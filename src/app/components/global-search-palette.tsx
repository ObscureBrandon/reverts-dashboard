'use client'

import { Badge } from '@/components/ui/badge'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { UserAvatar } from '@/components/ui/avatar'
import { useGlobalSearchOverlay } from '@/lib/contexts/global-search-context'
import { useDebounce } from '@/lib/hooks/useDebounce'
import { useMediaQuery } from '@/lib/hooks/useMediaQuery'
import {
  canRunGlobalSearchQuery,
  getGlobalSearchReasonLabel,
  useGlobalSearch,
  type GlobalSearchMessageResult,
  type GlobalSearchTicketResult,
  type GlobalSearchUserResult,
} from '@/lib/hooks/queries/useGlobalSearch'
import { usePrefetchTicketDetail } from '@/lib/hooks/queries/useTickets'
import { usePrefetchUserDetails } from '@/lib/hooks/queries/useUserDetails'
import { useUserRole } from '@/lib/hooks/queries/useUserRole'
import {
  parseGlobalSearchTokens,
  serializeGlobalSearchQuery,
  type GlobalSearchOperatorChip,
  type GlobalSearchOperatorKey,
} from '@/lib/search/global-search-query'
import { cn, formatRelativeTime } from '@/lib/utils'
import { Loader2, MessageSquare, Search, Ticket } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useUserPanel } from '@/lib/contexts/user-panel-context'

type FlatSearchResult =
  | { id: string; kind: 'user'; user: GlobalSearchUserResult }
  | { id: string; kind: 'ticket'; ticket: GlobalSearchTicketResult }
  | { id: string; kind: 'message'; message: GlobalSearchMessageResult }

type SearchOperatorChip = GlobalSearchOperatorChip & {
  id: string
}

function renderHighlightedText(text: string, highlight: string | null) {
  const normalizedHighlight = highlight?.trim()

  if (!normalizedHighlight) {
    return text
  }

  const lowerText = text.toLowerCase()
  const lowerHighlight = normalizedHighlight.toLowerCase()

  if (!lowerHighlight || !lowerText.includes(lowerHighlight)) {
    return text
  }

  const parts: React.ReactNode[] = []
  let cursor = 0
  let key = 0

  while (cursor < text.length) {
    const matchIndex = lowerText.indexOf(lowerHighlight, cursor)

    if (matchIndex === -1) {
      parts.push(text.slice(cursor))
      break
    }

    if (matchIndex > cursor) {
      parts.push(text.slice(cursor, matchIndex))
    }

    parts.push(
      <mark
        key={`${normalizedHighlight}-${key}`}
        className="rounded-sm bg-brand-accent-soft px-0.5 text-brand-accent-text shadow-[inset_0_0_0_1px_var(--color-brand-accent-border)]"
      >
        {text.slice(matchIndex, matchIndex + normalizedHighlight.length)}
      </mark>
    )

    cursor = matchIndex + normalizedHighlight.length
    key += 1
  }

  return parts
}

function createOperatorChip(key: GlobalSearchOperatorKey, value = ''): SearchOperatorChip {
  return {
    id: `${key}-${Math.random().toString(36).slice(2, 9)}`,
    key,
    value,
  }
}

function shouldKeepSpaceInChipValue(value: string) {
  const trimmed = value.trim()
  return trimmed.startsWith('"') && !trimmed.endsWith('"')
}

function getRemainingFreeText(input: string) {
  return parseGlobalSearchTokens(input)
    .filter((token) => token.type === 'text')
    .map((token) => token.value)
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}

function SearchResultSection({
  title,
  count,
  children,
}: {
  title: string
  count: number
  children: React.ReactNode
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</p>
        <span className="text-xs text-muted-foreground">{count}</span>
      </div>
      <div className="space-y-1">{children}</div>
    </section>
  )
}

function buildTicketHref(ticketId: number, returnTo: string) {
  const params = new URLSearchParams()

  if (returnTo) {
    params.set('returnTo', returnTo)
  }

  const query = params.toString()
  return query ? `/tickets/${ticketId}?${query}` : `/tickets/${ticketId}`
}

