import React from 'react';

interface EngravedProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  size?: 'xs' | 'sm' | 'md';
  glow?: boolean;
  className?: string;
}

export const Engraved: React.FC<EngravedProps> = ({
  children,
  size = 'sm',
  glow = false,
  className = '',
  ...props
}) => {
  const sizeClasses = {
    xs: 'text-[11px]',
    sm: 'text-xs',
    md: 'text-sm',
  }[size];

  return (
    <span
      className={`engraved font-sans select-none text-audio-muted ${sizeClasses} ${
        glow ? 'text-audio-accent' : ''
      } ${className}`}
      style={{
        textShadow: 'none',
      }}
      {...props}
    >
      {children}
    </span>
  );
};

export default Engraved;
