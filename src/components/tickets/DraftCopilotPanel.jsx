import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Loader2, CheckCircle2, XCircle, Copy, Send, RefreshCw,
  ChevronDown, ChevronUp, ShieldAlert, Radio, BookOpen, BarChart3,
  History, Lightbulb, ThumbsUp, Save, Check, AlertTriangle, Brain,
  FileText, MessageSquare, Clock, Search, X,
} from "lucide-react";
import { toast } from "sonner";
import client from "@/lib/lemmaClient";
import { emitRefresh } from "@/lib/refreshEvents";
import { createNotification } from "@/lib/notifications";
import { gatherContext, buildFacts, buildDraft, adaptTone, calculateConfidence, TONES } from "@/lib/draftCopilot";

const STEP_ICONS = {
  search: Search,
  check: CheckCircle2,
  error: AlertTriangle,
};

function StepIndicator({ steps }) {
  if (!steps || steps.length === 0) return null;
  return (
    <div className="space-y-1.5 mb-4">
      {steps.map((step, i) => {
        const Icon = STEP_ICONS[step.icon] || Loader2;
        const isActive = step.icon === "search";
        const isDone = step.icon === "check";
        const isError = step.icon === "error";
        return (
          <div key={i} className="flex items-center gap-2 text-xs">
            <Icon size={13} className={isDone ? "text-emerald-500" : isError ? "text-red-500" : isActive ? "text-blue-500 animate-pulse" : "text-zinc-400"} />
            <span className={isDone ? "text-emerald-600 dark:text-emerald-400" : isError ? "text-red-600" : "text-zinc-600 dark:text-zinc-400"}>{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function ContextChip({ icon: Icon, label, sublabel, onClick, color }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
      <Icon size={12} className={color || "text-zinc-500"} />
      <span>{label}</span>
      {sublabel && <span className="text-zinc-400 dark:text-zinc-500">·</span>}
      {sublabel && <span className="text-zinc-400 dark:text-zinc-500">{sublabel}</span>}
    </button>
  );
}

function DiffHighlight({ current, previous }) {
  if (!previous) return <span>{current}</span>;
  const curLines = current.split("\n");
  const prevLines = previous.split("\n");
  return (
    <div className="whitespace-pre-wrap text-sm leading-relaxed">
      {curLines.map((line, i) => {
        const isNew = i >= prevLines.length || prevLines[i] !== line;
        if (!isNew) return <span key={i}>{line}{i < curLines.length - 1 ? "\n" : ""}</span>;
        return (
          <span key={i} className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 rounded-sm px-0.5">
            {line}{i < curLines.length - 1 ? "\n" : ""}
          </span>
        );
      })}
    </div>
  );
}

export default function DraftCopilotPanel({ ticket, workspace, permissions = {}, onRefresh }) {
  const {
    canGenerate = true,
    canApprove = false,
    canReject = false,
    canSend = false,
    canEdit = true,
  } = permissions;

  const [phase, setPhase] = useState("idle");
  const [steps, setSteps] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [currentVersion, setCurrentVersion] = useState(0);
  const [selectedTone, setSelectedTone] = useState("professional");
  const [context, setContext] = useState(null);
  const [facts, setFacts] = useState(null);
  const [draftId, setDraftId] = useState(null);
  const [error, setError] = useState(null);
  const [showToneMenu, setShowToneMenu] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const toneRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (toneRef.current && !toneRef.current.contains(e.target)) setShowToneMenu(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const currentDraft = drafts[currentVersion] || null;
  const hasPrevious = currentVersion > 0;
  const previousDraft = hasPrevious ? drafts[currentVersion - 1] : null;

  const canApproveDraft = phase === "editing" && canApprove;
  const canRejectDraft = (phase === "editing" || phase === "pending_approval") && canReject;
  const canSendDraft = (phase === "approved" || phase === "pending_approval") && canSend;

  const handleGenerate = useCallback(async () => {
    if (phase === "generating") return;
    setPhase("generating");
    setError(null);
    setSteps([]);
    setDrafts([]);
    setCurrentVersion(0);
    setDraftId(null);
    setContext(null);

    const progressSteps = [
      { icon: "search", label: "Reading ticket..." },
    ];
    setSteps([...progressSteps]);

    try {
      const ctx = await gatherContext(ticket);
      setContext(ctx);

      const fts = buildFacts(ticket, ctx);
      setFacts(fts);

      progressSteps.push({ icon: "check", label: "Searching Knowledge Base" });
      progressSteps.push({ icon: "check", label: "Looking for active incidents" });
      progressSteps.push({ icon: "check", label: "Checking engineering updates" });
      progressSteps.push({ icon: "check", label: "Reading historical resolutions" });
      progressSteps.push({ icon: "search", label: "Drafting response..." });
      setSteps([...progressSteps]);

      await new Promise((r) => setTimeout(r, 400));

      const result = buildDraft(ticket, fts, selectedTone);
      const newDraft = {
        body: result.body,
        sections: result.sections,
        confidence: result.confidence,
        tone: selectedTone,
        created_at: new Date().toISOString(),
        version: 1,
      };

      progressSteps.pop();
      progressSteps.push({ icon: "check", label: "Ready" });
      setSteps([...progressSteps]);

      setDrafts([newDraft]);
      setCurrentVersion(0);
      setDraftId(null);
      setPhase("editing");

      try {
        await createNotification({
          action: "draft.generated",
          actor: "AI Copilot",
          resourceType: "ticket",
          resourceId: ticket.id,
          details: { tone: selectedTone, confidence: result.confidence.overall },
          workspaceId: ticket.workspaceId,
          workspaceName: ticket.workspaceName,
        });
      } catch {}
    } catch (err) {
      setError(err?.message || "Generation failed");
      setPhase("error");
      setSteps([...steps, { icon: "error", label: "Generation failed" }]);
    }
  }, [ticket, selectedTone, phase]);

  const handleRegenerate = useCallback(async () => {
    if (phase === "generating") return;
    setPhase("generating");
    setError(null);

    const previousBody = currentDraft?.body || "";
    const previousVersion = currentDraft?.version || 0;

    const progressSteps = [...steps];
    progressSteps.push({ icon: "search", label: "Regenerating response..." });
    setSteps([...progressSteps]);

    try {
      await new Promise((r) => setTimeout(r, 300));

      const fts = facts || buildFacts(ticket, context || await gatherContext(ticket));
      const result = buildDraft(ticket, fts, selectedTone);

      const newDraft = {
        body: result.body,
        sections: result.sections,
        confidence: result.confidence,
        tone: selectedTone,
        created_at: new Date().toISOString(),
        version: previousVersion + 1,
        previousBody,
      };

      progressSteps.pop();
      progressSteps.push({ icon: "check", label: "Regenerated" });
      setSteps([...progressSteps]);

      setDrafts((prev) => [...prev, newDraft]);
      setCurrentVersion(drafts.length);
      setPhase("editing");
      toast.success(`Version ${previousVersion + 1} generated`);
    } catch (err) {
      setError(err?.message || "Regeneration failed");
      setPhase("editing");
    }
  }, [ticket, selectedTone, currentDraft, facts, context, steps, drafts.length, phase]);

  const handleToneChange = useCallback((newTone) => {
    setSelectedTone(newTone);
    setShowToneMenu(false);

    if (!currentDraft) return;

    const fts = facts || buildFacts(ticket, context || { signal: null, incident: null, knowledge: [], historical: [], engineeringNotes: null, steps: [] });
    const result = buildDraft(ticket, fts, newTone);
    const previousBody = currentDraft.body;

    const updatedDraft = {
      ...currentDraft,
      body: result.body,
      sections: result.sections,
      confidence: result.confidence,
      tone: newTone,
      previousBody,
    };

    setDrafts((prev) => {
      const next = [...prev];
      next[currentVersion] = updatedDraft;
      return next;
    });
  }, [currentDraft, currentVersion, facts, ticket, context]);

  const handleSave = useCallback(async () => {
    if (!currentDraft) return;
    setSaving(true);
    try {
      const body = currentDraft.body;
      if (draftId) {
        await client.records.update("drafts", draftId, { body, confidence: currentDraft.confidence.overall });
      } else {
        const id = crypto.randomUUID();
        await client.records.create("drafts", {
          id,
          ticket_id: ticket.id,
          body,
          status: "pending",
          confidence: currentDraft.confidence.overall,
          grounded_in: {
            signal_id: facts?.signalId,
            incident_id: facts?.incidentId,
            knowledge_count: facts?.knowledgeCount || 0,
            historical_count: facts?.historicalCount || 0,
            tone: selectedTone,
          },
          workspaceId: ticket.workspaceId,
          workspaceName: ticket.workspaceName,
        });
        setDraftId(id);
      }
      toast.success("Draft saved");
      emitRefresh();
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error(err?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }, [currentDraft, draftId, ticket, facts, selectedTone, onRefresh]);

  const handleRequestApproval = useCallback(async () => {
    if (!currentDraft) return;
    await handleSave();
    setPhase("pending_approval");
    try {
      await createNotification({
        action: "draft.pending_approval",
        actor: "Support Agent",
        resourceType: "ticket",
        resourceId: ticket.id,
        details: { draft_id: draftId, tone: selectedTone, confidence: currentDraft.confidence.overall },
        workspaceId: ticket.workspaceId,
        workspaceName: ticket.workspaceName,
      });
      toast.success("Draft sent for approval");
    } catch {}
    emitRefresh();
  }, [currentDraft, draftId, ticket, selectedTone, handleSave]);

  const handleApprove = useCallback(async () => {
    if (!currentDraft || !draftId) return;
    try {
      await client.functions.run("resolve_ticket", {
        input: { ticket_id: ticket.id, draft_id: draftId },
      });
      setPhase("approved");
      toast.success("Draft approved");
      emitRefresh();
    } catch (err) {
      toast.error(err?.message || "Approval failed");
    }
  }, [currentDraft, draftId, ticket]);

  const handleReject = useCallback(async () => {
    if (!currentDraft || !draftId) return;
    try {
      await client.functions.run("reject_draft", {
        input: { ticket_id: ticket.id, draft_id: draftId },
      });
      setPhase("rejected");
      toast.success("Draft rejected");
      emitRefresh();
    } catch (err) {
      toast.error(err?.message || "Rejection failed");
    }
  }, [currentDraft, draftId, ticket]);

  const handleSend = useCallback(async () => {
    if (!currentDraft || !draftId) return;
    setSending(true);
    try {
      await client.functions.run("send_approved_reply", {
        input: { draft_id: draftId, ticket_id: ticket.id, channel: "email" },
      });
      setPhase("sent");
      toast.success("Reply sent to customer");

      if (facts) {
        try {
          const diff = {
            ai_draft: previousDraft?.body || currentDraft.body,
            final_sent: currentDraft.body,
            tone_used: selectedTone,
            ticket_outcome: "sent",
            resolution_success: true,
          };
          localStorage.setItem(`signaldesk-copilot-learning-${ticket.id}`, JSON.stringify(diff));
        } catch {}
      }

      emitRefresh();
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error(err?.message || "Send failed");
    } finally {
      setSending(false);
    }
  }, [currentDraft, draftId, ticket, selectedTone, facts, previousDraft, onRefresh]);

  const handleCopy = useCallback(async () => {
    if (!currentDraft) return;
    try {
      await navigator.clipboard.writeText(currentDraft.body);
      toast.success("Draft copied");
    } catch {
      toast.error("Copy failed");
    }
  }, [currentDraft]);

  const switchVersion = useCallback((idx) => {
    if (idx >= 0 && idx < drafts.length) setCurrentVersion(idx);
  }, [drafts]);

  const confidenceColor = (score) => {
    if (score >= 85) return "text-emerald-500";
    if (score >= 70) return "text-amber-500";
    return "text-red-500";
  };

  const ToneButton = ({ tone }) => {
    const isActive = selectedTone === tone.id;
    return (
      <button
        onClick={() => handleToneChange(tone.id)}
        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
          isActive
            ? "bg-zinc-900 text-white shadow-sm"
            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
        }`}
      >
        {tone.label}
      </button>
    );
  };

  if (!canGenerate && phase === "idle") {
    return (
      <div className="text-sm text-zinc-500 dark:text-zinc-400 py-4 text-center">
        You do not have permission to generate drafts.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Generate Button (idle/error phase) */}
      {(phase === "idle" || phase === "error") && (
        <div className="space-y-3">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-3">
              <AlertTriangle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-red-700 dark:text-red-400">{error}</div>
            </div>
          )}
          <button onClick={handleGenerate} disabled={phase === "generating"}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 transition-all">
            <Brain size={16} />
            Generate AI Draft Reply
          </button>
        </div>
      )}

      {/* Generating phase */}
      {phase === "generating" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-2">
            <Loader2 size={15} className="animate-spin text-blue-500" />
            AI Copilot is analyzing...
          </div>
          <StepIndicator steps={steps} />
        </div>
      )}

      {/* Ready / Editing / Approval phases */}
      {currentDraft && phase !== "idle" && phase !== "generating" && (
        <div className="space-y-3">
          {/* Context Chips */}
          {facts && (
            <div className="flex flex-wrap gap-1.5">
              {facts.hasSignal && (
                <ContextChip icon={Radio} label="Signal" sublabel={facts.signalName.substring(0, 20)} color="text-green-500" />
              )}
              {facts.hasIncident && (
                <ContextChip icon={ShieldAlert} label={`INC-${facts.incidentId?.substring(0, 8).toUpperCase()}`} sublabel={facts.incidentTitle?.substring(0, 20)} color="text-red-500" />
              )}
              {facts.hasKnowledge && (
                <ContextChip icon={BookOpen} label={`${facts.knowledgeCount} Article${facts.knowledgeCount > 1 ? "s" : ""}`} sublabel={facts.bestKnowledgeTitle?.substring(0, 20)} color="text-amber-500" />
              )}
              {facts.hasHistorical && (
                <ContextChip icon={History} label={`${facts.historicalCount} Historical`} color="text-purple-500" />
              )}
              {facts.hasEngineeringAck && (
                <ContextChip icon={Lightbulb} label="Engineering" sublabel={facts.engineeringStatus} color="text-blue-500" />
              )}
              <ContextChip icon={BarChart3} label={`${currentDraft.confidence?.overall || 0}%`} sublabel="Confidence" color={confidenceColor(currentDraft.confidence?.overall || 0)} />
            </div>
          )}

          {/* Tone Selector */}
          <div className="relative" ref={toneRef}>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Tone</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {TONES.map((tone) => (
                <ToneButton key={tone.id} tone={tone} />
              ))}
            </div>
          </div>

          {/* Draft Editor */}
          <div className="relative">
            <textarea
              value={currentDraft.body}
              onChange={(e) => {
                if (!canEdit && phase !== "editing") return;
                const updated = { ...currentDraft, body: e.target.value };
                setDrafts((prev) => { const next = [...prev]; next[currentVersion] = updated; return next; });
              }}
              readOnly={phase === "pending_approval" || phase === "approved" || phase === "sent"}
              rows={8}
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 p-3 text-sm leading-relaxed text-zinc-900 dark:text-zinc-100 outline-none transition-all focus:border-zinc-300 dark:focus:border-zinc-600 focus:ring-1 focus:ring-zinc-200 dark:focus:ring-zinc-600 resize-y font-sans"
            />
            {hasPrevious && (
              <div className="mt-2 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-200 dark:border-zinc-700">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <History size={11} className="text-zinc-400" />
                  <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Changes from v{previousDraft.version}</span>
                </div>
                <div className="text-xs text-zinc-600 dark:text-zinc-400 max-h-32 overflow-y-auto">
                  <DiffHighlight current={currentDraft.body} previous={previousDraft.body} />
                </div>
              </div>
            )}
          </div>

          {/* Confidence Breakdown */}
          {currentDraft.confidence && (
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Overall", value: currentDraft.confidence.overall, color: confidenceColor(currentDraft.confidence.overall) },
                { label: "Knowledge", value: currentDraft.confidence.knowledge, color: confidenceColor(currentDraft.confidence.knowledge) },
                { label: "Incident", value: currentDraft.confidence.incident, color: confidenceColor(currentDraft.confidence.incident) },
                { label: "Historical", value: currentDraft.confidence.historical, color: confidenceColor(currentDraft.confidence.historical) },
              ].map((item) => (
                <div key={item.label} className="rounded-lg bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-100 dark:border-zinc-700/50 p-2 text-center">
                  <p className={`text-sm font-bold ${item.color}`}>{item.value}%</p>
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500">{item.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Reasoning Summary */}
          {currentDraft.confidence?.reasoning?.length > 0 && (
            <div className="text-xs text-zinc-400 dark:text-zinc-500 space-y-0.5">
              {currentDraft.confidence.reasoning.map((r, i) => (
                <div key={i} className="flex items-center gap-1">
                  <Check size={10} className="text-emerald-400" />
                  <span>{r}</span>
                </div>
              ))}
            </div>
          )}

          {/* Version Selector */}
          {drafts.length > 1 && (
            <div className="flex items-center gap-1.5">
              <Clock size={12} className="text-zinc-400" />
              <span className="text-xs text-zinc-400 dark:text-zinc-500 mr-1">Versions:</span>
              {drafts.map((d, i) => (
                <button key={i} onClick={() => switchVersion(i)}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-all ${
                    i === currentVersion
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  }`}>
                  v{d.version}
                </button>
              ))}
            </div>
          )}

          {/* Phase Badge */}
          <div className="flex items-center gap-2">
            {phase === "editing" && <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded-full">Draft Mode</span>}
            {phase === "pending_approval" && <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 px-2 py-0.5 rounded-full">Pending Approval</span>}
            {phase === "approved" && <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-full">Approved</span>}
            {phase === "rejected" && <span className="text-[10px] font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 px-2 py-0.5 rounded-full">Rejected</span>}
            {phase === "sent" && <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">Sent to Customer</span>}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            {phase === "editing" && (
              <>
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50 transition-all">
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  {saving ? "Saving..." : "Save Draft"}
                </button>
                <button onClick={handleRequestApproval}
                  className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 transition-all">
                  <ThumbsUp size={12} /> Request Approval
                </button>
                <button onClick={handleRegenerate}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all">
                  <RefreshCw size={12} /> Regenerate
                </button>
                <button onClick={handleCopy}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all">
                  <Copy size={12} /> Copy
                </button>
              </>
            )}
            {phase === "pending_approval" && (
              <>
                {canApprove && (
                  <button onClick={handleApprove}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 transition-all">
                    <Check size={12} /> Approve
                  </button>
                )}
                {canReject && (
                  <button onClick={handleReject}
                    className="flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-800 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all">
                    <X size={12} /> Reject
                  </button>
                )}
              </>
            )}
            {(phase === "approved" || phase === "pending_approval") && canSend && (
              <button onClick={handleSend} disabled={sending}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-all">
                {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                {sending ? "Sending..." : "Send Reply"}
              </button>
            )}
            {(phase === "approved" || phase === "rejected" || phase === "sent") && (
              <button onClick={() => { setPhase("idle"); setDrafts([]); setCurrentVersion(0); setSteps([]); setContext(null); setFacts(null); }}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all">
                <Sparkles size={12} /> New Draft
              </button>
            )}
          </div>

          {/* Draft ID / Version footer */}
          <div className="text-[10px] text-zinc-400 dark:text-zinc-500 text-right">
            {draftId && <span>Draft: {draftId.substring(0, 8)} · </span>}
            <span>v{currentDraft.version || 1}</span>
            {currentDraft.created_at && <span> · {new Date(currentDraft.created_at).toLocaleString()}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
