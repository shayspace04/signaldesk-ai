import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, BookOpen, Lightbulb, FileText, Activity, ShieldAlert, ExternalLink, Hash, Clock, BarChart3 } from "lucide-react";
import { useLemmaRecords } from "@/hooks/useLemmaRecords";
import { useRefreshListener, emitRefresh } from "@/lib/refreshEvents";
import ConfidenceBadge from "@/components/common/ConfidenceBadge";
import { format } from "date-fns";
import { useWorkspace } from "@/context/WorkspaceContext";
import { workspaceFilter } from "@/lib/workspaceConfig";
import KnowledgeDrawer from "@/components/knowledge/KnowledgeDrawer";
import StatusBadge from "@/components/common/StatusBadge";

export default function Knowledge() {
  const { workspace } = useWorkspace();
  const memoryFilters = workspaceFilter(workspace.id);
  const { data: entries, loading, refresh } = useLemmaRecords("memory_entries", { limit: 200, filters: memoryFilters });
  const { data: allTickets } = useLemmaRecords("tickets", { limit: 500, filters: memoryFilters });
  const { data: allSignals } = useLemmaRecords("signals", { limit: 500, filters: memoryFilters });
  const { data: allIncidents } = useLemmaRecords("incidents", { limit: 200, filters: memoryFilters });
  useRefreshListener(refresh);
  const [search, setSearch] = useState("");
  const [selectedEntry, setSelectedEntry] = useState(null);

  const ticketMap = useMemo(() => {
    const m = {};
    (allTickets || []).forEach((t) => { m[t.id] = t; });
    return m;
  }, [allTickets]);

  const signalMap = useMemo(() => {
    const m = {};
    (allSignals || []).forEach((s) => { m[s.id] = s; });
    return m;
  }, [allSignals]);

  const incidentMap = useMemo(() => {
    const m = {};
    (allIncidents || []).forEach((i) => { m[i.id] = i; });
    return m;
  }, [allIncidents]);

  const filtered = useMemo(() => {
    if (!search) return entries;
    const q = search.toLowerCase();

    const matchesSearch = (entry) => {
      if ((entry.title || "").toLowerCase().includes(q) ||
          (entry.summary || "").toLowerCase().includes(q) ||
          (entry.body || "").toLowerCase().includes(q) ||
          (entry.root_cause || "").toLowerCase().includes(q) ||
          (entry.resolution || "").toLowerCase().includes(q) ||
          (entry.tags || []).some((t) => String(t).toLowerCase().includes(q)) ||
          (entry.category || "").toLowerCase().includes(q)) {
        return true;
      }

      if (entry.linear_issue_id && entry.linear_issue_id.toLowerCase().includes(q)) return true;

      if (entry.incident_id) {
        const inc = incidentMap[entry.incident_id];
        if (inc && (inc.title || "").toLowerCase().includes(q)) return true;
      }

      if (entry.signal_id) {
        const sig = signalMap[entry.signal_id];
        if (sig && (sig.name || sig.summary || "").toLowerCase().includes(q)) return true;
      }

      const tids = entry.ticket_ids || [];
      if (tids.some((tid) => {
        const t = ticketMap[tid];
        return t && ((t.title || "").toLowerCase().includes(q) || (t.customer_name || "").toLowerCase().includes(q) || (t.customer_email || "").toLowerCase().includes(q));
      })) return true;

      const sids = entry.signal_ids || [];
      if (sids.some((sid) => {
        const s = signalMap[sid];
        return s && (s.name || s.summary || "").toLowerCase().includes(q);
      })) return true;

      if (entry.incident_id) {
        const inc = incidentMap[entry.incident_id];
        if (inc && inc.linearIssueId && inc.linearIssueId.toLowerCase().includes(q)) return true;
      }

      return false;
    };

    return entries.filter(matchesSearch);
  }, [entries, search, ticketMap, signalMap, incidentMap]);

  return (
    <motion.div className="flex flex-col min-h-full" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      <div className="mb-6">
        <h1 className="text-[36px] font-bold tracking-tight text-primary">{workspace.knowledge.title}</h1>
        <p className="mt-1 text-sm text-muted dark:text-muted-dark">{workspace.knowledge.subtitle} · {entries.length} article{entries.length !== 1 ? "s" : ""}</p>
      </div>

      <div className="relative max-w-md mb-6">
        <Search className="absolute left-3 top-2.5 text-muted dark:text-muted-dark" size={16} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search knowledge by title, category, root cause..."
          className="w-full rounded-xl border border-border dark:border-border-dark bg-surface dark:bg-[#111113] py-2 pl-9 pr-3 text-sm outline-none transition-all duration-200 focus:border-zinc-300 dark:focus:border-[#2A2A2E] focus:ring-1 focus:ring-zinc-200 dark:focus:ring-zinc-600 placeholder:text-muted dark:text-muted-dark" />
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-44 animate-pulse rounded-xl bg-zinc-100 dark:bg-[#202024]" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 dark:border-[#2A2A2E] bg-zinc-50/50 py-20">
          <BookOpen size={36} className="mb-4 text-zinc-300 dark:text-zinc-500" />
          <p className="text-secondary-body font-medium">{search ? "No entries match your search" : "No knowledge entries yet"}</p>
          <p className="mt-1 text-sm text-muted dark:text-muted-dark">{search ? "Try a different search term." : "Knowledge entries appear when incidents are resolved."}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((entry) => (
            <motion.div key={entry.id} onClick={() => setSelectedEntry(entry)}
              whileHover={{ y: -2 }}
              className="rounded-xl border border-border dark:border-border-dark bg-card p-5 shadow-sm transition-all duration-200 hover:border-zinc-300 dark:hover:border-[#2A2A2E] hover:shadow-card cursor-pointer">
              <div className="flex items-start gap-3">
                <Lightbulb size={16} className="mt-0.5 text-amber-500 dark:text-amber-400 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-primary truncate">{entry.title || "Untitled"}</h3>
                  {entry.confidence != null && <div className="mt-1"><ConfidenceBadge value={entry.confidence} /></div>}
                </div>
              </div>
              {(entry.summary || entry.body) && <p className="mt-3 text-sm text-muted-base line-clamp-3">{entry.summary || entry.body}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-zinc-400 dark:text-zinc-500">
                {entry.category && <span className="rounded-md bg-zinc-100 dark:bg-[#202024] px-2 py-0.5 font-medium text-muted-base">{entry.category}</span>}
                {entry.reference_count > 0 && <span className="flex items-center gap-0.5"><Hash size={10} />{entry.reference_count}</span>}
                {entry.captured_at && <span className="flex items-center gap-0.5"><Clock size={10} />{format(new Date(entry.captured_at), "MMM d, yyyy")}</span>}
                {entry.incident_id && <ShieldAlert size={10} className="text-red-400 dark:text-red-300" />}
                {entry.linear_issue_id && <ExternalLink size={10} className="text-indigo-400 dark:text-indigo-300" />}
                {entry.root_cause && <span className="flex items-center gap-0.5"><FileText size={10} />Root cause</span>}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {selectedEntry && (
          <KnowledgeDrawer entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
