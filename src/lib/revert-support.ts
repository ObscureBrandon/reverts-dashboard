export type SupportStateValue = 'OPEN' | 'ON_HOLD' | 'CLOSED'

export const SUPPORT_STATE_VALUES: SupportStateValue[] = ['OPEN', 'ON_HOLD', 'CLOSED']

export const SUPPORT_RELEVANT_STATES: SupportStateValue[] = ['OPEN', 'ON_HOLD']

export type SupportStateReasonValue =
  | 'requested_support'
  | 'manual_triage'
  | 'paused'
  | 'not_ready'
  | 'self_sufficient'
  | 'inactive'
  | 'resolved'

export const SUPPORT_STATE_REASONS_BY_STATE: Record<SupportStateValue, SupportStateReasonValue[]> = {
  OPEN: ['requested_support', 'manual_triage'],
  ON_HOLD: ['paused', 'not_ready'],
  CLOSED: ['self_sufficient', 'inactive', 'resolved'],
}

export const SUPPORT_STATE_REASON_LABELS: Record<SupportStateReasonValue, string> = {
  requested_support: 'Requested support',
  manual_triage: 'Manual triage',
  paused: 'Paused',
  not_ready: 'Not ready',
  self_sufficient: 'Self-sufficient',
  inactive: 'Inactive',
  resolved: 'Resolved',
}

export type RevertTagCategoryValue = 'support_need' | 'context' | 'risk' | 'logistics'

export const REVERT_TAG_CATEGORY_VALUES: RevertTagCategoryValue[] = [
  'support_need',
  'context',
  'risk',
  'logistics',
]

export const SYSTEM_REVERT_TAG_SEED_ACTOR_ID = BigInt(0)

export type SystemRevertTagSeed = {
  slug: string
  name: string
  description: string
  color: string
  emoji: string | null
  category: RevertTagCategoryValue
}

export const SYSTEM_REVERT_TAGS: SystemRevertTagSeed[] = [
  {
    slug: 'prayer-help',
    name: 'Prayer Help',
    description: 'Guidance related to prayer practice, consistency, or questions.',
    color: '#0f766e',
    emoji: null,
    category: 'support_need',
  },
  {
    slug: 'quran-learning',
    name: 'Quran Learning',
    description: 'Support with Quran reading, recitation, or study.',
    color: '#1d4ed8',
    emoji: null,
    category: 'support_need',
  },
  {
    slug: 'family-issues',
    name: 'Family Issues',
    description: 'Context involving family pressure, conflict, or adjustment.',
    color: '#b45309',
    emoji: null,
    category: 'support_need',
  },
  {
    slug: 'new-convert-questions',
    name: 'New Convert Questions',
    description: 'Common early revert questions that need structured follow-up.',
    color: '#7c3aed',
    emoji: null,
    category: 'support_need',
  },
  {
    slug: 'arabic-learning',
    name: 'Arabic Learning',
    description: 'Support with Arabic reading, pronunciation, or study goals.',
    color: '#0284c7',
    emoji: null,
    category: 'support_need',
  },
  {
    slug: 'islamic-history',
    name: 'Islamic History',
    description: 'Interest in Islamic history, context, or structured learning.',
    color: '#9333ea',
    emoji: null,
    category: 'support_need',
  },
  {
    slug: 'community-integration',
    name: 'Community Integration',
    description: 'Help connecting into the community and building support.',
    color: '#15803d',
    emoji: null,
    category: 'support_need',
  },
  {
    slug: 'spiritual-guidance',
    name: 'Spiritual Guidance',
    description: 'General spiritual support, reassurance, or mentorship context.',
    color: '#c2410c',
    emoji: null,
    category: 'support_need',
  },
]

export function slugifyRevertTagName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}