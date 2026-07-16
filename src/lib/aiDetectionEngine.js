import client, { ORG_ID, LINEAR_AUTH_CONFIG, LINEAR_TEAM_ID } from "@/lib/lemmaClient";
import { emitRefresh } from "@/lib/refreshEvents";
import { createNotification } from "@/lib/notifications";
import { getAIDetectionConfig, getThresholds, isSignalAutomationEnabled, getSignalAutomation, getIncidentAutomation } from "@/lib/aiDetectionConfig";

const SIGNAL_FUNC = "create_signal";
const INCIDENT_FUNC = "link_incident";

/* ── Logger ─────────────────────────────────────────────────────── */
const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
const CURRENT_LOG_LEVEL = LOG_LEVELS.INFO;

function debug(...args) { if (CURRENT_LOG_LEVEL <= LOG_LEVELS.DEBUG) console.log("[AI DEBUG]", ...args); }
function log(...args) { if (CURRENT_LOG_LEVEL <= LOG_LEVELS.INFO) console.log("[AI Detection]", ...args); }
function warn(...args) { if (CURRENT_LOG_LEVEL <= LOG_LEVELS.WARN) console.warn("[AI Detection]", ...args); }
function error(...args) { if (CURRENT_LOG_LEVEL <= LOG_LEVELS.ERROR) console.error("[AI Detection]", ...args); }

/** Log a structured pipeline event for observability */
function pipelineLog(stage, payload) {
  const entry = { timestamp: new Date().toISOString(), stage, ...payload };
  const formatted = `[PIPELINE:${stage}] ${JSON.stringify(payload, null, 2)}`;
  if (payload.level === "error" || payload.success === false) {
    console.error(formatted);
  } else if (payload.level === "warn") {
    console.warn(formatted);
  } else {
    console.log(formatted);
  }
  return entry;
}

/** Collect all pipeline events for the current run */
const pipelineEvents = [];
function track(stage, payload) {
  const entry = pipelineLog(stage, { ...payload, level: payload.level || "info" });
  pipelineEvents.push(entry);
  return entry;
}

export function getPipelineEvents() { return [...pipelineEvents]; }
export function clearPipelineEvents() { pipelineEvents.length = 0; }

