import { useState, useCallback, useRef } from 'react';
import client from '@/lib/lemmaClient';

export const SYNC_STATUS = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  SYNCED: 'synced',
  ERROR: 'error',
};

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
      /* ---- Step 1: Check if already synced ---- */
      const existing = await fetchIssueFromIncident(incidentId);
      if (existing) {
        if (reqId !== reqRef.current) return { status: SYNC_STATUS.IDLE };
        setSyncStatus(SYNC_STATUS.SYNCED);
        setSyncResult(existing);
        setSyncLoading(false);
        return { status: SYNC_STATUS.SYNCED, result: existing };
      }

      /* ---- Step 2: Create new Linear issue ---- */
      const raw = await client.functions.run("create_linear_issue", {
        input: { incident_id: incidentId },
      });

      if (reqId !== reqRef.current) return { status: SYNC_STATUS.IDLE };

      const output = raw?.output_data || raw?.output || raw || {};

      if (!output.success) {
        /* ---- Step 3: Handle "already exists" from Linear API ---- */
        const errMsg = output.message || output.error || '';
        if (isAlreadyExistsError(errMsg)) {
          const recovered = await fetchIssueFromIncident(incidentId);
          if (recovered) {
            setSyncStatus(SYNC_STATUS.SYNCED);
            setSyncResult(recovered);
            setSyncLoading(false);
            return { status: SYNC_STATUS.SYNCED, result: recovered };
          }
        }

        setSyncStatus(SYNC_STATUS.ERROR);
        setSyncError(errMsg || 'Failed to create Linear issue');
        setSyncLoading(false);
        return { status: SYNC_STATUS.ERROR, error: errMsg };
      }

      /* ---- Step 4: Verify persistence ---- */
      const result = {
        issueId: output.linearIssueId,
        issueUrl: output.linearIssueUrl || '',
        identifier: output.linearIssueIdentifier || '',
        syncedAt: new Date().toISOString(),
      };

      const verified = await fetchIssueFromIncident(incidentId);
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

      /* ---- Catch clause: also check for "already exists" ---- */
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
