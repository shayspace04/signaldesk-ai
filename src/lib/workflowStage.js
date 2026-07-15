const STATUS_TO_STAGE = {
  pending: "new",
  approved: "approved",
  memory: "approved",
  rejected: "rejected",
};

export function deriveWorkflowStage(signal) {
  if (!signal) return "new";
  return STATUS_TO_STAGE[signal.status] || "new";
}
