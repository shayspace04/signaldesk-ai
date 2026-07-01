import { emitRefresh } from "./refreshEvents";
import client from "./lemmaClient";

const READ_STORAGE_KEY = "signaldesk-read-notifs";

export const ACTION_META = {
  "ticket.created":        { icon: "Ticket",      color: "text-blue-500",        bg: "bg-blue-50",        priority: "low",     label: "Ticket Created" },
  "ticket.updated":        { icon: "Ticket",      color: "text-blue-500",        bg: "bg-blue-50",        priority: "low",     label: "Ticket Updated" },
  "ticket.assigned":       { icon: "UserCheck",   color: "text-violet-500",      bg: "bg-violet-50",      priority: "medium",  label: "Ticket Assigned" },
  "ticket.resolved":       { icon: "CheckCircle2",color: "text-emerald-500",     bg: "bg-emerald-50",     priority: "low",     label: "Ticket Resolved" },
  "ticket.escalated":      { icon: "AlertTriangle",color: "text-orange-500",     bg: "bg-orange-50",      priority: "high",    label: "Ticket Escalated" },
  "signal.detected":       { icon: "Radio",       color: "text-green-500",       bg: "bg-green-50",       priority: "medium",  label: "Signal Detected" },
  "signal.created":        { icon: "Radio",       color: "text-green-500",       bg: "bg-green-50",       priority: "medium",  label: "Signal Created" },
  "signal.linked":         { icon: "Link2",       color: "text-cyan-500",        bg: "bg-cyan-50",        priority: "medium",  label: "Signal Linked" },
  "incident.created":      { icon: "ShieldAlert", color: "text-red-500",         bg: "bg-red-50",         priority: "high",    label: "Incident Created" },
  "incident.linked":       { icon: "ShieldAlert", color: "text-red-500",         bg: "bg-red-50",         priority: "high",    label: "Incident Linked" },
  "incident.resolved":     { icon: "CheckCircle2",color: "text-emerald-500",     bg: "bg-emerald-50",     priority: "low",     label: "Incident Resolved" },
  "draft.generated":       { icon: "Brain",       color: "text-violet-500",      bg: "bg-violet-50",      priority: "low",     label: "AI Draft Generated" },
  "draft.approved":        { icon: "CheckCircle2",color: "text-emerald-500",     bg: "bg-emerald-50",     priority: "medium",  label: "Draft Approved" },
  "draft.rejected":        { icon: "XCircle",     color: "text-red-500",         bg: "bg-red-50",         priority: "medium",  label: "Draft Rejected" },
  "draft.pending_approval":{ icon: "Clock",       color: "text-amber-500",       bg: "bg-amber-50",       priority: "medium",  label: "Draft Pending Approval" },
  "email.sent":            { icon: "Mail",        color: "text-emerald-500",     bg: "bg-emerald-50",     priority: "low",     label: "Email Sent" },
  "linear.issue_created":      { icon: "ExternalLink",color: "text-indigo-500",      bg: "bg-indigo-50",      priority: "medium",  label: "Linear Issue Created" },
  "linear.issue_updated":      { icon: "RefreshCw",   color: "text-indigo-500",      bg: "bg-indigo-50",      priority: "low",     label: "Linear Issue Updated" },
  "linear.issue_synced":       { icon: "RefreshCw",   color: "text-indigo-500",      bg: "bg-indigo-50",      priority: "low",     label: "Linear Issue Synced" },
  "linear.issue_fetched":      { icon: "RefreshCw",   color: "text-indigo-500",      bg: "bg-indigo-50",      priority: "low",     label: "Linear Issue Refreshed" },
  "linear.comment_added":      { icon: "MessageSquare",color: "text-indigo-500",      bg: "bg-indigo-50",      priority: "low",     label: "Linear Comment Added" },
  "linear.issue_assigned":     { icon: "UserCheck",   color: "text-indigo-500",      bg: "bg-indigo-50",      priority: "medium",  label: "Linear Issue Assigned" },
  "linear.issue_resolved":     { icon: "CheckCircle2",color: "text-indigo-500",      bg: "bg-indigo-50",      priority: "low",     label: "Linear Issue Resolved" },

  "signal.in_review":          { icon: "Radio",       color: "text-amber-500",      bg: "bg-amber-50",       priority: "medium",  label: "Signal In Review" },
  "signal.approved":           { icon: "CheckCircle2",color: "text-green-500",      bg: "bg-green-50",       priority: "high",    label: "Signal Approved" },
  "signal.resolved":           { icon: "CheckCircle2",color: "text-emerald-500",    bg: "bg-emerald-50",     priority: "low",     label: "Signal Resolved" },

  "engineering.handoff":       { icon: "Code",        color: "text-indigo-500",      bg: "bg-indigo-50",      priority: "high",    label: "Engineering Handoff" },
  "engineering.package_reviewed": { icon: "CheckCircle2",color: "text-indigo-500",    bg: "bg-indigo-50",      priority: "medium",  label: "Engineering Package Reviewed" },

  "draft.ready":               { icon: "FileText",    color: "text-violet-500",      bg: "bg-violet-50",      priority: "medium",  label: "Draft Ready for Review" },
  "ticket.ready_for_reply":    { icon: "Mail",        color: "text-emerald-500",     bg: "bg-emerald-50",     priority: "medium",  label: "Ticket Ready for Reply" },
  "ticket.closed":             { icon: "CheckCircle2",color: "text-zinc-500",        bg: "bg-zinc-100",       priority: "low",     label: "Ticket Closed" },

  "knowledge.created":         { icon: "BookOpen",    color: "text-amber-500",       bg: "bg-amber-50",       priority: "medium",  label: "Knowledge Article Created" },
  "knowledge.updated":         { icon: "BookOpen",    color: "text-amber-500",       bg: "bg-amber-50",       priority: "low",     label: "Knowledge Article Updated" },
  "knowledge.referenced":      { icon: "Link2",       color: "text-cyan-500",        bg: "bg-cyan-50",        priority: "low",     label: "Knowledge Article Referenced" },
  "knowledge.archived":        { icon: "Archive",     color: "text-zinc-500",        bg: "bg-zinc-100",       priority: "low",     label: "Knowledge Article Archived" },
};

