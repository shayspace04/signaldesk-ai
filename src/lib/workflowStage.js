const VALID_STAGES = ["new", "review", "approved", "incident_created", "rejected"];

const STATUS_TO_STAGE = {
  pending: "new",
  approved: "approved",
  memory: "approved",
  rejected: "rejected",
};

export function deriveWorkflowStage(signal) {
  if (!signal) return "new";
  if (signal.workflowStage && VALID_STAGES.includes(signal.workflowStage)) {
    return signal.workflowStage;
  }
  return STATUS_TO_STAGE[signal.status] || "new";
}
