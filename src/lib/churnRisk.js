const NEGATIVE_WORDS = [
  "cancel", "unsubscribe", "refund", "complaint", "frustrated", "angry",
  "terrible", "awful", "worst", "disappointed", "never again", "leave",
  "switch", "competitor", "chargeback", "lawsuit", "attorney", "horrible",
  "bad", "useless", "scam", "fraud", "unfair", "ridiculous", "unacceptable",
];

function wordCount(text) {
  return (text || "").toLowerCase().split(/\s+/).filter(Boolean).length;
}

function negativeWordMatches(text) {
  const body = (text || "").toLowerCase();
  return NEGATIVE_WORDS.filter((w) => body.includes(w));
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  return (Date.now() - new Date(dateStr).getTime()) / 86400000;
}

function hoursSince(dateStr) {
  if (!dateStr) return null;
  return (Date.now() - new Date(dateStr).getTime()) / 3600000;
}

export function calculateChurnRisk(ticket, context = {}) {
  if (!ticket) return null;

  const resolved = ticket.status === "resolved" || ticket.status === "closed";
  if (resolved) {
    return {
      riskPercent: 0,
      riskLevel: "none",
      factors: [],
      breakdown: [],
      recommendations: [],
      evidence: [],
      resolved: true,
    };
  }

  const factors = [];
  const breakdown = [];
  const evidence = [];
  let totalScore = 0;

  // 1. Ticket volume (requires customerTickets from context)
  const customerTickets = context.customerTickets || [];
  const recentTickets = customerTickets.filter((t) => {
    const d = daysSince(t.created_at);
    return d !== null && d <= 30;
  });
  if (recentTickets.length > 2) {
    const score = Math.min(recentTickets.length * 4, 20);
    factors.push({ name: "High ticket volume", score, label: `Customer opened ${recentTickets.length} tickets in 30 days` });
    breakdown.push({ label: `+${score} repeated tickets`, value: score, evidence: `${recentTickets.length} tickets in 30 days` });
    evidence.push(`Customer created ${recentTickets.length} tickets in the last 30 days.`);
    totalScore += score;
  }

  // 2. Priority
  const priorityScores = { urgent: 18, high: 12, normal: 5, low: 0 };
  const pScore = priorityScores[ticket.priority] || 5;
  if (pScore > 0) {
    factors.push({ name: `${ticket.priority} priority`, score: pScore, label: `High priority issue (${ticket.priority})` });
    breakdown.push({ label: `+${pScore} high priority`, value: pScore, evidence: `Ticket priority is ${ticket.priority}` });
    evidence.push(`Ticket has ${ticket.priority} priority.`);
    totalScore += pScore;
  }

  // 3. Sentiment analysis
  const negativeMatches = negativeWordMatches(ticket.body);
  if (negativeMatches.length > 0) {
    const score = Math.min(negativeMatches.length * 3, 15);
    factors.push({ name: "Negative sentiment", score, label: `${negativeMatches.length} negative words detected` });
    breakdown.push({ label: `+${score} negative sentiment`, value: score, evidence: `Words: ${negativeMatches.slice(0, 5).join(", ")}` });
    evidence.push(`Negative sentiment detected: ${negativeMatches.length} negative words found.`);
    totalScore += score;
  }

  // 4. SLA violations
  if (ticket.sla_due_at && new Date(ticket.sla_due_at) < new Date() && ticket.status !== "resolved") {
    const overdueHours = hoursSince(ticket.sla_due_at);
    const score = Math.min(Math.round(overdueHours / 2), 15);
    factors.push({ name: "SLA breach", score, label: `SLA exceeded by ${Math.round(overdueHours)}h` });
    breakdown.push({ label: `+${score} SLA violations`, value: score, evidence: `SLA exceeded by ${Math.round(overdueHours)} hours` });
    evidence.push(`Average resolution time exceeded SLA by ${Math.round(overdueHours)} hours.`);
    totalScore += score;
  } else if (ticket.sla_due_at) {
    const remainingHours = (new Date(ticket.sla_due_at) - new Date()) / 3600000;
    if (remainingHours < 4 && remainingHours > 0) {
      const score = Math.round((4 - remainingHours) * 2);
      factors.push({ name: "SLA at risk", score, label: `SLA expires in ${Math.round(remainingHours)}h` });
      breakdown.push({ label: `+${score} SLA at risk`, value: score, evidence: `SLA expires in ${Math.round(remainingHours)} hours` });
      evidence.push(`SLA deadline approaching: ${Math.round(remainingHours)} hours remaining.`);
      totalScore += score;
    }
  }

  // 5. Unresolved incidents
  const unresolvedIncidents = context.incidents ? context.incidents.filter((i) => i.status !== "closed").length : 0;
  if (unresolvedIncidents > 0) {
    const score = Math.min(unresolvedIncidents * 8, 16);
    factors.push({ name: "Unresolved incidents", score, label: `${unresolvedIncidents} related incident(s) unresolved` });
    breakdown.push({ label: `+${score} unresolved incident`, value: score, evidence: `${unresolvedIncidents} incidents remain open` });
    evidence.push(`${unresolvedIncidents} related incident${unresolvedIncidents > 1 ? "s remain" : " remains"} unresolved.`);
    totalScore += score;
  }

  // 6. Ticket age
  if (ticket.created_at && ticket.status !== "resolved") {
    const ageHours = hoursSince(ticket.created_at);
    if (ageHours > 24) {
      const score = Math.min(Math.round(ageHours / 8), 12);
      factors.push({ name: "Aging ticket", score, label: `Ticket open for ${Math.round(ageHours)}h` });
      breakdown.push({ label: `+${score} aging ticket`, value: score, evidence: `Open for ${Math.round(ageHours)} hours` });
      evidence.push(`Ticket has been open for ${Math.round(ageHours)} hours without resolution.`);
      totalScore += score;
    }
  }

  // 7. First response time
  const triagedAt = ticket.triaged_at;
  const receivedAt = ticket.received_at || ticket.created_at;
  if (triagedAt && receivedAt) {
    const responseHours = (new Date(triagedAt) - new Date(receivedAt)) / 3600000;
    if (responseHours > 4) {
      const score = Math.min(Math.round(responseHours / 2), 8);
      factors.push({ name: "Slow first response", score, label: `First response took ${Math.round(responseHours)}h` });
      breakdown.push({ label: `+${score} delayed response`, value: score, evidence: `First response: ${Math.round(responseHours)} hours` });
      evidence.push(`Initial response time was ${Math.round(responseHours)} hours, exceeding the 4-hour target.`);
      totalScore += score;
    }
  }

  // 8. Business hours / category risk
  const highRiskCategories = ["billing", "account", "cancellation", "delivery"];
  if (highRiskCategories.includes(ticket.category)) {
    const score = 8;
    factors.push({ name: "High-risk category", score, label: `${ticket.category} issues correlate with churn` });
    breakdown.push({ label: `+${score} risky category`, value: score, evidence: `Category: ${ticket.category}` });
    evidence.push(`Ticket category "${ticket.category}" correlates with higher churn rates.`);
    totalScore += score;
  }

  // 9. Customer tenure / loyalty discount
  if (customerTickets.length > 0) {
    const oldestTicket = customerTickets.reduce((earliest, t) => {
      return !earliest || (t.created_at && t.created_at < earliest.created_at) ? t : earliest;
    }, null);
    if (oldestTicket && oldestTicket.created_at) {
      const tenureMonths = daysSince(oldestTicket.created_at) / 30;
      if (tenureMonths > 6) {
        const score = -Math.min(Math.round(tenureMonths / 3), 8);
        factors.push({ name: "Loyal customer", score, label: `Customer for ${Math.round(tenureMonths)} months` });
        breakdown.push({ label: `${score} loyal customer history`, value: score, evidence: `Tenure: ${Math.round(tenureMonths)} months` });
        evidence.push(`Customer has been active for ${Math.round(tenureMonths)} months with lower churn probability.`);
        totalScore += score;
      }
    }
  }

  // 10. Recent positive resolution (within last 7 days)
  const recentResolved = customerTickets.filter((t) => {
    if (!t.updated_at || t.status !== "resolved") return false;
    return daysSince(t.updated_at) <= 7;
  });
  if (recentResolved.length > 0) {
    const score = -Math.min(recentResolved.length * 4, 8);
    factors.push({ name: "Recent positive resolution", score, label: `${recentResolved.length} ticket(s) resolved recently` });
    breakdown.push({ label: `${score} recent positive resolution`, value: score, evidence: `${recentResolved.length} resolved in 7 days` });
    evidence.push(`Customer had ${recentResolved.length} ticket${recentResolved.length > 1 ? "s" : ""} resolved positively in the last 7 days.`);
    totalScore += score;
  }

  // 11. Escalation history
  const escalationCount = customerTickets.filter((t) => t.escalated === true || t.status === "escalated").length;
  if (escalationCount > 0) {
    const score = Math.min(escalationCount * 6, 12);
    factors.push({ name: "Escalation history", score, label: `${escalationCount} previous escalation(s)` });
    breakdown.push({ label: `+${score} escalation history`, value: score, evidence: `${escalationCount} escalations` });
    evidence.push(`Customer has required ${escalationCount} escalation${escalationCount > 1 ? "s" : ""} on previous tickets.`);
    totalScore += score;
  }

  // Normalize to 0-99
  const riskPercent = Math.max(0, Math.min(Math.round(totalScore), 99));

  let riskLevel;
  if (riskPercent >= 70) riskLevel = "Critical";
  else if (riskPercent >= 50) riskLevel = "High";
  else if (riskPercent >= 25) riskLevel = "Medium";
  else riskLevel = "Low";

  // Generate recommendations based on top risk factors
  const activeFactors = factors.filter((f) => f.score > 0).sort((a, b) => b.score - a.score);
  const recommendations = [];
  if (riskPercent >= 50) recommendations.push({ action: "Escalate immediately", priority: "critical", reason: "Churn risk is critical or high" });
  if (factors.some((f) => f.name === "High ticket volume")) recommendations.push({ action: "Schedule customer call", priority: "high", reason: "High ticket volume indicates customer frustration" });
  if (factors.some((f) => f.name.includes("SLA"))) recommendations.push({ action: "Prioritize within SLA window", priority: "high", reason: "SLA at risk of breach" });
  if (factors.some((f) => f.name === "Unresolved incidents")) recommendations.push({ action: "Prioritize incident resolution", priority: "high", reason: "Unresolved incidents affect customer trust" });
  if (factors.some((f) => f.name === "Negative sentiment")) recommendations.push({ action: "Assign empathetic senior agent", priority: "medium", reason: "Negative sentiment requires careful handling" });
  if (riskPercent >= 50) recommendations.push({ action: "Create executive summary for review", priority: "medium", reason: "High-risk account needs management awareness" });
  if (factors.some((f) => f.name === "High-risk category")) recommendations.push({ action: "Offer goodwill credit or incentive", priority: "medium", reason: "Billing/account issues benefit from goodwill gestures" });
  if (factors.some((f) => f.name === "Slow first response")) recommendations.push({ action: "Reduce first response time", priority: "medium", reason: "Slow response damages customer experience" });
  recommendations.push({ action: "Create follow-up reminder for 48h", priority: "low", reason: "Standard post-resolution check-in" });
  if (factors.some((f) => f.name === "Escalation history")) recommendations.push({ action: "Notify account manager of escalation pattern", priority: "medium", reason: "Recurring escalations indicate systemic issue" });

  return {
    riskPercent,
    riskLevel,
    factors,
    breakdown: breakdown.sort((a, b) => Math.abs(b.value) - Math.abs(a.value)),
    recommendations: recommendations.slice(0, 6),
    evidence: evidence.slice(0, 8),
    resolved: false,
  };
}

export function useChurnRisk(ticket, context = {}) {
  return calculateChurnRisk(ticket, context);
}
