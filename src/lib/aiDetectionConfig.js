import { useState, useCallback, useEffect } from "react";

const STORAGE_PREFIX = "signaldesk-ai-config";
const DEFAULT_WORKSPACE = "signaldesk";

const DEFAULTS = {
  /* Detection mode */
  detectionMode: "balanced",

  /* Thresholds */
  minSimilarTickets: 3,
  similarityThreshold: 75,
  edgeSimilarityThreshold: 35,
  timeWindow: 48,
  minCustomersAffected: 2,
  signalRiskThreshold: 60,
  incidentEscalationThreshold: 60,

  /* Signal automation */
  autoCreateSignals: true,
  autoMergeSimilarSignals: true,
  semanticMatching: true,

  /* Incident automation */
  autoCreateIncident: true,
  requireManagerApprovalBeforeIncident: false,

  /* Engineering automation */
  autoCreateLinearIssue: true,
  autoSyncEngineeringStatus: true,
  autoSyncEngineeringNotes: true,

  /* Communication */
  autoSendGmailAlerts: true,
  autoNotifyManagers: true,

  /* Knowledge */
  autoGenerateKnowledgeArticles: true,
  autoUpdateExistingKnowledge: true,

  /* Developer AI Detection settings */
  aiSimilarityThreshold: 75,
  aiAutoSignal: true,
  aiMinSimilarTickets: 3,
  aiIncidentThreshold: 5,
  aiAutoGmail: true,
  aiAutoLinear: true,
};

function loadConfig(workspaceId) {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}:${workspaceId || DEFAULT_WORKSPACE}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULTS, ...parsed };
    }
  } catch { /* ignore */ }
  return { ...DEFAULTS };
}

function saveConfig(workspaceId, config) {
  try {
    const key = `${STORAGE_PREFIX}:${workspaceId || DEFAULT_WORKSPACE}`;
    const toStore = {};
    for (const k of Object.keys(DEFAULTS)) {
      if (config[k] !== undefined) toStore[k] = config[k];
    }
    localStorage.setItem(key, JSON.stringify(toStore));
  } catch { /* ignore */ }
}

export function getAIDetectionConfig(workspaceId) {
  return loadConfig(workspaceId);
}

export function getDetectionMode(workspaceId) {
  return loadConfig(workspaceId).detectionMode;
}

export function getThresholds(workspaceId) {
  const c = loadConfig(workspaceId);
  return {
    minTickets: c.minSimilarTickets,
    minSimilarity: c.similarityThreshold / 100,
    edgeThreshold: c.edgeSimilarityThreshold / 100,
    maxAgeMs: c.timeWindow * 3600000,
    riskThreshold: c.signalRiskThreshold,
    escalationThreshold: c.incidentEscalationThreshold,
  };
}

export function getSignalAutomation(workspaceId) {
  const c = loadConfig(workspaceId);
  return {
    enabled: c.autoCreateSignals,
    autoMerge: c.autoMergeSimilarSignals,
    semantic: c.semanticMatching,
  };
}

export function getIncidentAutomation(workspaceId) {
  const c = loadConfig(workspaceId);
  return {
    enabled: c.autoCreateIncident,
    requireApproval: c.requireManagerApprovalBeforeIncident,
  };
}

export function getEngineeringAutomation(workspaceId) {
  const c = loadConfig(workspaceId);
  return {
    createIssue: c.autoCreateLinearIssue,
    syncStatus: c.autoSyncEngineeringStatus,
    syncNotes: c.autoSyncEngineeringNotes,
  };
}

export function getCommunicationConfig(workspaceId) {
  const c = loadConfig(workspaceId);
  return {
    gmailAlerts: c.autoSendGmailAlerts,
    notifyManagers: c.autoNotifyManagers,
  };
}

export function getKnowledgeConfig(workspaceId) {
  const c = loadConfig(workspaceId);
  return {
    generateArticles: c.autoGenerateKnowledgeArticles,
    updateExisting: c.autoUpdateExistingKnowledge,
  };
}

export function isSignalAutomationEnabled(workspaceId) {
  return loadConfig(workspaceId).autoCreateSignals;
}

export function isSemanticMatchingEnabled(workspaceId) {
  return loadConfig(workspaceId).semanticMatching;
}

export function getDevDetectionConfig(workspaceId) {
  const c = loadConfig(workspaceId);
  return {
    similarityThreshold: c.aiSimilarityThreshold,
    autoSignal: c.aiAutoSignal,
    minSimilarTickets: c.aiMinSimilarTickets,
    incidentThreshold: c.aiIncidentThreshold,
    autoGmail: c.aiAutoGmail,
    autoLinear: c.aiAutoLinear,
  };
}

export function useAIDetectionConfig(workspaceId) {
  const [config, setConfig] = useState(() => loadConfig(workspaceId || DEFAULT_WORKSPACE));

  useEffect(() => {
    setConfig(loadConfig(workspaceId || DEFAULT_WORKSPACE));
  }, [workspaceId]);

  const updateConfig = useCallback((partial) => {
    setConfig((prev) => {
      const next = { ...prev, ...partial, _dirty: Date.now() };
      saveConfig(workspaceId || DEFAULT_WORKSPACE, next);
      return next;
    });
  }, [workspaceId]);

  const resetConfig = useCallback(() => {
    const defaults = { ...DEFAULTS };
    setConfig(defaults);
    saveConfig(workspaceId || DEFAULT_WORKSPACE, defaults);
  }, [workspaceId]);

  return { config, updateConfig, resetConfig, isDefault: config === DEFAULTS };
}
