import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Convert Discord role color (integer) to hex CSS color
 */
export function roleColorToHex(color: number): string {
  if (color === 0) return '#99AAB5' // Default gray for no color
  return `#${color.toString(16).padStart(6, '0')}`
}

/**
 * Format a date string as relative time (e.g., "2d ago", "3mo ago")
 */
export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()

  // Handle clock skew / freshly submitted items
  if (diffMs < 60_000) return 'just now'

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`
  return `${Math.floor(diffDays / 365)}y ago`
}

function extractErrorText(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    // Reject unhelpful serialized-object strings like "[object Object]"
    if (trimmed.length > 0 && !/^\[object \w+\]$/.test(trimmed)) {
      return trimmed
    }
    return null
  }

  if (
    typeof value === 'number'
    || typeof value === 'boolean'
    || typeof value === 'bigint'
  ) {
    return String(value)
  }

  if (Array.isArray(value)) {
    const messages = value
      .map(extractErrorText)
      .filter((message): message is string => Boolean(message))

    return messages.length > 0 ? messages.join(', ') : null
  }

  if (!value || typeof value !== 'object') {
    return null
  }

  // 'value' is included to handle Eden Treaty error shape: { value: { error: '...' } }
  for (const key of ['message', 'error', 'detail', 'title', 'value']) {
    if (key in value) {
      const nested = extractErrorText((value as Record<string, unknown>)[key])

      if (nested) {
        return nested
      }
    }
  }

  return null
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    const normalizedMessage = extractErrorText(error.message)

    if (normalizedMessage) {
      return normalizedMessage
    }
  }

  return extractErrorText(error) ?? fallback
}
