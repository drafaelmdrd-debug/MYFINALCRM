import React from 'react';
import { VA } from '../types';

interface VABadgeProps {
  va?: VA | string | null;
  className?: string;
  size?: 'sm' | 'md';
}

const VA_STYLES: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  Rain: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
  },
  Jah: {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  Jen: {
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
  },
  David: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  Unassigned: {
    bg: 'bg-stone-100',
    text: 'text-stone-600',
    border: 'border-stone-200',
    dot: 'bg-stone-400',
  },
};

export function VABadge({ va, className = '', size = 'sm' }: VABadgeProps) {
  const name = va || 'Unassigned';
  const style = VA_STYLES[name] || VA_STYLES.Unassigned;
  const padding = size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[10px]';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold font-mono rounded border ${style.bg} ${style.text} ${style.border} ${padding} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot} shrink-0`} />
      <span>{name}</span>
    </span>
  );
}
