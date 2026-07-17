import client from '@/lib/lemmaClient';
import { format } from 'date-fns';

const SEVERITY_PRIORITY = { urgent: 1, high: 2, normal: 3, low: 4 };
const PRIORITY_LABEL = { 1: 'Urgent', 2: 'High', 3: 'Medium', 4: 'Low' };

async function fetchSignal(incident) {
  if (!incident.signal_id) return null;
  try {
    return await client.records.get('signals', incident.signal_id);
  } catch {
    return null;
  }
}

async function fetchLinkedTickets(incidentId) {
  try {
    const links = await client.records.list('ticket_incidents', {
      filters: { incident_id: incidentId }, limit: 50,
    });
    const rows = links.items || links.data || [];
    const tickets = [];
    for (const link of rows) {
      try {
        const t = await client.records.get('tickets', link.ticket_id);
        if (t) tickets.push(t);
      } catch {}
    }
    return tickets;
  } catch {
    return [];
  }
}

async function fetchTimeline(incidentId) {
  try {
    const res = await client.records.list('audit_logs', {
      filters: { resource_id: incidentId },
      sort: [{ field: 'created_at', direction: 'asc' }], limit: 50,
    });
    return res.items || res.data || [];
  } catch {
    return [];
  }
}

function formatUTC(dateStr) {
  if (!dateStr) return '';
  try {
    return format(new Date(dateStr), "MMM d, yyyy HH:mm") + ' UTC';
  } catch {
    return dateStr;
  }
}

export async function buildEngineeringHandoff(incidentId) {
  const incident = await client.records.get('incidents', incidentId);
  if (!incident) return null;

  const signal = await fetchSignal(incident);
  const linkedTickets = await fetchLinkedTickets(incidentId);
  const timeline = await fetchTimeline(incidentId);

  const sev = incident.severity || 'normal';
  const linearPriority = SEVERITY_PRIORITY[sev] || 3;
  const priorityLabel = PRIORITY_LABEL[linearPriority] || 'Medium';
  const sevLabel = { urgent: 'Critical', high: 'High', normal: 'Medium', low: 'Low' }[sev] || 'Medium';

  const title = incident.title || `Incident ${incidentId}`;

  const signalName = signal?.name || signal?.summary || '—';
  const category = incident.category || signal?.category || 'General';
  const workspaceName = incident.workspaceName || incident.workspaceId || 'SignalDesk';

  const affectedCustomers = incident.affected_customer_count || incident.affected_ticket_count || linkedTickets.length || '—';
  const affectedTickets = incident.affected_ticket_count || linkedTickets.length || '—';
  const detectionTime = formatUTC(incident.opened_at || incident.created_at);
  const aiSummary = incident.summary || signal?.summary || 'No AI summary available.';
  const rootCause = signal?.root_cause || incident.description || incident.summary || 'Pending investigation.';
  const confidence = signal?.analysis_confidence != null ? `${signal.analysis_confidence}%` : '—';

  const catLower = category.toLowerCase();
  const businessImpact = [
    ...(sev === 'urgent' || sev === 'high' ? ['• Service degradation or outage risk'] : []),
    ...(catLower.includes('refund') || catLower.includes('billing') || catLower.includes('payment') ? ['• Revenue impact', '• Customer churn risk'] : []),
    '• SLA breach risk',
    '• Increased support volume',
  ].slice(0, 4);

  const technicalImpact = [
    '• Worker queue saturation',
    '• Database contention',
    '• Retry failures',
    '• API latency spikes',
  ];

  const recommendedActions = sev === 'urgent'
    ? ['1. Immediately assign engineering team', '2. Scale affected service capacity', '3. Restart failed consumers', '4. Validate data integrity']
    : sev === 'high'
      ? ['1. Prioritize in current sprint', '2. Investigate root cause', '3. Deploy hotfix if available', '4. Monitor after resolution']
      : ['1. Schedule for next sprint', '2. Reproduce issue in staging', '3. Apply standard fix', '4. Update documentation'];

  const timelineEntries = [];

  if (incident.created_at) {
    timelineEntries.push({ time: incident.created_at, event: 'Incident created' });
  }
  if (signal?.detected_at) {
    timelineEntries.push({ time: signal.detected_at, event: 'Signal detected' });
  }
  if (signal?.status === 'approved' || signal?.approved_at) {
    timelineEntries.push({ time: signal.approved_at || signal.detected_at || incident.created_at, event: 'Signal approved' });
  }
  timeline.forEach((log) => {
    const event = log.action?.replace(/\./g, ' ') || log.event;
    if (event) timelineEntries.push({ time: log.created_at, event: event.charAt(0).toUpperCase() + event.slice(1) });
  });
  if (incident.linearSyncedAt) {
    timelineEntries.push({ time: incident.linearSyncedAt, event: 'Engineering notified via Linear' });
  }

  timelineEntries.sort((a, b) => new Date(a.time) - new Date(b.time));

  const timelineMd = timelineEntries.length > 0
    ? timelineEntries.map((e) => `• ${formatUTC(e.time)} — ${e.event}`).join('\n')
    : '• No timeline events recorded.';

  const ticketRefs = linkedTickets.length > 0
    ? linkedTickets.slice(0, 10).map((t) => `• ${t.title || t.customer_name || t.id} (${t.status || 'open'})`).join('\n')
    : '• No linked tickets.';

  const description = [
    `# Incident Summary`,
    ``,
    `## Incident ID`,
    `INC-${incident.number || incident.id.slice(-6).toUpperCase()}`,
    ``,
    `## Signal`,
    signalName,
    ``,
    `## Status`,
    `${incident.status || 'open'}${incident.linearStatus ? ` → Linear: ${incident.linearStatus}` : ''}`,
    ``,
    `## Severity`,
    `${sevLabel} (Linear Priority: ${priorityLabel})`,
    ``,
    `## Category`,
    category,
    ``,
    `## Affected Customers`,
    String(affectedCustomers),
    ``,
    `## Affected Tickets`,
    String(affectedTickets),
    ``,
    `## Detection Time`,
    detectionTime,
    ``,
    `## Executive Summary`,
    aiSummary,
    ``,
    `## Root Cause`,
    rootCause,
    ``,
    `## Business Impact`,
    businessImpact.join('\n'),
    ``,
    `## Technical Impact`,
    technicalImpact.join('\n'),
    ``,
    `## Recommended Actions`,
    recommendedActions.join('\n'),
    ``,
    `## Linked Tickets`,
    ticketRefs,
    ``,
    `## Timeline`,
    timelineMd,
    ``,
    `## SignalDesk Metadata`,
    `| Field | Value |`,
    `|-------|-------|`,
    `| **Workspace** | ${workspaceName} |`,
    `| **Confidence** | ${confidence} |`,
    `| **Created by** | SignalDesk AI |`,
    `| **Source** | AI Incident Detection |`,
    `| **Incident ID** | ${incident.id} |`,
    signal ? `| **Signal ID** | ${signal.id} |` : null,
    `| **SignalDesk URL** | https://signaldesk.apps.lemma.work/incidents/${incident.id} |`,
    ``,
    `---`,
    `_This engineering handoff was automatically generated by SignalDesk._`,
  ].filter(Boolean).join('\n');

  return { title, description, priority: linearPriority, priorityLabel };
}

