import { useState, useCallback, useRef } from 'react';
import client from '@/lib/lemmaClient';
import { createOrUpdateLinearIssue, backfillLinearMetadata } from '@/lib/engineeringHandoff';

export const SYNC_STATUS = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  SYNCED: 'synced',
  ERROR: 'error',
};

async function fetchIssueFromIncident(incidentId) {
  let inc = await client.records.get("incidents", incidentId);
  if (!inc?.linearIssueId) return null;

  if (!inc.linearIssueIdentifier) {
    const backfilled = await backfillLinearMetadata(incidentId).catch(() => null);
    if (backfilled) inc = backfilled;
  }

  const now = new Date().toISOString();
  await client.records.update("incidents", incidentId, { linearSyncedAt: now }).catch(() => {});
  return {
    issueId: inc.linearIssueId,
    issueUrl: inc.linearIssueUrl || '',
    identifier: inc.linearIssueIdentifier || '',
    syncedAt: now,
    linearStatus: inc.linearStatus || 'Todo',
    linearPriority: inc.linearPriority || '',
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
      const existing = await fetchIssueFromIncident(incidentId);
      if (existing && reqId === reqRef.current) {
        setSyncStatus(SYNC_STATUS.SYNCED);
        setSyncResult(existing);
        setSyncLoading(false);
        return { status: SYNC_STATUS.SYNCED, result: existing };
      }

      const result = await createOrUpdateLinearIssue(incidentId);

      if (reqId !== reqRef.current) return { status: SYNC_STATUS.IDLE };

      const verified = await fetchIssueFromIncident(incidentId).catch(() => null);
      const finalResult = verified || result;

      setSyncStatus(SYNC_STATUS.SYNCED);
      setSyncResult(finalResult);
      setSyncLoading(false);
      return { status: SYNC_STATUS.SYNCED, result: finalResult };
    } catch (err) {
      if (reqId !== reqRef.current) return { status: SYNC_STATUS.IDLE };
      const msg = err?.message || err?.error || 'Unable to sync with Linear';

      const recovered = await fetchIssueFromIncident(incidentId).catch(() => null);
      if (recovered) {
        setSyncStatus(SYNC_STATUS.SYNCED);
        setSyncResult(recovered);
        setSyncLoading(false);
        return { status: SYNC_STATUS.SYNCED, result: recovered };
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
