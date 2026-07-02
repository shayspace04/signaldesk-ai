const STATUS_TO_STAGE = {
  pending: "new",
  approved: "approved",
  memory: "approved",
  rejected: null,
};

export function deriveWorkflowStage(signal) {
  if (!signal) return "new";
  if (signal.workflowStage) return signal.workflowStage;
  const status = (signal.status || "pending").toLowerCase();
  return STATUS_TO_STAGE[status] || "new";
}
