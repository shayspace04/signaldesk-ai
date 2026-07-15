import { useState, useCallback, useRef } from 'react';
import client from '@/lib/lemmaClient';

export const SYNC_STATUS = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  SYNCED: 'synced',
  CONNECTOR_UNAVAILABLE: 'connector_unavailable',
  ERROR: 'error',
};

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
      const raw = await client.functions.run("create_linear_issue", {
        input: { incident_id: incidentId },
      });
      if (reqId !== reqRef.current) return { status: SYNC_STATUS.IDLE };

      const result = raw.output_data || raw.output || raw;

      if (result.success) {
        setSyncStatus(SYNC_STATUS.SYNCED);
        setSyncResult({
          issueId: result.linearIssueId,
          issueUrl: result.linearIssueUrl,
          identifier: result.linearIssueIdentifier,
          syncedAt: new Date().toISOString(),
        });
        setSyncLoading(false);
        return { status: SYNC_STATUS.SYNCED, result };
      }

      const msg = result.message || '';
      const isConnectorError = /connector/i.test(msg) || /not configured/i.test(msg);
      const status = isConnectorError ? SYNC_STATUS.CONNECTOR_UNAVAILABLE : SYNC_STATUS.ERROR;
      setSyncStatus(status);
      setSyncError(msg || 'Failed to create Linear issue');
      setSyncLoading(false);
      return { status, error: msg };
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
