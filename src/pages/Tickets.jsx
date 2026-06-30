import { motion } from "framer-motion";
import { useState, useMemo, useEffect } from "react";
import { Search, Plus, X, RotateCcw, Loader2, Radio, ShieldAlert, Link2, AlertTriangle, List, Columns3, LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "react-router-dom";
import { useLemmaRecords } from "@/hooks/useLemmaRecords";
import { emitRefresh, useRefreshListener } from "@/lib/refreshEvents";
import { calculateChurnRisk } from "@/lib/churnRisk";
import useRole from "@/hooks/useRole";
import StatusBadge from "@/components/common/StatusBadge";
import PriorityBadge from "@/components/common/PriorityBadge";
import TicketDrawer from "@/components/tickets/TicketDrawer";
import client from "@/lib/lemmaClient";
import { useWorkspace } from "@/context/WorkspaceContext";

const PRIORITY_RANK = { urgent: 4, high: 3, normal: 2, low: 1 };

const SORT_OPTIONS = [
  { value: "created_at-desc", label: "Created Date (Newest)" },
  { value: "created_at-asc", label: "Created Date (Oldest)" },
  { value: "priority-desc", label: "Priority (High-Low)" },
  { value: "priority-asc", label: "Priority (Low-High)" },
  { value: "status-desc", label: "Status (Z-A)" },
  { value: "status-asc", label: "Status (A-Z)" },
  { value: "customer_name-desc", label: "Customer Name (Z-A)" },
  { value: "customer_name-asc", label: "Customer Name (A-Z)" },
];

const EMPTY_FILTERS = { priority: "All", status: "All", category: "All", assignee: "All", dateFrom: "", dateTo: "" };

export default function Tickets() {
  const { workspace } = useWorkspace();
  const location = useLocation();
  const { data: tickets, loading, refresh } = useLemmaRecords("tickets", { limit: 200 });
  const { canCreateTickets } = useRole();
  useRefreshListener(refresh);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [churnFilter, setChurnFilter] = useState(null);
  const [sortField, setSortField] = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ subject: "", customer_name: "", customer_email: "", description: "", priority: "normal", category: "" });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const [view, setView] = useState("list");

  useEffect(() => {
    const state = location.state;
    if (state?.churnFilter === "at-risk") {
      setChurnFilter("at-risk");
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const filterOptions = useMemo(() => {
    const opts = { status: [], priority: [], category: [], assignee: [] };
    const seen = { status: {}, priority: {}, category: {}, assignee: {} };
    tickets.forEach((t) => {
      if (t.status && !seen.status[t.status]) { seen.status[t.status] = 1; opts.status.push(t.status); }
      if (t.priority && !seen.priority[t.priority]) { seen.priority[t.priority] = 1; opts.priority.push(t.priority); }
      if (t.category && !seen.category[t.category]) { seen.category[t.category] = 1; opts.category.push(t.category); }
    });
    return opts;
  }, [tickets]);

  const hasActiveFilters = Object.values(filters).some((v) => v !== "" && v !== "All") || churnFilter !== null;

  const filtered = useMemo(() => {
    let result = [...tickets];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((t) =>
        (t.title || "").toLowerCase().includes(q) ||
        (t.customer_name || "").toLowerCase().includes(q) ||
        (t.customer_email || "").toLowerCase().includes(q) ||
        (t.id || "").toLowerCase().includes(q)
      );
    }
    if (filters.priority !== "All") result = result.filter((t) => t.priority === filters.priority);
    if (filters.status !== "All") result = result.filter((t) => t.status === filters.status);
    if (filters.category !== "All") result = result.filter((t) => t.category === filters.category);
    if (filters.assignee !== "All") result = result.filter((t) => (t.assignee || t.assigned_to || "") === filters.assignee);
    if (churnFilter === "at-risk") {
      result = result.filter((t) => {
        const r = calculateChurnRisk(t);
        return r && !r.resolved && (r.riskLevel === "High" || r.riskLevel === "Critical");
      });
    }
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom).getTime();
      if (!isNaN(from)) result = result.filter((t) => new Date(t.created_at || 0).getTime() >= from);
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo + "T23:59:59").getTime();
      if (!isNaN(to)) result = result.filter((t) => new Date(t.created_at || 0).getTime() <= to);
    }
    result.sort((a, b) => {
      if (sortField === "priority") {
        const pa = PRIORITY_RANK[a.priority] || 0;
        const pb = PRIORITY_RANK[b.priority] || 0;
        return sortDir === "desc" ? pb - pa : pa - pb;
      }
      const va = a[sortField] || "";
      const vb = b[sortField] || "";
      return sortDir === "desc" ? String(vb).localeCompare(String(va)) : String(va).localeCompare(String(vb));
    });
    return result;
  }, [tickets, search, filters, sortField, sortDir, churnFilter]);

  useEffect(() => { setPage(1); }, [search, filters, sortField, sortDir, churnFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const handleCreate = async () => {
    const errors = {};
    if (!form.subject?.trim()) errors.subject = "Subject is required";
    if (!form.customer_name?.trim()) errors.customer_name = "Customer name is required";
    if (!form.customer_email?.trim()) errors.customer_email = "Customer email is required";
    else if (!/\S+@\S+\.\S+/.test(form.customer_email)) errors.customer_email = "Invalid email format";
    if (!form.description?.trim()) errors.description = "Description is required";
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const toastId = toast.loading("Creating ticket...");
    setSubmitting(true);
    try {
      const input = {
        title: form.subject,
        customer_name: form.customer_name,
        customer_email: form.customer_email,
        body: form.description,
        channel: "email",
      };
      if (form.priority) input.priority = form.priority;
      if (form.category) input.category = form.category;
      const result = await client.functions.run("create_ticket", { input });
      const ticketId = result.output_data?.ticket_id || result.ticket_id || result.id;
      toast.dismiss(toastId);
      toast.success("Ticket created successfully");
      setShowForm(false);
      setForm({ subject: "", customer_name: "", customer_email: "", description: "", priority: "normal", category: "" });
      setFormErrors({});
      refresh();
      client.functions.run("detect_and_link_signal", { input: { ticket_id: ticketId } })
        .then((res) => {
          const o = res?.output_data || {};
          if (o.incident_created) {
            toast.success(`Incident created: ${o.ticket_count} related tickets`, { icon: <ShieldAlert size={18} /> });
          } else if (o.signal_created) {
            toast.success(`New signal detected from ${o.ticket_count} tickets`, { icon: <Radio size={18} /> });
          } else if (o.ticket_linked) {
            toast.success(`Ticket linked to existing signal`, { icon: <Link2 size={18} /> });
          }
        })
        .catch(() => {})
        .finally(() => emitRefresh());
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(err?.message || "Failed to create ticket");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      className="flex flex-col min-h-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="sticky top-0 z-10 bg-white pb-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold tracking-tight">Tickets</h1>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-[#EFEFEF] overflow-hidden">
              <button onClick={() => setView("list")} className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${view === "list" ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-50"}`}>
                <List size={14} />
                List
              </button>
              <button onClick={() => setView("kanban")} className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${view === "kanban" ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-50"}`}>
                <Columns3 size={14} />
                Kanban
              </button>
            </div>
            {canCreateTickets && (
              <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition-colors">
                <Plus size={15} /> New Ticket
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-2.5 text-zinc-400" size={15} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tickets..."
              className="w-full rounded-lg border border-[#EFEFEF] bg-[#FAFAFA] py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-zinc-400"
            />
          </div>
          <select value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
            className="rounded-lg border border-[#EFEFEF] bg-white px-3 py-2 text-sm outline-none">
            <option value="All">All Priorities</option>
            {filterOptions.priority.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="rounded-lg border border-[#EFEFEF] bg-white px-3 py-2 text-sm outline-none">
            <option value="All">All Statuses</option>
            {filterOptions.status.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
          </select>
          <select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            className="rounded-lg border border-[#EFEFEF] bg-white px-3 py-2 text-sm outline-none">
            <option value="All">All Categories</option>
            {filterOptions.category.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={`${sortField}-${sortDir}`} onChange={(e) => {
            const [f, d] = e.target.value.split("-");
            setSortField(f); setSortDir(d);
          }} className="rounded-lg border border-[#EFEFEF] bg-white px-3 py-2 text-sm outline-none">
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            onClick={() => setChurnFilter(churnFilter === "at-risk" ? null : "at-risk")}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
              churnFilter === "at-risk"
                ? "border-red-200 bg-red-50 text-red-600"
                : "border-[#EFEFEF] bg-white text-zinc-500 hover:bg-zinc-50"
            }`}
          >
            <AlertTriangle size={14} /> At Risk
          </button>
          {hasActiveFilters && (
            <button onClick={() => { setFilters(EMPTY_FILTERS); setChurnFilter(null); }}
              className="flex items-center gap-1.5 rounded-lg border border-[#EFEFEF] bg-white px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-50 transition-colors">
              <RotateCcw size={14} /> Clear
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4,5].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-zinc-100" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 py-16">
          <TicketIcon className="mb-3 text-zinc-300" size={32} />
          <p className="text-zinc-400">{search ? "No tickets match your search." : "No tickets yet."}</p>
          {!search && canCreateTickets && (
            <button onClick={() => setShowForm(true)} className="mt-3 text-sm text-accent hover:opacity-80">
              Create your first ticket
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#EFEFEF]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-[#EFEFEF] text-left text-xs uppercase tracking-wide text-zinc-400">
                  <th className="px-5 py-3 font-medium">ID</th>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Title</th>
                  <th className="px-5 py-3 font-medium">Priority</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((t) => (
                  <tr key={t.id} onClick={() => setSelected(t)}
                    className="cursor-pointer border-b border-[#EFEFEF] transition-colors hover:bg-zinc-50 last:border-b-0">
                    <td className="px-5 py-3.5 text-sm font-mono text-zinc-400">SD-{String(filtered.indexOf(t) + 1).padStart(3, '0')}</td>
                    <td className="px-5 py-3.5 text-sm">{t.customer_name || t.customer_email || "-"}</td>
                    <td className="px-5 py-3.5 text-sm font-medium max-w-[300px] truncate">{t.title || "(no title)"}</td>
                    <td className="px-5 py-3.5"><PriorityBadge priority={t.priority} /></td>
                    <td className="px-5 py-3.5"><StatusBadge status={t.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-[#EFEFEF] px-5 py-3">
              <span className="text-sm text-zinc-400">
                {filtered.length} ticket{filtered.length !== 1 ? "s" : ""}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-lg border border-[#EFEFEF] bg-white px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >Prev</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button key={p} onClick={() => setPage(p)}
                    className={`rounded-lg px-3 py-1.5 text-sm ${
                      p === page
                        ? "bg-zinc-900 text-white"
                        : "border border-[#EFEFEF] bg-white text-zinc-500 hover:bg-zinc-50"
                    }`}>{p}</button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="rounded-lg border border-[#EFEFEF] bg-white px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {selected && <TicketDrawer ticket={selected} onClose={() => setSelected(null)} onRefresh={refresh} />}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-[#EFEFEF] bg-white p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold">New Ticket</h2>
              <button onClick={() => setShowForm(false)} className="text-zinc-400 hover:text-zinc-700"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">Subject *</label>
                <input value={form.subject} onChange={(e) => { setForm({ ...form, subject: e.target.value }); setFormErrors({ ...formErrors, subject: "" }); }}
                  className="w-full rounded-lg border border-[#EFEFEF] bg-white p-3 text-sm outline-none focus:border-zinc-400" />
                {formErrors.subject && <p className="mt-1 text-xs text-red-500">{formErrors.subject}</p>}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">Customer Name *</label>
                <input value={form.customer_name} onChange={(e) => { setForm({ ...form, customer_name: e.target.value }); setFormErrors({ ...formErrors, customer_name: "" }); }}
                  className="w-full rounded-lg border border-[#EFEFEF] bg-white p-3 text-sm outline-none focus:border-zinc-400" />
                {formErrors.customer_name && <p className="mt-1 text-xs text-red-500">{formErrors.customer_name}</p>}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">Customer Email *</label>
                <input value={form.customer_email} onChange={(e) => { setForm({ ...form, customer_email: e.target.value }); setFormErrors({ ...formErrors, customer_email: "" }); }}
                  className="w-full rounded-lg border border-[#EFEFEF] bg-white p-3 text-sm outline-none focus:border-zinc-400" />
                {formErrors.customer_email && <p className="mt-1 text-xs text-red-500">{formErrors.customer_email}</p>}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">Description *</label>
                <textarea rows={4} value={form.description} onChange={(e) => { setForm({ ...form, description: e.target.value }); setFormErrors({ ...formErrors, description: "" }); }}
                  className="w-full rounded-lg border border-[#EFEFEF] bg-white p-3 text-sm outline-none focus:border-zinc-400 resize-none" />
                {formErrors.description && <p className="mt-1 text-xs text-red-500">{formErrors.description}</p>}
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-zinc-500">Priority</label>
                  <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    className="w-full rounded-lg border border-[#EFEFEF] bg-white p-3 text-sm outline-none">
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-zinc-500">Category</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full rounded-lg border border-[#EFEFEF] bg-white p-3 text-sm outline-none">
                    <option value="">None</option>
                    {workspace.ticketCategories.map((cat) => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button onClick={handleCreate} disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors">
                {submitting ? <><Loader2 size={16} className="animate-spin" /> Creating...</> : "Create Ticket"}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function TicketIcon(props) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 9a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3Z"/><path d="M7 12h10"/></svg>; }
