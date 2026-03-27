'use client';

import { roleColorToHex } from '@/app/components/utils';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Children, cloneElement, isValidElement, memo, useEffect, useRef, useState, type MouseEvent, type ReactElement, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

export type MentionLookup = {
  users: Record<string, { name: string; displayName: string | null; displayAvatar: string | null }>;
  roles: Record<string, { name: string; color: number }>;
  channels: Record<string, { name: string }>;
};

type MentionType = 'user' | 'role' | 'channel';

export type MessageMentionClickHandler = (type: MentionType, id: string, event: MouseEvent) => void;

type MessageContentProps = {
  content: string;
  mentions: MentionLookup;
  onMentionClick: MessageMentionClickHandler;
  onUserMentionHover?: (userId: string) => void;
  className?: string;
};

type DeferredMessageContentProps = MessageContentProps & {
  eager?: boolean;
  rootMargin?: string;
};

type MentionContext = Pick<MessageContentProps, 'mentions' | 'onMentionClick' | 'onUserMentionHover'>;

function MentionBadge({
  type,
  id,
  mentions,
  onMentionClick,
  onUserMentionHover,
}: {
  type: MentionType;
  id: string;
  mentions: MentionLookup;
  onMentionClick: MessageMentionClickHandler;
  onUserMentionHover?: (userId: string) => void;
}) {
  if (type === 'user') {
    const user = mentions.users[id];
    const displayName = user?.displayName || user?.name || 'Unknown User';

    return (
      <Badge asChild tone="info" kind="meta" emphasis="soft" className="mx-0.5 cursor-pointer align-baseline hover:opacity-80">
        <button type="button" onClick={(event) => onMentionClick('user', id, event)} onMouseEnter={onUserMentionHover ? () => onUserMentionHover(id) : undefined}>
          @{displayName}
        </button>
      </Badge>
    );
  }

  if (type === 'role') {
    const role = mentions.roles[id];
    const roleName = role?.name || 'Unknown Role';
    const roleColor = role?.color ? roleColorToHex(role.color) : '#99aab5';

    return (
      <Badge
        asChild
        tone="neutral"
        kind="meta"
        emphasis="outline"
        className="mx-0.5 cursor-pointer border-current bg-transparent align-baseline hover:opacity-80"
      >
        <button
          type="button"
          onClick={(event) => onMentionClick('role', id, event)}
          style={{
            backgroundColor: `${roleColor}20`,
            borderColor: `${roleColor}35`,
            color: roleColor,
          }}
        >
          @{roleName}
        </button>
      </Badge>
    );
  }

  const channel = mentions.channels[id];
  const channelName = channel?.name || 'unknown-channel';

  return (
    <Badge asChild tone="info" kind="meta" emphasis="soft" className="mx-0.5 cursor-pointer align-baseline hover:opacity-80">
      <button type="button" onClick={(event) => onMentionClick('channel', id, event)}>
        #{channelName}
      </button>
    </Badge>
  );
}

