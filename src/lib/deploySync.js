import client from "@/lib/lemmaClient";

const POD_ID = "019ef98f-eb70-71d8-a1e1-1aa54497dda0";

let _cache = { tables: null, functions: null, agents: null, workflows: null, schedules: null, surfaces: null, apps: null };

function clearCache() { _cache = { tables: null, functions: null, agents: null, workflows: null, schedules: null, surfaces: null, apps: null }; }

function _items(res) { return res?.items || res?.records || res?.data || []; }

export async function checkPodStatus() {
  try {
    const pod = await client.pods.get(POD_ID);
    return { ok: true, name: pod.name, id: pod.id, description: pod.description };
  } catch {
    return { ok: false, error: "Pod unreachable" };
  }
}

export async function listResources(type) {
  if (_cache[type]) return _cache[type];
  let res;
  switch (type) {
    case "tables": res = await client.tables.list({ podId: POD_ID }); break;
    case "functions": res = await client.functions.list({ podId: POD_ID }); break;
    case "agents": res = await client.agents.list({ podId: POD_ID }); break;
    case "workflows": res = await client.workflows.list({ podId: POD_ID }); break;
    case "schedules": res = await client.schedules.list({ podId: POD_ID }); break;
    case "apps": res = await client.apps.list({ podId: POD_ID }); break;
    default: return [];
  }
  _cache[type] = _items(res);
  return _cache[type];
}

export function getDeployInstructions() {
  return {
    cli: "lemma pods import <project-dir> --pod <pod-id> --upsert",
    script: "deploy-sync.ps1 -Command sync",
    note: "Deployment requires the Lemma CLI — run the PowerShell script from the project root.",
    podId: POD_ID,
    appUrl: "https://signaldesk.apps.lemma.work",
  };
}

export async function getResourceSummary() {
  const [tables, functions, agents, workflows, schedules, apps] = await Promise.all([
    listResources("tables"),
    listResources("functions"),
    listResources("agents"),
    listResources("workflows"),
    listResources("schedules"),
    listResources("apps"),
  ]);

  const checkCols = (tableName) => {
    const t = tables.find((x) => x.name === tableName);
    return t ? t.column_count || 0 : 0;
  };

  return {
    pod: await checkPodStatus(),
    tables: {
      total: tables.length,
      signals: checkCols("signals"),
      tickets: checkCols("tickets"),
      incidents: checkCols("incidents"),
    },
    functions: functions.length,
    agents: agents.length,
    workflows: workflows.length,
    schedules: schedules.length,
    apps: apps.map((a) => ({ name: a.name, status: a.status, url: a.url })),
    warnings: [
      ...(tables.length === 0 ? ["No tables found"] : []),
      ...(!functions.some((f) => f.name === "create_signal" && f.status === "READY") ? ["create_signal function not ready"] : []),
      ...(!functions.some((f) => f.name === "link_incident" && f.status === "READY") ? ["link_incident function not ready"] : []),
      ...(!functions.some((f) => f.name === "create_ticket" && f.status === "READY") ? ["create_ticket function not ready"] : []),

    ],
  };
}

export async function runResourceDoctor() {
  try {
    const result = await client.api.post(`/api/v1/pods/${POD_ID}/doctor`);
    return { ok: true, issues: result?.issues || result?.warnings || [] };
  } catch {
    const tables = await listResources("tables");
    const issues = [];
    if (!tables.find((t) => t.name === "signals")) issues.push("signals table missing");
    if (!tables.find((t) => t.name === "tickets")) issues.push("tickets table missing");
    if (!tables.find((t) => t.name === "incidents")) issues.push("incidents table missing");
    return { ok: issues.length === 0, issues };
  }
}

export async function checkTableSchema(tableName) {
  try {
    const cols = await client.tables.getColumns(tableName);
    const names = cols.map((c) => c.name);
    return { ok: true, table: tableName, columns: names };
  } catch {
    return { ok: false, table: tableName, error: "Could not fetch schema" };
  }
}
