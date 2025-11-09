'use client';

import { useRef, ReactNode } from 'react';
import { usePopoverPosition, Position } from './usePopoverPosition';

export type { Position };

type PopoverWrapperProps = {
  isOpen: boolean;
  onClose: () => void;
  triggerPosition: Position | null;
  title: string;
  children: ReactNode;
  dependencies?: any[];
};

export function PopoverWrapper({ 
  isOpen, 
  onClose, 
  triggerPosition, 
  title, 
  children,
  dependencies = []
}: PopoverWrapperProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const { position, isPositioned } = usePopoverPosition(
    popoverRef,
    triggerPosition,
    isOpen,
    dependencies
  );

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      
      <div 
        ref={popoverRef}
        className={`fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 w-80 max-h-[90vh] overflow-y-auto transition-opacity duration-200 ${
          isPositioned ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
        }}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-3">
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
