import client from "@/lib/lemmaClient";
import { emitRefresh } from "@/lib/refreshEvents";
import { createNotification } from "@/lib/notifications";
import { getAIDetectionConfig, getThresholds, isSignalAutomationEnabled, getSignalAutomation, getIncidentAutomation } from "@/lib/aiDetectionConfig";

const SIGNAL_FUNC = "create_signal";
const INCIDENT_FUNC = "link_incident";

/* ── Logger ─────────────────────────────────────────────────────── */
function log(...args) { console.log("[AI Detection]", ...args); }
function warn(...args) { console.warn("[AI Detection]", ...args); }

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

function averageSimilarity(tickets) {
  if (tickets.length < 2) return 1;
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
function buildCluster(tickets) {
  const ids = tickets.map((t) => t.id);
  const customers = [...new Set(tickets.map((t) => t.customer_email || t.customer_name || "").filter(Boolean))];
  const timestamps = tickets.map((t) => new Date(t.created_at || t.createdAt || 0).getTime()).filter((t) => !isNaN(t));
  const avgSim = averageSimilarity(tickets);
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
  log("Calling create_signal function for:", cluster.name);

  /* FIXED: Use 'name' not 'title' — the Python function expects 'name' */
  const signalResult = await client.functions.run(SIGNAL_FUNC, {
    input: {
      name: cluster.name,
      summary: cluster.summary,
      category: cluster.category,
      evidence_count: cluster.ticket_count,
      example_ticket_ids: cluster.ticket_ids,
      proposed_priority: cluster.proposed_priority,
    },
  });

  const signalId = signalResult.output_data?.signal_id || signalResult.signal_id || signalResult.id;
  if (!signalId) throw new Error("create_signal returned no signal_id");

  log("Signal created with id:", signalId);

  /* Only PATCH columns that exist in the signals table schema */
  const signalUpdates = {};
  signalUpdates.affected_customer_count = cluster.affected_customer_count;
  signalUpdates.analysis_confidence = cluster.confidence;
  signalUpdates.business_impact_score = Math.round(cluster.risk_score * 10);
  signalUpdates.root_cause = cluster.root_cause_summary;
  signalUpdates.proposed_priority = cluster.proposed_priority;
  signalUpdates.workspaceId = workspaceId;
  signalUpdates.workspaceName = workspaceName;
  signalUpdates.status = "pending";
  signalUpdates.workflowStage = "new";

  await client.records.update("signals", signalId, signalUpdates);

  return signalId;
}

/* ── Link ticket to existing signal ─────────────────────────────── */
async function attachTicketToSignal(signal, cluster, ticketId) {
  const existingIds = signal.example_ticket_ids || signal.linked_ticket_ids || signal.ticket_ids || [];
  if (existingIds.includes(ticketId)) {
    log("Ticket already in signal, skipping");
    return false;
  }

  const allIds = [...new Set([...existingIds, ticketId, ...cluster.ticket_ids])];
  const existingCustomerCount = signal.affected_customer_count || 0;
  const newCustomers = cluster.affected_customers.length;
  const totalCustomerCount = Math.max(existingCustomerCount, newCustomers);

  const signalUpdates = {};
  signalUpdates.example_ticket_ids = allIds;
  signalUpdates.evidence_count = allIds.length;
  signalUpdates.affected_customer_count = totalCustomerCount;
  signalUpdates.business_impact_score = Math.max(signal.business_impact_score || 0, Math.round(cluster.risk_score * 10));

  await client.records.update("signals", signal.id, signalUpdates);

  log("Attached ticket", ticketId, "to existing signal", signal.id);
  return true;
}

/* ── Escalate to incident ───────────────────────────────────────── */
async function escalateToIncident(cluster, signalForEscalation, workspaceId, workspaceName) {
  log("Escalating to incident, risk score:", cluster.risk_score);

  const existing = await findExistingIncidentBySignalId(signalForEscalation.id);
  if (existing) {
    log("Incident already exists for signal, skipping");
    return null;
  }

  const title = `Auto-escalated: ${cluster.name}`;
  const severity = cluster.risk_score >= 9 ? "critical" : cluster.risk_score >= 7 ? "high" : "normal";
  const desc = buildClusterDescription(cluster);

  const result = await client.functions.run(INCIDENT_FUNC, {
    input: {
      signal_id: signalForEscalation.id,
      title,
      summary: cluster.root_cause_summary,
      severity,
      description: desc,
      workspace_id: workspaceId,
      workspace_name: workspaceName,
    },
  });

  const incId = result.output_data?.incident_id || result.incident_id || result.id;
  if (incId) {
    try { await client.records.update("signals", signalForEscalation.id, { incident_id: incId, workflowStage: "incident_created", status: "approved" }); } catch { /* skip */ }
  }
  log("Incident created:", incId);
  return incId;
}

/* ── Post-incident automation ───────────────────────────────────── */
async function postIncidentActions(cluster, signalId, incidentId, workspaceId, workspaceName, config) {
  log("Running post-incident automation...");

  if (config.autoCreateLinearIssue && incidentId) {
    try {
      await writeAuditLog("linear.issue_created", "Signal Detection Agent",
        { incident_id: incidentId, signal_id: signalId, cluster_id: cluster.cluster_id },
        workspaceId, workspaceName);
      log("Linear issue audit logged");
    } catch { /* skip */ }
  }

  if (config.autoSendGmailAlerts && incidentId) {
    try {
      await writeAuditLog("email.alert_sent", "Signal Detection Agent",
        { incident_id: incidentId, severity: cluster.risk_score >= 7 ? "high" : "normal" },
        workspaceId, workspaceName);
      log("Gmail alert audit logged");
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
  const results = { signal_created: false, ticket_linked: false, incident_created: false, signal_id: null, incident_id: null, cluster: null, logs: [] };

  log("========== AI DETECTION STARTED ==========");
  log("Ticket:", ticketId, "Workspace:", workspaceId);

  const config = getAIDetectionConfig(workspaceId);
  const thresholds = getThresholds(workspaceId);
  const signalEnabled = isSignalAutomationEnabled(workspaceId);
  const signalAuto = getSignalAutomation(workspaceId);
  const incidentAuto = getIncidentAutomation(workspaceId);

  if (!signalEnabled) {
    warn("Signal automation disabled for workspace", workspaceId);
    results.logs.push("Signal automation disabled");
    return results;
  }

  results.logs.push("AI Detection Started");

  try {
    /* 1. Load the trigger ticket */
    let triggerTicket;
    try {
      triggerTicket = await client.records.get("tickets", ticketId);
      log("Loaded trigger ticket:", triggerTicket.title);
      results.logs.push("Loaded trigger ticket");
    } catch {
      warn("Failed to load ticket", ticketId);
      results.logs.push("Failed to load ticket");
      return results;
    }

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
    results.logs.push(`Found ${allTickets.length} recent tickets`);

    /* 3. Build candidate pool — all tickets, no filtering */
    const candidates = [triggerTicket];
    for (const t of allTickets) {
      if (t.id === ticketId) continue;
      candidates.push(t);
      if (candidates.length >= 20) break;
    }

    log("Candidate pool size:", candidates.length);
    if (candidates.length < 2) {
      warn("Not enough candidates");
      results.logs.push("Not enough candidates for clustering");
      return results;
    }

    /* 4. Compute pairwise similarity matrix */
    const pairs = [];
    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const sim = computeTicketSimilarity(candidates[i], candidates[j]);
        pairs.push({ i, j, score: sim.total, factors: sim.factors });
      }
    }
    results.logs.push("Similarity Matrix Built");

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
    results.logs.push(`Similarity Matrix Built (${edgesFormed} edges)`);

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

    log("Found", clusters.length, "clusters");

    /* 6. Find matching cluster */
    const matchCluster = clusters.find((c) => c.some((t) => t.id === ticketId));

    if (!matchCluster) {
      warn("No cluster found for ticket");
      results.logs.push("No cluster found");
      return results;
    }

    log("Matching cluster size:", matchCluster.length);
    results.logs.push(`Cluster Found (size: ${matchCluster.length})`);

    if (matchCluster.length < thresholds.minTickets) {
      warn("Cluster too small:", matchCluster.length, "/", thresholds.minTickets);
      results.logs.push(`Cluster too small (${matchCluster.length}/${thresholds.minTickets})`);
      return results;
    }

    if (!isWithinWindow(matchCluster, thresholds.maxAgeMs)) {
      warn("Cluster outside time window");
      results.logs.push("Cluster outside time window");
      return results;
    }

    const avgSim = averageSimilarity(matchCluster);
    log("Average similarity:", (avgSim * 100).toFixed(1), "%");

    if (avgSim < thresholds.minSimilarity) {
      warn("Similarity below threshold:", (avgSim * 100).toFixed(1), "% <", (thresholds.minSimilarity * 100), "%");
      results.logs.push(`Insufficient similarity (${(avgSim * 100).toFixed(1)}%)`);
      return results;
    }

    results.logs.push(`Cluster meets thresholds (${matchCluster.length} tickets, ${(avgSim * 100).toFixed(1)}% similar)`);

    /* 7. Build cluster data */
    const cluster = buildCluster(matchCluster);
    log("Risk score:", cluster.risk_score, "Confidence:", cluster.confidence, "%");
    results.logs.push(`Risk Score: ${cluster.risk_score}, Confidence: ${cluster.confidence}%`);

    /* 7b. Historical root cause check — boost risk by matching existing signals/incidents */
    try {
      const { signals: existingSignals, incidents: existingIncidents } = await loadExistingSignalsAndIncidents();
      const historicalBoost = checkHistoricalRootCause(triggerTicket, existingSignals, existingIncidents);
      if (historicalBoost > 0) {
        cluster.risk_score = Math.min(cluster.risk_score + historicalBoost * 3, 10);
        cluster.affected_customer_count = Math.max(cluster.affected_customer_count, Math.round(historicalBoost * 5));
        log("Historical boost applied:", historicalBoost);
        results.logs.push(`Historical root cause match (boost: ${(historicalBoost * 100).toFixed(0)}%)`);
      }
    } catch { /* skip historical check on failure */ }

    /* 8. Find or create signal — check if any cluster ticket already belongs to a signal */
    let existingSignal = null;
    let createdSignalId = null;
    for (const t of matchCluster) {
      if (t.id === ticketId) continue;
      const sig = await findExistingSignalForTicket(t.id, workspaceId);
      if (sig) { existingSignal = sig; break; }
    }

    if (existingSignal) {
      results.ticket_linked = await attachTicketToSignal(existingSignal, cluster, ticketId);
      results.cluster = { ...cluster, id: existingSignal.id };
      results.signal_id = existingSignal.id;
      if (results.ticket_linked) results.logs.push("Ticket linked to existing signal");
      else results.logs.push("Ticket already in signal");
    } else {
      try {
        createdSignalId = await createSignalFromCluster(cluster, workspaceId, workspaceName);
        results.signal_created = true;
        results.signal_id = createdSignalId;
        results.cluster = { ...cluster, id: createdSignalId };
        results.logs.push("Signal Created");
      } catch (err) {
        warn("Failed to create signal:", err);
        results.logs.push("Signal creation failed: " + (err.message || "unknown"));
        return results;
      }
    }

    /* 9. Audit log */
    const logAction = results.ticket_linked ? "signal.linked" : "signal.detected";
    const logDetails = results.ticket_linked
      ? { signal_id: existingSignal?.id, ticket_id: ticketId, cluster_id: cluster.cluster_id, ticket_count: cluster.ticket_count }
      : { cluster_id: cluster.cluster_id, ticket_count: cluster.ticket_count, similarity: cluster.similarity_score, confidence: cluster.confidence };
    await writeAuditLog(logAction, "Signal Detection Agent", logDetails, workspaceId, workspaceName);
    results.logs.push("Audit log written");

    /* 10. Escalate to incident */
    if (config.autoCreateIncident && cluster.risk_score > 0) {
      const escThreshold = thresholds.escalationThreshold / 10;
      log("Incident escalation check: risk", cluster.risk_score, ">= threshold", escThreshold, "?");
      if (cluster.risk_score >= escThreshold) {
        const signalForEscalation = existingSignal || results.cluster;
        if (signalForEscalation?.id) {
          try {
            const incId = await escalateToIncident(cluster, signalForEscalation, workspaceId, workspaceName);
            if (incId) {
              results.incident_created = true;
              results.incident_id = incId;
              results.logs.push("Incident Created");
              await postIncidentActions(cluster, signalForEscalation.id, incId, workspaceId, workspaceName, config);
              results.logs.push("Post-incident automation complete");
            } else {
              results.logs.push("Incident already exists, skipped");
            }
          } catch (err) {
            warn("Escalation failed:", err);
            results.logs.push("Incident creation failed: " + (err.message || "unknown"));
          }
        }
      } else {
        results.logs.push(`Risk below escalation threshold (${cluster.risk_score} < ${escThreshold})`);
      }
    }

    /* 11. Refresh */
    emitRefresh();
    results.logs.push("UI refresh triggered");

    log("========== AI DETECTION COMPLETED ==========");
    log("Signal created:", results.signal_created, "| Ticket linked:", results.ticket_linked, "| Incident created:", results.incident_created);
    results.logs.push("Detection Completed");

    return results;
  } catch (err) {
    warn("Fatal error:", err);
    results.logs.push("Error: " + (err.message || "unknown"));
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

  const overall = { total: tickets.length, signals_created: 0, incidents_created: 0, errors: 0, logs: [] };

  for (const t of tickets) {
    try {
      const r = await runDetection(t.id, workspaceId, wsName);
      if (r.signal_created) overall.signals_created++;
      if (r.incident_created) overall.incidents_created++;
      if (r.logs?.some((l) => l.startsWith("Error"))) overall.errors++;
    } catch {
      overall.errors++;
    }
  }

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
