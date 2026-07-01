import { motion } from "framer-motion";
import { useState, useMemo, useEffect } from "react";
import { Search, Plus, X, RotateCcw, Loader2, Radio, ShieldAlert, Link2, AlertTriangle, List, Columns3, Table2, ChevronLeft, ChevronRight, ArrowUpDown, MoreHorizontal, MessageSquare, Paperclip, Eye } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "react-router-dom";
import { useLemmaRecords } from "@/hooks/useLemmaRecords";
import { useMetrics } from "@/hooks/useMetrics";
import { emitRefresh, useRefreshListener } from "@/lib/refreshEvents";
import { calculateChurnRisk } from "@/lib/churnRisk";
import useRole from "@/hooks/useRole";
import StatusBadge from "@/components/common/StatusBadge";
import PriorityBadge from "@/components/common/PriorityBadge";
import TicketDrawer from "@/components/tickets/TicketDrawer";
import client from "@/lib/lemmaClient";
import { useWorkspace } from "@/context/WorkspaceContext";
import { workspaceFilter } from "@/lib/workspaceConfig";
import { createNotification } from "@/lib/notifications";
import { runDetection as runAiDetection } from "@/lib/aiDetectionEngine";
import { format } from "date-fns";

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

const KANBAN_COLUMNS = [
  { id: "new", label: "New", color: "bg-blue-500" },
  { id: "in_review", label: "In Review", color: "bg-amber-500" },
  { id: "waiting", label: "Waiting", color: "bg-purple-500" },
  { id: "resolved", label: "Resolved", color: "bg-emerald-500" },
  { id: "closed", label: "Closed", color: "bg-zinc-400" },
];

const AVATARS = ["AL", "JR", "MK", "SP", "TC"];
const COMMENT_COUNTS = [0, 1, 2, 0, 3, 1, 0, 2, 4, 1];
const ATTACHMENT_COUNTS = [0, 2, 0, 1, 3, 0, 1, 2, 0, 1];

