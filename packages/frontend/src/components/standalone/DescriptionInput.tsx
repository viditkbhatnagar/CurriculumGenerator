'use client';

import React, { useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Props for the DescriptionInput component
 * Per design document interface specification
 */
export interface DescriptionInputProps {
  stepNumber: number;
  stepName: string;
  stepIcon: string;
  stepDescription: string;
  value: string;
  onChange: (value: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  isValid: boolean;
}

/**
 * Minimum character count for valid description
 * Per Requirements 3.4 and 10.2
 */
export const MIN_DESCRIPTION_LENGTH = 10;

/**
 * Validates a description string
 * Returns true if description has at least MIN_DESCRIPTION_LENGTH characters after trimming
 * Per Requirements 3.4, 10.2
 */
export function validateDescription(description: string): boolean {
  return description.trim().length >= MIN_DESCRIPTION_LENGTH;
}

/**
 * DescriptionInput Component
 * 
 * Provides a multi-line textarea for users to enter context/requirements for step generation.
 * 
 * Requirements covered:
 * - 3.1: Display description input area when step is selected
 * - 3.2: Include placeholder text explaining what information to provide
 * - 3.3: Allow multi-line text entry with minimum height of 4 rows
 * - 3.4: Disable generate button when description is invalid (< 10 chars)
 * - 3.5: Display step's existing description above the input area
 */
export function DescriptionInput({
  stepNumber,
  stepName,
  stepIcon,
  stepDescription,
  value,
  onChange,
  onGenerate,
  isGenerating,
  isValid,
}: DescriptionInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const charCount = value.trim().length;
  const showCharWarning = charCount > 0 && charCount < MIN_DESCRIPTION_LENGTH;

  // Focus textarea when component mounts (step selected)
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [stepNumber]);

  // Generate placeholder based on step - Requirement 3.2
  const placeholder = `Describe what you want to generate for ${stepName}. Include relevant context, requirements, and any specific details...`;

  // Handle keyboard shortcut in textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && isValid && !isGenerating) {
      e.preventDefault();
      onGenerate();
    }
  };

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4 sm:p-6">
      {/* Step Header - Requirement 3.5: Display step description above input */}
      <div className="mb-4">
        <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
          <span role="img" aria-hidden="true">{stepIcon}</span>
          <span>Step {stepNumber}: {stepName}</span>
        </h2>
        <p className="text-slate-400 text-xs sm:text-sm mt-1">{stepDescription}</p>
      </div>

      {/* Description Input - Requirements 3.1, 3.2, 3.3 */}
      <div className="mb-4">
        <label
          htmlFor="description-input"
          className="block text-sm font-medium text-slate-300 mb-2"
        >
          Description
          <span className="sr-only"> (minimum {MIN_DESCRIPTION_LENGTH} characters required)</span>
        </label>
        <textarea
          ref={textareaRef}
          id="description-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={4}
          disabled={isGenerating}
          className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/50 resize-none disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
          aria-describedby="description-help"
          aria-invalid={showCharWarning}
          aria-required="true"
        />
        {/* Character count and validation message */}
        <p
          id="description-help"
          className={`text-xs mt-1 ${showCharWarning ? 'text-amber-400' : 'text-slate-500'}`}
          aria-live="polite"
        >
          {charCount < MIN_DESCRIPTION_LENGTH
            ? `Minimum ${MIN_DESCRIPTION_LENGTH} characters required (${charCount}/${MIN_DESCRIPTION_LENGTH})`
            : `${charCount} characters`}
        </p>
      </div>

      {/* Generate Button - Requirement 3.4: Disable when input invalid */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <button
          onClick={onGenerate}
          disabled={!isValid || isGenerating}
          className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-800"
          aria-busy={isGenerating}
          aria-disabled={!isValid || isGenerating}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" aria-hidden="true" />
              <span>Generating...</span>
            </>
          ) : (
            <span>Generate {stepName}</span>
          )}
        </button>
        
        {/* Keyboard shortcut hint - visible on larger screens */}
        <p className="hidden sm:block text-xs text-slate-500">
          Press <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-400">Ctrl+Enter</kbd> to generate
        </p>
      </div>
    </div>
  );
}

export default DescriptionInput;
