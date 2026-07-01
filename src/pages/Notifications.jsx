import { motion } from "framer-motion";
import { useState, useMemo } from "react";
import { Bell, CheckCircle2, XCircle, Ticket, Radio, ShieldAlert, Mail, Brain, AlertTriangle, Clock, ExternalLink, Link2, UserCheck, RefreshCw, Search, Trash2, ArrowRight, Eye, EyeOff } from "lucide-react";
import { useMetrics } from "@/hooks/useMetrics";
import { useWorkspace } from "@/context/WorkspaceContext";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { getActionMeta, getEntityRoute, clearRead, getReadIds } from "@/lib/notifications";

const PRIORITY_STYLES = {
  high: "border-l-2 border-l-red-400 bg-red-50/30 dark:bg-red-950/10",
  medium: "border-l-2 border-l-amber-400 bg-amber-50/30 dark:bg-amber-950/10",
  low: "",
};

const PRIORITY_DOT = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-zinc-300 dark:bg-zinc-600",
};

const ICON_MAP = {
  Bell, CheckCircle2, XCircle, Ticket, Radio, ShieldAlert, Mail, Brain,
  AlertTriangle, Clock, ExternalLink, Link2, UserCheck, RefreshCw, Eye, EyeOff,
};

export default function Notifications() {
  const { workspace } = useWorkspace();
  const m = useMetrics(workspace.id);
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [readIds, setReadIds] = useState(() => getReadIds());

  const persistReadIds = (next) => {
    setReadIds(next);
    try { localStorage.setItem("signaldesk-read-notifs", JSON.stringify([...next])); } catch {}
  };

  const visible = useMemo(() => (m.audit.logs || []).filter((n) => n && n.id), [m.audit.logs]);

  const unread = useMemo(() => visible.filter((n) => !readIds.has(n.id)), [visible, readIds]);

  const filtered = useMemo(() => {
    let items = filter === "unread" ? unread : visible;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter((n) =>
        (getActionMeta(n.action).label || "").toLowerCase().includes(q) ||
        (n.action || "").toLowerCase().includes(q) ||
        (n.actor_agent_name || "").toLowerCase().includes(q) ||
        (n.details?.name || n.details?.title || "").toLowerCase().includes(q)
      );
    }
    return items;
  }, [visible, unread, filter, searchQuery]);

  const handleMarkAllRead = () => {
    const allIds = visible.map((n) => n.id);
    persistReadIds(new Set([...readIds, ...allIds]));
    window.dispatchEvent(new CustomEvent("signaldesk:refresh"));
  };

  const handleClearRead = () => {
    try { localStorage.setItem("signaldesk-read-notifs", "[]"); } catch {}
    setReadIds(new Set());
    window.dispatchEvent(new CustomEvent("signaldesk:refresh"));
  };

  const toggleRead = (id, e) => {
    if (e) e.stopPropagation();
    const next = new Set(readIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    persistReadIds(next);
    window.dispatchEvent(new CustomEvent("signaldesk:refresh"));
  };

  const handleNavigate = (item) => {
    const route = getEntityRoute(item);
    if (route) {
      toggleRead(item.id);
      navigate(route.path, route.state ? { state: route.state } : undefined);
    } else {
      toggleRead(item.id);
    }
  };

  const hasReadEntries = readIds.size > 0;

  return (
    <motion.div className="flex flex-col min-h-full" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      <div className="mb-6">
        <h1 className="text-[36px] font-bold tracking-tight text-zinc-900 dark:text-[#FAFAFA]">Notifications</h1>
        <p className="mt-1 text-sm text-muted dark:text-[#A1A1AA]">{unread.length} unread of {visible.length} total</p>
      </div>

      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted dark:text-[#A1A1AA]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notifications..."
            className="w-full rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] py-2 pl-9 pr-3 text-sm outline-none transition-all focus:border-zinc-300 dark:focus:border-[#2A2A2E] focus:ring-1 focus:ring-zinc-200 dark:focus:ring-zinc-600 placeholder:text-muted dark:placeholder:text-[#A1A1AA] text-zinc-900 dark:text-[#FAFAFA]"
          />
        </div>
        <div className="flex rounded-xl border border-border dark:border-[#2A2A2E] overflow-hidden">
          <button onClick={() => setFilter("all")}
            className={`px-3 py-2 text-xs font-medium transition-colors ${filter === "all" ? "bg-zinc-900 text-white" : "text-zinc-500 dark:text-[#A1A1AA] hover:bg-zinc-50 dark:hover:bg-[#27272A]"}`}>All</button>
          <div className="w-px bg-border dark:bg-[#2A2A2E]" />
          <button onClick={() => setFilter("unread")}
            className={`px-3 py-2 text-xs font-medium transition-colors ${filter === "unread" ? "bg-zinc-900 text-white" : "text-zinc-500 dark:text-[#A1A1AA] hover:bg-zinc-50 dark:hover:bg-[#27272A]"}`}>Unread</button>
        </div>
        {unread.length > 0 && (
          <button onClick={handleMarkAllRead} className="rounded-xl border border-border dark:border-[#2A2A2E] px-3 py-2 text-xs font-medium text-accent hover:bg-zinc-50 dark:hover:bg-[#27272A] transition-colors">
            Mark all read
          </button>
        )}
        {hasReadEntries && (
          <button onClick={handleClearRead} className="rounded-xl border border-border dark:border-[#2A2A2E] px-3 py-2 text-xs font-medium text-zinc-500 hover:bg-zinc-50 dark:hover:bg-[#27272A] transition-colors">
            Clear read
          </button>
        )}
      </div>

      {m.loading ? (
        <div className="space-y-2">{[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-zinc-100 dark:bg-[#202024]" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 dark:border-[#2A2A2E] bg-zinc-50/50 dark:bg-transparent py-20">
          <Bell size={36} className="mb-4 text-zinc-300 dark:text-[#71717A]" />
          <p className="text-base font-medium text-zinc-600 dark:text-[#A1A1AA]">No notifications</p>
          <p className="mt-1 text-sm text-muted dark:text-[#A1A1AA]">{searchQuery ? "Try a different search." : "You're all caught up!"}</p>
        </div>
      ) : (
        <div className="space-y-1" onMouseDown={() => {}}>
          {filtered.map((item) => {
            const meta = getActionMeta(item.action);
            const Icon = ICON_MAP[meta.icon] || Bell;
            const isRead = readIds.has(item.id);
            const priority = item.details?.priority || meta.priority;
            const route = getEntityRoute(item);
            return (
              <div
                key={item.id}
                onClick={() => handleNavigate(item)}
                className={`flex items-start gap-4 rounded-xl border px-4 py-3.5 transition-all duration-200 cursor-pointer ${
                  isRead
                    ? "border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] hover:bg-zinc-50 dark:hover:bg-[#27272A]"
                    : "border-zinc-200 dark:border-[#2A2A2E] bg-zinc-50/50 dark:bg-[#202024]/50 hover:bg-zinc-100/50 dark:hover:bg-[#27272A]/50"
                } ${PRIORITY_STYLES[priority] || ""}`}
              >
                {!isRead ? (
                  <div className="mt-2 flex flex-col items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-accent flex-shrink-0" />
                    <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${PRIORITY_DOT[priority] || PRIORITY_DOT.low}`} />
                  </div>
                ) : (
                  <span className="mt-2 h-2 w-2 flex-shrink-0" />
                )}
                <div className={`rounded-lg p-2 flex-shrink-0 ${meta.bg}`}>
                  <Icon size={15} className={meta.color} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className={`text-sm truncate ${isRead ? "text-zinc-600 dark:text-[#A1A1AA]" : "font-medium text-zinc-900 dark:text-[#FAFAFA]"}`}>
                      {meta.label}
                    </h3>
                    <span className="flex-shrink-0 text-[10px] text-zinc-400 dark:text-[#71717A]">
                      {item.created_at ? formatDistanceToNow(new Date(item.created_at), { addSuffix: true }) : ""}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-[#A1A1AA] truncate">
                    {item.actor_agent_name || "System"}{item.details?.name ? ` · ${item.details.name}` : ""}{item.details?.title ? ` · ${item.details.title}` : ""}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    {route && (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-accent hover:opacity-80">
                        View details <ArrowRight size={10} />
                      </span>
                    )}
                    {priority === "high" && (
                      <span className="flex items-center gap-1 text-[10px] font-medium text-red-500">
                        <AlertTriangle size={10} /> High priority
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => toggleRead(item.id, e)}
                  className="rounded-lg p-1.5 text-zinc-400 dark:text-[#71717A] hover:bg-zinc-100 dark:hover:bg-[#202024] hover:text-accent transition-colors flex-shrink-0"
                  title={isRead ? "Mark as unread" : "Mark as read"}
                >
                  {isRead ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
