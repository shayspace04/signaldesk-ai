import { useState, useEffect, useCallback, useRef } from "react";

const PRIORITY_SCORES = { urgent: 35, high: 25, normal: 12, low: 5 };
const STATUS_BASE = { open: 10, pending: 5, waiting_on_customer: 8, escalated: 15 };
const NEGATIVE_WORDS = [
  "cancel", "unsubscribe", "refund", "complaint", "frustrated", "angry",
  "terrible", "awful", "worst", "disappointed", "never again", "leave",
  "switch", "competitor", "chargeback", "lawsuit", "attorney", "horrible",
  "bad", "useless", "scam", "fraud", "unfair",
];

export function calculateChurnRisk(ticket) {
  if (!ticket) return null;

  const resolved = ticket.status === "resolved" || ticket.status === "closed";
  if (resolved) {
    return { riskPercent: 0, riskLevel: "none", estimatedChurnMinutes: 0, reasons: [], resolved: true };
  }

  const priorityScore = PRIORITY_SCORES[ticket.priority] || 10;
  const statusScore = STATUS_BASE[ticket.status] || 10;

  let ageScore = 0;
  if (ticket.created_at) {
    const hours = (Date.now() - new Date(ticket.created_at).getTime()) / 3600000;
    ageScore = Math.min(hours * 1.5, 25);
  }

  let sentimentScore = 0;
  if (ticket.body) {
    const body = ticket.body.toLowerCase();
    const matches = NEGATIVE_WORDS.filter((w) => body.includes(w)).length;
    sentimentScore = Math.min(matches * 4, 20);
  }

  const highRiskCategories = ["billing", "account", "cancellation", "delivery"];
  const categoryScore = highRiskCategories.includes(ticket.category) ? 10 : 0;

  const total = priorityScore + statusScore + ageScore + sentimentScore + categoryScore;
  const riskPercent = Math.min(Math.round(total), 99);

  let riskLevel, estimatedChurnMinutes;
  if (riskPercent >= 75) {
    riskLevel = "Critical";
    estimatedChurnMinutes = Math.max(30, 240 - riskPercent * 2);
  } else if (riskPercent >= 50) {
    riskLevel = "High";
    estimatedChurnMinutes = Math.max(60, 480 - riskPercent * 4);
  } else if (riskPercent >= 25) {
    riskLevel = "Medium";
    estimatedChurnMinutes = Math.max(120, 720 - riskPercent * 6);
  } else {
    riskLevel = "Low";
    estimatedChurnMinutes = Math.max(240, 1440 - riskPercent * 10);
  }

  const reasons = [];
  if (priorityScore >= 25) reasons.push(`${ticket.priority} priority`);
  if (ageScore > 10) reasons.push(`Aging ticket (${Math.round(ageScore / 1.5)}h)`);
  if (sentimentScore > 8) reasons.push("Negative sentiment");
  if (categoryScore > 0) reasons.push(`${ticket.category} category`);
  if (reasons.length === 0) reasons.push("Routine ticket");

  return { riskPercent, riskLevel, estimatedChurnMinutes, reasons, resolved: false };
}

export function useChurnRisk(ticket) {
  const [risk, setRisk] = useState(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const calculatedAt = useRef(null);

  useEffect(() => {
    const r = calculateChurnRisk(ticket);
    setRisk(r);
    if (r && !r.resolved) {
      calculatedAt.current = Date.now();
      setRemainingMs(r.estimatedChurnMinutes * 60 * 1000);
    }
  }, [ticket]);

  useEffect(() => {
    if (!risk || risk.resolved) return;
    const interval = setInterval(() => {
      const elapsed = Date.now() - calculatedAt.current;
      setRemainingMs(Math.max(0, risk.estimatedChurnMinutes * 60 * 1000 - elapsed));
    }, 60000);
    return () => clearInterval(interval);
  }, [risk]);

  const formatRemaining = () => {
    if (!risk || risk.resolved) return null;
    const totalMinutes = Math.ceil(remainingMs / 60000);
    if (totalMinutes <= 0) return "Imminent";
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return { ...risk, remainingFormatted: formatRemaining() };
}
