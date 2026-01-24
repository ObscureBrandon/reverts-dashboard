'use client';

import { useState } from 'react';
import { roleColorToHex } from '../utils';
import { PopoverWrapper, Position } from './PopoverWrapper';

export type RolePopoverData = {
  id: string;
  name: string;
  color: number;
};

type RolePopoverProps = {
  isOpen: boolean;
  onClose: () => void;
  triggerPosition: Position | null;
  roleData: RolePopoverData;
};

export function RolePopover({ isOpen, onClose, triggerPosition, roleData }: RolePopoverProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(text);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <PopoverWrapper
      isOpen={isOpen}
      onClose={onClose}
      triggerPosition={triggerPosition}
      title="Role"
    >
      <div>
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Name</label>
        <p className="text-sm text-gray-900 dark:text-white mt-1">{roleData.name}</p>
      </div>
      
      <div>
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Color</label>
        <div className="flex items-center gap-2 mt-1">
          <div 
            className="w-5 h-5 rounded border border-gray-300 dark:border-gray-600"
            style={{ backgroundColor: roleColorToHex(roleData.color) }}
          />
          <p className="text-xs text-gray-900 dark:text-white font-mono">
            {roleColorToHex(roleData.color)}
          </p>
        </div>
      </div>
      
      <div>
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Role ID</label>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-xs text-gray-900 dark:text-white font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded flex-1">
            {roleData.id}
          </p>
          <button
            onClick={() => copyToClipboard(roleData.id)}
            className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
            title="Copy ID"
          >
            {copiedId === roleData.id ? (
              <svg className="w-3.5 h-3.5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </PopoverWrapper>
  );
}
