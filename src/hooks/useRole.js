/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from "react";
import client from "../lib/lemmaClient";

const MANAGER_USERS = [];

const AGENT_INFO = {
  role: "support_agent",
  user: null,
  isManager: false,
  canCreateTickets: true,
  canViewTickets: true,
  canGenerateDrafts: true,
  canApproveDrafts: false,
  canRejectDrafts: false,
  canEditDrafts: false,
  canSendReplies: false,
  canCompleteApproval: false,
};

const MANAGER_INFO = {
  role: "support_manager",
  user: null,
  isManager: true,
  canCreateTickets: true,
  canViewTickets: true,
  canGenerateDrafts: true,
  canApproveDrafts: true,
  canRejectDrafts: true,
  canEditDrafts: true,
  canSendReplies: true,
  canCompleteApproval: true,
};

export default function useRole() {
  const [info, setInfo] = useState(() => {
    try {
      const saved = localStorage.getItem("signaldesk-role");
      return saved === "manager" ? MANAGER_INFO : AGENT_INFO;
    } catch {
      return AGENT_INFO;
    }
  });

  useEffect(() => {
    const state = client.auth?.getState();
    if (state?.user && MANAGER_USERS.includes(state.user.email)) {
      setInfo(MANAGER_INFO);
      try { localStorage.setItem("signaldesk-role", "manager"); } catch {}
    }
  }, []);

  const setRole = useCallback((role) => {
    const newInfo = role === "manager" ? MANAGER_INFO : AGENT_INFO;
    setInfo(newInfo);
    try { localStorage.setItem("signaldesk-role", role); } catch {}
  }, []);

  return { ...info, setRole };
}