export async function createOrUpdateLinearIssue(incidentId) {
  const incident = await client.records.get('incidents', incidentId);
  if (!incident) throw new Error('Incident not found');

  const handoff = await buildEngineeringHandoff(incidentId);
  if (!handoff) throw new Error('Failed to build handoff');

  const orgId = '019ef98f-e90b-74df-9116-d0df1a4baeff';
  const teamId = '8016a82b-1e4c-40bc-b2c1-40c521897628';
  const config = { organizationId: orgId, authConfigName: 'linear' };

  let result;

  if (incident.linearIssueId) {
    const raw = await client.connectors.operations.execute(config, 'LINEAR_UPDATE_ISSUE', {
      issue_id: incident.linearIssueId,
      title: handoff.title,
      description: handoff.description,
      priority: handoff.priority,
    });
    const opResult = raw?.result || {};
    if (!opResult.id && !opResult.success) {
      throw new Error(opResult.error || 'Failed to update Linear issue');
    }
    result = {
      issueId: incident.linearIssueId,
      issueUrl: incident.linearIssueUrl || opResult.url || '',
      identifier: incident.linearIssueIdentifier || '',
    };
  } else {
    const raw = await client.connectors.operations.execute(config, 'LINEAR_CREATE_LINEAR_ISSUE', {
      team_id: teamId,
      title: handoff.title,
      description: handoff.description,
      priority: handoff.priority,
    });
    const opResult = raw?.result || {};
    const issueId = opResult.id;
    if (!issueId) throw new Error(opResult.error || 'Linear returned no issue ID');
    const issueUrl = opResult.url || opResult.ticket_url || '';
    const identifier = opResult.identifier || '';
    result = { issueId, issueUrl, identifier };
  }

  const now = new Date().toISOString();
  await client.records.update('incidents', incidentId, {
    linearIssueId: result.issueId,
    linearIssueUrl: result.issueUrl,
    linearIssueIdentifier: result.identifier,
    linearStatus: 'Todo',
    linearPriority: handoff.priorityLabel,
    linearSyncedAt: now,
  }).catch(() => {});

  await client.records.create('audit_logs', {
    id: crypto.randomUUID(),
    action: incident.linearIssueId ? 'linear.issue_updated' : 'linear.issue_created',
    actor_type: 'agent',
    actor_agent_name: 'System',
    resource_type: 'incident',
    resource_id: incidentId,
    ticket_id: '',
    details: { linearIssueId: result.issueId, linearIssueIdentifier: result.identifier, linearIssueUrl: result.issueUrl, priority: handoff.priorityLabel },
    workspaceId: incident.workspaceId || 'signaldesk',
    workspaceName: incident.workspaceName || 'SignalDesk',
    created_at: now,
  }).catch(() => {});

  return { ...result, syncedAt: now };
}
