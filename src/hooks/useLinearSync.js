import { useState, useCallback, useRef } from 'react';
import client from '@/lib/lemmaClient';

export const SYNC_STATUS = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  SYNCED: 'synced',
  ERROR: 'error',
};

const LINEAR_TEAM_ID = "8016a82b-1e4c-40bc-b2c1-40c521897628";

function isAlreadyExistsError(msg) {
  if (!msg) return false;
  const lower = msg.toLowerCase();
  return (
    lower.includes('already exists') ||
    lower.includes('duplicate') ||
    lower.includes('already been created') ||
    lower.includes('already linked') ||
    lower.includes('already synced')
  );
}

async function fetchIssueFromIncident(incidentId) {
  const inc = await client.records.get("incidents", incidentId);
  if (!inc?.linearIssueId) return null;

  const now = new Date().toISOString();
  await client.records
    .update("incidents", incidentId, { linearSyncedAt: now })
    .catch(() => {});

  return {
    issueId: inc.linearIssueId,
    issueUrl: inc.linearIssueUrl || '',
    identifier: inc.linearIssueIdentifier || '',
    syncedAt: now,
  };
}

async function tryServerFunction(incidentId) {
  const raw = await client.functions.run("create_linear_issue", {
    input: { incident_id: incidentId },
  });
  const output = raw?.output_data || raw?.output || raw || {};

  if (output.success && output.linearIssueId) {
    const now = new Date().toISOString();
    await client.records.update("incidents", incidentId, {
      linearSyncedAt: now,
      linearStatus: "Todo",
    }).catch(() => {});
    return {
      issueId: output.linearIssueId,
      issueUrl: output.linearIssueUrl || '',
      identifier: output.linearIssueIdentifier || '',
      syncedAt: now,
    };
  }

  const errMsg = output.message || output.error || '';
  if (isAlreadyExistsError(errMsg)) {
    const recovered = await fetchIssueFromIncident(incidentId);
    if (recovered) return recovered;
  }

  throw new Error(errMsg || 'Server function returned unsuccessful');
}

async function tryConnector(incidentId) {
  const incident = await client.records.get("incidents", incidentId);
  if (!incident) throw new Error("Incident not found");

  const priorityMap = { urgent: 1, high: 2, normal: 3, low: 4 };
  const priority = priorityMap[incident.severity] || 0;

  const raw = await client.connectors.operations.execute(
    { organizationId: "019ef98f-e90b-74df-9116-d0df1a4baeff", authConfigName: "linear" },
    "LINEAR_CREATE_LINEAR_ISSUE",
    {
      team_id: LINEAR_TEAM_ID,
      title: incident.title || `Incident ${incidentId}`,
      description: incident.description || incident.summary || `Incident ${incidentId}`,
      priority,
    },
  );

  const opResult = raw?.result || {};
  const issueId = opResult.id;
  if (!issueId) throw new Error(opResult.error || 'Connector returned no issue ID');

  const issueUrl = opResult.ticket_url || opResult.url || '';
  const identifier = opResult.identifier || '';
  const now = new Date().toISOString();

  await client.records.update("incidents", incidentId, {
    linearIssueId: issueId,
    linearIssueUrl: issueUrl,
    linearIssueIdentifier: identifier,
    linearSyncedAt: now,
    linearStatus: "Todo",
  }).catch(() => {});

  return { issueId, issueUrl, identifier, syncedAt: now };
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
      const existing = await fetchIssueFromIncident(incidentId);
      if (existing) {
        if (reqId !== reqRef.current) return { status: SYNC_STATUS.IDLE };
        setSyncStatus(SYNC_STATUS.SYNCED);
        setSyncResult(existing);
        setSyncLoading(false);
        return { status: SYNC_STATUS.SYNCED, result: existing };
      }

      let result;
      try {
        result = await tryServerFunction(incidentId);
      } catch (serverErr) {
        if (reqId !== reqRef.current) return { status: SYNC_STATUS.IDLE };
        result = await tryConnector(incidentId);
      }

      if (reqId !== reqRef.current) return { status: SYNC_STATUS.IDLE };

      const verified = await fetchIssueFromIncident(incidentId).catch(() => null);
      if (verified) {
        result.issueId = verified.issueId;
        result.issueUrl = verified.issueUrl || result.issueUrl;
        result.identifier = verified.identifier || result.identifier;
        result.syncedAt = verified.syncedAt;
      }

      setSyncStatus(SYNC_STATUS.SYNCED);
      setSyncResult(result);
      setSyncLoading(false);
      return { status: SYNC_STATUS.SYNCED, result };
    } catch (err) {
      if (reqId !== reqRef.current) return { status: SYNC_STATUS.IDLE };
      const msg = err?.message || err?.error || 'Unable to create Linear issue';

      if (isAlreadyExistsError(msg)) {
        const recovered = await fetchIssueFromIncident(incidentId).catch(() => null);
        if (recovered) {
          setSyncStatus(SYNC_STATUS.SYNCED);
          setSyncResult(recovered);
          setSyncLoading(false);
          return { status: SYNC_STATUS.SYNCED, result: recovered };
        }
      }

      setSyncStatus(SYNC_STATUS.ERROR);
      setSyncError(msg);
      setSyncLoading(false);
      return { status: SYNC_STATUS.ERROR, error: msg };
    }
  }, []);

  const checkExistingSync = useCallback(async (incidentId) => {
    try {
      const result = await fetchIssueFromIncident(incidentId);
      if (result) {
        setSyncStatus(SYNC_STATUS.SYNCED);
        setSyncResult(result);
        return true;
      }
      setSyncStatus(SYNC_STATUS.IDLE);
      setSyncResult(null);
    } catch {}
    return false;
  }, []);

  const resetSync = useCallback(() => {
    reqRef.current += 1;
    setSyncStatus(SYNC_STATUS.IDLE);
    setSyncLoading(false);
    setSyncResult(null);
    setSyncError(null);
  }, []);

  return { syncStatus, syncLoading, syncResult, syncError, syncLinearIssue, checkExistingSync, resetSync, SYNC_STATUS };
}
