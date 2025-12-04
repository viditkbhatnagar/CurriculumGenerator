'use client';

import { useState } from 'react';

interface EditTarget {
  type: 'item' | 'section';
  stepNumber: number;
  itemId?: string;
  sectionId?: string;
  originalContent: any;
  fieldPath: string;
}

interface EditWithAIButtonProps {
  target: EditTarget;
  onEdit: (target: EditTarget) => void;
  label?: string;
  size?: 'sm' | 'md';
  variant?: 'icon' | 'text' | 'both';
  className?: string;
}

export default function EditWithAIButton({
  target,
  onEdit,
  label = 'Edit with VB',
  size = 'sm',
  variant = 'both',
  className = '',
}: EditWithAIButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(target);
  };

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        inline-flex items-center gap-1.5 rounded-lg transition-all
        ${sizeClasses[size]}
        ${
          isHovered
            ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-cyan-500/50 text-cyan-400'
            : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-cyan-400'
        }
        border
        ${className}
      `}
      title="Edit with VB Canvas"
    >
      {(variant === 'icon' || variant === 'both') && (
        <svg
          className={`${size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} ${isHovered ? 'animate-pulse' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
      )}
      {(variant === 'text' || variant === 'both') && <span>{label}</span>}
    </button>
  );
}

// Export type for other components
export type { EditTarget };
