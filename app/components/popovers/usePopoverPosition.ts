import { useLayoutEffect, useState, RefObject } from 'react';

export type Position = { x: number; y: number; triggerWidth?: number; triggerHeight?: number };

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
    const gap = 8; // Gap between trigger and popover
    
    // Get trigger dimensions if provided
    const triggerWidth = triggerPosition.triggerWidth || 0;
    const triggerHeight = triggerPosition.triggerHeight || 0;
    
    let x = triggerPosition.x;
    let y = triggerPosition.y;
    let placement: 'bottom' | 'top' | 'right' | 'left' = 'bottom';

    // Try positioning to the right first if we have trigger dimensions
    if (triggerWidth > 0) {
      const xRight = triggerPosition.x + triggerWidth + gap;
      const yAlignTop = triggerPosition.y;
      
      // Check if there's enough space on the right
      if (xRight + rect.width <= window.innerWidth - viewportPadding) {
        x = xRight;
        y = yAlignTop;
        placement = 'right';
        
        // Adjust vertical position to keep popover in viewport
        if (y + rect.height > window.innerHeight - viewportPadding) {
          y = window.innerHeight - rect.height - viewportPadding;
        }
        if (y < viewportPadding) {
          y = viewportPadding;
        }
      } else {
        // Try below if right doesn't work
        const yBelow = triggerPosition.y + triggerHeight + gap;
        const xAlignLeft = triggerPosition.x;
        
        if (yBelow + rect.height <= window.innerHeight - viewportPadding) {
          x = xAlignLeft;
          y = yBelow;
          placement = 'bottom';
        } else {
          // Try above
          const yAbove = triggerPosition.y - rect.height - gap;
          if (yAbove >= viewportPadding) {
            x = xAlignLeft;
            y = yAbove;
            placement = 'top';
          } else {
            // Last resort: try left
            const xLeft = triggerPosition.x - rect.width - gap;
            if (xLeft >= viewportPadding) {
              x = xLeft;
              y = yAlignTop;
              placement = 'left';
              
              // Adjust vertical position
              if (y + rect.height > window.innerHeight - viewportPadding) {
                y = window.innerHeight - rect.height - viewportPadding;
              }
              if (y < viewportPadding) {
                y = viewportPadding;
              }
            } else {
              // Fallback: position below with constraints
              x = xAlignLeft;
              y = yBelow;
              placement = 'bottom';
            }
          }
        }
      }
    } else {
      // Fallback to old behavior for mentions (no trigger dimensions)
      y = triggerPosition.y + gap;
      
      // Vertical positioning
      if (y + rect.height > window.innerHeight - viewportPadding) {
        const yAbove = triggerPosition.y - rect.height - gap;
        if (yAbove >= viewportPadding) {
          y = yAbove;
          placement = 'top';
        } else {
          y = window.innerHeight - rect.height - viewportPadding;
        }
      }
    }

    // Horizontal positioning constraints (apply to all placements)
    if (x + rect.width > window.innerWidth - viewportPadding) {
      x = window.innerWidth - rect.width - viewportPadding;
    }
    if (x < viewportPadding) {
      x = viewportPadding;
    }
    
    // Final vertical constraints
    if (y < viewportPadding) {
      y = viewportPadding;
    }
    if (y + rect.height > window.innerHeight - viewportPadding) {
      y = window.innerHeight - rect.height - viewportPadding;
    }

    setPosition({ x, y });
    setIsPositioned(true);
  }, [isOpen, triggerPosition, popoverRef, ...dependencies]);

  return { position, isPositioned };
}