export function getActionMeta(action) {
  return ACTION_META[action] || { icon: "Bell", color: "text-zinc-400", bg: "bg-zinc-100", priority: "low", label: action || "Notification" };
}

export function getEntityRoute(item) {
  const type = item.resource_type || "";
  const id = item.resource_id || item.ticket_id || item.signal_id;
  if (type === "ticket" || item.ticket_id) return { path: "/tickets", state: { focusTicketId: id || item.ticket_id } };
  if (type === "signal" || item.signal_id || /^signal/i.test(item.action || "")) return { path: "/signals" };
  if (type === "incident" || /^incident/i.test(item.action || "")) return { path: "/incidents" };
  if (type === "draft" || /^draft/i.test(item.action || "")) return { path: "/approvals" };
  if (type === "email" || item.action === "email.sent") return { path: "/tickets", state: { focusTicketId: item.ticket_id } };
  if (type === "linear" || /^linear/i.test(item.action || "")) return null;
  if (/^engineering/i.test(item.action || "")) return { path: "/incidents" };
  return null;
}

export async function createNotification({ action, actor, resourceType, resourceId, details, workspaceId, workspaceName }) {
  const id = crypto.randomUUID();
  try {
    await client.records.create("audit_logs", {
      id,
      action,
      actor_type: "agent",
      actor_agent_name: actor || "System",
      resource_type: resourceType || "system",
      resource_id: resourceId,
      ticket_id: resourceType === "ticket" ? resourceId : undefined,
      signal_id: resourceType === "signal" ? resourceId : undefined,
      details: details || {},
      workspaceId: workspaceId || "signaldesk",
      workspaceName: workspaceName || "SignalDesk",
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("Failed to create notification:", err?.message);
  }
}

export async function createNotificationAndRefresh(opts) {
  await createNotification(opts);
  emitRefresh();
}

export function getReadIds() {
  try { return new Set(JSON.parse(localStorage.getItem(READ_STORAGE_KEY) || "[]")); } catch { return new Set(); }
}

export function markAsRead(id) {
  const ids = getReadIds();
  ids.add(id);
  try { localStorage.setItem(READ_STORAGE_KEY, JSON.stringify([...ids])); } catch {}
  emitRefresh();
}

export function markAllAsRead(logs) {
  const ids = new Set([...getReadIds(), ...logs.map((n) => n.id)]);
  try { localStorage.setItem(READ_STORAGE_KEY, JSON.stringify([...ids])); } catch {}
  emitRefresh();
}

export function clearRead() {
  try { localStorage.setItem(READ_STORAGE_KEY, "[]"); } catch {}
  emitRefresh();
}

export function unreadCount(logs) {
  const readIds = getReadIds();
  return logs.filter((n) => !readIds.has(n.id)).length;
}