function ListCard({ ticket, onClick }) {
  return (
    <motion.div
      onClick={() => onClick(ticket)}
      whileHover={{ y: -1 }}
      className="group flex items-center gap-4 rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] dark:border-[#2A2A2E] dark:bg-[#18181B] p-4 shadow-sm transition-all duration-200 hover:border-zinc-300 dark:hover:border-[#2A2A2E] hover:shadow-card cursor-pointer dark:hover:border-[#2A2A2E]"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-mono text-muted dark:text-[#A1A1AA]">SD-{ticket.id.slice(-4)}</span>
          <PriorityBadge priority={ticket.priority} />
          <StatusBadge status={ticket.status} />
        </div>
        <p className="text-sm font-medium text-zinc-900 dark:text-[#FAFAFA] truncate dark:text-[#FAFAFA]">{ticket.title || ticket.customer_name || ticket.id}</p>
        <p className="text-xs text-muted dark:text-[#A1A1AA] mt-0.5">{ticket.customer_name || ticket.customer_email || ""}</p>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {ticket.category && (
          <span className="text-xs text-muted dark:text-[#A1A1AA] hidden sm:inline">{ticket.category}</span>
        )}
        {ticket.created_at && (
          <span className="text-xs text-muted dark:text-[#A1A1AA] hidden md:inline">{format(new Date(ticket.created_at), "MMM d")}</span>
        )}
        <div className="flex items-center gap-1.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-200 text-[9px] font-semibold text-zinc-600 dark:bg-[#27272A] dark:text-[#A1A1AA]">
            {AVATARS[Math.abs(ticket.id?.length || 0) % AVATARS.length]}
          </span>
        </div>
        <button className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted dark:text-[#A1A1AA] hover:text-zinc-700 dark:hover:text-[#FAFAFA] hover:bg-zinc-100 dark:hover:bg-[#27272A] transition-all">
          <Eye size={14} />
        </button>
      </div>
    </motion.div>
  );
}

function KanbanCard({ ticket, columnId, onMove }) {
  const progress = useMemo(() => {
    if (columnId === "closed" || columnId === "resolved") return 100;
    if (columnId === "in_review") return 60;
    if (columnId === "waiting") return 40;
    return 20;
  }, [columnId]);

  const commentCount = COMMENT_COUNTS[Math.abs(ticket.id?.length || 0) % COMMENT_COUNTS.length];
  const attachmentCount = ATTACHMENT_COUNTS[Math.abs(ticket.id?.length || 0) % ATTACHMENT_COUNTS.length];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="group rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] dark:border-[#2A2A2E] dark:bg-[#18181B] p-4 shadow-sm transition-all duration-200 hover:border-zinc-300 dark:hover:border-[#2A2A2E] hover:shadow-card"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex flex-wrap gap-1.5">
          <PriorityBadge priority={ticket.priority} />
          {ticket.category && (
            <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-[#202024] dark:text-[#A1A1AA]">
              {ticket.category}
            </span>
          )}
        </div>
        <button className="flex-shrink-0 rounded p-1 text-muted dark:text-[#A1A1AA] opacity-0 group-hover:opacity-100 hover:bg-zinc-100 dark:hover:bg-[#27272A] transition-all">
          <MoreHorizontal size={14} />
        </button>
      </div>
      <p className="text-sm font-semibold text-zinc-900 dark:text-[#FAFAFA] leading-snug line-clamp-2 mb-2">
        {ticket.title || ticket.customer_name || ticket.id}
      </p>
      <p className="text-xs text-muted dark:text-[#A1A1AA] mb-3">{ticket.customer_name || ticket.customer_email || ""}</p>
      <div className="mb-3">
        <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-[#202024]">
          <div className="h-1.5 rounded-full bg-zinc-900 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-200 text-[8px] font-semibold text-zinc-600 dark:bg-[#27272A] dark:text-[#A1A1AA]">
          {AVATARS[Math.abs(ticket.id?.length || 0) % AVATARS.length]}
        </span>
        <div className="flex items-center gap-3">
          {attachmentCount > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-muted dark:text-[#A1A1AA]">
              <Paperclip size={11} />{attachmentCount}
            </span>
          )}
          {commentCount > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-muted dark:text-[#A1A1AA]">
              <MessageSquare size={11} />{commentCount}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function TicketIcon(props) {
  return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 9a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3Z"/><path d="M7 12h10"/></svg>;
}

export default function Tickets() {
  const { workspace } = useWorkspace();
  const location = useLocation();
  const m = useMetrics(workspace.id);
  const ticketFilters = workspaceFilter(workspace.id);
  const { data: tickets, loading, refresh } = useLemmaRecords("tickets", { limit: 10000, filters: ticketFilters });
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
  const [tableSort, setTableSort] = useState({ field: "created_at", dir: "desc" });

  useEffect(() => {
    const state = location.state;
    if (state?.churnFilter === "at-risk") {
      setChurnFilter("at-risk");
    }
    if (state?.focusTicketId && tickets.length > 0) {
      const found = tickets.find((t) => t.id === state.focusTicketId);
      if (found) setSelected(found);
    }
  }, [location.key, tickets]);

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

  const kanbanColumns = useMemo(() => {
    const statusMap = {
      new: ["new"],
      in_review: ["in_review", "triaged", "pending"],
      waiting: ["waiting", "escalated"],
      resolved: ["resolved"],
      closed: ["closed"],
    };
    return KANBAN_COLUMNS.map((col) => ({
      ...col,
      cards: filtered.filter((t) => (statusMap[col.id] || [col.id]).includes(t.status)),
    }));
  }, [filtered]);

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
      if (ticketId && workspace.id && workspace.id !== "signaldesk") {
        await client.records.update("tickets", ticketId, { workspaceId: workspace.id, workspaceName: workspace.name });
      }
      if (ticketId) {
        await createNotification({ action: "ticket.created", actor: workspace.name, resourceType: "ticket", resourceId: ticketId, details: { name: form.subject, priority: form.priority }, workspaceId: workspace.id, workspaceName: workspace.name });
      }
      toast.dismiss(toastId);
      toast.success("Ticket created successfully");
      setShowForm(false);
      setForm({ subject: "", customer_name: "", customer_email: "", description: "", priority: "normal", category: "" });
      setFormErrors({});
      refresh();
      /* Run AI detection asynchronously — no user action required */
      runAiDetection(ticketId, workspace.id, workspace.name).then((res) => {
        if (res.signal_created) {
          toast.success(`Signal auto-created from ${res.cluster?.ticket_count || 0} tickets`, { icon: <Radio size={18} /> });
        } else if (res.ticket_linked) {
          toast.success(`Ticket linked to existing signal`, { icon: <Link2 size={18} /> });
        }
        if (res.incident_created) {
          toast.success(`Incident auto-created: ${res.cluster?.ticket_count || 0} related tickets`, { icon: <ShieldAlert size={18} /> });
        }
        if (res.logs?.length > 0) {
          console.log("[AI Detection Logs]", res.logs.join(" → "));
        }
      });
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(err?.message || "Failed to create ticket");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTableSort = (field) => {
    setTableSort((prev) => ({
      field,
      dir: prev.field === field && prev.dir === "asc" ? "desc" : "asc",
    }));
  };

  const sortedForTable = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const field = tableSort.field;
      if (field === "priority") {
        const pa = PRIORITY_RANK[a.priority] || 0;
        const pb = PRIORITY_RANK[b.priority] || 0;
        return tableSort.dir === "desc" ? pb - pa : pa - pb;
      }
      const va = a[field] || "";
      const vb = b[field] || "";
      return tableSort.dir === "desc" ? String(vb).localeCompare(String(va)) : String(va).localeCompare(String(vb));
    });
  }, [filtered, tableSort]);

  const SortHeader = ({ field, label, className }) => (
    <th
      className={`px-4 py-3.5 text-left text-xs font-medium text-muted dark:text-[#A1A1AA] uppercase tracking-wider cursor-pointer hover:text-zinc-700 dark:hover:text-[#FAFAFA] transition-colors select-none ${className || ""}`}
      onClick={() => handleTableSort(field)}
    >
      <div className="flex items-center gap-1.5">
        {label}
        {tableSort.field === field && (
          <ArrowUpDown size={11} className={tableSort.dir === "asc" ? "rotate-180" : ""} />
        )}
      </div>
    </th>
  );

  const totalKanbanCount = kanbanColumns.reduce((sum, col) => sum + col.cards.length, 0);

  return (
    <motion.div
      className="flex flex-col min-h-full"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[36px] font-bold tracking-tight text-zinc-900 dark:text-[#FAFAFA]">Tickets</h1>
          <p className="mt-1 text-sm text-muted dark:text-[#A1A1AA]">
            {hasActiveFilters || search
              ? `${filtered.length} of ${m.tickets.total} ticket${m.tickets.total !== 1 ? "s" : ""}`
              : `${m.tickets.total} ticket${m.tickets.total !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-xl border border-border dark:border-[#2A2A2E] overflow-hidden shadow-sm">
            <button
              onClick={() => setView("list")}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium transition-all duration-150 ${
                view === "list" ? "bg-zinc-900 text-white" : "text-zinc-500 dark:text-[#A1A1AA] hover:bg-zinc-50 dark:hover:bg-[#27272A] hover:text-zinc-700 dark:hover:text-[#FAFAFA]"
              }`}
            >
              <List size={14} /> List
            </button>
            <div className="w-px h-4 bg-border dark:bg-[#2A2A2E]" />
            <button
              onClick={() => setView("table")}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium transition-all duration-150 ${
                view === "table" ? "bg-zinc-900 text-white" : "text-zinc-500 dark:text-[#A1A1AA] hover:bg-zinc-50 dark:hover:bg-[#27272A] hover:text-zinc-700 dark:hover:text-[#FAFAFA]"
              }`}
            >
              <Table2 size={14} /> Table
            </button>
            <div className="w-px h-4 bg-border dark:bg-[#2A2A2E]" />
            <button
              onClick={() => setView("kanban")}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium transition-all duration-150 ${
                view === "kanban" ? "bg-zinc-900 text-white" : "text-zinc-500 dark:text-[#A1A1AA] hover:bg-zinc-50 dark:hover:bg-[#27272A] hover:text-zinc-700 dark:hover:text-[#FAFAFA]"
              }`}
            >
              <Columns3 size={14} /> Kanban
            </button>
          </div>
          {canCreateTickets && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition-all duration-200 shadow-sm"
            >
              <Plus size={15} /> New Ticket
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-2.5 text-muted dark:text-[#A1A1AA]" size={15} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets..."
            className="w-full rounded-xl border border-border dark:border-[#2A2A2E] bg-surface dark:bg-[#111113] py-2 pl-9 pr-3 text-sm outline-none transition-all duration-200 focus:border-zinc-300 dark:focus:border-[#2A2A2E] focus:ring-1 focus:ring-zinc-200 dark:focus:ring-zinc-600 placeholder:text-muted dark:text-[#A1A1AA] dark:border-[#2A2A2E] dark:bg-[#111113] dark:focus:border-zinc-600 dark:focus:ring-zinc-600 dark:placeholder:text-[#71717A]"
          />
        </div>
        <select value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
          className="rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] dark:border-[#2A2A2E] dark:bg-[#18181B] px-3 py-2 text-sm text-zinc-700 dark:text-[#FAFAFA] outline-none dark:text-[#FAFAFA] hover:border-zinc-300 dark:hover:border-[#2A2A2E] transition-colors">
          <option value="All">All Priorities</option>
          {filterOptions.priority.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          className="rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] dark:border-[#2A2A2E] dark:bg-[#18181B] px-3 py-2 text-sm text-zinc-700 dark:text-[#FAFAFA] outline-none dark:text-[#FAFAFA] hover:border-zinc-300 dark:hover:border-[#2A2A2E] transition-colors">
          <option value="All">All Statuses</option>
          {filterOptions.status.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
        <select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}
          className="rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] dark:border-[#2A2A2E] dark:bg-[#18181B] px-3 py-2 text-sm text-zinc-700 dark:text-[#FAFAFA] outline-none dark:text-[#FAFAFA] hover:border-zinc-300 dark:hover:border-[#2A2A2E] transition-colors">
          <option value="All">All Categories</option>
          {filterOptions.category.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={`${sortField}-${sortDir}`} onChange={(e) => {
          const [f, d] = e.target.value.split("-");
          setSortField(f); setSortDir(d);
        }} className="rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] dark:border-[#2A2A2E] dark:bg-[#18181B] px-3 py-2 text-sm text-zinc-700 dark:text-[#FAFAFA] outline-none dark:text-[#FAFAFA] hover:border-zinc-300 dark:hover:border-[#2A2A2E] transition-colors">
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <button
          onClick={() => setChurnFilter(churnFilter === "at-risk" ? null : "at-risk")}
          className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm transition-all duration-200 ${
            churnFilter === "at-risk"
              ? "border-red-200 bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800"
              : "border-border dark:border-[#2A2A2E] bg-white dark:border-[#2A2A2E] dark:bg-[#18181B] text-zinc-500 dark:text-[#A1A1AA] hover:bg-zinc-50 dark:hover:bg-[#27272A] hover:border-zinc-300 dark:hover:border-[#2A2A2E]"
          }`}
        >
          <AlertTriangle size={14} /> At Risk
        </button>
        {hasActiveFilters && (
          <button onClick={() => { setFilters(EMPTY_FILTERS); setChurnFilter(null); }}
            className="flex items-center gap-1.5 rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] dark:border-[#2A2A2E] dark:bg-[#18181B] px-3 py-2 text-sm text-zinc-500 dark:text-[#A1A1AA] hover:bg-zinc-50 dark:hover:bg-[#27272A] hover:border-zinc-300 dark:hover:border-[#2A2A2E] transition-all duration-200">
            <RotateCcw size={14} /> Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4,5].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-zinc-100 dark:bg-[#202024]" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 dark:border-[#2A2A2E]  bg-zinc-50/50 py-20 dark:border-[#2A2A2E] dark:bg-[#202024]/50">
          <TicketIcon className="mb-4 text-zinc-300 dark:text-[#71717A]" size={36} />
          <p className="text-zinc-600 dark:text-[#A1A1AA] font-medium dark:text-[#A1A1AA]">{search ? "No tickets match your search." : "No tickets yet."}</p>
          {!search && canCreateTickets && (
            <button onClick={() => setShowForm(true)} className="mt-3 text-sm font-medium text-zinc-900 dark:text-[#FAFAFA] hover:opacity-80 transition-opacity">
              Create your first ticket
            </button>
          )}
        </div>
      ) : (
        <>
          {view === "list" && (
            <div className="space-y-3">
              {paginated.map((t) => (
                <ListCard key={t.id} ticket={t} onClick={setSelected} />
              ))}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <span className="text-sm text-muted dark:text-[#A1A1AA]">
                    Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, filtered.length)} of {filtered.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="flex items-center gap-1 rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] dark:border-[#2A2A2E] dark:bg-[#18181B] px-3 py-2 text-sm text-zinc-500 dark:text-[#A1A1AA] hover:bg-zinc-50 dark:hover:bg-[#27272A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft size={14} /> Prev
                    </button>
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((p) => (
                      <button key={p} onClick={() => setPage(p)}
                        className={`rounded-xl px-3.5 py-2 text-sm font-medium transition-all ${
                          p === page
                            ? "bg-zinc-900 text-white shadow-sm"
                            : "border border-border dark:border-[#2A2A2E] bg-white dark:border-[#2A2A2E] dark:bg-[#18181B] text-zinc-500 dark:text-[#A1A1AA] hover:bg-zinc-50 dark:hover:bg-[#27272A]"
                        }`}>{p}</button>
                    ))}
                    {totalPages > 7 && <span className="px-2 text-muted dark:text-[#A1A1AA] text-sm">...</span>}
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="flex items-center gap-1 rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] dark:border-[#2A2A2E] dark:bg-[#18181B] px-3 py-2 text-sm text-zinc-500 dark:text-[#A1A1AA] hover:bg-zinc-50 dark:hover:bg-[#27272A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Next <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {view === "table" && (
            <div className="overflow-hidden rounded-xl border border-border dark:border-[#2A2A2E] shadow-sm dark:border-[#2A2A2E]">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px]">
                  <thead className="bg-zinc-50 dark:bg-[#111113]">
                    <tr className="border-b border-border dark:border-[#2A2A2E]">
                      <th className="px-4 py-3.5 text-left text-xs font-medium text-muted dark:text-[#A1A1AA] uppercase tracking-wider w-10">
                        <input type="checkbox" className="rounded border-border dark:border-[#2A2A2E]" />
                      </th>
                      <SortHeader field="id" label="ID" />
                      <SortHeader field="customer_name" label="Customer" />
                      <SortHeader field="title" label="Subject" />
                      <SortHeader field="category" label="Category" />
                      <SortHeader field="priority" label="Priority" />
                      <SortHeader field="status" label="Status" />
                      <SortHeader field="created_at" label="Created" />
                      <SortHeader field="updated_at" label="Updated" />
                      <th className="px-4 py-3.5 text-left text-xs font-medium text-muted dark:text-[#A1A1AA] uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border dark:divide-[#2A2A2E]">
                    {sortedForTable.slice(0, 50).map((t) => (
                      <tr
                        key={t.id}
                        onClick={() => setSelected(t)}
                        className="group cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-[#27272A]"
                      >
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" className="rounded border-border dark:border-[#2A2A2E]" />
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-muted dark:text-[#A1A1AA]">
                          SD-{String(Math.abs(t.id?.hashCode?.() || 0) % 999).padStart(3, "0")}
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-900 dark:text-[#FAFAFA]">{t.customer_name || t.customer_email || "-"}</td>
                        <td className="px-4 py-3 text-sm font-medium text-zinc-900 dark:text-[#FAFAFA] max-w-[250px] truncate">
                          {t.title || "(no title)"}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted dark:text-[#A1A1AA]">{t.category || "-"}</td>
                        <td className="px-4 py-3"><PriorityBadge priority={t.priority} /></td>
                        <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                        <td className="px-4 py-3 text-sm text-muted dark:text-[#A1A1AA]">
                          {t.created_at ? format(new Date(t.created_at), "MMM d") : "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted dark:text-[#A1A1AA]">
                          {t.updated_at ? format(new Date(t.updated_at), "MMM d") : "-"}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelected(t); }}
                            className="opacity-0 group-hover:opacity-100 rounded-lg border border-border dark:border-[#2A2A2E] px-2.5 py-1 text-xs text-muted dark:text-[#A1A1AA] hover:bg-zinc-100 dark:hover:bg-[#27272A] transition-all dark:border-[#2A2A2E]"
                          >
                            Open
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {view === "kanban" && (
            <div className="flex-1 min-h-0 overflow-x-auto pb-4">
              <div className="flex gap-5 min-w-max" style={{ height: "calc(100vh - 320px)" }}>
                {kanbanColumns.map((col) => (
                  <div key={col.id} className="flex flex-col flex-1 min-w-[280px] max-w-[320px]">
                    <div className="flex items-center justify-between mb-4 px-1">
                      <div className="flex items-center gap-2">
                        <div className={`h-2.5 w-2.5 rounded-full ${col.color}`} />
                        <h3 className="text-sm font-semibold text-zinc-800 dark:text-[#FAFAFA]">{col.label}</h3>
                        <span className="text-xs font-medium text-muted dark:text-[#A1A1AA] bg-zinc-100 rounded-full px-2 py-0.5 dark:bg-[#202024]">{col.cards.length}</span>
                      </div>
                      <button className="text-muted dark:text-[#A1A1AA] hover:text-zinc-700 dark:hover:text-[#FAFAFA] p-1 rounded hover:bg-zinc-100 dark:hover:bg-[#27272A] transition-all">
                        <MoreHorizontal size={14} />
                      </button>
                    </div>
                    <div className="flex-1 space-y-3 overflow-y-auto min-h-[200px] rounded-xl bg-zinc-50/50 p-3 border border-dashed border-zinc-200 dark:border-[#2A2A2E] dark:bg-[#202024]/50 dark:border-[#2A2A2E]">
                      {col.cards.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                          <p className="text-sm text-muted dark:text-[#A1A1AA]">No tickets</p>
                        </div>
                      ) : (
                        col.cards.map((t) => (
                          <div key={t.id} onClick={() => setSelected(t)}>
                            <KanbanCard ticket={t} columnId={col.id} />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {selected && <TicketDrawer ticket={selected} onClose={() => setSelected(null)} onRefresh={refresh} />}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm dark:bg-black/60">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] dark:border-[#2A2A2E] dark:bg-[#18181B] p-6 shadow-modal">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-[#FAFAFA]">New Ticket</h2>
              <button onClick={() => setShowForm(false)} className="rounded-lg p-1.5 text-muted dark:text-[#A1A1AA] hover:text-zinc-700 dark:hover:text-[#FAFAFA] hover:bg-zinc-100 dark:hover:bg-[#27272A] transition-all">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-[#FAFAFA]">Subject *</label>
                <input value={form.subject} onChange={(e) => { setForm({ ...form, subject: e.target.value }); setFormErrors({ ...formErrors, subject: "" }); }}
                  className="w-full rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] dark:border-[#2A2A2E] dark:bg-[#18181B] p-3 text-sm outline-none transition-all focus:border-zinc-300 dark:focus:border-[#2A2A2E] focus:ring-1 focus:ring-zinc-200 dark:focus:ring-zinc-600 dark:focus:border-zinc-600 dark:focus:ring-zinc-600" />
                {formErrors.subject && <p className="mt-1 text-xs text-red-500">{formErrors.subject}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-[#FAFAFA]">Customer Name *</label>
                  <input value={form.customer_name} onChange={(e) => { setForm({ ...form, customer_name: e.target.value }); setFormErrors({ ...formErrors, customer_name: "" }); }}
                    className="w-full rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] dark:border-[#2A2A2E] dark:bg-[#18181B] p-3 text-sm outline-none transition-all focus:border-zinc-300 dark:focus:border-[#2A2A2E] focus:ring-1 focus:ring-zinc-200 dark:focus:ring-zinc-600 dark:focus:border-zinc-600 dark:focus:ring-zinc-600" />
                  {formErrors.customer_name && <p className="mt-1 text-xs text-red-500">{formErrors.customer_name}</p>}
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-[#FAFAFA]">Customer Email *</label>
                  <input value={form.customer_email} onChange={(e) => { setForm({ ...form, customer_email: e.target.value }); setFormErrors({ ...formErrors, customer_email: "" }); }}
                    className="w-full rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] dark:border-[#2A2A2E] dark:bg-[#18181B] p-3 text-sm outline-none transition-all focus:border-zinc-300 dark:focus:border-[#2A2A2E] focus:ring-1 focus:ring-zinc-200 dark:focus:ring-zinc-600 dark:focus:border-zinc-600 dark:focus:ring-zinc-600" />
                  {formErrors.customer_email && <p className="mt-1 text-xs text-red-500">{formErrors.customer_email}</p>}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-[#FAFAFA]">Description *</label>
                <textarea rows={4} value={form.description} onChange={(e) => { setForm({ ...form, description: e.target.value }); setFormErrors({ ...formErrors, description: "" }); }}
                  className="w-full rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] dark:border-[#2A2A2E] dark:bg-[#18181B] p-3 text-sm text-zinc-900 dark:text-[#FAFAFA] outline-none transition-all focus:border-zinc-300 dark:focus:border-[#2A2A2E] focus:ring-1 focus:ring-zinc-200 dark:focus:ring-zinc-600 dark:text-[#FAFAFA] dark:focus:border-zinc-600 dark:focus:ring-zinc-600 resize-none" />
                {formErrors.description && <p className="mt-1 text-xs text-red-500">{formErrors.description}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-[#FAFAFA]">Priority</label>
                  <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    className="w-full rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] dark:border-[#2A2A2E] dark:bg-[#18181B] p-3 text-sm text-zinc-900 dark:text-[#FAFAFA] outline-none transition-all focus:border-zinc-300 dark:focus:border-zinc-600 dark:text-[#FAFAFA]">
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-[#FAFAFA]">Category</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] dark:border-[#2A2A2E] dark:bg-[#18181B] p-3 text-sm text-zinc-900 dark:text-[#FAFAFA] outline-none transition-all focus:border-zinc-300 dark:focus:border-zinc-600 dark:text-[#FAFAFA]">
                    <option value="">None</option>
                    {workspace.ticketCategories.map((cat) => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleCreate} disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-zinc-900 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 transition-all duration-200">
                  {submitting ? <><Loader2 size={16} className="animate-spin" /> Creating...</> : "Create Ticket"}
                </button>
                <button onClick={() => setShowForm(false)}
                  className="rounded-xl border border-border dark:border-[#2A2A2E] px-6 py-3 text-sm font-medium text-zinc-600 dark:text-[#A1A1AA] hover:bg-zinc-50 dark:hover:bg-[#27272A] transition-all duration-200 dark:border-[#2A2A2E] dark:text-[#A1A1AA]">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
