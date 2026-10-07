import React from 'react';

export type LedColor = 'green' | 'red' | 'amber' | 'brass' | 'teal' | 'muted';

interface LedProps {
  color?: LedColor;
  pulse?: boolean;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  bootDelay?: number; // ms to stagger power-on sequencing
  className?: string;
}

export const Led: React.FC<LedProps> = ({
  color = 'green',
  pulse = false,
  size = 'md',
  label,
  bootDelay,
  className = '',
}) => {
  const colorStyles: Record<LedColor, { text: string; shadow: string }> = {
    green: {
      text: 'text-audio-signal',
      shadow: 'shadow-none',
    },
    teal: {
      text: 'text-audio-signal',
      shadow: 'shadow-none',
    },
    red: {
      text: 'text-[#eb9689]',
      shadow: 'shadow-none',
    },
    amber: {
      text: 'text-[#e6a18b]',
      shadow: 'shadow-none',
    },
    brass: {
      text: 'text-audio-accent',
      shadow: 'shadow-none',
    },
    muted: {
      text: 'text-audio-muted',
      shadow: 'shadow-none',
    },
  };

  const sizeClasses = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5',
  }[size];

  const current = colorStyles[color];

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span
        className={`rounded-full bg-currentColor flex-shrink-0 ${sizeClasses} ${current.text} ${current.shadow} ${
          pulse ? 'animate-led-pulse' : ''
        } ${bootDelay !== undefined ? 'animate-boot-led' : ''}`}
        style={{
          backgroundColor: 'currentColor',
          ...(bootDelay !== undefined ? { animationDelay: `${bootDelay}ms` } : {}),
        }}
      />
      {label && (
        <span className="font-data text-[10px] tracking-wider uppercase text-audio-muted select-none">
          {label}
        </span>
      )}
    </span>
  );
};

export default Led;
