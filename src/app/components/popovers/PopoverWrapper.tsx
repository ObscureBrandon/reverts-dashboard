'use client';

import { useEffect, useRef, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer';
import { useMediaQuery } from '@/lib/hooks/useMediaQuery';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { X } from 'lucide-react';
import { usePopoverPosition, Position } from './usePopoverPosition';

export type { Position };

type PopoverWrapperProps = {
  isOpen: boolean;
  onClose: () => void;
  triggerElement: HTMLElement | null;
  triggerRect: Position | null;
  title: string;
  children: ReactNode;
  dependencies?: ReadonlyArray<string | number | boolean | null | undefined>;
};

export function PopoverWrapper({ 
  isOpen, 
  onClose, 
  triggerElement, 
  triggerRect,
  title, 
  children,
  dependencies = []
}: PopoverWrapperProps) {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const popoverRef = useRef<HTMLDivElement>(null);
  const { position, isPositioned } = usePopoverPosition(
    popoverRef,
    triggerElement,
    triggerRect,
    isOpen,
    dependencies
  );

  useEffect(() => {
    if (!isOpen || isMobile) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;

      if (!target) {
        return;
      }

      if (popoverRef.current?.contains(target) || triggerElement?.contains(target)) {
        return;
      }

      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobile, isOpen, onClose, triggerElement]);

  if (!isOpen) return null;

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="max-h-[85vh] flex flex-col overflow-hidden rounded-t-2xl bg-card p-0 text-card-foreground shadow-2xl">
          <VisuallyHidden.Root>
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{title} details</DrawerDescription>
          </VisuallyHidden.Root>

          <div className="relative flex min-h-0 flex-1 flex-col">
            <div className="border-b border-border bg-card px-4 py-3">
              <h3 className="text-sm font-semibold tracking-tight text-card-foreground">
                {title}
              </h3>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="flex flex-col gap-4">
                {children}
              </div>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <div 
      ref={popoverRef}
      className={`fixed z-50 w-[min(20rem,calc(100vw-2rem))] max-h-[min(32rem,calc(100vh-2rem))] overflow-y-auto rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl ring-1 ring-border/40 transition-opacity duration-150 ${
        isPositioned ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
      style={{
        left: `${position?.x ?? 0}px`,
        top: `${position?.y ?? 0}px`,
      }}
    >
      <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-popover/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-popover/90">
        <h3 className="text-sm font-semibold tracking-tight text-popover-foreground">
          {title}
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onClose}
          className="-mr-1 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
          aria-label={`Close ${title.toLowerCase()} popover`}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="space-y-4 p-4">
        <div className="flex flex-col gap-4">
          {children}
        </div>
      </div>
    </div>
  );
}
