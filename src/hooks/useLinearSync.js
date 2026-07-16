import { useState, useCallback, useRef } from 'react';
import client, { ORG_ID, LINEAR_AUTH_CONFIG, LINEAR_TEAM_ID } from '@/lib/lemmaClient';

export const SYNC_STATUS = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  SYNCED: 'synced',
  CONNECTOR_UNAVAILABLE: 'connector_unavailable',
  ERROR: 'error',
};

function persistLinearFields(incidentId, issueId, issueUrl, identifier) {
  const now = new Date().toISOString();
  return client.records.update("incidents", incidentId, {
    linearIssueId: issueId,
    linearIssueUrl: issueUrl || "",
    linearIssueIdentifier: identifier || "",
    linearKey: identifier || "",
    linearUrl: issueUrl || "",
    linearSyncedAt: now,
    lastSyncedAt: now,
    linearStatus: "Todo",
    syncStatus: "Todo",
  });
}

export function useLinearSync() {
  const [syncStatus, setSyncStatus] = useState(SYNC_STATUS.IDLE);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [syncError, setSyncError] = useState(null);

  const reqRef = useRef(0);

  const syncLinearIssue = useCallback(async (incidentId) => {
    const reqId = ++reqRef.current;
    setSyncStatus(SYNC_STATUS.CONNECTING);
    setSyncLoading(true);
    setSyncResult(null);
    setSyncError(null);

    try {
      const incident = await client.records.get("incidents", incidentId).catch(() => null);
      if (reqId !== reqRef.current) return { status: SYNC_STATUS.IDLE };
      if (!incident) throw new Error("Incident not found");

      // Idempotency: skip create if already synced
      if (incident.linearIssueId) {
        const result = {
          id: incident.linearIssueId,
          ticket_url: incident.linearIssueUrl || "",
          issue_title: incident.linearIssueIdentifier || incident.linearKey || "",
        };
        setSyncStatus(SYNC_STATUS.SYNCED);
        setSyncResult({
          issueId: incident.linearIssueId,
          issueUrl: incident.linearIssueUrl || "",
          identifier: incident.linearIssueIdentifier || incident.linearKey || "",
          syncedAt: incident.linearSyncedAt || incident.lastSyncedAt || new Date().toISOString(),
        });
        setSyncLoading(false);
        return { status: SYNC_STATUS.SYNCED, result };
      }

      const priorityMap = { urgent: 1, high: 2, normal: 3, low: 4 };
      const priority = priorityMap[incident.severity] || 0;

      const raw = await client.connectors.operations.execute(
        { organizationId: ORG_ID, authConfigName: LINEAR_AUTH_CONFIG },
        "LINEAR_CREATE_LINEAR_ISSUE",
        {
          team_id: LINEAR_TEAM_ID,
          title: incident.title || `Incident ${incidentId}`,
          description: incident.description || incident.summary || `Severity: ${incident.severity || "N/A"}`,
          priority,
        },
      );
      if (reqId !== reqRef.current) return { status: SYNC_STATUS.IDLE };

      const opResult = raw?.result || {};
      const issueId = opResult.id;
      const issueUrl = opResult.ticket_url || "";
      const key = issueUrl.match(/\/issue\/([^/]+)/)?.[1] || opResult.issue_title || "";

      if (issueId) {
        // Persist to datastore BEFORE updating React state
        await persistLinearFields(incidentId, issueId, issueUrl, key);

        setSyncStatus(SYNC_STATUS.SYNCED);
        setSyncResult({
          issueId,
          issueUrl,
          identifier: key,
          syncedAt: new Date().toISOString(),
        });
        setSyncLoading(false);
        return { status: SYNC_STATUS.SYNCED, result: { id: issueId, ticket_url: issueUrl, issue_title: key } };
      }

      const msg = 'Failed to create Linear issue';
      setSyncStatus(SYNC_STATUS.ERROR);
      setSyncError(msg);
      setSyncLoading(false);
      return { status: SYNC_STATUS.ERROR, error: msg };
    } catch (err) {
      if (reqId !== reqRef.current) return { status: SYNC_STATUS.IDLE };
      setSyncStatus(SYNC_STATUS.ERROR);
      setSyncError(err?.message || 'Unable to create Linear issue');
      setSyncLoading(false);
      return { status: SYNC_STATUS.ERROR, error: err?.message };
    }
  }, []);

  const resetSync = useCallback(() => {
    reqRef.current += 1;
    setSyncStatus(SYNC_STATUS.IDLE);
    setSyncLoading(false);
    setSyncResult(null);
    setSyncError(null);
  }, []);

  return { syncStatus, syncLoading, syncResult, syncError, syncLinearIssue, resetSync, SYNC_STATUS };
}
