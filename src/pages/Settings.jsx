import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import {
  Bot, Workflow, FunctionSquare, Database, Info, Mail, AlertTriangle, CheckCircle2, XCircle, Upload, Loader2, Check,
} from "lucide-react";
import client from "@/lib/lemmaClient";
import { seedWorkspace, checkSeedExists } from "@/lib/seedLoader";
import { useWorkspace, workspaces } from "@/context/WorkspaceContext";

function Section({ title, icon: Icon, children }) {
  return (
    <div className="rounded-xl border border-[#EFEFEF] bg-white p-5">
      <div className="flex items-center gap-3 mb-4">
        {Icon && <Icon size={18} className="text-zinc-500" />}
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Loader() {
  return <div className="h-4 w-full animate-pulse rounded bg-zinc-100" />;
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#EFEFEF] last:border-0">
      <span className="text-sm text-zinc-400">{label}</span>
      <span className="text-sm text-zinc-900 font-mono truncate max-w-[300px] ml-4">{value || "-"}</span>
    </div>
  );
}

export default function Settings() {
  const { workspace } = useWorkspace();
  const [agents, setAgents] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [funcs, setFuncs] = useState([]);
  const [tables, setTables] = useState([]);
  const [podInfo, setPodInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gmailStatus, setGmailStatus] = useState("checking");
  const [seeding, setSeeding] = useState(null);
  const [seedProgress, setSeedProgress] = useState({ done: 0, total: 0, msg: "" });
  const [seedDone, setSeedDone] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [a, w, f, t] = await Promise.allSettled([
          client.agents.list().catch(() => ({ items: [] })),
          client.workflows.list().catch(() => ({ items: [] })),
          client.functions.list().catch(() => ({ items: [] })),
          client.tables.list().catch(() => ({ items: [] })),
        ]);
        if (a.status === "fulfilled") setAgents(a.value.items || []);
        if (w.status === "fulfilled") setWorkflows(w.value.items || []);
        if (f.status === "fulfilled") setFuncs(f.value.items || []);
        if (t.status === "fulfilled") setTables(t.value.items || []);
        setPodInfo({ podId: client.podId });

        try {
          const surfaces = await (client.surfaces?.list?.() || Promise.resolve({ items: [] }));
          const gmail = (surfaces.items || []).find((s) => s.name === "gmail");
          setGmailStatus(gmail?.is_enabled ? "connected" : "disconnected");
        } catch {
          setGmailStatus("unknown");
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <motion.div
      className="flex flex-col min-h-full space-y-5 max-w-4xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-zinc-400">Pod configuration and system info.</p>
      </div>

      <Section title="Pod Info" icon={Info}>
        {loading ? <Loader /> : (
          <div className="space-y-1">
            <InfoRow label="Pod ID" value={podInfo?.podId} />
            <InfoRow label="API URL" value={client.apiUrl} />
            <InfoRow label="Auth URL" value={client.authUrl} />
          </div>
        )}
      </Section>

      {gmailStatus === "disconnected" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-amber-800">Gmail Connector Not Connected</h3>
              <p className="mt-1 text-sm text-amber-600">
                Email alerts for newly created incidents will be logged but not delivered.
                Connect Gmail in Lemma Console or contact your pod admin to enable it.
              </p>
            </div>
          </div>
        </div>
      )}

      <Section title="Integrations" icon={Mail}>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-[#EFEFEF] bg-white p-4">
            <div className="flex items-center gap-3">
              <Mail size={18} className="text-zinc-400" />
              <div>
                <p className="text-sm font-medium text-zinc-900">Gmail</p>
                <p className="text-xs text-zinc-400">Incident email alerts</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {gmailStatus === "checking" ? (
                <div className="h-2 w-2 animate-pulse rounded-full bg-zinc-300" />
              ) : gmailStatus === "connected" ? (
                <><CheckCircle2 size={16} className="text-green-500" /><span className="text-xs text-green-600">Connected</span></>
              ) : (
                <><XCircle size={16} className="text-red-500" /><span className="text-xs text-red-600">Not connected</span></>
              )}
            </div>
          </div>
        </div>
      </Section>

      <Section title="Demo Data" icon={Upload}>
        <p className="mb-4 text-sm text-zinc-400">
          Load production-quality demo data for the active workspace (<span className="text-zinc-900 font-medium">{workspace.name}</span>).
          This will create tickets, signals, incidents, and AI draft replies using the existing Lemma functions.
        </p>
        <div className="space-y-3">
          {workspaces.filter((w) => w.id !== "signaldesk").map((w) => (
            <div
              key={w.id}
              className="flex items-center justify-between rounded-lg border border-[#EFEFEF] bg-white p-4"
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white"
                  style={{ backgroundColor: w.accent }}
                >
                  {w.initials}
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-900">{w.name}</p>
                  <p className="text-xs text-zinc-400">{w.ticketCategories.length} categories · {w.subtitle}</p>
                </div>
              </div>
              <button
                disabled={seeding === w.id}
                onClick={async () => {
                  setSeeding(w.id);
                  setSeedProgress({ done: 0, total: 0, msg: "Starting..." });
                  setSeedDone(null);
                  try {
                    await seedWorkspace(w.id, (done, total, msg) => {
                      setSeedProgress({ done, total, msg });
                    });
                    setSeedDone(w.id);
                  } catch (err) {
                    console.error(err);
                  } finally {
                    setSeeding(null);
                  }
                }}
                className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                {seeding === w.id ? (
                  <><Loader2 size={14} className="animate-spin" /> Loading...</>
                ) : seedDone === w.id ? (
                  <><Check size={14} /> Loaded</>
                ) : (
                  <><Upload size={14} /> Load Data</>
                )}
              </button>
            </div>
          ))}
          {seeding && (
            <div className="rounded-lg border border-[#EFEFEF] bg-white p-4">
              <div className="flex items-center gap-3 mb-2">
                <Loader2 size={16} className="animate-spin text-zinc-500" />
                <span className="text-sm text-zinc-600">{seedProgress.msg}</span>
              </div>
              {seedProgress.total > 0 && (
                <div className="h-1.5 w-full rounded-full bg-zinc-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-zinc-900 transition-all duration-300"
                    style={{ width: `${(seedProgress.done / seedProgress.total) * 100}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </Section>

      <Section title={`Agents (${agents.length})`} icon={Bot}>
        {loading ? <Loader /> : agents.length === 0 ? (
          <p className="text-sm text-zinc-400">No agents found.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {agents.map((a) => (
              <div key={a.name || a.id} className="rounded-lg border border-[#EFEFEF] bg-white p-3">
                <p className="text-sm font-medium text-zinc-900 truncate">{a.name || a.id}</p>
                <p className="text-xs text-zinc-400 truncate">{a.description || ""}</p>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title={`Workflows (${workflows.length})`} icon={Workflow}>
        {loading ? <Loader /> : workflows.length === 0 ? (
          <p className="text-sm text-zinc-400">No workflows found.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {workflows.map((w) => (
              <div key={w.name || w.id} className="rounded-lg border border-[#EFEFEF] bg-white p-3">
                <p className="text-sm font-medium text-zinc-900 truncate">{w.name || w.id}</p>
                <p className="text-xs text-zinc-400 truncate">{w.description || ""}</p>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title={`Functions (${funcs.length})`} icon={FunctionSquare}>
        {loading ? <Loader /> : funcs.length === 0 ? (
          <p className="text-sm text-zinc-400">No functions found.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {funcs.map((f) => (
              <div key={f.name || f.id} className="rounded-lg border border-[#EFEFEF] bg-white p-3">
                <p className="text-sm font-medium text-zinc-900 truncate">{f.name || f.id}</p>
                <p className="text-xs text-zinc-400 truncate">{f.description || ""}</p>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title={`Tables (${tables.length})`} icon={Database}>
        {loading ? <Loader /> : tables.length === 0 ? (
          <p className="text-sm text-zinc-400">No tables found.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {tables.map((t) => (
              <div key={t.name || t.id} className="rounded-lg border border-[#EFEFEF] bg-white p-3">
                <p className="text-sm font-medium text-zinc-900 truncate">{t.name || t.id}</p>
                <p className="text-xs text-zinc-400 truncate">{t.columns?.length || 0} columns</p>
              </div>
            ))}
          </div>
        )}
      </Section>
    </motion.div>
  );
}
