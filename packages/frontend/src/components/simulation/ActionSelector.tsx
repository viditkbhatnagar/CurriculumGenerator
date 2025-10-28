'use client';

import { Action } from '@/types/simulation';

interface ActionSelectorProps {
  actions: Action[];
  onActionSelect: (actionId: string) => void;
  disabled: boolean;
}

const categoryColors = {
  analysis: 'bg-purple-50 border-purple-300 hover:bg-purple-100 text-purple-900',
  communication: 'bg-blue-50 border-blue-300 hover:bg-blue-100 text-blue-900',
  decision: 'bg-green-50 border-green-300 hover:bg-green-100 text-green-900',
  implementation: 'bg-orange-50 border-orange-300 hover:bg-orange-100 text-orange-900',
};

const categoryIcons = {
  analysis: '🔍',
  communication: '💬',
  decision: '⚖️',
  implementation: '⚙️',
};

export function ActionSelector({ actions, onActionSelect, disabled }: ActionSelectorProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">What will you do?</h3>
      <div className="space-y-3">
        {actions.map((action) => (
          <button
            key={action.actionId}
            onClick={() => onActionSelect(action.actionId)}
            disabled={disabled}
            className={`w-full text-left p-4 border-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              categoryColors[action.category]
            }`}
          >
            <div className="flex items-start space-x-3">
              <span className="text-2xl flex-shrink-0">
                {categoryIcons[action.category]}
              </span>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wide">
                    {action.category}
                  </span>
                </div>
                <p className="text-sm font-medium">{action.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
      {disabled && (
        <p className="text-sm text-gray-500 text-center mt-4">Processing your action...</p>
      )}
    </div>
  );
}
