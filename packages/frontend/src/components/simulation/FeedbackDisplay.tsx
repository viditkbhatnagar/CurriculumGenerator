'use client';

import { StudentAction } from '@/types/simulation';

interface FeedbackDisplayProps {
  feedback: string;
  previousAction?: StudentAction;
}

export function FeedbackDisplay({ feedback, previousAction }: FeedbackDisplayProps) {
  if (!previousAction) return null;

  const isGoodScore = previousAction.score >= 15;

  return (
    <div
      className={`rounded-lg p-6 border-l-4 ${
        isGoodScore
          ? 'bg-green-50 border-green-500'
          : 'bg-yellow-50 border-yellow-500'
      }`}
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 text-3xl">
          {isGoodScore ? '✅' : '💡'}
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900 mb-2">
            {isGoodScore ? 'Great Choice!' : 'Consider This'}
          </h4>
          <p className="text-gray-800 mb-3">{feedback}</p>
          {previousAction.consequences && (
            <div className="bg-white bg-opacity-50 rounded p-3 mt-3">
              <p className="text-sm font-medium text-gray-700 mb-1">What happens next:</p>
              <p className="text-sm text-gray-800">{previousAction.consequences}</p>
            </div>
          )}
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm text-gray-600">
              Action: {previousAction.description}
            </span>
            <span className="text-lg font-bold text-blue-600">
              +{previousAction.score} points
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
