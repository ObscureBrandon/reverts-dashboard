import type { BadgeEmphasis, BadgeKind, BadgeTone } from '@/components/ui/badge'
import type { UserListItem } from '@/lib/hooks/queries/useUsersTable'

export const CHECK_IN_OVERDUE_DAYS = 14

export type UserWorkspaceSignalKey =
  | 'active-risk'
  | 'missing-check-in'
  | 'overdue-check-in'
  | 'support-needs'
  | 'left-server'
  | 'open-tickets'

export type UserWorkspaceSignal = {
  key: UserWorkspaceSignalKey
  label: string
  tone: BadgeTone
  kind: BadgeKind
  emphasis: BadgeEmphasis
}

type UserWorkspaceSignalSource = Pick<
  UserListItem,
  'activeInfractionCount' | 'activeSupportNeedsCount' | 'inGuild' | 'lastCheckInAt' | 'openTicketCount'
>

export function getCheckInAgeDays(lastCheckInAt: string | null) {
  if (!lastCheckInAt) {
    return Number.MAX_SAFE_INTEGER
  }

  return Math.floor((Date.now() - new Date(lastCheckInAt).getTime()) / (24 * 60 * 60 * 1000))
}

export function isOverdueCheckIn(lastCheckInAt: string | null) {
  return getCheckInAgeDays(lastCheckInAt) >= CHECK_IN_OVERDUE_DAYS
}

export function getCheckInSummaryLabel(lastCheckInAt: string | null) {
  if (!lastCheckInAt) {
    return 'No check-in yet'
  }

  const ageDays = getCheckInAgeDays(lastCheckInAt)

  if (ageDays === 0) {
    return 'Checked in today'
  }

  if (ageDays === 1) {
    return 'Checked in 1 day ago'
  }

  return `Checked in ${ageDays} days ago`
}

export function getUserAttentionSignals(user: UserWorkspaceSignalSource): UserWorkspaceSignal[] {
  const signals: UserWorkspaceSignal[] = []

  if (user.activeInfractionCount > 0) {
    signals.push({
      key: 'active-risk',
      label: `${user.activeInfractionCount} active risk${user.activeInfractionCount === 1 ? '' : 's'}`,
      tone: 'danger',
      kind: 'status',
      emphasis: 'soft',
    })
  }

  if (!user.lastCheckInAt) {
    signals.push({
      key: 'missing-check-in',
      label: 'No check-in yet',
      tone: 'danger',
      kind: 'status',
      emphasis: 'soft',
    })
  } else if (isOverdueCheckIn(user.lastCheckInAt)) {
    const ageDays = getCheckInAgeDays(user.lastCheckInAt)
    signals.push({
      key: 'overdue-check-in',
      label: `${ageDays}d since check-in`,
      tone: 'warning',
      kind: 'status',
      emphasis: 'soft',
    })
  }

  if (user.activeSupportNeedsCount > 0) {
    signals.push({
      key: 'support-needs',
      label: `${user.activeSupportNeedsCount} active support need${user.activeSupportNeedsCount === 1 ? '' : 's'}`,
      tone: 'warning',
      kind: 'attribute',
      emphasis: 'soft',
    })
  }

  if (!user.inGuild) {
    signals.push({
      key: 'left-server',
      label: 'Left server',
      tone: 'danger',
      kind: 'attribute',
      emphasis: 'soft',
    })
  }

  if (user.openTicketCount > 0) {
    signals.push({
      key: 'open-tickets',
      label: `${user.openTicketCount} open ticket${user.openTicketCount === 1 ? '' : 's'}`,
      tone: 'info',
      kind: 'meta',
      emphasis: 'outline',
    })
  }

  return signals
}

export function userNeedsAttention(user: UserWorkspaceSignalSource) {
  return getUserAttentionSignals(user).length > 0
}