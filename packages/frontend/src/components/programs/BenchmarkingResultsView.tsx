'use client';

import { useState, useEffect } from 'react';

interface InstitutionComparison {
  institutionName: string;
  similarityScore: number;
  topicCoverage: number;
  assessmentAlignment: number;
}

interface Gap {
  topic: string;
  description: string;
  competitorInstitutions: string[];
  priority: 'high' | 'medium' | 'low';
}

interface Strength {
  topic: string;
  description: string;
  advantage: string;
}

interface BenchmarkReport {
  comparisons: InstitutionComparison[];
  overallSimilarity: number;
  gaps: Gap[];
  strengths: Strength[];
  recommendations: string[];
}

interface BenchmarkingResultsViewProps {
  programId: string;
}

export function BenchmarkingResultsView({ programId }: BenchmarkingResultsViewProps) {
  const [benchmarkData, setBenchmarkData] = useState<BenchmarkReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedView, setSelectedView] = useState<'overview' | 'gaps' | 'strengths'>('overview');

  useEffect(() => {
    loadBenchmarkData();
  }, [programId]);

  const loadBenchmarkData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/benchmarks/compare/${programId}`
      );

      if (!response.ok) {
        throw new Error('Failed to load benchmarking data');
      }

      const result = await response.json();
      setBenchmarkData(result.data);
    } catch (err: any) {
      console.error('Failed to load benchmarking data:', err);
      setError(err.message || 'Failed to load benchmarking data');
    } finally {
      setIsLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-100';
    if (score >= 60) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  if (!benchmarkData) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-yellow-800">No benchmarking data available</p>
      </div>
    );
  }

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Overall Similarity */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Overall Market Similarity</h3>
            <p className="text-sm text-gray-600 mt-1">
              Average similarity across all competitor institutions
            </p>
          </div>
          <div className="text-right">
            <div className={`text-4xl font-bold ${getScoreColor(benchmarkData.overallSimilarity)}`}>
              {benchmarkData.overallSimilarity}
            </div>
            <p className="text-sm text-gray-600">out of 100</p>
          </div>
        </div>
      </div>

      {/* Competitor Comparisons */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Competitor Comparisons</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Institution
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Overall Similarity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Topic Coverage
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assessment Alignment
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {benchmarkData.comparisons.map((comparison, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {comparison.institutionName}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className={`text-lg font-semibold ${getScoreColor(comparison.similarityScore)}`}>
                        {comparison.similarityScore}
                      </span>
                      <div className="ml-4 flex-1 max-w-xs">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              comparison.similarityScore >= 80 ? 'bg-green-500' :
                              comparison.similarityScore >= 60 ? 'bg-yellow-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${comparison.similarityScore}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getScoreBgColor(comparison.topicCoverage)}`}>
                      {comparison.topicCoverage}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getScoreBgColor(comparison.assessmentAlignment)}`}>
                      {comparison.assessmentAlignment}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-2xl font-bold text-gray-900">{benchmarkData.gaps.length}</p>
              <p className="text-sm text-gray-600">Content Gaps</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-2xl font-bold text-gray-900">{benchmarkData.strengths.length}</p>
              <p className="text-sm text-gray-600">Competitive Strengths</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-2xl font-bold text-gray-900">{benchmarkData.recommendations.length}</p>
              <p className="text-sm text-gray-600">Recommendations</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderGaps = () => (
    <div className="space-y-4">
      {benchmarkData.gaps.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
          <svg className="mx-auto h-12 w-12 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="mt-2 text-lg font-medium text-green-900">No Content Gaps Identified</h3>
          <p className="mt-1 text-sm text-green-700">
            Your curriculum covers all topics found in competitor programs
          </p>
        </div>
      ) : (
        benchmarkData.gaps.map((gap, index) => (
          <div key={index} className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center">
                  <h3 className="text-lg font-medium text-gray-900">{gap.topic}</h3>
                  <span className={`ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(gap.priority)}`}>
                    {gap.priority} priority
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-700">{gap.description}</p>
                <div className="mt-3">
                  <p className="text-xs text-gray-600">Found in:</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {gap.competitorInstitutions.map((institution, idx) => (
                      <span key={idx} className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-700">
                        {institution}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="ml-4">
                <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );

  const renderStrengths = () => (
    <div className="space-y-4">
      {benchmarkData.strengths.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-600">No unique strengths identified</p>
        </div>
      ) : (
        benchmarkData.strengths.map((strength, index) => (
          <div key={index} className="bg-white border border-green-200 rounded-lg p-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4 flex-1">
                <h3 className="text-lg font-medium text-gray-900">{strength.topic}</h3>
                <p className="mt-2 text-sm text-gray-700">{strength.description}</p>
                <div className="mt-3 bg-green-50 border border-green-200 rounded p-3">
                  <p className="text-sm text-green-800">
                    <span className="font-medium">Competitive Advantage:</span> {strength.advantage}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900">Benchmarking Analysis</h2>
        <p className="mt-2 text-sm text-gray-600">
          Comparison of your curriculum against {benchmarkData.comparisons.length} competitor institutions
        </p>
      </div>

      {/* View Selector */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setSelectedView('overview')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              selectedView === 'overview'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setSelectedView('gaps')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              selectedView === 'gaps'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Content Gaps
            {benchmarkData.gaps.length > 0 && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                {benchmarkData.gaps.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setSelectedView('strengths')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              selectedView === 'strengths'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Strengths
            {benchmarkData.strengths.length > 0 && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                {benchmarkData.strengths.length}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* View Content */}
      <div>
        {selectedView === 'overview' && renderOverview()}
        {selectedView === 'gaps' && renderGaps()}
        {selectedView === 'strengths' && renderStrengths()}
      </div>

      {/* Recommendations */}
      {benchmarkData.recommendations.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Improvement Recommendations</h3>
          <ul className="space-y-3">
            {benchmarkData.recommendations.map((recommendation, index) => (
              <li key={index} className="flex items-start">
                <span className="flex-shrink-0 inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-100 text-blue-600 text-xs font-medium mr-3">
                  {index + 1}
                </span>
                <span className="text-sm text-gray-700">{recommendation}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
