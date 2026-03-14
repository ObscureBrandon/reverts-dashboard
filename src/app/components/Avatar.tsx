'use client';

import { MouseEvent, useState } from 'react';

import {
  Avatar as SharedAvatar,
  AvatarFallback,
  AvatarImage,
  UserAvatar,
  type AvatarSize,
} from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const canonicalAvatarSizes: Record<number, AvatarSize> = {
  20: 'xs',
  24: 'sm',
  32: 'md',
  40: 'lg',
  64: 'xl',
};

export function Avatar({ 
  src, 
  name, 
  size = 32,
  onClick 
}: { 
  src: string | null; 
  name: string; 
  size?: number;
  onClick?: (e: MouseEvent) => void;
}) {
  const [imageError, setImageError] = useState(false);
  const canonicalSize = canonicalAvatarSizes[size];

  if (canonicalSize) {
    return (
      <UserAvatar
        src={src}
        name={name}
        size={canonicalSize}
        className={cn(
          'shrink-0 border border-border',
          onClick && 'cursor-pointer transition-opacity hover:opacity-80'
        )}
        onClick={onClick}
      />
    );
  }

  return (
    <SharedAvatar
      size={canonicalSize ?? 'md'}
      className={cn(
        'shrink-0 border border-border',
        onClick && 'cursor-pointer transition-opacity hover:opacity-80'
      )}
      style={{ width: size, height: size }}
      onClick={onClick}
    >
      {!imageError && src ? (
        <AvatarImage
          src={src}
          alt={`${name}'s avatar`}
          onError={() => setImageError(true)}
        />
      ) : null}
      <AvatarFallback
        className="font-semibold"
        style={{ fontSize: Math.max(10, size * 0.4) }}
      >
        {name
          .split(' ')
          .map(word => word[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)}
      </AvatarFallback>
    </SharedAvatar>
  );
}
