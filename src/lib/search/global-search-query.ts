export const GLOBAL_SEARCH_OPERATOR_KEYS = ['user', 'ticket', 'channel', 'contains', 'from'] as const

export type GlobalSearchOperatorKey = (typeof GLOBAL_SEARCH_OPERATOR_KEYS)[number]

export type ParsedGlobalSearchQuery = {
  raw: string
  text: string
  userTerm: string | null
  ticketTerm: string | null
  channelTerm: string | null
  containsTerm: string | null
  fromTerm: string | null
}

export type GlobalSearchQueryToken =
  | {
      type: 'text'
      value: string
    }
  | {
      type: 'operator'
      key: GlobalSearchOperatorKey
      rawValue: string
      value: string
      quoted: boolean
      rawText: string
      isEmpty: boolean
    }

export type GlobalSearchOperatorChip = {
  key: GlobalSearchOperatorKey
  value: string
}

const GLOBAL_SEARCH_OPERATOR_PATTERN = /(user|ticket|channel|contains|from):("[^"]*"|\S*)/gi

export function isGlobalSearchOperatorKey(value: string): value is GlobalSearchOperatorKey {
  return GLOBAL_SEARCH_OPERATOR_KEYS.includes(value as GlobalSearchOperatorKey)
}

export function parseGlobalSearchTokens(query: string): GlobalSearchQueryToken[] {
  if (!query) {
    return []
  }

  const tokens: GlobalSearchQueryToken[] = []
  let cursor = 0
  let match: RegExpExecArray | null

  GLOBAL_SEARCH_OPERATOR_PATTERN.lastIndex = 0

  while ((match = GLOBAL_SEARCH_OPERATOR_PATTERN.exec(query)) !== null) {
    if (match.index > cursor) {
      tokens.push({
        type: 'text',
        value: query.slice(cursor, match.index),
      })
    }

    const key = match[1].toLowerCase()
    const rawValue = match[2] ?? ''
    const quoted = rawValue.startsWith('"') && rawValue.endsWith('"')
    const value = quoted ? rawValue.slice(1, -1) : rawValue

    if (isGlobalSearchOperatorKey(key)) {
      tokens.push({
        type: 'operator',
        key,
        rawValue,
        value,
        quoted,
        rawText: match[0],
        isEmpty: value.length === 0,
      })
    } else {
      tokens.push({
        type: 'text',
        value: match[0],
      })
    }

    cursor = match.index + match[0].length
  }

  if (cursor < query.length) {
    tokens.push({
      type: 'text',
      value: query.slice(cursor),
    })
  }

  return tokens
}

export function parseGlobalSearchQuery(query: string): ParsedGlobalSearchQuery {
  const extracted: ParsedGlobalSearchQuery = {
    raw: query,
    text: query.trim(),
    userTerm: null,
    ticketTerm: null,
    channelTerm: null,
    containsTerm: null,
    fromTerm: null,
  }

  const tokens = parseGlobalSearchTokens(query)
  const textParts: string[] = []

  tokens.forEach((token) => {
    if (token.type === 'text') {
      textParts.push(token.value)
      return
    }

    if (!token.value) {
      return
    }

    if (token.key === 'user') {
      extracted.userTerm = token.value
    } else if (token.key === 'ticket') {
      extracted.ticketTerm = token.value
    } else if (token.key === 'channel') {
      extracted.channelTerm = token.value
    } else if (token.key === 'contains') {
      extracted.containsTerm = token.value
    } else if (token.key === 'from') {
      extracted.fromTerm = token.value
    }
  })

  if (tokens.some((token) => token.type === 'operator')) {
    extracted.text = textParts.join(' ').replace(/\s+/g, ' ').trim()
  }

  return extracted
}

export function serializeGlobalSearchQuery(chips: GlobalSearchOperatorChip[], freeText: string) {
  const chipParts = chips.map((chip) => {
    if (!chip.value) {
      return `${chip.key}:`
    }

    const needsQuotes = /\s/.test(chip.value)
    const serializedValue = needsQuotes ? `"${chip.value}"` : chip.value
    return `${chip.key}:${serializedValue}`
  })

  const text = freeText.trim()
  return [...chipParts, text].filter(Boolean).join(' ').trim()
}

export function hasMeaningfulGlobalSearchQuery(query: string) {
  const tokens = parseGlobalSearchTokens(query)

  return tokens.some((token) => {
    if (token.type === 'text') {
      return token.value.trim().length > 0
    }

    return token.value.trim().length > 0
  })
}