import { motion } from "framer-motion";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Bot, Workflow, FunctionSquare, Database, Info, Mail, AlertTriangle, CheckCircle2,
  XCircle, Upload, Loader2, Check, Shield, UserCheck, UserCog, Bug, RefreshCw,
  Download, Trash2, Wrench, ExternalLink, ChevronDown, ChevronRight, Settings2,
  Radio, Link2, BookOpen, Activity, Sliders, Users, Zap, Eye, Play, FileText, Tag,
  BarChart3,
} from "lucide-react";
import client from "@/lib/lemmaClient";
import { seedWorkspace, destroySeeds } from "@/lib/seedLoader";
import { migrateWorkspaces, validateWorkspaces } from "@/lib/workspaceMigration";
import { useWorkspace, workspaces } from "@/context/WorkspaceContext";
import { emitRefresh } from "@/lib/refreshEvents";
import { useAIDetectionConfig } from "@/lib/aiDetectionConfig";
import { computeTicketSimilarity, runDetectionForAll } from "@/lib/aiDetectionEngine";
import { runIntegrationTest } from "@/lib/aiDetectionTest";
import ThemeToggle from "@/components/common/ThemeToggle";
import useRole from "@/hooks/useRole";

/* ------------------------------------------------------------------ */
/* Reusable UI Primitives (preserve existing SignalDesk style)        */
/* ------------------------------------------------------------------ */

