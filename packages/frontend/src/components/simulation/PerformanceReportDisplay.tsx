'use client';

import { PerformanceReport } from '@/types/simulation';

interface PerformanceReportDisplayProps {
  report: PerformanceReport;
  onReplay: () => void;
  onNewScenario: () => void;
  isResetting: boolean;
}

export function PerformanceReportDisplay({
  report,
  onReplay,
  onNewScenario,
  isResetting,
}: PerformanceReportDisplayProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Improvement';
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-8 text-center">
        <div className="text-6xl mb-4">🏆</div>
        <h2 className="text-3xl font-bold mb-2">Performance Report</h2>
        <p className="text-blue-100">Here's how you did in this simulation</p>
      </div>

      {/* Overall Score */}
      <div className="p-8 text-center border-b border-gray-200">
        <div className={`text-6xl font-bold mb-2 ${getScoreColor(report.overallScore)}`}>
          {report.overallScore}
        </div>
        <div className="text-2xl font-semibold text-gray-700 mb-4">
          {getScoreLabel(report.overallScore)}
        </div>
        <div className="flex justify-center space-x-8 text-sm text-gray-600">
          <div>
            <div className="font-semibold text-gray-900">{report.actionsCount}</div>
            <div>Total Actions</div>
          </div>
          <div>
            <div className="font-semibold text-gray-900">{report.optimalActionsCount}</div>
            <div>Optimal Actions</div>
          </div>
          <div>
            <div className="font-semibold text-gray-900">
              {formatTime(report.completionTime)}
            </div>
            <div>Time Taken</div>
          </div>
        </div>
      </div>

      {/* Category Scores */}
      <div className="p-8 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Category Performance</h3>
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(report.categoryScores).map(([category, score]) => (
            <div key={category} className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 capitalize">
                  {category}
                </span>
                <span className={`text-lg font-bold ${getScoreColor(score)}`}>
                  {score}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-full rounded-full"
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detailed Feedback */}
      <div className="p-8 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Detailed Feedback</h3>
        <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
          {report.detailedFeedback}
        </p>
      </div>

      {/* Strengths */}
      {report.strengths.length > 0 && (
        <div className="p-8 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">✨ Strengths</h3>
          <ul className="space-y-2">
            {report.strengths.map((strength, index) => (
              <li key={index} className="flex items-start space-x-2">
                <span className="text-green-500 flex-shrink-0">✓</span>
                <span className="text-gray-700">{strength}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Areas for Improvement */}
      {report.areasForImprovement.length > 0 && (
        <div className="p-8 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            📈 Areas for Improvement
          </h3>
          <ul className="space-y-2">
            {report.areasForImprovement.map((area, index) => (
              <li key={index} className="flex items-start space-x-2">
                <span className="text-yellow-500 flex-shrink-0">→</span>
                <span className="text-gray-700">{area}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      {report.recommendations.length > 0 && (
        <div className="p-8 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">💡 Recommendations</h3>
          <ul className="space-y-3">
            {report.recommendations.map((recommendation, index) => (
              <li key={index} className="bg-blue-50 rounded-lg p-3">
                <span className="text-gray-800">{recommendation}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="p-8 bg-gray-50">
        <div className="flex justify-center space-x-4">
          <button
            onClick={onReplay}
            disabled={isResetting}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isResetting ? 'Resetting...' : 'Try Again'}
          </button>
          <button
            onClick={onNewScenario}
            className="bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors"
          >
            New Scenario
          </button>
        </div>
      </div>
    </div>
  );
}
