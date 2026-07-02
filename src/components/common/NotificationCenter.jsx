import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell, CheckCircle2, Brain, Ticket, Radio, ShieldAlert, ArrowRight,
} from "lucide-react";
import { useLemmaRecords } from "@/hooks/useLemmaRecords";
import { useRefreshListener } from "@/lib/refreshEvents";
import { formatDistanceToNow } from "date-fns";
import { useWorkspace } from "@/context/WorkspaceContext";

const SEVERITY_COLORS = {
  urgent: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
  high: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
  normal: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  low: "bg-zinc-100 dark:bg-zinc-900/30 text-muted-base dark:text-muted-dark",
};

function actionMeta(action) {
  if (!action) return { icon: Bell, color: "text-muted dark:text-muted-dark" };
  const a = action.toLowerCase();
  if (a.includes("incident") || a.includes("notification")) return { icon: ShieldAlert, color: "text-red-500 dark:text-red-400" };
  if (a.includes("signal")) return { icon: Radio, color: "text-accent" };
  if (a.includes("ticket")) return { icon: Ticket, color: "text-blue-500 dark:text-blue-400" };
  if (a.includes("draft") || a.includes("approv")) return { icon: CheckCircle2, color: "text-green-500 dark:text-green-400" };
  if (a.includes("agent") || a.includes("triage") || a.includes("reply")) return { icon: Brain, color: "text-accent" };
  return { icon: Bell, color: "text-muted dark:text-muted-dark" };
}

export default function NotificationCenter() {
  const { workspace } = useWorkspace();
  const { data: logs, refresh } = useLemmaRecords("audit_logs", { sort: [{ field: "created_at", direction: "desc" }], limit: 20 });
  useRefreshListener(refresh);
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("signaldesk-read-notifs") || "[]")); }
    catch { return new Set(); }
  });
  const navigate = useNavigate();

  const notifications = logs.slice(0, 10);
  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  const markAllRead = () => {
    const allIds = notifications.map((n) => n.id);
    const next = new Set([...readIds, ...allIds]);
    setReadIds(next);
    try { localStorage.setItem("signaldesk-read-notifs", JSON.stringify([...next])); } catch {}
  };

  const markRead = (id) => {
    if (readIds.has(id)) return;
    const next = new Set([...readIds, id]);
    setReadIds(next);
    try { localStorage.setItem("signaldesk-read-notifs", JSON.stringify([...next])); } catch {}
  };

  const isIncidentNotification = (item) => item.action === "manager.notification_created";

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(!open); }}
        className="relative rounded-xl bg-zinc-100 dark:bg-[#202024] p-2.5 hover:bg-zinc-200 dark:hover:bg-[#27272A] transition-colors"
      >
        <Bell size={18} className="text-secondary-body dark:text-muted-dark" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-zinc-900 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[380px] rounded-xl border border-border dark:border-border-dark bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-border dark:border-border-dark px-5 py-4">
            <h2 className="text-sm font-semibold text-primary">Notifications</h2>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs font-medium text-accent hover:opacity-80">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[500px] overflow-auto">
            {notifications.length === 0 ? (
              <div className="p-5 text-sm text-muted dark:text-muted-dark text-center">No notifications yet.</div>
            ) : (
              notifications.map((item) => {
                const { icon: Icon, color } = actionMeta(item.action);
                const incidentNotif = isIncidentNotification(item);
                const sev = item.details?.severity;
                const sevColor = SEVERITY_COLORS[sev] || "bg-zinc-100 dark:bg-zinc-900/30 text-muted-base dark:text-muted-dark";
                return (
                  <div
                    key={item.id}
                    onClick={() => markRead(item.id)}
                    className={`relative border-b border-border dark:border-border-dark px-5 py-4 transition-colors hover:bg-zinc-50 dark:hover:bg-[#202024] cursor-pointer ${readIds.has(item.id) ? "" : "bg-zinc-50/50 dark:bg-[#202024]/50"}`}
                  >
                    <div className="flex gap-3">
                      {!readIds.has(item.id) && (
                        <span className="absolute left-2.5 top-5 h-2 w-2 rounded-full bg-accent" />
                      )}
                      <Icon size={18} className={color} />
                      <div className="min-w-0 flex-1">
                        {incidentNotif ? (
                          <>
                            <h3 className="text-sm font-medium text-primary truncate">
                              {item.details?.incident_title || "Incident Detected"}
                            </h3>
                            <p className="mt-0.5 text-sm text-muted-base dark:text-muted-dark line-clamp-2">
                              {item.details?.affected_tickets} related tickets — {workspace.name}
                            </p>
                            {sev && (
                              <span className={`mt-1.5 inline-block rounded px-2 py-0.5 text-[10px] font-semibold ${sevColor}`}>
                                {sev}
                              </span>
                            )}
                            <div className="mt-2">
                              <button
                                onClick={() => { navigate("/incidents"); setOpen(false); }}
                                className="flex items-center gap-1 text-xs font-medium text-accent hover:opacity-80"
                              >
                                View Incident <ArrowRight size={12} />
                              </button>
                            </div>
                          </>
                        ) : item.ticket_id ? (
                          <>
                            <h3 className="text-sm font-medium text-primary">{item.action}</h3>
                            <p className="text-sm text-muted-base dark:text-muted-dark">
                              {item.details?.name || item.resource_type || ""}
                            </p>
                            <div className="mt-2">
                              <button
                                onClick={() => { navigate("/tickets", { state: { focusTicketId: item.ticket_id } }); setOpen(false); }}
                                className="flex items-center gap-1 text-xs font-medium text-accent hover:opacity-80"
                              >
                                View Ticket <ArrowRight size={12} />
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <h3 className="text-sm font-medium text-primary">{item.action}</h3>
                            <p className="text-sm text-muted-base dark:text-muted-dark">
                              {item.details?.name || item.resource_type || ""}
                            </p>
                          </>
                        )}
                        <span className="mt-0.5 block text-xs text-muted dark:text-muted-dark">
                          {item.created_at
                            ? formatDistanceToNow(new Date(item.created_at), { addSuffix: true })
                            : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
