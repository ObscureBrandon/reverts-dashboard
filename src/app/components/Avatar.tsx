'use client';

import { useState } from 'react';

// Avatar component with fallback
export function Avatar({ 
  src, 
  name, 
  size = 32,
  onClick 
}: { 
  src: string | null; 
  name: string; 
  size?: number;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const [imageError, setImageError] = useState(false);
  
  const initials = name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  
  const getColorFromName = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 60%, 50%)`;
  };
  
  const baseClasses = "rounded-full flex items-center justify-center border-2 border-gray-200 dark:border-gray-700 flex-shrink-0";
  const clickableClasses = onClick ? "cursor-pointer hover:opacity-80 transition-opacity" : "";
  
  if (!src || imageError) {
    return (
      <div 
        className={`${baseClasses} ${clickableClasses} font-semibold text-white`}
        style={{ 
          width: `${size}px`, 
          height: `${size}px`,
          backgroundColor: getColorFromName(name),
          fontSize: `${size * 0.4}px`
        }}
        onClick={onClick}
      >
        {initials}
      </div>
    );
  }
  
  return (
    <img 
      src={src}
      alt={`${name}'s avatar`}
      className={`${baseClasses} ${clickableClasses}`}
      style={{ width: `${size}px`, height: `${size}px` }}
      onError={() => setImageError(true)}
      onClick={onClick}
    />
  );
}
