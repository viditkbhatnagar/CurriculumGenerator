'use client';

/**
 * Resource Cost Evaluation Page (Stage 3)
 * Displays paid resources, costs, and AI-suggested alternatives
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DollarSign, TrendingDown, Check, X, ArrowLeft, Loader2 } from 'lucide-react';

interface Alternative {
  name: string;
  cost: number;
  qualityMatch: number;
  limitations?: string;
  source: string;
}

interface Resource {
  resourceName: string;
  resourceType: string;
  vendor?: string;
  costPerStudent: number;
  estimatedStudents: number;
  totalCost: number;
  isRecurring: boolean;
  recurringPeriod?: string;
  justification: string;
  alternatives: Alternative[];
}

interface CostEvaluation {
  _id: string;
  projectId: string;
  resources: Resource[];
  totalEstimatedCost: number;
  managementDecision: 'pending' | 'approved' | 'rejected';
  decidedAt?: string;
  decisionNotes?: string;
}

export default function CostEvaluationPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [evaluation, setEvaluation] = useState<CostEvaluation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvaluation();
  }, [projectId]);

  const fetchEvaluation = async () => {
    setLoading(true);
    try {
      // First get the project to get the evaluation ID
      const projectResponse = await fetch(`/api/v2/projects/${projectId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (projectResponse.ok) {
        const projectData = await projectResponse.json();
        const evaluationId = projectData.data.stageProgress.stage3?.costEvaluationId;

        if (evaluationId) {
          const evalResponse = await fetch(`/api/v2/cost/${evaluationId}`, {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          });

          if (evalResponse.ok) {
            const evalData = await evalResponse.json();
            setEvaluation(evalData.data);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching evaluation:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-blue-600 mb-4" />
          <p className="text-gray-600">Loading cost evaluation...</p>
        </div>
      </div>
    );
  }

  if (!evaluation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No cost evaluation found</p>
          <button
            onClick={() => router.push(`/projects/${projectId}`)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Back to Project
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push(`/projects/${projectId}`)}
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Resource Cost Evaluation</h1>
                <p className="mt-2 text-sm text-gray-600">
                  Stage 3 - Review paid resources and alternatives
                </p>
              </div>
            </div>

            <div className="text-right">
              <div className="text-sm text-gray-600">Total Estimated Cost</div>
              <div className="text-3xl font-bold text-gray-900">
                ${evaluation.totalEstimatedCost.toFixed(2)}
              </div>
              <div
                className={`
                mt-2 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium
                ${evaluation.managementDecision === 'approved' ? 'bg-green-100 text-green-800' : ''}
                ${evaluation.managementDecision === 'pending' ? 'bg-yellow-100 text-yellow-800' : ''}
                ${evaluation.managementDecision === 'rejected' ? 'bg-red-100 text-red-800' : ''}
              `}
              >
                {evaluation.managementDecision === 'approved' && <Check className="w-4 h-4 mr-1" />}
                {evaluation.managementDecision === 'rejected' && <X className="w-4 h-4 mr-1" />}
                {evaluation.managementDecision.replace('_', ' ').toUpperCase()}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Resources List */}
        <div className="space-y-6">
          {evaluation.resources.map((resource, idx) => (
            <div key={idx} className="bg-white rounded-lg shadow overflow-hidden">
              {/* Resource Header */}
              <div className="bg-gray-50 px-6 py-4 border-b">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{resource.resourceName}</h3>
                    <div className="mt-2 flex items-center space-x-4 text-sm text-gray-600">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md font-medium">
                        {resource.resourceType}
                      </span>
                      {resource.vendor && <span>Vendor: {resource.vendor}</span>}
                      {resource.isRecurring && (
                        <span className="text-orange-600 font-medium">
                          Recurring ({resource.recurringPeriod})
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">
                      ${resource.totalCost.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-600">
                      ${resource.costPerStudent.toFixed(2)} × {resource.estimatedStudents} students
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Justification:</span> {resource.justification}
                  </p>
                </div>
              </div>

              {/* Alternatives */}
              {resource.alternatives.length > 0 && (
                <div className="px-6 py-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                    <TrendingDown className="w-4 h-4 mr-2 text-green-600" />
                    AI-Suggested Alternatives
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {resource.alternatives.map((alt, altIdx) => (
                      <div
                        key={altIdx}
                        className="border border-gray-200 rounded-lg p-4 hover:border-blue-400 hover:shadow-md transition-all"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h5 className="font-medium text-gray-900 text-sm">{alt.name}</h5>
                          {alt.cost === 0 && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded">
                              FREE
                            </span>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Cost:</span>
                            <span className="font-semibold text-gray-900">
                              ${(alt.cost * resource.estimatedStudents).toFixed(2)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Quality Match:</span>
                            <div className="flex items-center">
                              <div className="w-16 h-2 bg-gray-200 rounded-full mr-2">
                                <div
                                  className={`h-2 rounded-full ${
                                    alt.qualityMatch >= 80
                                      ? 'bg-green-500'
                                      : alt.qualityMatch >= 60
                                        ? 'bg-yellow-500'
                                        : 'bg-red-500'
                                  }`}
                                  style={{ width: `${alt.qualityMatch}%` }}
                                ></div>
                              </div>
                              <span className="font-semibold">{alt.qualityMatch}%</span>
                            </div>
                          </div>

                          {alt.limitations && (
                            <div className="text-xs text-gray-600 mt-2 pt-2 border-t">
                              <span className="font-medium">Limitations:</span> {alt.limitations}
                            </div>
                          )}

                          <div className="text-xs text-gray-500 mt-1">Source: {alt.source}</div>

                          {/* Potential Savings */}
                          {resource.totalCost > alt.cost * resource.estimatedStudents && (
                            <div className="mt-2 pt-2 border-t text-xs text-green-600 font-medium">
                              Save $
                              {(resource.totalCost - alt.cost * resource.estimatedStudents).toFixed(
                                2
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {evaluation.resources.length === 0 && (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <DollarSign className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Paid Resources Detected</h3>
              <p className="text-gray-600">
                The curriculum uses only free and open-source resources
              </p>
            </div>
          )}
        </div>

        {/* Decision Notes */}
        {evaluation.decisionNotes && (
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">Management Notes</h3>
            <p className="text-sm text-blue-800">{evaluation.decisionNotes}</p>
            {evaluation.decidedAt && (
              <p className="text-xs text-blue-600 mt-2">
                Decided on {new Date(evaluation.decidedAt).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
