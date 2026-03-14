import { useLayoutEffect, useState, RefObject } from 'react';

export type Position = {
  x: number;
  y: number;
  width?: number;
  height?: number;
  right?: number;
  bottom?: number;
};

function getPopoverPosition(anchorRect: Position, popoverRect: DOMRect) {
  const viewportPadding = 16;
  const gap = 8;
  const anchorRight = anchorRect.right ?? anchorRect.x + (anchorRect.width ?? 0);
  const anchorBottom = anchorRect.bottom ?? anchorRect.y + (anchorRect.height ?? 0);

  let x = anchorRect.left;
  let y = anchorBottom + gap;

  const xRight = anchorRight + gap;
  if (xRight + popoverRect.width <= window.innerWidth - viewportPadding) {
    x = xRight;
    y = anchorRect.y;
  } else if (y + popoverRect.height > window.innerHeight - viewportPadding) {
    const yAbove = anchorRect.y - popoverRect.height - gap;

    if (yAbove >= viewportPadding) {
      y = yAbove;
    } else {
      const xLeft = anchorRect.x - popoverRect.width - gap;
      if (xLeft >= viewportPadding) {
        x = xLeft;
        y = anchorRect.y;
      }
    }
  }

  if (x + popoverRect.width > window.innerWidth - viewportPadding) {
    x = window.innerWidth - popoverRect.width - viewportPadding;
  }
  if (x < viewportPadding) {
    x = viewportPadding;
  }

  if (y + popoverRect.height > window.innerHeight - viewportPadding) {
    y = window.innerHeight - popoverRect.height - viewportPadding;
  }
  if (y < viewportPadding) {
    y = viewportPadding;
  }

  return { x, y };
}

export function usePopoverPosition(
  popoverRef: RefObject<HTMLDivElement | null>,
  triggerElement: HTMLElement | null,
  fallbackRect: Position | null,
  isOpen: boolean,
  dependencies: ReadonlyArray<string | number | boolean | null | undefined> = []
) {
  const [position, setPosition] = useState<Position | null>(null);
  const dependencyKey = dependencies.join('|');

  useLayoutEffect(() => {
    if (!isOpen || (!triggerElement && !fallbackRect) || !popoverRef.current) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      if (!popoverRef.current) {
        return;
      }

      const liveAnchorRect = triggerElement?.isConnected
        ? triggerElement.getBoundingClientRect()
        : null;
      const anchorRect = liveAnchorRect
        ? {
            x: liveAnchorRect.left,
            y: liveAnchorRect.top,
            width: liveAnchorRect.width,
            height: liveAnchorRect.height,
            right: liveAnchorRect.right,
            bottom: liveAnchorRect.bottom,
          }
        : fallbackRect;

      if (!anchorRect) {
        return;
      }

      const popoverRect = popoverRef.current.getBoundingClientRect();
      setPosition(getPopoverPosition(anchorRect, popoverRect));
    };

    updatePosition();

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [dependencyKey, fallbackRect, isOpen, triggerElement, popoverRef]);

  return { position, isPositioned: isOpen && (!!triggerElement || !!fallbackRect) && !!position };
}
