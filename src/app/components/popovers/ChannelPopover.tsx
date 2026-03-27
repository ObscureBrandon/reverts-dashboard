'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Copy } from 'lucide-react';
import { PopoverWrapper, type Position } from './PopoverWrapper';

export type ChannelPopoverData = {
  id: string;
  name: string;
};

type ChannelPopoverProps = {
  isOpen: boolean;
  onClose: () => void;
  triggerElement: HTMLElement | null;
  triggerRect: Position | null;
  channelData: ChannelPopoverData;
};

export function ChannelPopover({ isOpen, onClose, triggerElement, triggerRect, channelData }: ChannelPopoverProps) {
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
      title="Channel"
    >
      <div>
        <label className="text-xs font-medium text-muted-foreground">Name</label>
        <div className="mt-1 rounded-md bg-muted px-2.5 py-2 text-sm font-medium text-foreground">
          <p className="truncate">#{channelData.name}</p>
        </div>
      </div>
      
      <div>
        <label className="text-xs font-medium text-muted-foreground">Channel ID</label>
        <div className="flex items-center gap-2 mt-1">
          <p className="flex-1 rounded-md bg-muted px-2 py-1 font-mono text-xs text-foreground">
            {channelData.id}
          </p>
          <Button
            type="button"
            onClick={() => copyToClipboard(channelData.id)}
            variant="ghost"
            size="icon-xs"
            className="shrink-0 rounded-full text-muted-foreground hover:text-foreground"
            title="Copy ID"
          >
            {copiedId === channelData.id ? (
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
