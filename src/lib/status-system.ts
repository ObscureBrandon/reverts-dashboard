export type CanonicalStatusCategory =
  | "operational-status"
  | "attribute-status"
  | "metadata-chip"
  | "brand-highlight"

export type CanonicalStatusTone = "brand" | "success" | "warning" | "danger" | "info" | "neutral"
export type CanonicalStatusKind = "status" | "attribute" | "meta"
export type CanonicalStatusEmphasis = "soft" | "solid" | "outline"

export type AssignmentStatusValue =
  | "NEEDS_SUPPORT"
  | "INACTIVE"
  | "SELF_SUFFICIENT"
  | "PAUSED"
  | "NOT_READY"

export type TicketStatusValue = "OPEN" | "CLOSED" | "DELETED"

export type UserAttributeStatusKey = "left-server" | "verified" | "voice" | "revert"

export interface CanonicalStatusDescriptor {
  category: CanonicalStatusCategory
  tone: CanonicalStatusTone
  kind: CanonicalStatusKind
  emphasis: CanonicalStatusEmphasis
  label: string
}

// Shared contract for FND-02. Call sites should map UI state through one of these
// categories instead of introducing page-local color semantics.
export const canonicalStatusCategoryDescriptions: Record<CanonicalStatusCategory, string> = {
  "operational-status": "Workflow-driving status that affects urgency or queue priority.",
  "attribute-status": "Durable user or entity attribute that matters, but is not the primary queue state.",
  "metadata-chip": "Descriptive metadata that should remain visually secondary.",
  "brand-highlight": "Product emphasis or selected state, not operational health.",
}

const assignmentStatusDescriptors: Record<AssignmentStatusValue, CanonicalStatusDescriptor> = {
  NEEDS_SUPPORT: {
    category: "operational-status",
    tone: "danger",
    kind: "status",
    emphasis: "soft",
    label: "Needs Support",
  },
  INACTIVE: {
    category: "operational-status",
    tone: "neutral",
    kind: "status",
    emphasis: "soft",
    label: "Inactive",
  },
  SELF_SUFFICIENT: {
    category: "operational-status",
    tone: "success",
    kind: "status",
    emphasis: "soft",
    label: "Self-Sufficient",
  },
  PAUSED: {
    category: "operational-status",
    tone: "warning",
    kind: "status",
    emphasis: "soft",
    label: "Paused",
  },
  NOT_READY: {
    category: "operational-status",
    tone: "warning",
    kind: "status",
    emphasis: "soft",
    label: "Not Ready",
  },
}

const ticketStatusDescriptors: Record<TicketStatusValue, CanonicalStatusDescriptor> = {
  OPEN: {
    category: "operational-status",
    tone: "neutral",
    kind: "status",
    emphasis: "soft",
    label: "Open",
  },
  CLOSED: {
    category: "operational-status",
    tone: "neutral",
    kind: "status",
    emphasis: "soft",
    label: "Closed",
  },
  DELETED: {
    category: "operational-status",
    tone: "danger",
    kind: "status",
    emphasis: "soft",
    label: "Deleted",
  },
}

const userAttributeStatusDescriptors: Record<UserAttributeStatusKey, CanonicalStatusDescriptor> = {
  "left-server": {
    category: "attribute-status",
    tone: "danger",
    kind: "attribute",
    emphasis: "soft",
    label: "Left Server",
  },
  verified: {
    category: "attribute-status",
    tone: "success",
    kind: "attribute",
    emphasis: "soft",
    label: "Verified",
  },
  voice: {
    category: "attribute-status",
    tone: "info",
    kind: "attribute",
    emphasis: "soft",
    label: "Voice",
  },
  revert: {
    category: "metadata-chip",
    tone: "neutral",
    kind: "meta",
    emphasis: "outline",
    label: "Revert",
  },
}

function toTitleCase(value: string) {
  return value
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")
}

export function getAssignmentStatusDescriptor(status: string | null | undefined): CanonicalStatusDescriptor {
  const normalized = status?.trim().toUpperCase() as AssignmentStatusValue | undefined

  if (normalized && normalized in assignmentStatusDescriptors) {
    return assignmentStatusDescriptors[normalized]
  }

  return {
    category: "operational-status",
    tone: "neutral",
    kind: "status",
    emphasis: "soft",
    label: status ? toTitleCase(status) : "Unknown",
  }
}

export function getTicketStatusDescriptor(status: string | null | undefined): CanonicalStatusDescriptor {
  const normalized = status?.trim().toUpperCase() as TicketStatusValue | undefined

  if (normalized && normalized in ticketStatusDescriptors) {
    return ticketStatusDescriptors[normalized]
  }

  return {
    category: "operational-status",
    tone: "neutral",
    kind: "status",
    emphasis: "soft",
    label: status ? toTitleCase(status) : "Unknown",
  }
}

export function getUserAttributeStatusDescriptor(key: UserAttributeStatusKey): CanonicalStatusDescriptor {
  return userAttributeStatusDescriptors[key]
}

export function getStatusDotClassName(tone: CanonicalStatusTone) {
  switch (tone) {
    case "brand":
      return "bg-brand-accent-solid"
    case "success":
      return "bg-status-success-solid"
    case "warning":
      return "bg-status-warning-solid"
    case "danger":
      return "bg-status-danger-solid"
    case "info":
      return "bg-status-info-solid"
    case "neutral":
    default:
      return "bg-status-neutral-solid"
  }
}

export function formatStatusLabel(value: string | null | undefined) {
  return value ? toTitleCase(value) : "Unknown"
}