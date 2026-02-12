export type AssignmentAssignedEvent = {
  type: "assignment.assigned";
  revertUserId: string;
  supervisorUserId: string;
  assignedByUserId?: string;
  timestamp: number;
};

export type AssignmentUnassignedEvent = {
  type: "assignment.unassigned";
  revertUserId: string;
  timestamp: number;
};