/* ── Simple stemmer (suffix stripping) ──────────────────────────── */
function stem(word) {
  if (word.length < 4) return word;
  let w = word;
  if (w.endsWith("ization")) return w.slice(0, -7) + "ize";
  if (w.endsWith("isation")) return w.slice(0, -7) + "ise";
  if (w.endsWith("ative")) return w.slice(0, -5);
  if (w.endsWith("ional")) return w.slice(0, -5);
  if (w.endsWith("ional")) return w.slice(0, -5);
  if (w.endsWith("ivity")) return w.slice(0, -5) + "ive";
  if (w.endsWith("ation")) return w.slice(0, -5) + "ate";
  if (w.endsWith("ition")) return w.slice(0, -5);
  if (w.endsWith("ments")) return w.slice(0, -5);
  if (w.endsWith("ment")) return w.slice(0, -4);
  if (w.endsWith("ness")) return w.slice(0, -4);
  if (w.endsWith("less")) return w.slice(0, -4);
  if (w.endsWith("able")) return w.slice(0, -4);
  if (w.endsWith("ance")) return w.slice(0, -4);
  if (w.endsWith("ence")) return w.slice(0, -4);
  if (w.endsWith("ions")) return w.slice(0, -4);
  if (w.endsWith("tion")) return w.slice(0, -4) + "te";
  if (w.endsWith("sion")) return w.slice(0, -4);
  if (w.endsWith("ally")) return w.slice(0, -4) + "al";
  if (w.endsWith("ives")) return w.slice(0, -4) + "ive";
  if (w.endsWith("ings")) return w.slice(0, -4);
  if (w.endsWith("ting")) return w.slice(0, -4) + "te";
  if (w.endsWith("ning")) return w.slice(0, -4) + "n";
  if (w.endsWith("ying")) return w.slice(0, -4) + "y";
  if (w.endsWith("ized")) return w.slice(0, -4) + "ize";
  if (w.endsWith("ised")) return w.slice(0, -4) + "ise";
  if (w.endsWith("iser")) return w.slice(0, -4) + "ise";
  if (w.endsWith("izer")) return w.slice(0, -4) + "ize";
  if (w.endsWith("ator")) return w.slice(0, -4) + "ate";
  if (w.endsWith("oing")) return w.slice(0, -4) + "o";
  if (w.endsWith("ling")) return w.slice(0, -4) + "le";
  if (w.endsWith("ical")) return w.slice(0, -4);
  if (w.endsWith("iced")) return w.slice(0, -4) + "ice";
  if (w.endsWith("iful")) return w.slice(0, -4) + "y";
  if (w.endsWith("iful")) return w.slice(0, -4) + "y";
  if (w.endsWith("less")) return w.slice(0, -4);
  if (w.endsWith("ying")) return w.slice(0, -4) + "y";
  if (w.endsWith("ibly")) return w.slice(0, -4) + "ible";
  if (w.endsWith("ably")) return w.slice(0, -4) + "able";
  if (w.endsWith("ness")) return w.slice(0, -4);
  if (w.endsWith("ship")) return w.slice(0, -4);
  if (w.endsWith("itic")) return w.slice(0, -4);
  if (w.endsWith("ised")) return w.slice(0, -4) + "ise";
  if (w.endsWith("ized")) return w.slice(0, -4) + "ize";
  if (w.endsWith("iser")) return w.slice(0, -4) + "ise";
  if (w.endsWith("izer")) return w.slice(0, -4) + "ize";
  if (w.endsWith("ings")) return w.slice(0, -4);
  if (w.endsWith("uses")) return w.slice(0, -3) + "use";
  if (w.endsWith("sses")) return w.slice(0, -3);
  if (w.endsWith("zzes")) return w.slice(0, -3);
  if (w.endsWith("ches")) return w.slice(0, -3);
  if (w.endsWith("shes")) return w.slice(0, -3);
  if (w.endsWith("tive")) return w.slice(0, -4);
  if (w.endsWith("ture")) return w.slice(0, -4) + "te";
  if (w.endsWith("ture")) return w.slice(0, -4) + "te";
  if (w.endsWith("ular")) return w.slice(0, -4);
  if (w.endsWith("rary")) return w.slice(0, -4);
  if (w.endsWith("gate")) return w.slice(0, -4) + "gate";
  if (w.endsWith("hers")) return w.slice(0, -4);
  if (w.endsWith("ling")) return w.slice(0, -4) + "le";
  if (w.endsWith("lder")) return w.slice(0, -4);
  if (w.endsWith("nder")) return w.slice(0, -4);
  if (w.endsWith("ster")) return w.slice(0, -4);
  if (w.endsWith("test")) return w.slice(0, -3);
  if (w.endsWith("ting") && w.length > 5) return w.slice(0, -3) + "te";
  if (w.endsWith("ing") && w.length > 5) return w.slice(0, -3);
  if (w.endsWith("ted") && w.length > 5) return w.slice(0, -3) + "te";
  if (w.endsWith("eed") && w.length > 4) return w.slice(0, -3) + "eed";
  if (w.endsWith("ed") && w.length > 4) return w.slice(0, -2);
  if (w.endsWith("ies") && w.length > 4) return w.slice(0, -3) + "y";
  if (w.endsWith("es") && w.length > 4) return w.slice(0, -2);
  if (w.endsWith("s") && w.length > 3 && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

/* ── Synonym map ────────────────────────────────────────────────── */
const SYNONYM_MAP = {
  valuation: ["valuation", "financial", "portfolio", "equity", "asset", "worth"],
  financial: ["financial", "finance", "fiscal", "monetary", "valuation", "economic"],
  portfolio: ["portfolio", "holdings", "investment", "asset", "fund"],
  report: ["report", "statement", "document", "summary", "record", "filing"],
  document: ["document", "file", "paper", "record", "report", "dossier"],
  calculation: ["calculation", "computation", "valuation", "estimate", "reckoning"],
  value: ["value", "amount", "balance", "figure", "number", "data", "total"],
  amount: ["amount", "value", "total", "balance", "sum", "quantity"],
  balance: ["balance", "amount", "value", "remaining", "remainder"],
  data: ["data", "information", "record", "entry", "stat", "figure"],
  incorrect: ["incorrect", "wrong", "error", "mistake", "inaccurate", "false", "invalid"],
  error: ["error", "issue", "problem", "bug", "failure", "fault", "defect"],
  issue: ["issue", "problem", "error", "concern", "trouble"],
  problem: ["problem", "issue", "error", "trouble", "difficulty"],
  fail: ["fail", "error", "break", "crash", "timeout", "malfunction"],
  processing: ["processing", "parsing", "computation", "handling", "execution"],
  parse: ["parse", "process", "read", "interpret", "extract"],
  ocr: ["ocr", "scan", "recognition", "imaging", "digitize"],
  download: ["download", "export", "retrieve", "fetch", "pull"],
  upload: ["upload", "import", "submit", "transfer", "push"],
  export: ["export", "download", "extract", "backup"],
  import: ["import", "upload", "ingest", "load", "pull"],
  sync: ["sync", "synchronization", "sync", "integration", "sync"],
  integration: ["integration", "connection", "interface", "api", "link"],
  customer: ["customer", "client", "user", "partner", "account"],
  user: ["user", "customer", "client", "account", "member"],
  service: ["service", "api", "endpoint", "system", "platform"],
  system: ["system", "platform", "service", "application", "infra"],
  app: ["app", "application", "platform", "portal", "web"],
  login: ["login", "authentication", "signin", "access", "auth"],
  password: ["password", "credential", "authentication", "login", "passcode"],
  payment: ["payment", "transaction", "charge", "billing", "checkout"],
  transaction: ["transaction", "payment", "charge", "order", "purchase"],
  booking: ["booking", "appointment", "reservation", "schedule", "slot"],
  appointment: ["appointment", "booking", "session", "visit", "meeting"],
  schedule: ["schedule", "appointment", "booking", "calendar", "slot"],
  refund: ["refund", "return", "reimbursement", "credit", "rebate"],
  invoice: ["invoice", "bill", "charge", "statement", "receipt"],
  billing: ["billing", "invoice", "payment", "accounting", "finance"],
  subscription: ["subscription", "plan", "membership", "tier", "package"],
  wallet: ["wallet", "balance", "credit", "fund", "account"],
  request: ["request", "query", "submission", "ticket", "inquiry"],
  response: ["response", "reply", "answer", "feedback", "resolution"],
  notification: ["notification", "alert", "reminder", "message", "notice"],
  alert: ["alert", "notification", "warning", "reminder", "alarm"],
  timeout: ["timeout", "timeout", "expired", "delay", "timeout"],
  verify: ["verify", "validate", "confirm", "check", "authenticate"],
  validation: ["validation", "verification", "checking", "authentication"],
  loading: ["loading", "loading", "processing", "spinner", "wait"],
  delay: ["delay", "lag", "slow", "stall", "backlog"],
  perform: ["perform", "performance", "speed", "throughput", "efficiency"],
  crash: ["crash", "break", "down", "outage", "failure", "error"],
  outage: ["outage", "down", "unavailable", "offline", "interruption"],
  auth: ["auth", "authentication", "login", "oauth", "sso", "identity"],
  health: ["health", "status", "uptime", "monitoring", "check"],
  sync: ["sync", "sync", "synchronize", "sync", "sync"],
  backup: ["backup", "restore", "recovery", "snapshot", "archive"],
  security: ["security", "secure", "privacy", "encryption", "protection"],
  config: ["config", "configuration", "setting", "setup", "parameter"],
  deploy: ["deploy", "deployment", "release", "rollout", "update", "migration"],
  bill: ["bill", "invoice", "charge", "fee", "payment"],
  medicine: ["medicine", "medication", "prescription", "drug", "pharma"],
  patient: ["patient", "client", "person", "individual", "case"],
  doctor: ["doctor", "physician", "provider", "clinician", "specialist"],
  lab: ["lab", "laboratory", "testing", "diagnostic", "analysis"],
  claim: ["claim", "insurance", "coverage", "benefit", "policy"],
};

function expandSynonyms(word) {
  const lower = word.toLowerCase();
  if (SYNONYM_MAP[lower]) return SYNONYM_MAP[lower];
  return [lower];
}

/* ── Character trigram similarity ───────────────────────────────── */
function charTrigrams(word) {
  if (word.length < 3) return [word];
  const grams = [];
  for (let i = 0; i <= word.length - 3; i++) grams.push(word.slice(i, i + 3));
  return grams;
}

function trigramSimilarity(wordA, wordB) {
  const ga = charTrigrams(wordA.toLowerCase());
  const gb = charTrigrams(wordB.toLowerCase());
  if (ga.length === 0 && gb.length === 0) return 0;
  const inter = ga.filter((g) => gb.includes(g)).length;
  const union = new Set([...ga, ...gb]).size;
  return union === 0 ? 0 : inter / union;
}

/* ── Tokenizer ──────────────────────────────────────────────────── */
const STOP_WORDS = new Set([
  "the","a","an","and","or","but","in","on","at","to","for","of","with","by",
  "from","as","is","was","are","were","be","been","being","have","has","had",
  "do","does","did","will","would","can","could","should","may","might",
  "shall","not","no","nor","this","that","these","those","it","its",
  "i","you","he","she","we","they","me","him","her","us","them","my","your",
  "his","her","our","their","who","which","what","when","where","why","how",
  "all","each","every","both","few","more","most","some","any","such","only",
  "own","same","so","than","too","very","just","because","about","after",
  "before","between","into","through","during","without","within","along",
  "up","down","out","off","over","under","again","further","then","once",
  "here","there","when","where","why","how","all","each","every","both",
  "am","pm","etc","eg","ie","vs","per","via",
]);

function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
    .map(stem);
}

/* ── Similarity metrics ─────────────────────────────────────────── */
function jaccardSimilarity(setA, setB) {
  if (setA.length === 0 && setB.length === 0) return 0;
  const intersection = setA.filter((w) => setB.includes(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

function weightedWordScore(tokensA, tokensB) {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  const freqA = {}; const freqB = {};
  tokensA.forEach((w) => { freqA[w] = (freqA[w] || 0) + 1; });
  tokensB.forEach((w) => { freqB[w] = (freqB[w] || 0) + 1; });
  let shared = 0; let total = 0;
  const allWords = new Set([...tokensA, ...tokensB]);
  allWords.forEach((w) => {
    const fa = freqA[w] || 0;
    const fb = freqB[w] || 0;
    shared += Math.min(fa, fb);
    total += Math.max(fa, fb);
  });
  return total === 0 ? 0 : shared / total;
}

/* Synonym-expanded similarity: matches "valuation" ↔ "financial" */
function synonymSimilarity(tokensA, tokensB) {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  const synSetsA = tokensA.map((t) => new Set(expandSynonyms(t)));
  const synSetsB = tokensB.map((t) => new Set(expandSynonyms(t)));
  let matches = 0;
  for (const setA of synSetsA) {
    for (const setB of synSetsB) {
      for (const wordA of setA) {
        if (setB.has(wordA)) { matches++; break; }
      }
    }
  }
  const total = Math.max(tokensA.length, tokensB.length);
  return total === 0 ? 0 : matches / total;
}

/* Average trigram similarity between all word pairs */
function trigramSetSimilarity(tokensA, tokensB) {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  let totalSim = 0; let pairs = 0;
  for (const wa of tokensA) {
    for (const wb of tokensB) {
      totalSim += trigramSimilarity(wa, wb);
      pairs++;
    }
  }
  return pairs === 0 ? 0 : totalSim / pairs;
}

function tagOverlap(tagsA, tagsB) {
  if (!tagsA || !tagsB) return 0;
  const a = Array.isArray(tagsA) ? tagsA : [];
  const b = Array.isArray(tagsB) ? tagsB : [];
  if (a.length === 0 && b.length === 0) return 0;
  const intersection = a.filter((t) => b.includes(t)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

function categorySimilarity(catA, catB) {
  if (!catA || !catB) return 0;
  const a = catA.toLowerCase().trim();
  const b = catB.toLowerCase().trim();
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.7;
  return 0;
}

function priorityScore(priA, priB) {
  const rank = { urgent: 4, high: 3, normal: 2, low: 1 };
  const ra = rank[priA] || 2;
  const rb = rank[priB] || 2;
  const diff = Math.abs(ra - rb);
  if (diff === 0) return 1;
  if (diff === 1) return 0.6;
  return 0.2;
}

function customerOverlap(a, b) {
  const emailA = (a.customer_email || "").toLowerCase().trim();
  const emailB = (b.customer_email || "").toLowerCase().trim();
  if (emailA && emailB && emailA === emailB) return 1;
  const domainA = emailA.split("@")[1] || "";
  const domainB = emailB.split("@")[1] || "";
  if (domainA && domainB && domainA === domainB) return 0.5;
  return 0;
}

/* ── Main similarity function ───────────────────────────────────── */
const WEIGHTS = {
  title: 0.30,
  description: 0.20,
  category: 0.20,
  tags: 0.10,
  customer: 0.10,
  priority: 0.10,
};

function tokenizeOriginal(text) {
  if (!text) return [];
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

export function computeTicketSimilarity(ticketA, ticketB) {
  /* Stemmed tokens for word overlap and trigram matching */
  const titleStemA = tokenize(ticketA.title || "");
  const titleStemB = tokenize(ticketB.title || "");
  const descStemA = tokenize(ticketA.body || ticketA.description || "");
  const descStemB = tokenize(ticketB.body || ticketB.description || "");

  /* Original tokens for synonym matching (synonym map uses base words) */
  const titleOrigA = tokenizeOriginal(ticketA.title || "");
  const titleOrigB = tokenizeOriginal(ticketB.title || "");
  const descOrigA = tokenizeOriginal(ticketA.body || ticketA.description || "");
  const descOrigB = tokenizeOriginal(ticketB.body || ticketB.description || "");

  /* Title: combine word overlap + trigram + synonym */
  const titleWord = Math.max(jaccardSimilarity(titleStemA, titleStemB), weightedWordScore(titleStemA, titleStemB));
  const titleTri = trigramSetSimilarity(titleStemA, titleStemB);
  const titleSyn = synonymSimilarity(titleOrigA, titleOrigB);
  const titleSim = Math.max(titleWord, titleTri, titleSyn);

  /* Description: same approach */
  const descWord = Math.max(jaccardSimilarity(descStemA, descStemB), weightedWordScore(descStemA, descStemB));
  const descTri = trigramSetSimilarity(descStemA, descStemB);
  const descSyn = synonymSimilarity(descOrigA, descOrigB);
  const descSim = Math.max(descWord, descTri, descSyn);

  const catSim = categorySimilarity(ticketA.category, ticketB.category);
  const tagSim = tagOverlap(ticketA.tags, ticketB.tags);
  const custSim = customerOverlap(ticketA, ticketB);
  const priSim = priorityScore(ticketA.priority, ticketB.priority);

  /* Category boost: if same exact category, add 0.15 to the weighted total */
  const catBoost = catSim >= 1 ? 0.15 : 0;

  const weighted =
    titleSim * WEIGHTS.title +
    descSim * WEIGHTS.description +
    catSim * WEIGHTS.category +
    tagSim * WEIGHTS.tags +
    custSim * WEIGHTS.customer +
    priSim * WEIGHTS.priority;

  const total = Math.min(weighted + catBoost, 1);

  return { total, factors: { titleSim, descSim, catSim, tagSim, custSim, priSim, catBoost } };
}

/* ── Cluster helpers ────────────────────────────────────────────── */
function generateClusterId(ticketIds) {
  const sorted = [...ticketIds].sort();
  const joined = sorted.join("|");
  let hash = 5381;
  for (let i = 0; i < joined.length; i++) {
    hash = ((hash << 5) + hash) + joined.charCodeAt(i);
    hash = hash & hash;
  }
  return `cluster_${Math.abs(hash).toString(36)}_${sorted.length}`;
}

function isWithinWindow(tickets, maxAgeMs) {
  const now = Date.now();
  return tickets.every((t) => {
    const ts = new Date(t.created_at || t.createdAt || 0).getTime();
    return now - ts <= (maxAgeMs || 86400000);
  });
}

function averageSimilarity(tickets, anchorIndex) {
  if (tickets.length < 2) return 1;
  if (anchorIndex !== undefined && anchorIndex >= 0 && anchorIndex < tickets.length) {
    /* Anchor-based: only compute similarity to the anchor ticket */
    let total = 0;
    let count = 0;
    const anchor = tickets[anchorIndex];
    for (let i = 0; i < tickets.length; i++) {
      if (i === anchorIndex) continue;
      total += computeTicketSimilarity(anchor, tickets[i]).total;
      count++;
    }
    return count === 0 ? 0 : total / count;
  }
  /* Fall back to all-pairs */
  let total = 0;
  let count = 0;
  for (let i = 0; i < tickets.length; i++) {
    for (let j = i + 1; j < tickets.length; j++) {
      total += computeTicketSimilarity(tickets[i], tickets[j]).total;
      count++;
    }
  }
  return count === 0 ? 0 : total / count;
}

function computeRiskScore(tickets) {
  if (tickets.length === 0) return 0;
  const rank = { urgent: 4, high: 3, normal: 2, low: 1 };
  const highPriorityCat = new Set(["billing", "security", "payment", "refund", "critical", "outage", "portfolio", "financial"]);

  const uniqueCustomers = new Set(tickets.map((t) => t.customer_email || "").filter(Boolean));
  const avgPriority = tickets.reduce((s, t) => s + (rank[t.priority] || 2), 0) / tickets.length;
  const highRiskCats = tickets.filter((t) => highPriorityCat.has((t.category || "").toLowerCase())).length;
  const recentCount = tickets.filter((t) => {
    const ts = new Date(t.created_at || t.createdAt || 0).getTime();
    return Date.now() - ts <= 3600000;
  }).length;

  let score = 0;
  score += Math.min(tickets.length / 5, 1) * 3;
  score += (avgPriority / 4) * 2;
  score += Math.min(highRiskCats / tickets.length, 1) * 1.5;
  score += Math.min(uniqueCustomers.size / 3, 1) * 1.5;
  score += Math.min(recentCount / 2, 1) * 1;
  score += tickets.length >= 5 ? 1 : 0;

  return Math.min(Math.round(score * 10) / 10, 10);
}

function computeConfidence(tickets, avgSim) {
  const sizeScore = Math.min(tickets.length / 10, 1);
  const simScore = avgSim;
  const categoryConsistency = tickets.filter((t) => t.category === tickets[0]?.category).length / tickets.length;
  const uniqueCustomers = new Set(tickets.map((t) => t.customer_email || "").filter(Boolean)).size;
  const multiCustomer = Math.min(uniqueCustomers / 3, 1);

  return Math.round((
    sizeScore * 0.3 +
    simScore * 0.35 +
    categoryConsistency * 0.2 +
    multiCustomer * 0.15
  ) * 100);
}

function generateRootCauseSummary(tickets) {
  if (tickets.length === 0) return "";
  const categories = [...new Set(tickets.map((t) => t.category).filter(Boolean))];
  const titles = tickets.map((t) => t.title || "").filter(Boolean);
  const commonWords = [];
  const wordFreq = {};
  titles.forEach((t) => {
    tokenize(t).forEach((w) => { wordFreq[w] = (wordFreq[w] || 0) + 1; });
  });
  Object.entries(wordFreq)
    .filter(([, count]) => count >= Math.max(2, tickets.length * 0.4))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([word]) => commonWords.push(word));

  const cat = categories.length === 1 ? categories[0] : categories.slice(0, 2).join("/");
  const wordHint = commonWords.length > 0 ? ` (keywords: ${commonWords.join(", ")})` : "";
  return `Systemic issue affecting ${tickets.length} ticket${tickets.length > 1 ? "s" : ""} in ${cat || "multiple categories"}${wordHint}. Tickets share similar patterns indicating a common root cause.`;
}

/* ── Dedup functions ────────────────────────────────────────────── */
async function findExistingSignalForTicket(ticketId, workspaceId) {
  try {
    const filters = workspaceId && workspaceId !== "signaldesk"
      ? [{ field: "workspaceId", op: "eq", value: workspaceId }]
      : undefined;
    const res = await client.records.list("signals", { limit: 50, filters });
    const signals = res.items || res.records || res.data || [];
    return signals.find((s) => {
      const linked = s.example_ticket_ids || s.linked_ticket_ids || s.ticket_ids || [];
      return linked.includes(ticketId);
    }) || null;
  } catch { return null; }
}

async function findActiveSignalByClusterId(clusterId, workspaceId) {
  /* cluster_id column doesn't exist on signals table — always returns null */
  return null;
}

async function findExistingIncidentBySignalId(signalId) {
  try {
    const res = await client.records.list("incidents", {
      limit: 50,
      filters: [{ field: "signal_id", op: "eq", value: signalId }],
    });
    const incidents = res.items || res.records || res.data || [];
    return incidents.find((i) => i.status !== "resolved" && i.status !== "closed") || null;
  } catch { return null; }
}

/* ── Build cluster object ───────────────────────────────────────── */
function buildCluster(tickets, anchorId) {
  const ids = tickets.map((t) => t.id);
  const customers = [...new Set(tickets.map((t) => t.customer_email || t.customer_name || "").filter(Boolean))];
  const timestamps = tickets.map((t) => new Date(t.created_at || t.createdAt || 0).getTime()).filter((t) => !isNaN(t));
  const anchorIdx = anchorId ? tickets.findIndex((t) => t.id === anchorId) : -1;
  const avgSim = averageSimilarity(tickets, anchorIdx >= 0 ? anchorIdx : undefined);
  const risk = computeRiskScore(tickets);
  const conf = computeConfidence(tickets, avgSim);

  return {
    cluster_id: generateClusterId(ids),
    ticket_ids: ids,
    linked_ticket_ids: ids,
    similarity_score: Math.round(avgSim * 100) / 100,
    affected_customers: customers,
    confidence: conf,
    risk_score: risk,
    first_seen: timestamps.length > 0 ? new Date(Math.min(...timestamps)).toISOString() : new Date().toISOString(),
    last_seen: timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : new Date().toISOString(),
    root_cause_summary: generateRootCauseSummary(tickets),
    ticket_count: tickets.length,
    affected_customer_count: customers.length,
    name: tickets[0]?.title || "Auto-detected Signal",
    summary: tickets.map((t) => t.title || "").filter(Boolean).join("; ").slice(0, 500),
    category: tickets[0]?.category || "general",
    proposed_priority: tickets.some((t) => t.priority === "urgent") ? "urgent"
      : tickets.some((t) => t.priority === "high") ? "high" : "normal",
    status: "pending",
    workflowStage: "new",
  };
}

function buildClusterDescription(cluster) {
  return [
    `**Auto-detected Signal**`,
    `**Cluster**: ${cluster.cluster_id}`,
    `**Tickets**: ${cluster.ticket_count}`,
    `**Affected Customers**: ${cluster.affected_customer_count}`,
    `**Similarity**: ${Math.round(cluster.similarity_score * 100)}%`,
    `**Confidence**: ${cluster.confidence}%`,
    `**Risk Score**: ${cluster.risk_score}/10`,
    ``,
    `**Root Cause**: ${cluster.root_cause_summary}`,
    ``,
    `**Related Tickets**:`,
    ...cluster.ticket_ids.map((id) => `- ${id}`),
  ].join("\n");
}

/* ── Historical root cause check ────────────────────────────────── */
async function loadExistingSignalsAndIncidents() {
  try {
    const [sigRes, incRes] = await Promise.allSettled([
      client.records.list("signals", { limit: 200 }),
      client.records.list("incidents", { limit: 200 }),
    ]);
    const signals = (sigRes.status === "fulfilled" ? sigRes.value.items || sigRes.value.records || sigRes.value.data || [] : []);
    const incidents = (incRes.status === "fulfilled" ? incRes.value.items || incRes.value.records || incRes.value.data || [] : []);
    return { signals, incidents };
  } catch {
    return { signals: [], incidents: [] };
  }
}

function checkHistoricalRootCause(ticket, signals, incidents) {
  let historicalScore = 0;
  const ticketCat = (ticket.category || "").toLowerCase();
  const ticketWords = tokenize(ticket.title || "");

  for (const sig of signals) {
    const sigCat = (sig.category || "").toLowerCase();
    if (sigCat === ticketCat && sigCat) {
      historicalScore += 0.3;
      const sigWords = tokenize(sig.name || sig.summary || "");
      const overlap = ticketWords.filter((w) => sigWords.includes(w)).length;
      if (overlap > 1) historicalScore += 0.2;
    }
  }

  for (const inc of incidents) {
    const incCat = (inc.category || inc.title || "").toLowerCase();
    if (incCat.includes(ticketCat) && ticketCat) {
      historicalScore += 0.2;
    }
  }

  return Math.min(historicalScore, 1);
}

/* ── Audit log ──────────────────────────────────────────────────── */
async function writeAuditLog(action, actor, details, workspaceId, workspaceName) {
  await createNotification({
    action,
    actor: actor || "Signal Detection Agent",
    resourceType: "signal",
    details: details || {},
    workspaceId,
    workspaceName,
  });
}

/* ── Create a signal record ─────────────────────────────────────── */
async function createSignalFromCluster(cluster, workspaceId, workspaceName) {
  /* STEP 6 */
  const requestPayload = {
    name: cluster.name,
    summary: cluster.summary,
    category: cluster.category,
    evidence_count: cluster.ticket_count,
    example_ticket_ids: cluster.ticket_ids,
    proposed_priority: cluster.proposed_priority,
    analysis_confidence: cluster.confidence,
    affected_customer_count: cluster.affected_customer_count,
    business_impact_score: Math.round(cluster.risk_score * 10),
    root_cause: cluster.root_cause_summary,
    workspaceId: workspaceId,
    workspaceName: workspaceName,
  };
  console.log("Calling create_signal()");
  console.log("Complete request payload:", JSON.stringify(requestPayload, null, 2));

  const signalResult = await client.functions.run(SIGNAL_FUNC, {
    input: requestPayload,
  });

  /* STEP 7 */
  console.log("FULL RAW RESPONSE");
  console.log("success:", signalResult.status === "completed" ? true : false);
  console.log("signal id:", signalResult.output_data?.signal_id || signalResult.signal_id || signalResult.id);
  console.log("output_data:", JSON.stringify(signalResult.output_data, null, 2));
  console.log("errors:", signalResult.errors || signalResult.error || "none");

  const signalId = signalResult.output_data?.signal_id || signalResult.signal_id || signalResult.id;
  if (!signalId) {
    console.error("create_signal returned no signal_id. Raw result keys:", Object.keys(signalResult));
    throw new Error("create_signal returned no signal_id");
  }

  /* 2. Verify the signal record actually exists before PATCHing */
  let signalRecord = null;
  try {
    signalRecord = await client.records.get("signals", signalId);
  } catch (err) {
    console.warn("GET signals/" + signalId + " FAILED:", err.message);
    console.warn("The returned signal_id is NOT a valid datastore record. Returning ID without PATCH.");
    return signalId;
  }

  /* 3. Check which PATCH fields are already written by create_signal */
  const patchFields = {
    affected_customer_count: cluster.affected_customer_count,
    business_impact_score: Math.round(cluster.risk_score * 10),
    root_cause: cluster.root_cause_summary,
    workspaceId: workspaceId,
    workspaceName: workspaceName,
  };

  const missing = {};
  for (const [key, value] of Object.entries(patchFields)) {
    if (signalRecord[key] === null || signalRecord[key] === undefined || signalRecord[key] === "") {
      missing[key] = value;
    }
  }

  /* 4. Only PATCH if fields are actually missing */
  if (Object.keys(missing).length === 0) {
    log("create_signal already wrote all fields — skipping PATCH");
  } else {
    log("Patching missing fields on signal:", Object.keys(missing).join(", "));
    await client.records.update("signals", signalId, missing);
    log("PATCH succeeded");
  }

  return signalId;
}

/* ── Link ticket to existing signal ─────────────────────────────── */
async function attachTicketToSignal(signal, cluster, ticketId) {
  const existingIds = signal.example_ticket_ids || signal.linked_ticket_ids || signal.ticket_ids || [];
  const allClusterIds = [ticketId, ...cluster.ticket_ids];
  const allAlreadyPresent = allClusterIds.every((id) => existingIds.includes(id));
  if (allAlreadyPresent) {
    log("All cluster tickets already in signal, skipping");
    return false;
  }

  const allIds = [...new Set([...existingIds, ...allClusterIds])];
  const existingCustomerCount = signal.affected_customer_count || 0;
  const newCustomers = cluster.affected_customers.length;
  const totalCustomerCount = Math.max(existingCustomerCount, newCustomers);

  const signalUpdates = {};
  signalUpdates.example_ticket_ids = allIds;
  signalUpdates.evidence_count = allIds.length;
  signalUpdates.affected_customer_count = totalCustomerCount;
  signalUpdates.business_impact_score = Math.max(signal.business_impact_score || 0, Math.round(cluster.risk_score * 10));
  signalUpdates.analysis_confidence = Math.max(signal.analysis_confidence ?? 0, cluster.confidence ?? 0);

  await client.records.update("signals", signal.id, signalUpdates);

  log("Attached ticket", ticketId, "to existing signal", signal.id);
  return true;
}

/* ── Escalate to incident (create or update — link_incident handles dedup) ─── */
async function escalateToIncident(cluster, signalForEscalation, workspaceId, workspaceName) {
  log("Escalating to incident, risk score:", cluster.risk_score);

  const title = `Auto-escalated: ${cluster.name}`;
  const severity = cluster.risk_score >= 9 ? "urgent" : cluster.risk_score >= 7 ? "high" : "normal";
  const desc = buildClusterDescription(cluster);

  const incidentInput = {
    signal_id: signalForEscalation.id,
    title,
    summary: cluster.root_cause_summary,
    severity,
    description: desc,
    workspace_id: workspaceId,
    workspace_name: workspaceName,
    affected_customer_count: cluster.affected_customer_count || 0,
    root_cause: cluster.root_cause_summary,
    category: cluster.category || "general",
  };
  log("[escalateToIncident] Payload:", incidentInput);

  const result = await client.functions.run(INCIDENT_FUNC, { input: incidentInput });

  const incId = result.output_data?.incident_id || result.incident_id || result.id;
  log("[escalateToIncident] Result — incId:", incId, "output_data:", JSON.stringify(result.output_data).slice(0, 200));
  if (!incId) {
    warn("link_incident raw result has no incident_id — keys:", Object.keys(result),
      "output_data:", result.output_data ? JSON.stringify(result.output_data).slice(0, 300) : "undefined",
      "incident_id field:", result.incident_id, "id field:", result.id);
  } else {
    try {
      await client.records.update("signals", signalForEscalation.id, { incident_id: incId, workflowStage: "incident_created", status: "approved" });
      log("[escalateToIncident] Signal updated with incident_id:", incId);
    } catch (err) {
      console.error("FAILED at signal update after incident:", err.message);
      throw err;
    }
  }
  log("Incident created:", incId);
  return incId;
}

/* ── Post-incident automation ───────────────────────────────────── */
async function postIncidentActions(cluster, signalId, incidentId, workspaceId, workspaceName, config) {
  log("Running post-incident automation...");

  if (config.autoCreateLinearIssue && incidentId) {
    try {
      const incident = await client.records.get("incidents", incidentId).catch(() => null);
      if (incident) {
        const priorityMap = { urgent: 1, high: 2, normal: 3, low: 4 };
        const raw = await client.connectors.operations.execute(
          { organizationId: ORG_ID, authConfigName: LINEAR_AUTH_CONFIG },
          "LINEAR_CREATE_LINEAR_ISSUE",
          {
            team_id: LINEAR_TEAM_ID,
            title: incident.title || `Incident ${incidentId}`,
            description: incident.description || incident.summary || `Severity: ${incident.severity || "N/A"}`,
            priority: priorityMap[incident.severity] || 0,
          },
        );
        const opResult = raw?.result || {};
        const issueId = opResult.id;
        const issueUrl = opResult.ticket_url || "";
        const identifier = issueUrl.match(/\/issue\/([^/]+)/)?.[1] || opResult.issue_title || "";
        if (issueId) {
          const now = new Date().toISOString();
          await client.records.update("incidents", incidentId, {
            linearIssueId: issueId,
            linearIssueUrl: issueUrl || "",
            linearIssueIdentifier: identifier || "",
            linearSyncedAt: now,
            linearStatus: "Todo",
          }).catch(e => log("Linear persist failed:", e?.message || e));
          log("Linear issue created and persisted:", identifier);
        } else {
          log("Linear create returned unsuccessful:", opResult.error || "unknown error");
        }
      }
    } catch (err) {
      log("Failed to create Linear issue:", err.message);
    }
  }

  if (config.autoSendGmailAlerts && incidentId) {
    try {
      await writeAuditLog("email.alert_sent", "Signal Detection Agent",
        { incident_id: incidentId, severity: cluster.risk_score >= 9 ? "urgent" : cluster.risk_score >= 7 ? "high" : "normal",
          note: "Handled by link_incident server-side via Gmail connector" },
        workspaceId, workspaceName);
      log("Gmail alert: handled by link_incident function");
    } catch { /* skip */ }
  }

  if (incidentId) {
    try {
      await writeAuditLog("incident.created", "Signal Detection Agent",
        { incident_id: incidentId, cluster_id: cluster.cluster_id, risk_score: cluster.risk_score },
        workspaceId, workspaceName);
    } catch { /* skip */ }
  }
}

/* ── Main: run detection for a single ticket ────────────────────── */
export async function runDetection(ticketId, workspaceId, workspaceName) {
  clearPipelineEvents();
  const results = { signal_created: false, ticket_linked: false, incident_created: false, signal_id: null, incident_id: null, cluster: null, logs: [], pipeline: [] };


  track("detection_start", { ticketId, workspaceId, workspaceName });

  const config = getAIDetectionConfig(workspaceId);
  const thresholds = getThresholds(workspaceId);
  const signalEnabled = isSignalAutomationEnabled(workspaceId);
  const signalAuto = getSignalAutomation(workspaceId);
  const incidentAuto = getIncidentAutomation(workspaceId);

  track("config_loaded", { signalEnabled, edgeThreshold: thresholds.edgeThreshold, minTickets: thresholds.minTickets, minSimilarity: thresholds.minSimilarity, maxAgeMs: thresholds.maxAgeMs, escalationThreshold: thresholds.escalationThreshold });

  if (!signalEnabled) {
    warn("Signal automation disabled for workspace", workspaceId);
    track("signal_disabled", { workspaceId });
    results.logs.push("Signal automation disabled");
    results.pipeline = getPipelineEvents();
    return results;
  }

  results.logs.push("AI Detection Started");

  try {
    /* 1. Load the trigger ticket */
    let triggerTicket;
    try {
      triggerTicket = await client.records.get("tickets", ticketId);
      log("Loaded trigger ticket:", triggerTicket.title);
      track("load_ticket", { success: true, ticketId, title: triggerTicket.title, category: triggerTicket.category, priority: triggerTicket.priority });
      results.logs.push("Loaded trigger ticket");
    } catch (err) {
      warn("Failed to load ticket", ticketId);
      track("load_ticket", { success: false, ticketId, error: err.message });
      results.logs.push("Failed to load ticket");
      results.pipeline = getPipelineEvents();
      return results;
    }

    console.log("");
    console.log("--- Ticket ---");
    console.log("Ticket title:", triggerTicket.title);

    /* 2. Load recent tickets from same workspace */
    const filters = workspaceId && workspaceId !== "signaldesk"
      ? [{ field: "workspaceId", op: "eq", value: workspaceId }]
      : undefined;

    const res = await client.records.list("tickets", {
      limit: 200,
      sort: [{ field: "created_at", direction: "desc" }],
      filters,
    });
    const allTickets = res.items || res.records || res.data || [];
    log("Loaded", allTickets.length, "recent tickets");
    track("load_candidates", { success: true, totalAvailable: allTickets.length });
    results.logs.push(`Found ${allTickets.length} recent tickets`);

    /* 3. Build candidate pool — filter by time window (and optional grouping) */
    const candidates = [triggerTicket];
    const now = Date.now();
    const maxAge = thresholds.maxAgeMs;
    const groupingId = triggerTicket.outage_id || triggerTicket.grouping_id || triggerTicket.simulation_id || triggerTicket.demo_run_id || null;
    if (groupingId) {
      log("Restricting candidates to grouping:", groupingId);
      track("candidate_grouping", { groupingId, triggerTicketId: ticketId });
    }
    for (const t of allTickets) {
      if (t.id === ticketId) continue;
      if (groupingId) {
        const tGroup = t.outage_id || t.grouping_id || t.simulation_id || t.demo_run_id || null;
        if (tGroup !== groupingId) continue;
      } else {
        const age = now - new Date(t.created_at || t.createdAt || 0).getTime();
        if (age > maxAge) continue;
      }
      candidates.push(t);
      if (candidates.length >= 20) break;
    }

    log("Candidate pool size:", candidates.length);
    const candidateSource = groupingId ? "grouping_id" : "time_window";
    track("candidate_pool", { poolSize: candidates.length, groupingId, source: candidateSource });
    if (candidates.length < 2) {
      warn("Not enough candidates");
      track("insufficient_candidates", { poolSize: candidates.length });
      results.logs.push("Not enough candidates for clustering");
      results.pipeline = getPipelineEvents();
      return results;
    }

    /* 4. Compute pairwise similarity matrix */
    const pairs = [];
    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const sim = computeTicketSimilarity(candidates[i], candidates[j]);
        pairs.push({ i, j, i_id: candidates[i].id, j_id: candidates[j].id, score: sim.total, factors: sim.factors });
      }
    }
    track("similarity_matrix", { pairs: pairs.map(p => ({ i_id: p.i_id, j_id: p.j_id, score: Math.round(p.score * 100) / 100 })) });
    results.logs.push("Similarity Matrix Built");

    const allScores = pairs.map(p => p.score);
    const highestSim = allScores.length > 0 ? Math.max(...allScores) : 0;
    const avgSimAll = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;
    console.log("Candidate count:", candidates.length);
    console.log("Highest similarity:", (highestSim * 100).toFixed(1) + "%");

    /* 5. Graph-based clustering (edge threshold from config) */
    const adjacency = candidates.map(() => []);
    let edgesFormed = 0;
    pairs.forEach((p) => {
      if (p.score >= thresholds.edgeThreshold) {
        adjacency[p.i].push(p.j);
        adjacency[p.j].push(p.i);
        edgesFormed++;
      }
    });
    log("Edges formed:", edgesFormed, "out of", pairs.length, "pairs");
    track("edges_formed", { edgeThreshold: thresholds.edgeThreshold, totalPairs: pairs.length, edgesFormed });

    const visited = new Set();
    const clusters = [];

    for (let i = 0; i < candidates.length; i++) {
      if (visited.has(i)) continue;
      const cluster = [];
      const queue = [i];
      visited.add(i);
      while (queue.length > 0) {
        const node = queue.shift();
        cluster.push(candidates[node]);
        for (const neighbor of adjacency[node]) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
      clusters.push(cluster);
    }

    const clusterSizes = clusters.map((c, idx) => ({ clusterIndex: idx, size: c.length, ticketIds: c.map(t => t.id) }));
    log("Found", clusters.length, "clusters:", clusterSizes.map(c => `cluster_${c.clusterIndex}=${c.size}`).join(", "));
    track("clusters_found", { clusterCount: clusters.length, clusters: clusterSizes });

    console.log("Clusters formed:", clusters.length);
    clusters.forEach((c, idx) => {
      const cPairs = [];
      for (let i = 0; i < c.length; i++) {
        for (let j = i + 1; j < c.length; j++) {
          cPairs.push(computeTicketSimilarity(c[i], c[j]).total);
        }
      }
      const cAvgSim = cPairs.length > 0 ? cPairs.reduce((a, b) => a + b, 0) / cPairs.length : (c.length >= 2 ? 0 : 1);
      const cMaxSim = cPairs.length > 0 ? Math.max(...cPairs) : (c.length >= 2 ? 0 : 1);
      const timestamps = c.map(t => new Date(t.created_at || t.createdAt || 0).getTime()).filter(ts => !isNaN(ts));
      const timeSpanHours = timestamps.length > 1 ? (Math.max(...timestamps) - Math.min(...timestamps)) / 3600000 : 0;
      const category = c[0]?.category || "N/A";
      const riskScore = computeRiskScore(c);
      const meetsSize = c.length >= thresholds.minTickets;
      const meetsSim = cAvgSim >= thresholds.minSimilarity;
      const meetsWindow = isWithinWindow(c, thresholds.maxAgeMs);

      console.log(`Cluster #${idx + 1} — ${c.length} tickets, avg sim ${(cAvgSim * 100).toFixed(1)}%, cat=${category}, risk=${riskScore}`);
      console.log(`  Cluster passed minimum size? ${meetsSize ? "Yes" : "No"}`);
      console.log(`  Cluster passed similarity threshold? ${meetsSim ? "Yes" : "No"}`);
      console.log(`  Cluster passed time window? ${meetsWindow ? "Yes" : "No"}`);
      console.log(`  Cluster size: ${c.length}`);
      console.log(`  Cluster average similarity: ${(cAvgSim * 100).toFixed(1)}%`);

      const isMatch = c.some(t => t.id === ticketId);
      if (isMatch) console.log(`  --> Trigger's cluster`);
    });

    /* 6. Find matching cluster */
    const matchCluster = clusters.find((c) => c.some((t) => t.id === ticketId));

    if (!matchCluster) {
      warn("No cluster found for ticket");
      track("cluster_match", { found: false, ticketId });
      results.logs.push("No cluster found");
      results.pipeline = getPipelineEvents();
      return results;
    }

    log("Matching cluster size:", matchCluster.length);
    track("cluster_match", { found: true, ticketId, clusterSize: matchCluster.length, memberIds: matchCluster.map(t => t.id) });
    results.logs.push(`Cluster Found (size: ${matchCluster.length})`);

    if (matchCluster.length < thresholds.minTickets) {
      warn("Cluster too small:", matchCluster.length, "/", thresholds.minTickets);
      console.log(`  Rejected: Size = ${matchCluster.length} (minimum required = ${thresholds.minTickets})`);
      track("cluster_too_small", { size: matchCluster.length, minRequired: thresholds.minTickets });
      results.logs.push(`Cluster too small (${matchCluster.length}/${thresholds.minTickets})`);
      results.pipeline = getPipelineEvents();
      return results;
    }

    const windowOk = isWithinWindow(matchCluster, thresholds.maxAgeMs);
    track("cluster_time_window", { passed: windowOk, maxAgeMs: thresholds.maxAgeMs, ticketAgesMs: matchCluster.map(t => Date.now() - new Date(t.created_at || t.createdAt || 0).getTime()) });
    if (!windowOk) {
      warn("Cluster outside time window");
      console.log("  Rejected: Time window exceeded");
      results.logs.push("Cluster outside time window");
      results.pipeline = getPipelineEvents();
      return results;
    }

    const anchorIdx = matchCluster.findIndex((t) => t.id === ticketId);
    /* Filter out chain-connected members with low similarity to the trigger */
    const filteredCluster = anchorIdx >= 0 && thresholds.minTicketSimilarity
      ? matchCluster.filter((t, i) => i === anchorIdx || computeTicketSimilarity(matchCluster[anchorIdx], t).total >= thresholds.minTicketSimilarity)
      : matchCluster;
    if (filteredCluster.length < matchCluster.length) {
      log(`Filtered ${matchCluster.length - filteredCluster.length} low-similarity chained tickets`);
    }
    const avgSim = averageSimilarity(filteredCluster, anchorIdx >= 0 ? Math.min(anchorIdx, filteredCluster.length - 1) : undefined);
    log("Average similarity:", (avgSim * 100).toFixed(1), "%");

    track("similarity_check", { avgSimilarity: Math.round(avgSim * 10000) / 10000, minSimilarity: thresholds.minSimilarity, passed: avgSim >= thresholds.minSimilarity });
    if (avgSim < thresholds.minSimilarity) {
      warn("Similarity below threshold:", (avgSim * 100).toFixed(1), "% <", (thresholds.minSimilarity * 100), "%");
      console.log(`  Rejected: Average similarity = ${(avgSim * 100).toFixed(1)}% (minimum required = ${(thresholds.minSimilarity * 100).toFixed(0)}%)`);
      results.logs.push(`Insufficient similarity (${(avgSim * 100).toFixed(1)}%)`);
      results.pipeline = getPipelineEvents();
      return results;
    }

    results.logs.push(`Cluster meets thresholds (${matchCluster.length} tickets, ${(avgSim * 100).toFixed(1)}% similar)`);

    /* 7. Build cluster data */
    const cluster = buildCluster(matchCluster, ticketId);
    log("Risk score:", cluster.risk_score, "Confidence:", cluster.confidence, "%");
    track("cluster_accepted", { clusterId: cluster.cluster_id, ticketCount: cluster.ticket_count, avgSimilarity: cluster.similarity_score, riskScore: cluster.risk_score, confidence: cluster.confidence });
    results.logs.push(`Risk Score: ${cluster.risk_score}, Confidence: ${cluster.confidence}%`);

    /* 7b. Historical root cause check — boost risk by matching existing signals/incidents */
    try {
      const { signals: existingSignals, incidents: existingIncidents } = await loadExistingSignalsAndIncidents();
      track("historical_check_start", { existingSignalCount: existingSignals.length, existingIncidentCount: existingIncidents.length });
      const historicalBoost = checkHistoricalRootCause(triggerTicket, existingSignals, existingIncidents);
      if (historicalBoost > 0) {
        cluster.risk_score = Math.min(cluster.risk_score + historicalBoost * 3, 10);
        cluster.affected_customer_count = Math.max(cluster.affected_customer_count, Math.round(historicalBoost * 5));
        log("Historical boost applied:", historicalBoost);
        track("historical_boost_applied", { boost: historicalBoost, newRiskScore: cluster.risk_score });
        results.logs.push(`Historical root cause match (boost: ${(historicalBoost * 100).toFixed(0)}%)`);
      } else {
        track("historical_boost_none", {});
      }
    } catch { track("historical_check_error", {}); /* skip historical check on failure */ }

    /* 8. Find or create signal — check if any cluster ticket already belongs to a signal */
    let existingSignal = null;
    let createdSignalId = null;
    for (const t of matchCluster) {
      if (t.id === ticketId) continue;
      const sig = await findExistingSignalForTicket(t.id, workspaceId);
      if (sig) { existingSignal = sig; break; }
    }

    track("existing_signal_search", { signalFound: !!existingSignal, existingSignalId: existingSignal?.id, searchedTicketIds: matchCluster.map(t => t.id).filter(id => id !== ticketId) });

    if (existingSignal) {
      results.ticket_linked = await attachTicketToSignal(existingSignal, cluster, ticketId);
      results.cluster = { ...cluster, id: existingSignal.id };
      results.signal_id = existingSignal.id;
      track("ticket_linked", { signalId: existingSignal.id, ticketId, linked: results.ticket_linked });
      if (results.ticket_linked) results.logs.push("Ticket linked to existing signal");
      else results.logs.push("Ticket already in signal");
    } else {
      try {
        /* STEP 5 */
        console.log("CREATING SIGNAL");
        console.log("cluster size:", cluster.ticket_count);
        console.log("cluster score:", cluster.risk_score);
        console.log("ticket ids:", JSON.stringify(cluster.ticket_ids));

        /* STEP 8 — query signals before */
        let signalsBefore = [];
        try {
          const sb = await client.records.list("signals", { limit: 200 });
          signalsBefore = sb.items || sb.records || sb.data || [];
        } catch (e) { console.warn("signals before query failed:", e.message); }
        console.log("Signals before create:", signalsBefore.length);

        const signalInput = {
          name: cluster.name,
          summary: cluster.summary,
          category: cluster.category,
          evidence_count: cluster.ticket_count,
          example_ticket_ids: cluster.ticket_ids,
          proposed_priority: cluster.proposed_priority,
        };
        track("create_signal_invoked", { input: signalInput });
        createdSignalId = await createSignalFromCluster(cluster, workspaceId, workspaceName);
        track("create_signal_response", { success: true, signalId: createdSignalId });

        /* STEP 8 — verify returned ID is a real datastore record */
        console.log("returned ID:", createdSignalId);
        let newestSignals = [];
        try {
          const sa = await client.records.list("signals", {
            sort: [{ field: "created_at", direction: "desc" }],
            limit: 5,
          });
          newestSignals = sa.items || sa.records || sa.data || [];
        } catch (e) { console.warn("signals query failed:", e.message); }
        const newestIds = newestSignals.map(s => s.id);
        console.log("newest signal IDs:", JSON.stringify(newestIds));
        if (newestIds.includes(createdSignalId)) {
          console.log("returned ID IS in the newest signals list ✓");
        } else {
          console.error("returned ID IS NOT in the newest signals list — the function returned a fake/non-datastore ID");
        }

        /* STEP 9 */
        console.log("Signal created successfully");

        results.signal_created = true;
        results.signal_id = createdSignalId;
        results.cluster = { ...cluster, id: createdSignalId };
        results.logs.push("Signal Created");
      } catch (err) {
        console.error("FAILED at signal creation stage");
        console.error("Error:", err.message);
        console.error("Stack:", err.stack);
        throw err;
      }
    }

    /* 9. Audit log */
    const logAction = results.ticket_linked ? "signal.linked" : "signal.detected";
    const logDetails = results.ticket_linked
      ? { signal_id: existingSignal?.id, ticket_id: ticketId, cluster_id: cluster.cluster_id, ticket_count: cluster.ticket_count }
      : { cluster_id: cluster.cluster_id, ticket_count: cluster.ticket_count, similarity: cluster.similarity_score, confidence: cluster.confidence };
    try {
      await writeAuditLog(logAction, "Signal Detection Agent", logDetails, workspaceId, workspaceName);
      track("audit_log", { action: logAction, written: true, details: logDetails });
      results.logs.push("Audit log written");
    } catch (err) {
      track("audit_log", { action: logAction, written: false, error: err.message });
      warn("Audit log write failed:", err);
    }

    /* 10. Escalate to incident */
    console.log("Incident creation started");
    if (config.autoCreateIncident && cluster.risk_score > 0) {
      const escThreshold = thresholds.escalationThreshold / 10;
      track("escalation_check", { riskScore: cluster.risk_score, threshold: escThreshold, autoCreateIncident: config.autoCreateIncident });
      log("Incident escalation check: risk", cluster.risk_score, ">= threshold", escThreshold, "?");
      if (cluster.risk_score >= escThreshold) {
        const signalForEscalation = existingSignal || results.cluster;
        if (signalForEscalation?.id) {
          try {
            const incId = await escalateToIncident(cluster, signalForEscalation, workspaceId, workspaceName);
            if (incId) {
              results.incident_created = true;
              results.incident_id = incId;
              console.log("Incident created");
              console.log("Incident ID:", incId);
              track("incident_created", { incidentId: incId, signalId: signalForEscalation.id });
              results.logs.push("Incident created / updated");
              await postIncidentActions(cluster, signalForEscalation.id, incId, workspaceId, workspaceName, config);
              track("post_incident_actions", { completed: true });
              results.logs.push("Post-incident automation complete");
            }
          } catch (err) {
            console.error("FAILED at incident creation stage");
            console.error("Error:", err.message);
            console.error("Stack:", err.stack);
            throw err;
          }
        }
      } else {
        track("escalation_skipped", { reason: "below_threshold", riskScore: cluster.risk_score, threshold: escThreshold });
        results.logs.push(`Risk below escalation threshold (${cluster.risk_score} < ${escThreshold})`);
      }
    } else {
      track("escalation_check", { autoCreateIncident: config.autoCreateIncident, riskScore: cluster.risk_score });
    }

    /* 11. Refresh */
    emitRefresh();
    results.logs.push("UI refresh triggered");

    track("detection_complete", { signalCreated: results.signal_created, ticketLinked: results.ticket_linked, incidentCreated: results.incident_created, signalId: results.signal_id, incidentId: results.incident_id });

    console.log(`  Signal created? ${results.signal_created ? "Yes" : "No"}`);
    if (results.signal_created) console.log(`  Signal ID: ${results.signal_id}`);
    if (results.incident_created) console.log(`  Incident created? Yes (ID: ${results.incident_id})`);
    if (results.ticket_linked) console.log(`  Ticket linked to existing signal? Yes (Signal ID: ${results.signal_id})`);
    console.log("");

    log("========== AI DETECTION COMPLETED ==========");
    log("Signal created:", results.signal_created, "| Ticket linked:", results.ticket_linked, "| Incident created:", results.incident_created);
    results.logs.push("Detection Completed");

    results.pipeline = getPipelineEvents();
    return results;
  } catch (err) {
    warn("Fatal error:", err);
    track("detection_fatal_error", { error: err.message, stack: err.stack });
    results.logs.push("Error: " + (err.message || "unknown"));
    results.pipeline = getPipelineEvents();
    return results;
  }
}

/* ── Run detection for all tickets in a workspace ───────────────── */
export async function runDetectionForWorkspace(workspaceId) {
  log("Running detection for all tickets in workspace:", workspaceId);

  const wsName = workspaceId === "signaldesk" ? "SignalDesk" : workspaceId;
  const filters = workspaceId && workspaceId !== "signaldesk"
    ? [{ field: "workspaceId", op: "eq", value: workspaceId }]
    : undefined;

  const res = await client.records.list("tickets", {
    limit: 200,
    sort: [{ field: "created_at", direction: "desc" }],
    filters,
  });
  const tickets = res.items || res.records || res.data || [];
  log("Found", tickets.length, "tickets to analyze");

  const thresholds = getThresholds(workspaceId);
  const wsNameFinal = wsName;

  console.log("Workspace ID:", workspaceId || "signaldesk");
  console.log("Tickets loaded:", tickets.length);
  console.log("Time window:", thresholds.maxAgeMs / 3600000, "hours");
  console.log("Similarity threshold:", (thresholds.minSimilarity * 100).toFixed(0) + "%");
  console.log("Minimum cluster size:", thresholds.minTickets);
  console.log("Edge threshold:", (thresholds.edgeThreshold * 100).toFixed(0) + "%");

  const overall = { total: tickets.length, signals_created: 0, incidents_created: 0, errors: 0, logs: [] };

  for (const t of tickets) {
    try {
      const r = await runDetection(t.id, workspaceId, wsNameFinal);
      if (r.signal_created) overall.signals_created++;
      if (r.incident_created) overall.incidents_created++;
      if (r.logs?.some((l) => l.startsWith("Error"))) overall.errors++;
    } catch (e) {
      console.log("--- Ticket ---");
      console.log("Ticket ID:", t.id);
      console.log("Title:", t.title);
      console.log("  Error:", e.message);
      overall.errors++;
    }
  }

  console.log("");
  console.log("=========================");
  console.log("SUMMARY");
  console.log("=========================");
  console.log("Tickets processed:", tickets.length);
  console.log("Signals created:", overall.signals_created);
  console.log("Incidents created:", overall.incidents_created);
  console.log("Errors:", overall.errors);
  console.log("=========================");
  console.log("");

  log("Done. Signals created:", overall.signals_created, "Incidents:", overall.incidents_created, "Errors:", overall.errors);
  return overall;
}

/* ── Run detection for all workspaces ───────────────────────────── */
export async function runDetectionForAll() {
  log("Running detection for ALL workspaces");
  const workspaceIds = ["signaldesk", "corally", "foxo", "binocs", "zap", "yesmadam"];
  const overall = { total: 0, signals: 0, incidents: 0, errors: 0 };
  for (const wsId of workspaceIds) {
    const r = await runDetectionForWorkspace(wsId);
    overall.total += r.total;
    overall.signals += r.signals_created;
    overall.incidents += r.incidents_created;
    overall.errors += r.errors;
  }
  log("All workspaces done. Total signals:", overall.signals, "Incidents:", overall.incidents);
  return overall;
}

/* ── Backward compat alias ──────────────────────────────────────── */
export const runSignalDetection = runDetection;
