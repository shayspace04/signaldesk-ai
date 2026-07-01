/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from "react";
import client from "../lib/lemmaClient";

const MANAGER_USERS = [];

// ---------------------------------------------------------------------------
// Permission matrix
// ---------------------------------------------------------------------------

const AGENT_PERMISSIONS = {
  role: "support_agent",
  isManager: false,

  // Tickets
  canViewTickets: true,
  canCreateTickets: true,
  canEditTickets: true,
  canEditTicketDetails: true,
  canSearchFilter: true,

  // Drafts
  canGenerateDrafts: true,
  canEditDrafts: true,
  canSaveDrafts: true,
  canRegenerateDrafts: true,
  canCopyDrafts: true,
  canApproveDrafts: false,
  canRejectDrafts: false,
  canSendReplies: false,
  canRequestApproval: true,

  // Ticket lifecycle
  canResolveTicket: false,
  canCloseTicket: false,
  canDeleteTicket: false,
  canAssignTicket: false,
  canChangeStatus: false,
  canChangePriority: false,
  canChangeCategory: false,

  // AI tools
  canViewAiSummary: true,
  canViewRootCause: true,
  canViewSentiment: true,
  canViewChurnRisk: true,
  canViewResolution: true,

  // Incidents & Signals
  canLinkIncident: true,
  canCreateIncident: false,
  canCreateSignal: true,
  canApproveSignal: false,
  canRejectSignal: false,
  canEscalateTicket: false,
  canCreateLinearIssue: false,

  // Notes & Timeline
  canAddNotes: true,
  canViewTimeline: true,
  canViewAuditHistory: false,

  // Workflow
  canCompleteApproval: false,
  canReviewEngineeringPackage: false,
  canCreateIncidentFromSignal: false,
  canApproveReply: false,
  canSendReply: false,
  canResolveIncident: false,
};

const MANAGER_PERMISSIONS = {
  role: "support_manager",
  isManager: true,

  // Tickets
  canViewTickets: true,
  canCreateTickets: true,
  canEditTickets: true,
  canEditTicketDetails: true,
  canSearchFilter: true,

  // Drafts
  canGenerateDrafts: true,
  canEditDrafts: true,
  canSaveDrafts: true,
  canRegenerateDrafts: true,
  canCopyDrafts: true,
  canApproveDrafts: true,
  canRejectDrafts: true,
  canSendReplies: true,
  canRequestApproval: true,

  // Ticket lifecycle
  canResolveTicket: true,
  canCloseTicket: true,
  canDeleteTicket: true,
  canAssignTicket: true,
  canChangeStatus: true,
  canChangePriority: true,
  canChangeCategory: true,

  // AI tools
  canViewAiSummary: true,
  canViewRootCause: true,
  canViewSentiment: true,
  canViewChurnRisk: true,
  canViewResolution: true,

  // Incidents & Signals
  canLinkIncident: true,
  canCreateIncident: true,
  canCreateSignal: true,
  canApproveSignal: true,
  canRejectSignal: true,
  canEscalateTicket: true,
  canCreateLinearIssue: true,

  // Notes & Timeline
  canAddNotes: true,
  canViewTimeline: true,
  canViewAuditHistory: true,

  // Workflow
  canCompleteApproval: true,
  canReviewEngineeringPackage: true,
  canCreateIncidentFromSignal: true,
  canApproveReply: true,
  canSendReply: true,
  canResolveIncident: true,
};

function loadSavedRole() {
  try {
    const saved = localStorage.getItem("signaldesk-role");
    return saved === "support_manager" ? MANAGER_PERMISSIONS : AGENT_PERMISSIONS;
  } catch {
    return AGENT_PERMISSIONS;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export default function useRole() {
  const [perms, setPerms] = useState(loadSavedRole);
  const [loading, setLoading] = useState(false);

  // Sync role with backend on mount
  useEffect(() => {
    const sync = async () => {
      setLoading(true);
      try {
        const state = client.auth?.getState();
        if (state?.user && MANAGER_USERS.includes(state.user.email)) {
          const manager = { ...MANAGER_PERMISSIONS };
          setPerms(manager);
          try { localStorage.setItem("signaldesk-role", "support_manager"); } catch {}
        }
      } catch {}
      setLoading(false);
    };
    sync();
  }, []);

  const setRole = useCallback((role, syncBackend = true) => {
    const newPerms = role === "support_manager" || role === "manager"
      ? { ...MANAGER_PERMISSIONS }
      : { ...AGENT_PERMISSIONS };
    setPerms(newPerms);
    try {
      localStorage.setItem("signaldesk-role",
        newPerms.role === "support_manager" ? "support_manager" : "support_agent");
    } catch {}
    if (syncBackend) {
      client.functions.run("set_user_role", { input: { role: newPerms.role } }).catch(() => {});
    }
  }, []);

  const permissionKeys = [
    "canViewTickets", "canCreateTickets", "canEditTickets", "canEditTicketDetails", "canSearchFilter",
    "canGenerateDrafts", "canEditDrafts", "canSaveDrafts", "canRegenerateDrafts", "canCopyDrafts",
    "canApproveDrafts", "canRejectDrafts", "canSendReplies", "canRequestApproval",
    "canResolveTicket", "canCloseTicket", "canDeleteTicket", "canAssignTicket",
    "canChangeStatus", "canChangePriority", "canChangeCategory",
    "canViewAiSummary", "canViewRootCause", "canViewSentiment", "canViewChurnRisk", "canViewResolution",
    "canLinkIncident", "canCreateIncident", "canCreateSignal", "canApproveSignal", "canRejectSignal",
    "canEscalateTicket", "canCreateLinearIssue",
    "canAddNotes", "canViewTimeline", "canViewAuditHistory",
    "canCompleteApproval", "canReviewEngineeringPackage", "canCreateIncidentFromSignal",
    "canApproveReply", "canSendReply", "canResolveIncident",
  ];

  const permissions = {};
  permissionKeys.forEach((key) => { permissions[key] = perms[key] ?? false; });

  return { ...perms, permissions, loading, setRole };
}
