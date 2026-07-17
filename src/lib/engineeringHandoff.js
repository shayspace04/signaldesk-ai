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
    const issueUrl = incident.linearIssueUrl || opResult.url || '';
    const identifier = incident.linearIssueIdentifier || opResult.identifier || extractIdentifierFromUrl(issueUrl);
    result = { issueId: incident.linearIssueId, issueUrl, identifier };
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
    const identifier = opResult.identifier || extractIdentifierFromUrl(issueUrl);
    result = { issueId, issueUrl, identifier };
  }

  const now = new Date().toISOString();
  const updates = {
    linearIssueId: result.issueId,
    linearIssueUrl: result.issueUrl,
    linearIssueIdentifier: result.identifier,
    linearStatus: 'Todo',
    linearPriority: handoff.priorityLabel,
    linearSyncedAt: now,
  };

  if (!result.identifier || !result.issueUrl) {
    try {
      const verified = await verifyLinearIssue(result.issueId);
      if (verified && verified.id) {
        if (!result.identifier && verified.identifier) updates.linearIssueIdentifier = verified.identifier;
        if (!result.issueUrl && verified.url) updates.linearIssueUrl = verified.url;
        if (verified.state?.name) updates.linearStatus = verified.state.name;
        if (verified.priority != null) {
          const labels = { 0: 'No priority', 1: 'Urgent', 2: 'High', 3: 'Medium', 4: 'Low' };
          updates.linearPriority = labels[verified.priority] || handoff.priorityLabel;
        }
      }
    } catch {}
  }

  await client.records.update('incidents', incidentId, updates).catch(() => {});

  await client.records.create('audit_logs', {
    id: crypto.randomUUID(),
    action: incident.linearIssueId ? 'linear.issue_updated' : 'linear.issue_created',
    actor_type: 'agent',
    actor_agent_name: 'System',
    resource_type: 'incident',
    resource_id: incidentId,
    ticket_id: '',
    details: { linearIssueId: result.issueId, linearIssueIdentifier: updates.linearIssueIdentifier, linearIssueUrl: updates.linearIssueUrl, priority: handoff.priorityLabel },
    workspaceId: incident.workspaceId || 'signaldesk',
    workspaceName: incident.workspaceName || 'SignalDesk',
    created_at: now,
  }).catch(() => {});

  return { ...result, syncedAt: now, identifier: updates.linearIssueIdentifier };
}

function extractIdentifierFromUrl(url) {
  if (!url) return '';
  const match = url.match(/\/issue\/([A-Z0-9]+-\d+)/i);
  return match ? match[1] : '';
}

export async function verifyLinearIssue(issueId) {
  const config = { organizationId: '019ef98f-e90b-74df-9116-d0df1a4baeff', authConfigName: 'linear' };
  const raw = await client.connectors.operations.execute(config, 'LINEAR_GET_LINEAR_ISSUE', { issue_id: issueId });
  return raw?.result || {};
}

export async function backfillLinearMetadata(incidentId) {
  const incident = await client.records.get('incidents', incidentId);
  if (!incident || !incident.linearIssueId) return null;
  const issue = await verifyLinearIssue(incident.linearIssueId);
  if (!issue || !issue.id) return null;

  const identifier = issue.identifier || extractIdentifierFromUrl(issue.url) || '';
  const updates = {};
  if (!incident.linearIssueIdentifier && identifier) updates.linearIssueIdentifier = identifier;
  if (!incident.linearIssueUrl && issue.url) updates.linearIssueUrl = issue.url;
  if (issue.state?.name) updates.linearStatus = issue.state.name;
  if (issue.priority != null) {
    const labels = { 0: 'No priority', 1: 'Urgent', 2: 'High', 3: 'Medium', 4: 'Low' };
    updates.linearPriority = labels[issue.priority] || '';
  }
  if (Object.keys(updates).length > 0) {
    updates.linearSyncedAt = new Date().toISOString();
    await client.records.update('incidents', incidentId, updates).catch(() => {});
  }
  return { ...incident, ...updates };
}

export async function addLinearComment(incidentId, body, userName) {
  const incident = await client.records.get('incidents', incidentId);
  if (!incident || !incident.linearIssueId) throw new Error('No Linear issue linked to this incident');

  const config = { organizationId: '019ef98f-e90b-74df-9116-d0df1a4baeff', authConfigName: 'linear' };
  const raw = await client.connectors.operations.execute(config, 'LINEAR_CREATE_LINEAR_COMMENT', {
    issue_id: incident.linearIssueId,
    body: `**${userName}** (via SignalDesk):\n\n${body}`,
  });
  console.log('Linear comment create response', raw);

  const result = raw?.result || raw?.data || raw || {};
  const commentId = result.id || result.comment_id || result._id;
  if (!commentId) {
    throw new Error(result.error || result.message || 'Linear did not create the comment');
  }

  try {
    const verifyRaw = await client.connectors.operations.execute(config, 'LINEAR_GET_COMMENT', { comment_id: commentId });
    console.log('Linear comment verify response', verifyRaw);
    return { id: commentId, body, user: userName, createdAt: new Date().toISOString(), verified: true };
  } catch {
    console.warn('Comment verification skipped — comment was already created in Linear');
    return { id: commentId, body, user: userName, createdAt: new Date().toISOString(), verified: false };
  }
}

export async function fetchLinearComments(incidentId) {
  const incident = await client.records.get('incidents', incidentId);
  if (!incident || !incident.linearIssueId) return [];

  const config = { organizationId: '019ef98f-e90b-74df-9116-d0df1a4baeff', authConfigName: 'linear' };
  try {
    const raw = await client.connectors.operations.execute(config, 'LINEAR_RUN_QUERY_OR_MUTATION', {
      query: `query($issueId: String!) { issue(id: $issueId) { comments { nodes { id body user { name } createdAt } } } }`,
      variables: { issueId: incident.linearIssueId },
    });
    const result = raw?.result || {};
    const data = result.data || result;
    const nodes = data?.issue?.comments?.nodes || [];
    return nodes
      .filter((c) => c && c.id)
      .map((c) => ({
        id: c.id,
        body: (c.body || '').replace(/\*\*(.+?)\*\*\s*\(via SignalDesk\):\n*/g, '').trim(),
        user: c.user?.name || 'Unknown',
        createdAt: c.createdAt || '',
      }))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  } catch {
    try {
      const raw = await client.connectors.operations.execute(config, 'LINEAR_LIST_COMMENTS', {});
      const result = raw?.result || {};
      const items = result.items || result.data || (Array.isArray(result) ? result : []);
      const list = Array.isArray(items) ? items : [];
      return list
        .filter((c) => c && c.id)
        .map((c) => ({
          id: c.id,
          body: (c.body || '').replace(/\*\*(.+?)\*\*\s*\(via SignalDesk\):\n*/g, '').trim(),
          user: c.user?.name || c.userName || c.user_name || 'Unknown',
          createdAt: c.createdAt || c.created_at || '',
        }))
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    } catch {
      return [];
    }
  }
}