function buildMessageHref(ticketId: number, messageId: string, returnTo: string, highlight: string | null) {
  const params = new URLSearchParams()

  params.set('message', messageId)

  if (returnTo) {
    params.set('returnTo', returnTo)
  }

  if (highlight?.trim()) {
    params.set('highlight', highlight.trim())
  }

  return `/tickets/${ticketId}?${params.toString()}`
}

function formatExactDateTime(value: string) {
  return new Date(value).toLocaleString()
}

export function GlobalSearchPalette() {
  const { isMod, isLoading: roleLoading } = useUserRole()
  const { isOpen, closeGlobalSearch, toggleGlobalSearch } = useGlobalSearchOverlay()
  const { openUserPanel } = useUserPanel()
  const { prefetch } = usePrefetchUserDetails()
  const { prefetchTicket } = usePrefetchTicketDetail()
  const isMobile = useMediaQuery('(max-width: 767px)')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const resultsContainerRef = useRef<HTMLDivElement | null>(null)
  const textInputRef = useRef<HTMLInputElement | null>(null)
  const chipInputRef = useRef<HTMLInputElement | null>(null)
  const [operatorChips, setOperatorChips] = useState<SearchOperatorChip[]>([])
  const [freeText, setFreeText] = useState('')
  const [activeChipId, setActiveChipId] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const serializedQuery = useMemo(
    () => serializeGlobalSearchQuery(operatorChips.map(({ key, value }) => ({ key, value })), freeText),
    [freeText, operatorChips]
  )
  const normalizedQuery = serializedQuery.trim()
  const debouncedQuery = useDebounce(serializedQuery, 140)
  const debouncedNormalizedQuery = debouncedQuery.trim()
  const canRunQuery = canRunGlobalSearchQuery(normalizedQuery)
  const { data, isError, isFetching, isLoading } = useGlobalSearch(debouncedQuery)

  const focusTextInput = useCallback(() => {
    window.setTimeout(() => {
      const input = textInputRef.current

      if (!input) {
        return
      }

      input.focus()
      const end = input.value.length
      input.setSelectionRange(end, end)
    }, 0)
  }, [])

  const focusChipInput = useCallback(() => {
    window.setTimeout(() => {
      const input = chipInputRef.current

      if (!input) {
        return
      }

      input.focus()
      const end = input.value.length
      input.setSelectionRange(end, end)
    }, 0)
  }, [])

  const currentQueryString = searchParams.toString()
  const returnTo = `${pathname}${currentQueryString ? `?${currentQueryString}` : ''}`

  const flatResults = useMemo<FlatSearchResult[]>(() => {
    if (!data) {
      return []
    }

    return [
      ...data.users.map((user) => ({ id: `user-${user.id}`, kind: 'user' as const, user })),
      ...data.tickets.map((ticket) => ({ id: `ticket-${ticket.id}`, kind: 'ticket' as const, ticket })),
      ...data.messages.map((message) => ({ id: `message-${message.id}`, kind: 'message' as const, message })),
    ]
  }, [data])

  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    if (!isOpen) {
      setOperatorChips([])
      setFreeText('')
      setActiveChipId(null)
      setIsExpanded(false)
      setSelectedIndex(0)
      return
    }

    if (activeChipId) {
      focusChipInput()
      return
    }

    focusTextInput()
  }, [activeChipId, focusChipInput, focusTextInput, isOpen])

  useEffect(() => {
    setSelectedIndex(0)
  }, [data?.query])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    if (!normalizedQuery || !canRunQuery) {
      setIsExpanded(false)
      return
    }

    if (!isLoading && !isFetching && debouncedNormalizedQuery === normalizedQuery && (Boolean(data) || isError)) {
      setIsExpanded(true)
    }
  }, [canRunQuery, data, debouncedNormalizedQuery, isError, isFetching, isLoading, isOpen, normalizedQuery])

  const selectedResult = flatResults[selectedIndex] ?? null

  useEffect(() => {
    if (!selectedResult) {
      return
    }

    if (selectedResult.kind === 'user') {
      prefetch(selectedResult.user.id)
      return
    }

    if (selectedResult.kind === 'ticket') {
      prefetchTicket(selectedResult.ticket.id)
      return
    }

    prefetchTicket(selectedResult.message.ticketId)
  }, [prefetch, prefetchTicket, selectedResult])

  const handleSelect = useCallback((result: FlatSearchResult) => {
    if (result.kind === 'user') {
      openUserPanel(result.user.id)
      closeGlobalSearch()
      return
    }

    if (result.kind === 'ticket') {
      closeGlobalSearch()
      router.push(buildTicketHref(result.ticket.id, returnTo))
      return
    }

    closeGlobalSearch()
    router.push(buildMessageHref(result.message.ticketId, result.message.id, returnTo, result.message.highlightTerm))
  }, [closeGlobalSearch, openUserPanel, returnTo, router])

  const handleFreeTextChange = useCallback((value: string) => {
    const tokens = parseGlobalSearchTokens(value)
    const operatorTokens = tokens.filter((token) => token.type === 'operator')

    if (operatorTokens.length === 0) {
      setFreeText(value)
      return
    }

    const createdChips = operatorTokens.map((token) => createOperatorChip(token.key, token.value))
    let nextActiveChipId: string | null = null

    for (let index = operatorTokens.length - 1; index >= 0; index -= 1) {
      if (operatorTokens[index].isEmpty) {
        nextActiveChipId = createdChips[index].id
        break
      }
    }

    setOperatorChips((current) => [...current, ...createdChips])
    setFreeText(getRemainingFreeText(value))
    setActiveChipId(nextActiveChipId)

    if (!nextActiveChipId) {
      focusTextInput()
    }
  }, [focusTextInput])

  const handleChipValueChange = useCallback((chipId: string, value: string) => {
    setOperatorChips((current) => current.map((chip) => chip.id === chipId ? { ...chip, value } : chip))
  }, [])

  const removeChip = useCallback((chipId: string, focusMode: 'text' | 'previous' = 'text') => {
    let previousChipId: string | null = null

    setOperatorChips((current) => {
      const chipIndex = current.findIndex((chip) => chip.id === chipId)
      previousChipId = chipIndex > 0 ? current[chipIndex - 1].id : null
      return current.filter((chip) => chip.id !== chipId)
    })

    setActiveChipId(focusMode === 'previous' ? previousChipId : null)

    if (focusMode === 'previous' && previousChipId) {
      focusChipInput()
      return
    }

    focusTextInput()
  }, [focusChipInput, focusTextInput])

  const handleFreeTextKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      event.stopPropagation()
      toggleGlobalSearch()
      return
    }

    if (
      event.key === 'Backspace'
      && event.currentTarget.selectionStart === 0
      && event.currentTarget.selectionEnd === 0
      && freeText.length === 0
      && operatorChips.length > 0
    ) {
      event.preventDefault()
      setActiveChipId(operatorChips[operatorChips.length - 1].id)
      focusChipInput()
    }
  }, [focusChipInput, freeText.length, operatorChips, toggleGlobalSearch])

  const handleChipInputKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>, chip: SearchOperatorChip) => {
    if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      event.stopPropagation()
      toggleGlobalSearch()
      return
    }

    if (
      event.key === 'Backspace'
      && event.currentTarget.selectionStart === 0
      && event.currentTarget.selectionEnd === 0
      && chip.value.length === 0
    ) {
      event.preventDefault()
      event.stopPropagation()
      removeChip(chip.id, 'previous')
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      setActiveChipId(null)
      focusTextInput()
      return
    }

    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault()
      event.stopPropagation()
      setActiveChipId(null)
      focusTextInput()
      return
    }

    if (
      event.key === ' '
      && event.currentTarget.selectionStart === event.currentTarget.value.length
      && event.currentTarget.selectionEnd === event.currentTarget.value.length
      && !shouldKeepSpaceInChipValue(chip.value)
    ) {
      event.preventDefault()
      setActiveChipId(null)
      focusTextInput()
    }
  }, [focusTextInput, removeChip, toggleGlobalSearch])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const isNextResultKey = event.key === 'ArrowDown' || (event.altKey && event.key.toLowerCase() === 'j')
      const isPreviousResultKey = event.key === 'ArrowUp' || (event.altKey && event.key.toLowerCase() === 'k')

      if (isNextResultKey) {
        event.preventDefault()
        setSelectedIndex((current) => (flatResults.length === 0 ? 0 : (current + 1) % flatResults.length))
      }

      if (isPreviousResultKey) {
        event.preventDefault()
        setSelectedIndex((current) => {
          if (flatResults.length === 0) {
            return 0
          }

          return current <= 0 ? flatResults.length - 1 : current - 1
        })
      }

      if (event.key === 'Enter' && selectedResult) {
        event.preventDefault()
        handleSelect(selectedResult)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [flatResults.length, handleSelect, isOpen, selectedResult])

  const hasResults = flatResults.length > 0
  const showResultsPanel = isExpanded
  const useTallResultsShell = showResultsPanel && hasResults
  const showInlineSpinner = canRunQuery && (isLoading || isFetching)
  const showNoResults = showResultsPanel && !showInlineSpinner && !isError && normalizedQuery.length > 0 && !hasResults
  const showErrorState = showResultsPanel && !showInlineSpinner && isError

  useEffect(() => {
    if (!showResultsPanel || !selectedResult) {
      return
    }

    const container = resultsContainerRef.current

    if (!container) {
      return
    }

    const element = container.querySelector<HTMLElement>(`[data-search-result-id="${selectedResult.id}"]`)

    if (!element) {
      return
    }

    element.scrollIntoView({ block: 'nearest' })
  }, [selectedResult, showResultsPanel])

  if (roleLoading || !isMod) {
    return null
  }

  const paletteBody = (
    <div className={cn(
      'flex min-h-0 flex-1 flex-col overflow-hidden',
      showResultsPanel
        ? 'bg-background'
        : isMobile
          ? 'bg-background'
          : 'rounded-3xl bg-transparent'
    )}>
      <div className={cn(showResultsPanel ? '' : isMobile ? '' : 'rounded-3xl')}>
        <div
          className={cn(
            'flex min-h-11 items-center gap-2 overflow-x-auto bg-background px-3 py-1.5 shadow-xs transition-[color,box-shadow,border-color] focus-within:border-ring',
            showResultsPanel
              ? 'rounded-t-3xl rounded-b-none border-b border-border'
              : isMobile
                ? 'rounded-none border-0 shadow-none focus-within:shadow-none'
                : 'rounded-3xl border border-input focus-within:shadow-[0_0_0_1px_var(--color-ring)]'
          )}
          onClick={() => {
            if (!activeChipId) {
              focusTextInput()
            }
          }}
        >
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />

          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {operatorChips.map((chip) => {
              const isActiveChip = chip.id === activeChipId

              return (
                <div
                  key={chip.id}
                  onClick={() => setActiveChipId(chip.id)}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-1 text-sm transition-colors',
                    isActiveChip
                      ? 'border-brand-accent-border bg-brand-accent-soft/70 text-foreground'
                      : 'border-border bg-muted/40 text-foreground hover:border-border/80 hover:bg-muted/60'
                  )}
                >
                  <span className="font-medium text-muted-foreground">{chip.key}:</span>
                  {isActiveChip ? (
                    <input
                      ref={chipInputRef}
                      value={chip.value}
                      onChange={(event) => handleChipValueChange(chip.id, event.target.value)}
                      onKeyDown={(event) => handleChipInputKeyDown(event, chip)}
                      onClick={(event) => event.stopPropagation()}
                      className="min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                      style={{ width: `${Math.max(1, chip.value.length + 0.75)}ch` }}
                    />
                  ) : (
                    <span className="max-w-[24ch] truncate">{chip.value}</span>
                  )}
                </div>
              )
            })}

            <input
              ref={textInputRef}
              value={freeText}
              onChange={(event) => handleFreeTextChange(event.target.value)}
              onKeyDown={handleFreeTextKeyDown}
              placeholder={operatorChips.length === 0 ? 'Search' : ''}
              className="min-w-0 max-w-full shrink-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              style={{
                width: operatorChips.length === 0
                  ? `${Math.max(6, freeText.length + 1)}ch`
                  : freeText.length > 0
                    ? `${freeText.length + 1}ch`
                    : '1.5ch',
              }}
            />
          </div>

          <div className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">
            {showInlineSpinner ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          </div>
        </div>
      </div>

      {showResultsPanel ? (
        <>
          <div ref={resultsContainerRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {showErrorState ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-5 py-7 text-sm text-muted-foreground">
                Search unavailable.
              </div>
            ) : showNoResults ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-5 py-7 text-sm text-muted-foreground">
                No results.
              </div>
            ) : (
              <div className="space-y-5">
                {data?.users.length ? (
                  <SearchResultSection title="Users" count={data.users.length}>
                    {data.users.map((user) => {
                      const resultId = `user-${user.id}`
                      const isSelected = flatResults[selectedIndex]?.id === resultId

                      return (
                        <button
                          key={resultId}
                          data-search-result-id={resultId}
                          type="button"
                          onClick={() => handleSelect({ id: resultId, kind: 'user', user })}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-colors',
                            isSelected
                              ? 'border-brand-accent-border bg-brand-accent-soft/50 shadow-[inset_0_0_0_1px_var(--color-brand-accent-border)]'
                              : 'border-transparent hover:border-border/70 hover:bg-muted/40'
                          )}
                        >
                          <UserAvatar
                            src={user.displayAvatar}
                            name={user.displayName || user.name || 'User'}
                            size="md"
                            className="border border-border"
                          />
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate font-medium text-foreground">{user.displayName || user.name || 'Unknown User'}</p>
                              <Badge tone="info" kind="meta" emphasis="outline">{getGlobalSearchReasonLabel(user.matchReason)}</Badge>
                            </div>
                            <p className="truncate text-sm text-muted-foreground">
                              {user.name ? `@${user.name}` : user.id}
                              {user.name ? ` • ${user.id}` : ''}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </SearchResultSection>
                ) : null}

                {data?.tickets.length ? (
                  <SearchResultSection title="Tickets" count={data.tickets.length}>
                    {data.tickets.map((ticket) => {
                      const resultId = `ticket-${ticket.id}`
                      const isSelected = flatResults[selectedIndex]?.id === resultId

                      return (
                        <button
                          key={resultId}
                          data-search-result-id={resultId}
                          type="button"
                          onClick={() => handleSelect({ id: resultId, kind: 'ticket', ticket })}
                          className={cn(
                            'flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition-colors',
                            isSelected
                              ? 'border-brand-accent-border bg-brand-accent-soft/50 shadow-[inset_0_0_0_1px_var(--color-brand-accent-border)]'
                              : 'border-transparent hover:border-border/70 hover:bg-muted/40'
                          )}
                        >
                          <div className="mt-0.5 rounded-xl bg-muted p-2 text-muted-foreground">
                            <Ticket className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-foreground">#{ticket.sequence ?? ticket.id}</p>
                              {ticket.status ? <Badge tone="neutral" kind="meta" emphasis="outline">{ticket.status}</Badge> : null}
                              <Badge tone="neutral" kind="meta" emphasis="outline">{getGlobalSearchReasonLabel(ticket.matchReason)}</Badge>
                              <p className="text-xs text-muted-foreground" title={formatExactDateTime(ticket.createdAt)}>
                                {formatRelativeTime(ticket.createdAt)}
                              </p>
                            </div>
                            <p className="truncate text-sm text-muted-foreground">
                              {ticket.panelTitle || 'Ticket'}
                              {ticket.channelName ? ` • #${ticket.channelName}` : ''}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </SearchResultSection>
                ) : null}

                {data?.messages.length ? (
                  <SearchResultSection title="Messages" count={data.messages.length}>
                    {data.messages.map((message) => {
                      const resultId = `message-${message.id}`
                      const isSelected = flatResults[selectedIndex]?.id === resultId

                      return (
                        <button
                          key={resultId}
                          data-search-result-id={resultId}
                          type="button"
                          onClick={() => handleSelect({ id: resultId, kind: 'message', message })}
                          className={cn(
                            'flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition-colors',
                            isSelected
                              ? 'border-brand-accent-border bg-brand-accent-soft/50 shadow-[inset_0_0_0_1px_var(--color-brand-accent-border)]'
                              : 'border-transparent hover:border-border/70 hover:bg-muted/40'
                          )}
                        >
                          <div className="mt-0.5 rounded-xl bg-muted p-2 text-muted-foreground">
                            <MessageSquare className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate font-medium text-foreground">
                                {message.author?.displayName || message.author?.name || 'Unknown user'}
                              </p>
                              <Badge tone="info" kind="meta" emphasis="outline">{getGlobalSearchReasonLabel(message.matchReason)}</Badge>
                              <p className="text-xs text-muted-foreground" title={formatExactDateTime(message.createdAt)}>
                                {formatRelativeTime(message.createdAt)}
                              </p>
                            </div>
                            <p className="line-clamp-2 text-sm text-muted-foreground">
                              {renderHighlightedText(
                                message.preview,
                                message.matchReason === 'message_content' ? message.highlightTerm : null
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Ticket #{message.ticketSequence ?? message.ticketId}
                              {message.channelName ? ` • #${message.channelName}` : ''}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </SearchResultSection>
                ) : null}
              </div>
            )}
          </div>

          {!isMobile && hasResults ? (
            <div className="border-t border-border/60 px-4 py-2 text-[11px] text-muted-foreground/80">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5">
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">↑</kbd>
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">↓</kbd>
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">Alt J</kbd>
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">Alt K</kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">Enter</kbd>
                Open
              </span>
              {data?.meta ? <span>{data.meta.tookMs} ms</span> : <span />}
            </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )

  if (isMobile) {
    return (
      <Drawer modal={false} open={isOpen} onOpenChange={(open) => { if (!open) closeGlobalSearch() }}>
        <DrawerContent disableAnimation showHandle={false} overlayClassName="data-[state=open]:animate-none data-[state=closed]:animate-none data-[state=open]:duration-0 data-[state=closed]:duration-0 transition-none"
          className={cn(
          'rounded-t-3xl p-0 data-[state=open]:animate-none data-[state=closed]:animate-none data-[state=open]:duration-0 data-[state=closed]:duration-0 transition-none',
            useTallResultsShell
              ? 'h-[78vh] overflow-hidden border-t-2 border-border bg-background'
              : 'h-auto max-h-[40vh] overflow-hidden border-t-2 border-border bg-background shadow-none'
        )}>
          <DrawerTitle className="sr-only">Global Search</DrawerTitle>
          {paletteBody}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet modal={false} open={isOpen} onOpenChange={(open) => { if (!open) closeGlobalSearch() }}>
      <SheetContent side="top" showCloseButton={false} disableAnimation
        overlayClassName="data-[state=open]:animate-none data-[state=closed]:animate-none data-[state=open]:duration-0 data-[state=closed]:duration-0 transition-none"
        className={cn(
        'mx-auto mt-20 w-[min(920px,calc(100vw-2rem))] rounded-3xl p-0 data-[state=open]:animate-none data-[state=closed]:animate-none data-[state=open]:duration-0 data-[state=closed]:duration-0 transition-none',
        useTallResultsShell
          ? 'h-[min(75vh,680px)] overflow-hidden border border-border bg-background'
          : 'h-auto border-0 bg-transparent shadow-none'
      )}>
        <SheetTitle className="sr-only">Global Search</SheetTitle>
        {paletteBody}
      </SheetContent>
    </Sheet>
  )
}