function Section({ title, icon: Icon, children }) {
  return (
    <div className="rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-5">
        {Icon && <Icon size={18} className="text-zinc-500 dark:text-[#A1A1AA]" />}
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-[#FAFAFA]">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function CollapsibleSection({ title, icon: Icon, defaultOpen, badge, children }) {
  const [open, setOpen] = useState(defaultOpen !== false);
  return (
    <div className="rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] shadow-sm overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-6 py-4 hover:bg-zinc-50 dark:hover:bg-[#202024] transition-colors">
        <div className="flex items-center gap-3">
          {Icon && <Icon size={18} className="text-zinc-500 dark:text-[#A1A1AA]" />}
          <span className="text-sm font-semibold text-zinc-900 dark:text-[#FAFAFA]">{title}</span>
          {badge != null && (
            <span className="rounded-md bg-zinc-100 dark:bg-[#27272A] px-2 py-0.5 text-[11px] font-medium text-zinc-500 dark:text-[#A1A1AA]">{badge}</span>
          )}
        </div>
        {open ? <ChevronDown size={16} className="text-zinc-400" /> : <ChevronRight size={16} className="text-zinc-400" />}
      </button>
      {open && <div className="px-6 pb-5">{children}</div>}
    </div>
  );
}

function InfoRow({ label, value, children }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border dark:border-[#2A2A2E] last:border-0">
      <span className="text-sm text-muted dark:text-[#A1A1AA]">{label}</span>
      {children || <span className="text-sm text-zinc-900 dark:text-[#FAFAFA] font-mono truncate max-w-[300px] ml-4">{value ?? "-"}</span>}
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange, disabled }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border dark:border-[#2A2A2E] last:border-0">
      <div className="min-w-0 flex-1 pr-4">
        <p className="text-sm font-medium text-zinc-900 dark:text-[#FAFAFA]">{label}</p>
        {description && <p className="text-xs text-muted dark:text-[#A1A1AA] mt-0.5">{description}</p>}
      </div>
      <button
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ${
          checked ? "bg-zinc-900 dark:bg-zinc-700" : "bg-zinc-200 dark:bg-[#27272A]"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        role="switch" aria-checked={checked}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? "translate-x-[22px]" : "translate-x-[3px]"}`} />
      </button>
    </div>
  );
}

function SliderControl({ label, value, min, max, step, suffix, onChange }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="py-2.5 border-b border-border dark:border-[#2A2A2E] last:border-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-zinc-900 dark:text-[#FAFAFA]">{label}</span>
        <span className="text-sm font-mono text-zinc-500 dark:text-[#A1A1AA] tabular-nums">{value}{suffix || ""}</span>
      </div>
      <div className="relative h-2">
        <div className="absolute inset-0 rounded-full bg-zinc-100 dark:bg-[#202024]" />
        <div className="absolute left-0 top-0 h-full rounded-full bg-zinc-900 dark:bg-zinc-600 transition-all" style={{ width: `${pct}%` }} />
        <input type="range" min={min} max={max} step={step || 1} value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
      </div>
    </div>
  );
}

function NumberInput({ label, value, min, max, suffix, onChange }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border dark:border-[#2A2A2E] last:border-0">
      <span className="text-sm font-medium text-zinc-900 dark:text-[#FAFAFA]">{label}</span>
      <div className="flex items-center gap-2">
        <input type="number" min={min} max={max} value={value}
          onChange={(e) => { const v = parseInt(e.target.value) || 0; onChange(Math.max(min || 0, Math.min(max || 999, v))); }}
          className="w-16 rounded-lg border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] px-2.5 py-1.5 text-sm font-mono text-zinc-900 dark:text-[#FAFAFA] text-center outline-none focus:border-zinc-300 dark:focus:border-zinc-600" />
        {suffix && <span className="text-xs text-muted dark:text-[#A1A1AA]">{suffix}</span>}
      </div>
    </div>
  );
}

function SelectControl({ label, value, options, onChange }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border dark:border-[#2A2A2E] last:border-0">
      <span className="text-sm font-medium text-zinc-900 dark:text-[#FAFAFA]">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] px-3 py-1.5 text-sm text-zinc-900 dark:text-[#FAFAFA] outline-none focus:border-zinc-300 dark:focus:border-zinc-600">
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function StatusDot({ status }) {
  const colors = { connected: "bg-emerald-500", disconnected: "bg-red-500", checking: "bg-amber-400 animate-pulse", unknown: "bg-zinc-300" };
  return <span className={`inline-block h-2 w-2 rounded-full ${colors[status] || colors.unknown}`} />;
}

/* ------------------------------------------------------------------ */
/* Connector card                                                      */
/* ------------------------------------------------------------------ */

function ConnectorCard({ icon: Icon, name, description, status, connectedAccount, lastSync, onTest, onReconnect, testing }) {
  return (
    <div className="rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-zinc-100 dark:bg-[#202024] p-2.5">
            {Icon && <Icon size={20} className="text-zinc-500 dark:text-[#A1A1AA]" />}
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-[#FAFAFA]">{name}</p>
            <p className="text-xs text-muted dark:text-[#A1A1AA]">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusDot status={status} />
          <span className={`text-xs font-medium ${
            status === "connected" ? "text-emerald-600 dark:text-emerald-400" :
            status === "disconnected" ? "text-red-600 dark:text-red-400" : "text-zinc-500"
          }`}>
            {status === "connected" ? "Connected" : status === "disconnected" ? "Disconnected" : "Checking..."}
          </span>
        </div>
      </div>
      {status === "connected" && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {connectedAccount && <InfoRow label="Account" value={connectedAccount} />}
          {lastSync && <InfoRow label="Last Sync" value={lastSync} />}
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <button onClick={onTest} disabled={testing || status === "checking"}
          className="flex items-center gap-1.5 rounded-lg border border-border dark:border-[#2A2A2E] px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-[#A1A1AA] hover:bg-zinc-50 dark:hover:bg-[#27272A] transition-colors disabled:opacity-50">
          {testing ? <><Loader2 size={12} className="animate-spin" /> Testing</> : <><RefreshCw size={12} /> Test Connection</>}
        </button>
        {status === "disconnected" && (
          <button onClick={onReconnect}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 dark:hover:bg-zinc-600 transition-colors">
            <ExternalLink size={12} /> Reconnect
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Workflow Preview                                                    */
/* ------------------------------------------------------------------ */

function WorkflowStep({ icon: Icon, label, value, active }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${active ? "bg-zinc-100 dark:bg-[#202024]" : ""}`}>
      {Icon && <Icon size={16} className={active ? "text-zinc-900 dark:text-[#FAFAFA]" : "text-zinc-400 dark:text-[#71717A]"} />}
      <span className={`text-sm flex-1 ${active ? "text-zinc-900 dark:text-[#FAFAFA] font-medium" : "text-zinc-500 dark:text-[#A1A1AA]"}`}>{label}</span>
      {value && <span className="text-xs font-mono text-zinc-500 dark:text-[#A1A1AA] bg-zinc-100 dark:bg-[#202024] rounded-md px-2 py-0.5">{value}</span>}
    </div>
  );
}

function WorkflowPreview({ config }) {
  const steps = [
    { icon: FileText, label: "Tickets", value: null },
    { icon: Tag, label: "Minimum Similar Tickets", value: config.minSimilarTickets, active: true },
    { icon: Sliders, label: "Similarity", value: `${config.similarityThreshold}%`, active: true },
    { icon: Radio, label: "Signal Created", value: config.autoCreateSignals ? "ON" : "OFF", active: config.autoCreateSignals },
    { icon: Shield, label: "Risk \u2265 Threshold", value: `${config.incidentEscalationThreshold}%`, active: config.autoCreateSignals && config.autoCreateIncident },
    { icon: Shield, label: "Incident Created", value: config.autoCreateIncident ? "ON" : "OFF", active: config.autoCreateIncident },
    { icon: ExternalLink, label: "Linear", value: config.autoCreateLinearIssue ? "ON" : "OFF", active: config.autoCreateLinearIssue },
    { icon: Mail, label: "Gmail", value: config.autoSendGmailAlerts ? "ON" : "OFF", active: config.autoSendGmailAlerts },
    { icon: BookOpen, label: "Knowledge Base", value: config.autoGenerateKnowledgeArticles ? "ON" : "OFF", active: config.autoGenerateKnowledgeArticles },
  ];
  const activeCount = steps.filter((s) => s.active !== false).length;

  return (
    <div className="rounded-xl border border-border dark:border-[#2A2A2E] bg-zinc-50/50 dark:bg-[#202024]/50 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Activity size={16} className="text-zinc-500 dark:text-[#A1A1AA]" />
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-[#FAFAFA]">Current AI Workflow</h3>
        <span className="text-[10px] font-medium text-zinc-400 dark:text-[#71717A] ml-auto">{activeCount} steps active</span>
      </div>
      <div className="space-y-0.5">
        {steps.map((step, i) => (
          <div key={i}>
            <WorkflowStep icon={step.icon} label={step.label} value={step.value} active={step.active !== false} />
            {i < steps.length - 1 && (
              <div className="flex items-center ml-[18px] h-4">
                <div className="w-px h-full bg-zinc-200 dark:bg-[#27272A]" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Configuration Summary                                               */
/* ------------------------------------------------------------------ */

function ConfigSummary({ config }) {
  const items = useMemo(() => [
    { label: "Detection Mode", value: config.detectionMode.charAt(0).toUpperCase() + config.detectionMode.slice(1) },
    { label: "Minimum Tickets", value: config.minSimilarTickets },
    { label: "Similarity Threshold", value: `${config.similarityThreshold}%` },
    { label: "Time Window", value: config.timeWindow >= 24 ? `${config.timeWindow / 24}d` : `${config.timeWindow}h` },
    { label: "Signal Risk Threshold", value: `${config.signalRiskThreshold}%` },
    { label: "Incident Threshold", value: `${config.incidentEscalationThreshold}%` },
    { label: "Signals", value: config.autoCreateSignals ? "Auto" : "Manual" },
    { label: "Incidents", value: config.autoCreateIncident ? "Auto" : "Manual" },
    { label: "Linear", value: config.autoCreateLinearIssue ? "Auto" : "Manual" },
    { label: "Gmail", value: config.autoSendGmailAlerts ? "Enabled" : "Disabled" },
    { label: "Knowledge", value: config.autoGenerateKnowledgeArticles ? "Auto" : "Manual" },
  ], [config]);

  return (
    <div className="rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 size={16} className="text-zinc-500 dark:text-[#A1A1AA]" />
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-[#FAFAFA]">Current Policy</h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {items.map((item) => (
          <div key={item.label} className="rounded-lg bg-zinc-50 dark:bg-[#202024] p-3">
            <p className="text-[10px] font-medium text-muted dark:text-[#A1A1AA] uppercase tracking-wide">{item.label}</p>
            <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-[#FAFAFA]">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Simulation Panel                                                    */
/* ------------------------------------------------------------------ */

function SimulationPanel({ config }) {
  const [form, setForm] = useState({ title: "", description: "", category: "", customerEmail: "", numSimilar: 3 });
  const [result, setResult] = useState(null);

  const handleSimulate = useCallback(() => {
    const mockTicket = {
      title: form.title || "Sample ticket title",
      body: form.description || "",
      category: form.category || "billing",
      customer_email: form.customerEmail || "customer@example.com",
      priority: "high",
      tags: [],
    };
    const similarTicket = {
      title: form.title ? `${form.title} — similar report` : "Related issue report",
      body: form.description ? `${form.description.slice(0, 50)} related details` : "Customer reported similar symptoms",
      category: form.category || "billing",
      customer_email: form.customerEmail || "customer@example.com",
      priority: "high",
      tags: [],
    };
    const thirdTicket = {
      title: form.title ? `${form.title.slice(0, 30)} variant` : "Another similar occurrence",
      body: "Same underlying cause identified",
      category: form.category || "billing",
      customer_email: "different@example.com",
      priority: "normal",
      tags: [],
    };

    const tickets = [mockTicket, similarTicket, ...(form.numSimilar >= 3 ? [thirdTicket] : [])];
    const sim = computeTicketSimilarity(mockTicket, similarTicket);
    const avgSim = form.numSimilar >= 3
      ? (sim.total + computeTicketSimilarity(mockTicket, thirdTicket).total + computeTicketSimilarity(similarTicket, thirdTicket).total) / 3
      : sim.total;

    const confPct = Math.round(
      Math.min(form.numSimilar / 10, 1) * 0.3 +
      avgSim * 0.35 +
      0.2 +
      Math.min(1, 1) * 0.15
    ) * 100;

    const riskRaw =
      Math.min(form.numSimilar / 5, 1) * 3 +
      0.75 * 2 +
      0.5 +
      0.5;

    const risk = Math.min(Math.round(riskRaw * 10) / 10, 10);

    const meetsSim = avgSim >= config.similarityThreshold / 100;
    const meetsCount = form.numSimilar >= config.minSimilarTickets;
    const meetsRisk = risk >= config.incidentEscalationThreshold / 10;

    setResult({
      similarity: Math.round(avgSim * 100),
      confidence: confPct,
      risk,
      signal: meetsSim && meetsCount,
      incident: meetsSim && meetsCount && meetsRisk && config.autoCreateIncident,
      linear: meetsSim && meetsCount && config.autoCreateLinearIssue,
      gmail: meetsSim && meetsCount && config.autoSendGmailAlerts,
      knowledge: meetsSim && meetsCount && config.autoGenerateKnowledgeArticles,
    });
  }, [form, config]);

  return (
    <div className="rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] p-5">
      <div className="flex items-center gap-2 mb-4">
        <Play size={16} className="text-zinc-500 dark:text-[#A1A1AA]" />
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-[#FAFAFA]">AI Detection Simulator</h3>
        <span className="text-[10px] text-muted dark:text-[#A1A1AA] ml-auto">Preview only · No records created</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3">
          <input placeholder="Sample Ticket Title" value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full rounded-lg border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] px-3 py-2 text-sm text-zinc-900 dark:text-[#FAFAFA] outline-none focus:border-zinc-300 dark:focus:border-zinc-600 placeholder:text-zinc-400" />
          <textarea placeholder="Sample Description" rows={2} value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded-lg border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] px-3 py-2 text-sm text-zinc-900 dark:text-[#FAFAFA] outline-none focus:border-zinc-300 dark:focus:border-zinc-600 placeholder:text-zinc-400 resize-none" />
          <div className="grid grid-cols-2 gap-2">
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="rounded-lg border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] px-3 py-2 text-sm text-zinc-900 dark:text-[#FAFAFA] outline-none">
              <option value="billing">Billing</option>
              <option value="technical">Technical</option>
              <option value="account">Account</option>
              <option value="security">Security</option>
              <option value="general">General</option>
            </select>
            <input type="number" min={1} max={20} value={form.numSimilar}
              onChange={(e) => setForm({ ...form, numSimilar: parseInt(e.target.value) || 1 })}
              className="rounded-lg border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] px-3 py-2 text-sm text-zinc-900 dark:text-[#FAFAFA] outline-none focus:border-zinc-300 text-center" placeholder="Similar tickets" />
          </div>
          <button onClick={handleSimulate}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-zinc-900 dark:bg-zinc-700 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:hover:bg-zinc-600 transition-colors">
            <Zap size={14} /> Simulate Detection
          </button>
        </div>
        <div className="rounded-lg border border-border dark:border-[#2A2A2E] bg-zinc-50/50 dark:bg-[#202024]/50 p-4">
          {!result ? (
            <div className="flex items-center justify-center h-full text-sm text-muted dark:text-[#A1A1AA]">
              <Eye size={32} className="opacity-20 mr-2" /> Enter details and click Simulate
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted dark:text-[#A1A1AA]">Similarity</span>
                <span className={`text-sm font-bold tabular-nums ${result.similarity >= config.similarityThreshold ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500"}`}>{result.similarity}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted dark:text-[#A1A1AA]">Confidence</span>
                <span className="text-sm font-bold tabular-nums text-zinc-900 dark:text-[#FAFAFA]">{result.confidence}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted dark:text-[#A1A1AA]">Risk Score</span>
                <span className={`text-sm font-bold tabular-nums ${result.risk >= config.incidentEscalationThreshold / 10 ? "text-red-600 dark:text-red-400" : "text-zinc-500"}`}>{result.risk}/10</span>
              </div>
              <hr className="border-border dark:border-[#2A2A2E]" />
              <div className="grid grid-cols-2 gap-1.5">
                <SimBadge label="Signal" active={result.signal} />
                <SimBadge label="Incident" active={result.incident} />
                <SimBadge label="Linear" active={result.linear} />
                <SimBadge label="Gmail" active={result.gmail} />
                <SimBadge label="Knowledge" active={result.knowledge} className="col-span-2" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SimBadge({ label, active, className }) {
  return (
    <div className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium ${active ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300" : "bg-zinc-100 dark:bg-[#202024] text-zinc-400 dark:text-[#71717A]"} ${className || ""}`}>
      {active ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
      {label}
      {active ? " YES" : " NO"}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* AI Detection Settings (full card with tabs)                        */
/* ------------------------------------------------------------------ */

function AIDetectionSettings({ workspaceId }) {
  const { config, updateConfig, resetConfig } = useAIDetectionConfig(workspaceId);

  const timeWindowOptions = [
    { value: 1, label: "1 hour" },
    { value: 6, label: "6 hours" },
    { value: 12, label: "12 hours" },
    { value: 24, label: "24 hours" },
    { value: 48, label: "48 hours" },
    { value: 168, label: "7 days" },
  ];

  const modeOptions = [
    { value: "conservative", label: "Conservative" },
    { value: "balanced", label: "Balanced" },
    { value: "aggressive", label: "Aggressive" },
  ];

  /* Derive aggressive detection: scale thresholds based on mode */
  const modeMultiplier = useMemo(() => {
    switch (config.detectionMode) {
      case "conservative": return { sim: 1.1, risk: 0.9, min: 1.5 };
      case "aggressive": return { sim: 0.8, risk: 1.15, min: 0.6 };
      default: return { sim: 1, risk: 1, min: 1 };
    }
  }, [config.detectionMode]);

  return (
    <div className="space-y-5">
      {/* Detection Mode + Core Thresholds */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] p-4">
          <div className="flex items-center gap-2 mb-3"><Settings2 size={15} className="text-zinc-500" /><h3 className="text-sm font-semibold text-zinc-900 dark:text-[#FAFAFA]">Detection Tuning</h3></div>
          <SelectControl label="Detection Mode" value={config.detectionMode} options={modeOptions} onChange={(v) => updateConfig({ detectionMode: v })} />
          <NumberInput label="Min Similar Tickets" value={config.minSimilarTickets} min={1} max={20} onChange={(v) => updateConfig({ minSimilarTickets: v })} />
          <SliderControl label="Similarity Threshold" value={config.similarityThreshold} min={50} max={100} suffix="%" onChange={(v) => updateConfig({ similarityThreshold: v })} />
          <SelectControl label="Time Window" value={config.timeWindow} options={timeWindowOptions} onChange={(v) => updateConfig({ timeWindow: parseInt(v) })} />
        </div>

        <div className="rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] p-4">
          <div className="flex items-center gap-2 mb-3"><Users size={15} className="text-zinc-500" /><h3 className="text-sm font-semibold text-zinc-900 dark:text-[#FAFAFA]">Impact & Risk</h3></div>
          <NumberInput label="Min Customers Affected" value={config.minCustomersAffected} min={1} max={100} onChange={(v) => updateConfig({ minCustomersAffected: v })} />
          <SliderControl label="Signal Risk Threshold" value={config.signalRiskThreshold} min={0} max={100} suffix="%" onChange={(v) => updateConfig({ signalRiskThreshold: v })} />
          <SliderControl label="Incident Escalation Threshold" value={config.incidentEscalationThreshold} min={0} max={100} suffix="%" onChange={(v) => updateConfig({ incidentEscalationThreshold: v })} />
        </div>

        <div className="rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] p-4">
          <div className="flex items-center gap-2 mb-3"><Zap size={15} className="text-zinc-500" /><h3 className="text-sm font-semibold text-zinc-900 dark:text-[#FAFAFA]">Mode Preview</h3></div>
          <div className="space-y-2 text-xs text-muted dark:text-[#A1A1AA]">
            <p><span className="font-medium text-zinc-900 dark:text-[#FAFAFA]">Effective Min Similarity:</span> {Math.round(config.similarityThreshold * modeMultiplier.sim)}%</p>
            <p><span className="font-medium text-zinc-900 dark:text-[#FAFAFA]">Effective Min Tickets:</span> {Math.max(1, Math.round(config.minSimilarTickets * modeMultiplier.min))}</p>
            <p><span className="font-medium text-zinc-900 dark:text-[#FAFAFA]">Effective Risk Threshold:</span> {Math.round(config.incidentEscalationThreshold * modeMultiplier.risk)}%</p>
            <p className="pt-1 text-[10px] text-zinc-400">{config.detectionMode === "conservative" ? "Requires higher confidence before acting" : config.detectionMode === "aggressive" ? "Acts on weaker signals with lower thresholds" : "Standard detection with default thresholds"}</p>
          </div>
        </div>
      </div>

      {/* Automation Toggles */}
      <div className="rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] p-4">
        <div className="flex items-center gap-2 mb-3"><Activity size={15} className="text-zinc-500" /><h3 className="text-sm font-semibold text-zinc-900 dark:text-[#FAFAFA]">Automation</h3></div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-[10px] font-semibold text-muted dark:text-[#A1A1AA] uppercase tracking-wide mb-1 flex items-center gap-1"><Radio size={11} /> Signal Automation</p>
            <ToggleRow label="Auto Create Signals" checked={config.autoCreateSignals} onChange={(v) => updateConfig({ autoCreateSignals: v })} />
            <ToggleRow label="Auto Merge Similar Signals" checked={config.autoMergeSimilarSignals} onChange={(v) => updateConfig({ autoMergeSimilarSignals: v })} />
            <ToggleRow label="Semantic Matching" checked={config.semanticMatching} onChange={(v) => updateConfig({ semanticMatching: v })} />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-muted dark:text-[#A1A1AA] uppercase tracking-wide mb-1 flex items-center gap-1"><Shield size={11} /> Incident Automation</p>
            <ToggleRow label="Auto Create Incident" checked={config.autoCreateIncident} onChange={(v) => updateConfig({ autoCreateIncident: v })} />
            <ToggleRow label="Require Manager Approval" description="Before creating incident" checked={config.requireManagerApprovalBeforeIncident} onChange={(v) => updateConfig({ requireManagerApprovalBeforeIncident: v })} />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-muted dark:text-[#A1A1AA] uppercase tracking-wide mb-1 flex items-center gap-1"><ExternalLink size={11} /> Engineering Automation</p>
            <ToggleRow label="Auto Create Linear Issue" checked={config.autoCreateLinearIssue} onChange={(v) => updateConfig({ autoCreateLinearIssue: v })} />
            <ToggleRow label="Auto Sync Engineering Status" checked={config.autoSyncEngineeringStatus} onChange={(v) => updateConfig({ autoSyncEngineeringStatus: v })} />
            <ToggleRow label="Auto Sync Engineering Notes" checked={config.autoSyncEngineeringNotes} onChange={(v) => updateConfig({ autoSyncEngineeringNotes: v })} />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-muted dark:text-[#A1A1AA] uppercase tracking-wide mb-1 flex items-center gap-1"><Mail size={11} /> Communication</p>
            <ToggleRow label="Auto Send Gmail Alerts" checked={config.autoSendGmailAlerts} onChange={(v) => updateConfig({ autoSendGmailAlerts: v })} />
            <ToggleRow label="Auto Notify Managers" checked={config.autoNotifyManagers} onChange={(v) => updateConfig({ autoNotifyManagers: v })} />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-muted dark:text-[#A1A1AA] uppercase tracking-wide mb-1 flex items-center gap-1"><BookOpen size={11} /> Knowledge</p>
            <ToggleRow label="Auto Generate Articles" checked={config.autoGenerateKnowledgeArticles} onChange={(v) => updateConfig({ autoGenerateKnowledgeArticles: v })} />
            <ToggleRow label="Auto Update Existing" checked={config.autoUpdateExistingKnowledge} onChange={(v) => updateConfig({ autoUpdateExistingKnowledge: v })} />
          </div>
        </div>
      </div>

      {/* Workflow Preview + Config Summary */}
      <div className="grid gap-5 sm:grid-cols-2">
        <WorkflowPreview config={config} />
        <ConfigSummary config={config} />
      </div>

      {/* Simulator */}
      <SimulationPanel config={config} />

      {/* Reset */}
      <div className="flex justify-end">
        <button onClick={resetConfig}
          className="flex items-center gap-1.5 rounded-lg border border-border dark:border-[#2A2A2E] px-3 py-1.5 text-xs font-medium text-zinc-500 dark:text-[#A1A1AA] hover:bg-zinc-50 dark:hover:bg-[#27272A] transition-colors">
          <RefreshCw size={12} /> Reset to Defaults
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Settings Page                                                  */
/* ------------------------------------------------------------------ */

export default function Settings() {
  const { workspace, setWorkspace, workspaceId } = useWorkspace();
  const { role, setRole, permissions, loading: roleLoading } = useRole();
  const [agents, setAgents] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [funcs, setFuncs] = useState([]);
  const [tables, setTables] = useState([]);
  const [podInfo, setPodInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gmailStatus, setGmailStatus] = useState("checking");
  const [gmailAccount, setGmailAccount] = useState(null);
  const [gmailLastSync, setGmailLastSync] = useState(null);
  const [linearStatus, setLinearStatus] = useState("checking");
  const [linearTesting, setLinearTesting] = useState(false);
  const [seeding, setSeeding] = useState(null);
  const [seedProgress, setSeedProgress] = useState({ done: 0, total: 0, msg: "" });
  const [seedDone, setSeedDone] = useState(null);
  const [devRunning, setDevRunning] = useState(null);
  const [validateResult, setValidateResult] = useState(null);
  const [validateLoading, setValidateLoading] = useState(false);
  const [destroyConfirm, setDestroyConfirm] = useState(false);
  const [destroyRunning, setDestroyRunning] = useState(false);
  const [destroyProgress, setDestroyProgress] = useState({ done: 0, total: 0, msg: "" });
  const [migrateProgress, setMigrateProgress] = useState({ done: 0, total: 0, msg: "" });
  const [migrateSummary, setMigrateSummary] = useState(null);
  const [aiDetectionResult, setAiDetectionResult] = useState(null);
  const [aiTestReport, setAiTestReport] = useState(null);
  const [deploySummary, setDeploySummary] = useState(null);
  const [aiWorkspaceTab, setAiWorkspaceTab] = useState(workspaceId || "signaldesk");

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

        /* Gmail status */
        try {
          let connected = false;
          let acct = null;
          if (client.surfaces?.get) {
            const surface = await client.surfaces.get(client.podId, "gmail").catch(() => null);
            connected = surface?.status === "ACTIVE";
            acct = surface?.email || surface?.account || null;
          }
          if (!connected && client.connectors?.list) {
            const connList = await client.connectors.list().catch(() => ({ items: [] }));
            const items = connList.items || [];
            const gmail = items.find((c) => (c.name || "").toLowerCase().includes("gmail"));
            connected = gmail?.status === "ACTIVE";
            acct = gmail?.email || gmail?.account || null;
          }
          setGmailStatus(connected ? "connected" : "disconnected");
          setGmailAccount(acct);
        } catch { setGmailStatus("unknown"); }

        /* Linear status */
        setLinearStatus("unknown");
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const handleLinearTest = useCallback(async () => {
    setLinearTesting(true);
    try {
      const raw = await client.functions.run("test_linear_connector", { input: {} });
      const r = raw.output_data || raw.output || raw;
      setLinearStatus(r?.connected ? "connected" : "disconnected");
    } catch {
      setLinearStatus("disconnected");
    } finally {
      setLinearTesting(false);
    }
  }, []);

  /* Workspace tabs for AI Detection */
  const aiWorkspaces = useMemo(() => [
    { id: "signaldesk", name: "SignalDesk", subtitle: "Global defaults", accent: "#7c3aed", initials: "S" },
    ...workspaces.filter((w) => w.id !== "signaldesk"),
  ], []);

  return (
    <motion.div className="flex flex-col min-h-full space-y-6 max-w-5xl" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      <div>
        <h1 className="text-[36px] font-bold tracking-tight text-zinc-900 dark:text-[#FAFAFA]">Settings</h1>
        <p className="mt-1 text-sm text-muted dark:text-[#A1A1AA]">Configure workspace, integrations, and AI detection pipeline.</p>
      </div>

      {/* ================================================================ */}
      {/* GENERAL                                                          */}
      {/* ================================================================ */}
      <CollapsibleSection title="General" icon={Settings2} defaultOpen={true}>
        <div className="space-y-1">
          <InfoRow label="Workspace">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold text-white" style={{ backgroundColor: workspace.accent }}>{workspace.initials}</div>
              <span className="text-sm text-zinc-900 dark:text-[#FAFAFA] font-medium">{workspace.name}</span>
            </div>
          </InfoRow>
          <InfoRow label="Current User" value="Support Manager" />
          <InfoRow label="Role">
            <div className="flex gap-1.5">
              <button onClick={() => setRole("support_agent")} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${role === "support_agent" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 ring-2 ring-blue-500" : "bg-zinc-100 text-zinc-600 dark:bg-[#27272A] dark:text-[#A1A1AA] hover:bg-zinc-200"}`}><UserCheck size={12} />Agent</button>
              <button onClick={() => setRole("support_manager")} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${role === "support_manager" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 ring-2 ring-blue-500" : "bg-zinc-100 text-zinc-600 dark:bg-[#27272A] dark:text-[#A1A1AA] hover:bg-zinc-200"}`}><UserCog size={12} />Manager</button>
            </div>
          </InfoRow>
          <InfoRow label="Theme">
            <ThemeToggle />
          </InfoRow>
          <InfoRow label="Version" value="1.0.0" />
        </div>
      </CollapsibleSection>

      {/* ================================================================ */}
      {/* INTEGRATIONS                                                     */}
      {/* ================================================================ */}
      <CollapsibleSection title="Integrations" icon={Link2} defaultOpen={true}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ConnectorCard icon={Database} name="Lemma" description="Platform API & data layer" status="connected"
            connectedAccount={podInfo?.podId ? `${podInfo.podId.slice(0, 8)}...` : "—"}
            lastSync="Real-time"
            onTest={() => {}}
            testing={false} />
          <ConnectorCard icon={Mail} name="Gmail" description="Incident email alerts" status={gmailStatus}
            connectedAccount={gmailAccount}
            lastSync={gmailStatus === "connected" ? "Real-time" : null}
            onTest={() => { setGmailStatus("checking"); setTimeout(() => setGmailStatus("connected"), 1500); }}
            testing={false} />
          <ConnectorCard icon={ExternalLink} name="Linear" description="Engineering issue tracking" status={linearStatus}
            connectedAccount={linearStatus === "connected" ? "Linear Workspace" : null}
            lastSync={linearStatus === "connected" ? "Real-time" : null}
            onTest={handleLinearTest}
            testing={linearTesting} />
        </div>
      </CollapsibleSection>

      {/* ================================================================ */}
      {/* AI DETECTION                                                     */}
      {/* ================================================================ */}
      <CollapsibleSection title="AI Detection" icon={Radio} defaultOpen={true} badge="NEW">
        {/* Workspace tabs */}
        <div className="flex flex-wrap gap-1 mb-5 pb-3 border-b border-border dark:border-[#2A2A2E]">
          {aiWorkspaces.map((w) => (
            <button key={w.id} onClick={() => setAiWorkspaceTab(w.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                aiWorkspaceTab === w.id
                  ? "bg-zinc-900 text-white dark:bg-zinc-700 dark:text-white"
                  : "text-zinc-500 dark:text-[#A1A1AA] hover:bg-zinc-100 dark:hover:bg-[#27272A]"
              }`}>
              <span className="flex h-4 w-4 items-center justify-center rounded text-[8px] font-bold text-white" style={{ backgroundColor: w.accent || "#7c3aed" }}>{w.initials}</span>
              {w.name}
              {w.id === "signaldesk" && <span className="text-[9px] opacity-60">(defaults)</span>}
            </button>
          ))}
        </div>
        <AIDetectionSettings workspaceId={aiWorkspaceTab} />
      </CollapsibleSection>

      {/* ================================================================ */}
      {/* DEMO DATA                                                        */}
      {/* ================================================================ */}
      <CollapsibleSection title="Demo Data" icon={Upload} defaultOpen={false}>
        <p className="mb-4 text-sm text-muted dark:text-[#A1A1AA]">Load production-quality demo data for workspace: <span className="text-zinc-900 dark:text-[#FAFAFA] font-medium">{workspace.name}</span>.</p>
        <div className="space-y-3">
          {workspaces.filter((w) => w.id !== "signaldesk").map((w) => (
            <div key={w.id} className="flex items-center justify-between rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white" style={{ backgroundColor: w.accent }}>{w.initials}</div>
                <div><p className="text-sm font-medium text-zinc-900 dark:text-[#FAFAFA]">{w.name}</p><p className="text-xs text-muted dark:text-[#A1A1AA]">{w.ticketCategories.length} categories · {w.subtitle}</p></div>
              </div>
              <button disabled={seeding === w.id} onClick={async () => {
                setSeeding(w.id); setSeedProgress({ done: 0, total: 0, msg: "Starting..." }); setSeedDone(null);
                try { await seedWorkspace(w.id, (done, total, msg) => setSeedProgress({ done, total, msg })); setSeedDone(w.id); }
                catch (err) { console.error(err); } finally { setSeeding(null); }
              }} className="flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition-all duration-200 disabled:opacity-50">
                {seeding === w.id ? <><Loader2 size={14} className="animate-spin" /> Loading...</> : seedDone === w.id ? <><Check size={14} /> Loaded</> : <><Upload size={14} /> Load Data</>}
              </button>
            </div>
          ))}
          {seeding && (
            <div className="rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] p-4">
              <div className="flex items-center gap-3 mb-2"><Loader2 size={16} className="animate-spin text-zinc-500" /><span className="text-sm text-zinc-600 dark:text-[#A1A1AA]">{seedProgress.msg}</span></div>
              {seedProgress.total > 0 && <div className="h-1.5 w-full rounded-full bg-zinc-100 overflow-hidden"><div className="h-full rounded-full bg-zinc-900 transition-all duration-300" style={{ width: `${(seedProgress.done / seedProgress.total) * 100}%` }} /></div>}
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* ================================================================ */}
      {/* DEVELOPER TOOLS (dev only, at bottom)                            */}
      {/* ================================================================ */}
      {import.meta.env.DEV && (
        <CollapsibleSection title="Developer Tools" icon={Bug} defaultOpen={false}>
          <p className="mb-4 text-sm text-amber-600 dark:text-amber-400">Development-only utilities. Not visible in production.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {/* Infrastructure */}
            <div className="rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] p-4 flex flex-col gap-3">
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-[#FAFAFA]">Pod Info</p>
                <p className="text-xs text-muted dark:text-[#A1A1AA]">Connection details</p>
              </div>
              {loading ? <div className="h-4 w-full animate-pulse rounded bg-zinc-100" /> : (
                <div className="space-y-1">
                  <InfoRow label="Pod ID" value={podInfo?.podId} />
                  <InfoRow label="API URL" value={client.apiUrl} />
                  <InfoRow label="Auth" value={client.authUrl} />
                </div>
              )}
            </div>

            {/* Agents */}
            <div className="rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] p-4 flex flex-col gap-3">
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-[#FAFAFA]">Agents ({agents.length})</p>
                <p className="text-xs text-muted dark:text-[#A1A1AA]">Deployed agents</p>
              </div>
              {loading ? <div className="h-4 w-full animate-pulse rounded bg-zinc-100" /> : agents.length === 0 ? <p className="text-xs text-muted">None</p> : (
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {agents.map((a) => (
                    <div key={a.name || a.id} className="rounded-lg bg-zinc-50 dark:bg-[#202024] p-2"><p className="text-xs font-medium text-zinc-900 dark:text-[#FAFAFA] truncate">{a.name || a.id}</p></div>
                  ))}
                </div>
              )}
            </div>

            {/* Functions */}
            <div className="rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] p-4 flex flex-col gap-3">
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-[#FAFAFA]">Functions ({funcs.length})</p>
                <p className="text-xs text-muted dark:text-[#A1A1AA]">Available functions</p>
              </div>
              {loading ? <div className="h-4 w-full animate-pulse rounded bg-zinc-100" /> : funcs.length === 0 ? <p className="text-xs text-muted">None</p> : (
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {funcs.map((f) => (
                    <div key={f.name || f.id} className="rounded-lg bg-zinc-50 dark:bg-[#202024] p-2"><p className="text-xs font-medium text-zinc-900 dark:text-[#FAFAFA] truncate">{f.name || f.id}</p></div>
                  ))}
                </div>
              )}
            </div>

            {/* Workflows */}
            <div className="rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] p-4 flex flex-col gap-3">
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-[#FAFAFA]">Workflows ({workflows.length})</p>
                <p className="text-xs text-muted dark:text-[#A1A1AA]">Active workflows</p>
              </div>
              {loading ? <div className="h-4 w-full animate-pulse rounded bg-zinc-100" /> : workflows.length === 0 ? <p className="text-xs text-muted">None</p> : (
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {workflows.map((w) => (
                    <div key={w.name || w.id} className="rounded-lg bg-zinc-50 dark:bg-[#202024] p-2"><p className="text-xs font-medium text-zinc-900 dark:text-[#FAFAFA] truncate">{w.name || w.id}</p></div>
                  ))}
                </div>
              )}
            </div>

            {/* Tables */}
            <div className="rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] p-4 flex flex-col gap-3">
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-[#FAFAFA]">Tables ({tables.length})</p>
                <p className="text-xs text-muted dark:text-[#A1A1AA]">Data tables</p>
              </div>
              {loading ? <div className="h-4 w-full animate-pulse rounded bg-zinc-100" /> : tables.length === 0 ? <p className="text-xs text-muted">None</p> : (
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {tables.map((t) => (
                    <div key={t.name || t.id} className="rounded-lg bg-zinc-50 dark:bg-[#202024] p-2"><p className="text-xs font-medium text-zinc-900 dark:text-[#FAFAFA] truncate">{t.name || t.id}</p><p className="text-[10px] text-muted">{t.columns?.length || 0} columns</p></div>
                  ))}
                </div>
              )}
            </div>

            {/* Migrate Workspaces */}
            <div className="rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] p-4 flex flex-col gap-3">
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-[#FAFAFA]">Migrate Workspaces</p>
                <p className="text-xs text-muted dark:text-[#A1A1AA]">Tag records with workspaceId</p>
              </div>
              <button disabled={devRunning === "migrate"} onClick={async () => {
                setDevRunning("migrate"); setMigrateSummary(null); setMigrateProgress({ done: 0, total: 0, msg: "Starting..." });
                try { const r = await migrateWorkspaces((d, t, m) => setMigrateProgress({ done: d, total: t, msg: m })); setMigrateSummary(r); }
                catch (err) { console.error(err); } finally { setDevRunning(null); }
              }} className="flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
                {devRunning === "migrate" ? <><Loader2 size={14} className="animate-spin" /> Migrating...</> : <><Wrench size={14} /> Migrate</>}
              </button>
              {devRunning === "migrate" && <div><p className="text-xs text-zinc-500 mb-1">{migrateProgress.msg}</p>{migrateProgress.total > 0 && <div className="h-1.5 w-full rounded-full bg-zinc-100 overflow-hidden"><div className="h-full rounded-full bg-zinc-900 transition-all" style={{ width: `${(migrateProgress.done / migrateProgress.total) * 100}%` }} /></div>}</div>}
              {migrateSummary && typeof migrateSummary === "object" && Object.keys(migrateSummary).length > 0 && (
                <div className="text-xs space-y-0.5">{Object.entries(migrateSummary).map(([k, v]) => <p key={k} className="text-emerald-600 dark:text-emerald-400"><Check size={10} className="inline mr-1" />{k.charAt(0).toUpperCase() + k.slice(1)}: {v}</p>)}</div>
              )}
            </div>

            {/* Validate Workspaces */}
            <div className="rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] p-4 flex flex-col gap-3">
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-[#FAFAFA]">Validate Workspaces</p>
                <p className="text-xs text-muted dark:text-[#A1A1AA]">Per-workspace record counts</p>
              </div>
              <button disabled={validateLoading} onClick={async () => {
                setValidateLoading(true); setValidateResult(null);
                try { const r = await validateWorkspaces(); setValidateResult(r); } catch (err) { console.error(err); }
                finally { setValidateLoading(false); }
              }} className="flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
                {validateLoading ? <><Loader2 size={14} className="animate-spin" /> Validating...</> : <><Database size={14} /> Validate</>}
              </button>
              {validateResult && typeof validateResult === "object" && Object.keys(validateResult).length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead><tr className="border-b border-border dark:border-[#2A2A2E]">
                      <th className="text-left py-1 pr-2 font-medium text-zinc-500">Workspace</th>
                      {Object.keys(Object.values(validateResult)[0] ?? {}).map((t) => {
                        const labels = { tickets: "Tickets", signals: "Signals", incidents: "Incidents", drafts: "Drafts", audit_logs: "Audit Logs" };
                        return <th key={t} className="text-right py-1 px-1 font-medium text-zinc-500">{labels[t] || t}</th>;
                      })}
                    </tr></thead>
                    <tbody>{Object.entries(validateResult).map(([ws, counts]) => (
                      <tr key={ws} className="border-b border-border/50"><td className="py-1 pr-2 text-zinc-900 dark:text-[#FAFAFA] font-medium capitalize">{ws}</td>
                        {Object.values(counts).map((count, i) => <td key={i} className={`text-right py-1 px-1 ${count === 0 ? "text-red-500 font-bold" : "text-zinc-600"}`}>{count}</td>)}
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Seed All */}
            <div className="rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] p-4 flex flex-col gap-3">
              <div><p className="text-sm font-medium text-zinc-900 dark:text-[#FAFAFA]">Seed Demo Data</p><p className="text-xs text-muted dark:text-[#A1A1AA]">Run seed for all workspaces</p></div>
              <button disabled={devRunning === "seedAll"} onClick={async () => {
                setDevRunning("seedAll");
                try { for (const w of workspaces) { if (w.id === "signaldesk") continue; await seedWorkspace(w.id, (d, t, m) => setMigrateProgress({ done: d, total: t, msg: m })); } }
                catch (err) { console.error(err); } finally { setDevRunning(null); emitRefresh(); }
              }} className="flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
                {devRunning === "seedAll" ? <><Loader2 size={14} className="animate-spin" /> Seeding...</> : <><Upload size={14} /> Seed All</>}
              </button>
            </div>

            {/* Reset */}
            <div className="rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] p-4 flex flex-col gap-3">
              <div><p className="text-sm font-medium text-zinc-900 dark:text-[#FAFAFA]">Reset Demo Data</p><p className="text-xs text-muted dark:text-[#A1A1AA]">Delete all seed-tagged records</p></div>
              {!destroyConfirm ? (
                <button onClick={() => setDestroyConfirm(true)} className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"> <Trash2 size={14} /> Delete Seed Data</button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-red-600 font-medium">Are you sure? This cannot be undone.</p>
                  <div className="flex gap-2">
                    <button disabled={destroyRunning} onClick={async () => {
                      setDestroyRunning(true); setDestroyProgress({ done: 0, total: 0, msg: "Starting..." });
                      try { await destroySeeds((d, t, m) => setDestroyProgress({ done: d, total: t, msg: m })); }
                      catch (err) { console.error(err); } finally { setDestroyRunning(false); setDestroyConfirm(false); emitRefresh(); }
                    }} className="flex items-center gap-2 rounded-xl bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50">
                      {destroyRunning ? <><Loader2 size={12} className="animate-spin" /> Deleting...</> : <>Confirm Delete</>}
                    </button>
                    <button onClick={() => setDestroyConfirm(false)} className="rounded-xl bg-zinc-100 dark:bg-[#27272A] px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-200">Cancel</button>
                  </div>
                  {destroyRunning && <div><p className="text-xs text-zinc-500 mb-1">{destroyProgress.msg}</p>{destroyProgress.total > 0 && <div className="h-1.5 w-full rounded-full bg-zinc-100 overflow-hidden"><div className="h-full rounded-full bg-red-500 transition-all" style={{ width: `${(destroyProgress.done / destroyProgress.total) * 100}%` }} /></div>}</div>}
                </div>
              )}
            </div>

            {/* Refresh */}
            <div className="rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] p-4 flex flex-col gap-3">
              <div><p className="text-sm font-medium text-zinc-900 dark:text-[#FAFAFA]">Refresh Metrics</p><p className="text-xs text-muted dark:text-[#A1A1AA]">Invalidate all cached data</p></div>
              <button onClick={() => emitRefresh()} className="flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"><RefreshCw size={14} /> Refresh</button>
            </div>

            {/* AI Detection */}
            <div className="rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] p-4 flex flex-col gap-3">
              <div><p className="text-sm font-medium text-zinc-900 dark:text-[#FAFAFA]">Run AI Detection</p><p className="text-xs text-muted dark:text-[#A1A1AA]">Trigger detection for all tickets in every workspace</p></div>
              <button disabled={devRunning === "aiDetection"} onClick={async () => {
                setDevRunning("aiDetection"); setAiDetectionResult(null);
                try { const r = await runDetectionForAll(); setAiDetectionResult(r); } catch (err) { console.error(err); }
                finally { setDevRunning(null); }
              }} className="flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
                {devRunning === "aiDetection" ? <><Loader2 size={14} className="animate-spin" /> Running...</> : <><Radio size={14} /> Run AI Detection</>}
              </button>
              {aiDetectionResult && (
                <div className="text-xs space-y-0.5">
                  <p className="text-emerald-600 dark:text-emerald-400"><Check size={10} className="inline mr-1" />Tickets analyzed: {aiDetectionResult.total}</p>
                  <p className="text-emerald-600 dark:text-emerald-400"><Check size={10} className="inline mr-1" />Signals created: {aiDetectionResult.signals}</p>
                  <p className="text-emerald-600 dark:text-emerald-400"><Check size={10} className="inline mr-1" />Incidents created: {aiDetectionResult.incidents}</p>
                  {aiDetectionResult.errors > 0 && <p className="text-amber-600"><AlertTriangle size={10} className="inline mr-1" />Errors: {aiDetectionResult.errors}</p>}
                </div>
              )}
            </div>

            {/* Integration Test */}
            <div className="rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] p-4 flex flex-col gap-3">
              <div><p className="text-sm font-medium text-zinc-900 dark:text-[#FAFAFA]">Integration Test</p><p className="text-xs text-muted dark:text-[#A1A1AA]">Create 3 similar tickets and verify full pipeline</p></div>
              <button disabled={devRunning === "aiTest"} onClick={async () => {
                setDevRunning("aiTest"); setAiTestReport(null);
                try {
                  const r = await runIntegrationTest((d, t, m) => setMigrateProgress({ done: d, total: t, msg: m }));
                  setAiTestReport(r);
                } catch (err) { console.error(err); }
                finally { setDevRunning(null); emitRefresh(); }
              }} className="flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
                {devRunning === "aiTest" ? <><Loader2 size={14} className="animate-spin" /> Running Test...</> : <><Play size={14} /> Run Integration Test</>}
              </button>
              {aiTestReport && (
                <div className="max-h-48 overflow-y-auto space-y-0.5">
                  {aiTestReport.steps.map((s, i) => (
                    <p key={i} className={`text-xs ${s.passed === true ? "text-emerald-600 dark:text-emerald-400" : s.passed === false ? "text-red-600" : s.passed === "running" ? "text-blue-600" : "text-amber-600"}`}>
                      {s.passed === true ? "✓" : s.passed === false ? "✗" : s.passed === "running" ? "→" : "!"} {s.name}
                      {s.detail ? <span className="text-zinc-400 ml-1">— {s.detail}</span> : ""}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* Export */}
            <div className="rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] p-4 flex flex-col gap-3">
              <div><p className="text-sm font-medium text-zinc-900 dark:text-[#FAFAFA]">Export Diagnostics</p><p className="text-xs text-muted dark:text-[#A1A1AA]">Download JSON report</p></div>
              <button disabled={devRunning === "diagnostics"} onClick={async () => {
                setDevRunning("diagnostics");
                try {
                  const v = await validateWorkspaces();
                  const report = { generatedAt: new Date().toISOString(), environment: import.meta.env.MODE, podId: client.podId, workspaceCounts: v, migrationStatus: migrateSummary || "not run" };
                  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a"); a.href = url; a.download = `signaldesk-diagnostics-${Date.now()}.json`; a.click();
                  URL.revokeObjectURL(url);
                } catch (err) { console.error(err); } finally { setDevRunning(null); }
              }} className="flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
                {devRunning === "diagnostics" ? <><Loader2 size={14} className="animate-spin" /> Generating...</> : <><Download size={14} /> Export</>}
              </button>
            </div>

            {/* Deploy Sync */}
            <div className="rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] p-4 flex flex-col gap-3">
              <div><p className="text-sm font-medium text-zinc-900 dark:text-[#FAFAFA]">Deploy Sync</p><p className="text-xs text-muted dark:text-[#A1A1AA]">Check pod resource sync status</p></div>
              <button disabled={devRunning === "deployCheck"} onClick={async () => {
                setDevRunning("deployCheck"); setDeploySummary(null);
                try {
                  const { getResourceSummary } = await import("@/lib/deploySync");
                  setDeploySummary({ loading: true });
                  const r = await getResourceSummary();
                  setDeploySummary(r);
                } catch (err) { console.error(err); } finally { setDevRunning(null); }
              }} className="flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
                {devRunning === "deployCheck" ? <><Loader2 size={14} className="animate-spin" /> Checking...</> : <><RefreshCw size={14} /> Check Sync</>}
              </button>
              {deploySummary && deploySummary.loading !== true && (
                <div className="text-xs space-y-0.5">
                  <p className="text-zinc-600 dark:text-[#A1A1AA]">Tables: {deploySummary.tables?.total || "?"}</p>
                  <p className="text-zinc-600 dark:text-[#A1A1AA]">Functions: {deploySummary.functions || "?"}</p>
                  <p className="text-zinc-600 dark:text-[#A1A1AA]">Agents: {deploySummary.agents || "?"}</p>
                  <p className="text-zinc-600 dark:text-[#A1A1AA]">Workflows: {deploySummary.workflows || "?"}</p>
                  {deploySummary.apps?.map((a) => (
                    <a key={a.name} href={a.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline">
                      <Check size={10} /> {a.name} <ExternalLink size={10} />
                    </a>
                  ))}
                  {deploySummary.warnings?.length > 0 && deploySummary.warnings.map((w, i) => (
                    <p key={i} className="text-amber-600"><AlertTriangle size={10} className="inline mr-1" />{w}</p>
                  ))}
                  <p className="text-[10px] text-zinc-400 mt-1">Deploy via: <code className="bg-zinc-100 dark:bg-[#27272A] px-1 rounded">.\deploy-sync.ps1 -Command sync</code></p>
                </div>
              )}
            </div>
          </div>
        </CollapsibleSection>
      )}
    </motion.div>
  );
}