function replaceMentionsInText(text: string, context: MentionContext, keyPrefix: string): ReactNode {
  const mentionPattern = /<@!?(\d+)>|<@&(\d+)>|<#(\d+)>/g;

  if (!mentionPattern.test(text)) {
    return text;
  }

  mentionPattern.lastIndex = 0;

  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = mentionPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[1]) {
      parts.push(
        <MentionBadge
          key={`${keyPrefix}-user-${key++}`}
          type="user"
          id={match[1]}
          mentions={context.mentions}
          onMentionClick={context.onMentionClick}
          onUserMentionHover={context.onUserMentionHover}
        />
      );
    } else if (match[2]) {
      parts.push(
        <MentionBadge
          key={`${keyPrefix}-role-${key++}`}
          type="role"
          id={match[2]}
          mentions={context.mentions}
          onMentionClick={context.onMentionClick}
          onUserMentionHover={context.onUserMentionHover}
        />
      );
    } else if (match[3]) {
      parts.push(
        <MentionBadge
          key={`${keyPrefix}-channel-${key++}`}
          type="channel"
          id={match[3]}
          mentions={context.mentions}
          onMentionClick={context.onMentionClick}
          onUserMentionHover={context.onUserMentionHover}
        />
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

function renderNodeWithMentions(node: ReactNode, context: MentionContext, allowMentions = true): ReactNode {
  return Children.map(node, (child, index) => {
    if (typeof child === 'string') {
      return allowMentions ? replaceMentionsInText(child, context, `segment-${index}`) : child;
    }

    if (typeof child === 'number' || child == null || typeof child === 'boolean') {
      return child;
    }

    if (!isValidElement<{ children?: ReactNode }>(child)) {
      return child;
    }

    const elementType = typeof child.type === 'string' ? child.type : null;
    const nextAllowMentions = allowMentions && elementType !== 'a' && elementType !== 'code' && elementType !== 'pre';
    const originalChildren = child.props.children;

    if (originalChildren === undefined) {
      return child;
    }

    return cloneElement(child as ReactElement<{ children?: ReactNode }>, undefined, renderNodeWithMentions(originalChildren, context, nextAllowMentions));
  });
}

const MessageContentComponent = ({ content, mentions, onMentionClick, onUserMentionHover, className }: MessageContentProps) => {
  if (!content) {
    return null;
  }

  const mentionContext: MentionContext = {
    mentions,
    onMentionClick,
    onUserMentionHover,
  };

  const components: Components = {
    p: ({ children, className: markdownClassName, ...props }) => (
      <p {...props} className={cn('whitespace-pre-wrap break-words', markdownClassName)}>
        {renderNodeWithMentions(children, mentionContext)}
      </p>
    ),
    h1: ({ children, className: markdownClassName, ...props }) => (
      <h1 {...props} className={cn('text-base font-semibold whitespace-pre-wrap break-words', markdownClassName)}>
        {renderNodeWithMentions(children, mentionContext)}
      </h1>
    ),
    h2: ({ children, className: markdownClassName, ...props }) => (
      <h2 {...props} className={cn('text-base font-semibold whitespace-pre-wrap break-words', markdownClassName)}>
        {renderNodeWithMentions(children, mentionContext)}
      </h2>
    ),
    h3: ({ children, className: markdownClassName, ...props }) => (
      <h3 {...props} className={cn('text-sm font-semibold whitespace-pre-wrap break-words', markdownClassName)}>
        {renderNodeWithMentions(children, mentionContext)}
      </h3>
    ),
    ul: ({ children, className: markdownClassName, ...props }) => (
      <ul {...props} className={cn('list-disc space-y-1 pl-5', markdownClassName)}>
        {renderNodeWithMentions(children, mentionContext)}
      </ul>
    ),
    ol: ({ children, className: markdownClassName, ...props }) => (
      <ol {...props} className={cn('list-decimal space-y-1 pl-5', markdownClassName)}>
        {renderNodeWithMentions(children, mentionContext)}
      </ol>
    ),
    li: ({ children, className: markdownClassName, ...props }) => (
      <li {...props} className={cn('whitespace-pre-wrap break-words', markdownClassName)}>
        {renderNodeWithMentions(children, mentionContext)}
      </li>
    ),
    blockquote: ({ children, className: markdownClassName, ...props }) => (
      <blockquote {...props} className={cn('border-l-2 border-border pl-4 italic text-muted-foreground', markdownClassName)}>
        {renderNodeWithMentions(children, mentionContext)}
      </blockquote>
    ),
    a: ({ children, className: markdownClassName, href, ...props }) => {
      const isExternal = typeof href === 'string' && /^(https?:)?\/\//.test(href);

      return (
        <a
          {...props}
          href={href}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noopener noreferrer' : undefined}
          className={cn('underline decoration-border underline-offset-4 hover:text-brand-accent-text', markdownClassName)}
        >
          {renderNodeWithMentions(children, mentionContext, false)}
        </a>
      );
    },
    code: ({ children, className: markdownClassName, ...props }) => (
      <code {...props} className={cn('rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]', markdownClassName)}>
        {children}
      </code>
    ),
    pre: ({ children, className: markdownClassName, ...props }) => (
      <pre {...props} className={cn('overflow-x-auto rounded-md bg-muted p-3 text-[0.9em]', markdownClassName)}>
        {children}
      </pre>
    ),
    hr: ({ className: markdownClassName, ...props }) => <hr {...props} className={cn('border-border', markdownClassName)} />,
    table: ({ children, className: markdownClassName, ...props }) => (
      <div className="overflow-x-auto">
        <table {...props} className={cn('min-w-full border-collapse text-left text-sm', markdownClassName)}>
          {renderNodeWithMentions(children, mentionContext)}
        </table>
      </div>
    ),
    th: ({ children, className: markdownClassName, ...props }) => (
      <th {...props} className={cn('border-b border-border px-2 py-1 font-semibold', markdownClassName)}>
        {renderNodeWithMentions(children, mentionContext)}
      </th>
    ),
    td: ({ children, className: markdownClassName, ...props }) => (
      <td {...props} className={cn('border-b border-border px-2 py-1 align-top whitespace-pre-wrap break-words', markdownClassName)}>
        {renderNodeWithMentions(children, mentionContext)}
      </td>
    ),
  };

  return (
    <div className={cn('min-w-0 space-y-3', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export const MessageContent = memo(MessageContentComponent);

export function DeferredMessageContent({
  content,
  mentions,
  onMentionClick,
  onUserMentionHover,
  className,
  eager = false,
  rootMargin = '600px 0px',
}: DeferredMessageContentProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [shouldRenderMarkdown, setShouldRenderMarkdown] = useState(() => eager || typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    if (eager || shouldRenderMarkdown) {
      return;
    }

    const element = containerRef.current;

    if (!element || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldRenderMarkdown(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [eager, rootMargin, shouldRenderMarkdown]);

  return (
    <div ref={containerRef}>
      {shouldRenderMarkdown ? (
        <MessageContent
          content={content}
          mentions={mentions}
          onMentionClick={onMentionClick}
          onUserMentionHover={onUserMentionHover}
          className={className}
        />
      ) : (
        <div className={cn('min-w-0 whitespace-pre-wrap break-words', className)}>{content}</div>
      )}
    </div>
  );
}