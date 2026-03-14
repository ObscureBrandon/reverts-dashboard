import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type PageHeaderAlignment = 'start' | 'center';

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  context?: ReactNode;
  actions?: ReactNode;
  utility?: ReactNode;
  align?: PageHeaderAlignment;
  className?: string;
}

export function PageHeader({
  title,
  description,
  context,
  actions,
  utility,
  align = 'start',
  className,
}: PageHeaderProps) {
  const isCentered = align === 'center';

  return (
    <section
      className={cn(
        'rounded-2xl bg-card/80 py-5 shadow-xs',
        className,
      )}
    >
      <div
        className={cn(
          'flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between',
          isCentered && 'items-center text-center',
        )}
      >
        <div className={cn('space-y-1', !isCentered && 'max-w-3xl')}>
          <div className={cn('flex flex-wrap items-center gap-2', isCentered && 'justify-center')}>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
            {context}
          </div>
          {description ? (
            <div className="text-sm leading-6 text-muted-foreground">{description}</div>
          ) : null}
        </div>

        {actions ? (
          <div className={cn('flex flex-wrap items-center gap-2', !isCentered && 'lg:justify-end')}>
            {actions}
          </div>
        ) : null}
      </div>

      {utility ? <div>{utility}</div> : null}
    </section>
  );
}