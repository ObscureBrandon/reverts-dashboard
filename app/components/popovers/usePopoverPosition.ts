import { useLayoutEffect, useState, RefObject } from 'react';

export type Position = { x: number; y: number };

export function usePopoverPosition(
  popoverRef: RefObject<HTMLDivElement | null>,
  triggerPosition: Position | null,
  isOpen: boolean,
  dependencies: any[] = []
) {
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [isPositioned, setIsPositioned] = useState(false);

  useLayoutEffect(() => {
    if (!isOpen || !triggerPosition || !popoverRef.current) {
      setIsPositioned(false);
      return;
    }

    const popover = popoverRef.current;
    const rect = popover.getBoundingClientRect();
    const viewportPadding = 16; // Buffer from viewport edges
    
    let x = triggerPosition.x;
    let y = triggerPosition.y + 10; // Default: show below with small gap

    // Horizontal positioning
    // Check if popover overflows right edge
    if (x + rect.width > window.innerWidth - viewportPadding) {
      // Align to right edge of viewport with padding
      x = window.innerWidth - rect.width - viewportPadding;
    }
    
    // Check if popover overflows left edge
    if (x < viewportPadding) {
      x = viewportPadding;
    }

    // Vertical positioning
    // Check if popover overflows bottom edge
    if (y + rect.height > window.innerHeight - viewportPadding) {
      // Try to show above the mention instead
      const yAbove = triggerPosition.y - rect.height - 10;
      if (yAbove >= viewportPadding) {
        // Enough space above
        y = yAbove;
      } else {
        // Not enough space above or below, align to bottom with padding
        y = window.innerHeight - rect.height - viewportPadding;
      }
    }
    
    // Check if popover overflows top edge
    if (y < viewportPadding) {
      y = viewportPadding;
    }

    setPosition({ x, y });
    setIsPositioned(true);
  }, [isOpen, triggerPosition, popoverRef, ...dependencies]);

  return { position, isPositioned };
}
