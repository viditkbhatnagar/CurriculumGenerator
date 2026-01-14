'use client';

import { useState, ReactNode } from 'react';

interface LockableItemProps {
  itemId: string;
  stepNumber: number;
  isLocked: boolean;
  editedByHuman?: boolean;
  originalAIContent?: any;
  currentContent?: any;
  children: ReactNode;
  onLockChange: (itemId: string, locked: boolean) => void;
  onResetToAI?: (itemId: string) => void;
  className?: string;
}

export default function LockableItem({
  itemId,
  stepNumber,
  isLocked,
  editedByHuman = false,
  originalAIContent,
  currentContent,
  children,
  onLockChange,
  onResetToAI,
  className = '',
}: LockableItemProps) {
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleToggleLock = () => {
    onLockChange(itemId, !isLocked);
  };

  const handleReset = () => {
    if (onResetToAI) {
      onResetToAI(itemId);
      setShowResetConfirm(false);
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Lock/Edit Status Badge */}
      <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1">
        {/* Human Edited Indicator */}
        {editedByHuman && (
          <span
            className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded text-amber-400"
            title="Manually edited"
          >
            ✏️ Edited
          </span>
        )}

        {/* Lock Toggle Button */}
        <button
          onClick={handleToggleLock}
          className={`p-1.5 rounded-lg transition-all ${
            isLocked
              ? 'bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30'
              : 'bg-teal-50 border border-teal-200 text-teal-600 hover:border-cyan-500/50 hover:text-cyan-400'
          }`}
          title={
            isLocked
              ? 'Locked - Click to unlock'
              : 'Unlocked - Click to lock (protect from regeneration)'
          }
        >
          {isLocked ? (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Content */}
      <div className={isLocked ? 'ring-1 ring-red-500/30 rounded-xl' : ''}>{children}</div>

      {/* Reset to AI Button (shows if edited by human) */}
      {editedByHuman && onResetToAI && (
        <div className="mt-2">
          {showResetConfirm ? (
            <div className="flex items-center gap-2 p-2 bg-teal-50 rounded-lg border border-teal-200">
              <span className="text-xs text-teal-600">Reset to AI-generated version?</span>
              <button
                onClick={handleReset}
                className="px-2 py-1 text-xs bg-amber-500/20 text-amber-400 rounded hover:bg-amber-500/30"
              >
                Yes, Reset
              </button>
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-2 py-1 text-xs text-teal-600 hover:text-teal-600"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="text-[10px] text-teal-500 hover:text-amber-400 transition-colors flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Reset to AI
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Export hook for managing locked items in parent components
export function useLockedItems(initialLocked: string[] = []) {
  const [lockedItems, setLockedItems] = useState<Set<string>>(new Set(initialLocked));
  const [editedByHuman, setEditedByHuman] = useState<Set<string>>(new Set());
  const [originalAIContent, setOriginalAIContent] = useState<Map<string, any>>(new Map());

  const toggleLock = (itemId: string, locked: boolean) => {
    setLockedItems((prev) => {
      const next = new Set(prev);
      if (locked) {
        next.add(itemId);
      } else {
        next.delete(itemId);
      }
      return next;
    });
  };

  const markAsHumanEdited = (itemId: string, originalContent: any) => {
    setEditedByHuman((prev) => new Set(prev).add(itemId));
    setOriginalAIContent((prev) => new Map(prev).set(itemId, originalContent));
  };

  const resetToAI = (itemId: string) => {
    setEditedByHuman((prev) => {
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
    return originalAIContent.get(itemId);
  };

  const isLocked = (itemId: string) => lockedItems.has(itemId);
  const isEditedByHuman = (itemId: string) => editedByHuman.has(itemId);
  const getOriginalAI = (itemId: string) => originalAIContent.get(itemId);

  return {
    lockedItems,
    editedByHuman,
    toggleLock,
    markAsHumanEdited,
    resetToAI,
    isLocked,
    isEditedByHuman,
    getOriginalAI,
    getLockedItemIds: () => Array.from(lockedItems),
  };
}
