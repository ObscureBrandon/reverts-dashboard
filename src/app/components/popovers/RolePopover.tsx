'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Copy } from 'lucide-react';
import { roleColorToHex } from '../utils';
import { PopoverWrapper, type Position } from './PopoverWrapper';

export type RolePopoverData = {
  id: string;
  name: string;
  color: number;
};

type RolePopoverProps = {
  isOpen: boolean;
  onClose: () => void;
  triggerElement: HTMLElement | null;
  triggerRect: Position | null;
  roleData: RolePopoverData;
};

export function RolePopover({ isOpen, onClose, triggerElement, triggerRect, roleData }: RolePopoverProps) {
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
      triggerElement={triggerElement}
      triggerRect={triggerRect}
      title="Role"
    >
      <div>
        <label className="text-xs font-medium text-muted-foreground">Name</label>
        <div className="mt-1 flex items-center gap-2 rounded-md bg-muted px-2.5 py-2 text-sm font-medium text-foreground">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: roleColorToHex(roleData.color) }}
          />
          <span className="truncate">{roleData.name}</span>
        </div>
      </div>
      
      <div>
        <label className="text-xs font-medium text-muted-foreground">Color</label>
        <div className="flex items-center gap-2 mt-1">
          <div 
            className="h-5 w-5 rounded border border-border"
            style={{ backgroundColor: roleColorToHex(roleData.color) }}
          />
          <p className="font-mono text-xs text-foreground">
            {roleColorToHex(roleData.color)}
          </p>
        </div>
      </div>
      
      <div>
        <label className="text-xs font-medium text-muted-foreground">Role ID</label>
        <div className="flex items-center gap-2 mt-1">
          <p className="flex-1 rounded-md bg-muted px-2 py-1 font-mono text-xs text-foreground">
            {roleData.id}
          </p>
          <Button
            type="button"
            onClick={() => copyToClipboard(roleData.id)}
            variant="ghost"
            size="icon-xs"
            className="shrink-0 rounded-full text-muted-foreground hover:text-foreground"
            title="Copy ID"
          >
            {copiedId === roleData.id ? (
              <Check className="h-3.5 w-3.5 text-status-success-text" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
    </PopoverWrapper>
  );
}
