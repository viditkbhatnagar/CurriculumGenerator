'use client';

import { useEffect, useState } from 'react';
import { BLOOM_VERBS, type BloomLevel } from '@/types/workflow';
import { getCustomVerbs, addCustomVerb, removeCustomVerb } from '@/lib/bloomVerbs';

interface BloomVerbPickerProps {
  bloomLevel: BloomLevel;
  value: string;
  onChange: (verb: string) => void;
}

/**
 * Bloom's verb field: a free-text input plus clickable suggestion chips
 * for the current level. Users can add their own verbs — these persist
 * (localStorage) and appear as chips on every PLO/MLO editor afterwards.
 */
export default function BloomVerbPicker({ bloomLevel, value, onChange }: BloomVerbPickerProps) {
  const [customVerbs, setCustomVerbs] = useState<string[]>([]);
  const [draft, setDraft] = useState('');

  // localStorage is client-only — load after mount to avoid hydration drift.
  useEffect(() => {
    setCustomVerbs(getCustomVerbs(bloomLevel));
  }, [bloomLevel]);

  const builtIn = BLOOM_VERBS[bloomLevel] || [];
  const verbs = [...builtIn, ...customVerbs.filter((v) => !builtIn.includes(v))];

  const handleAdd = () => {
    const cleaned = draft.trim().toLowerCase();
    if (!cleaned) return;
    setCustomVerbs(addCustomVerb(bloomLevel, cleaned));
    onChange(cleaned);
    setDraft('');
  };

  return (
    <div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-teal-500"
        placeholder="e.g., analyze, evaluate, design"
      />

      <p className="text-xs text-teal-500 mt-2 mb-1">
        Suggested verbs for {bloomLevel} — click to use:
      </p>
      <div className="flex flex-wrap gap-1.5">
        {verbs.map((v) => {
          const isCustom = customVerbs.includes(v) && !builtIn.includes(v);
          const isActive = v === value.trim().toLowerCase();
          return (
            <span
              key={v}
              className={`group inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                isActive
                  ? 'border-teal-500 bg-teal-500 text-white'
                  : 'border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100'
              }`}
            >
              <button type="button" onClick={() => onChange(v)} className="capitalize">
                {v}
              </button>
              {isCustom && (
                <button
                  type="button"
                  onClick={() => setCustomVerbs(removeCustomVerb(bloomLevel, v))}
                  aria-label={`Remove ${v}`}
                  className={`leading-none ${isActive ? 'text-white/80 hover:text-white' : 'text-teal-400 hover:text-rose-500'}`}
                >
                  ×
                </button>
              )}
            </span>
          );
        })}
      </div>

      <div className="flex gap-2 mt-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
          className="flex-1 px-3 py-1.5 bg-white border border-teal-200 rounded-lg text-sm text-teal-800 placeholder-teal-400 focus:outline-none focus:border-teal-500"
          placeholder="Add your own verb…"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!draft.trim()}
          className="px-3 py-1.5 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          + Add
        </button>
      </div>
    </div>
  );
}
