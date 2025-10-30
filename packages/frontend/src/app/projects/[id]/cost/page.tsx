'use client';

/**
 * Cost Evaluation Page (Stage 3)
 * Display paid resources, cost breakdown, AI alternatives, and management approval
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  DollarSign,
  AlertCircle,
  CheckCircle,
  XCircle,
  TrendingDown,
  Book,
  Database,
  Wrench,
  Package,
} from 'lucide-react';

interface PaidResource {
  resourceName: string;
  resourceType: string;
  cost: number;
  currency: string;
  subscriptionType: string;
  identifiedIn: string;
  url?: string;
  reasoning: string;
}

interface Alternative {
  originalResource: string;
  alternativeName: string;
  alternativeCost: number;
  costSaving: number;
  reasoning: string;
  qualityComparison: string;
  url?: string;
}

interface CostEvaluation {
  _id: string;
  projectId: string;
  paidResources: PaidResource[];
  totalEstimatedCost: number;
  currency: string;
  costBreakdown: {
    journals: number;
    databases: number;
    tools: number;
    software: number;
    other: number;
  };
  aiSuggestedAlternatives: Alternative[];
  managementDecision: 'pending' | 'approved' | 'rejected';
  selectedAlternatives?: string[];
  rejectionReason?: string;
  evaluatedAt: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
}

export default function CostEvaluationPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [costEval, setCostEval] = useState<CostEvaluation | null>(null);
  const [selectedAlternatives, setSelectedAlternatives] = useState<string[]>([]);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    fetchOrStartEvaluation();
  }, [projectId]);

  const fetchOrStartEvaluation = async () => {
    try {
      setLoading(true);

      // Try to fetch existing evaluation
      const fetchResponse = await fetch(`http://localhost:4000/api/v2/projects/${projectId}/cost`);

      if (fetchResponse.ok) {
        const data = await fetchResponse.json();
        setCostEval(data.data);
        setSelectedAlternatives(data.data.selectedAlternatives || []);
        setLoading(false);
        return;
      }

      // No evaluation exists, start one
      setEvaluating(true);
      const startResponse = await fetch(
        `http://localhost:4000/api/v2/projects/${projectId}/cost/evaluate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (startResponse.ok) {
        const result = await startResponse.json();
        setCostEval(result.data);
        setSelectedAlternatives(result.data.selectedAlternatives || []);
      }
    } catch (error) {
      console.error('Error with cost evaluation:', error);
    } finally {
      setLoading(false);
      setEvaluating(false);
    }
  };

  const handleApprove = async () => {
    try {
      const response = await fetch(
        `http://localhost:4000/api/v2/projects/${projectId}/cost/approve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ selectedAlternatives }),
        }
      );

      if (response.ok) {
        alert('Cost evaluation approved! Moving to Stage 4.');
        router.push(`/projects/${projectId}`);
      }
    } catch (error) {
      console.error('Error approving:', error);
      alert('Failed to approve cost evaluation');
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:4000/api/v2/projects/${projectId}/cost/reject`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: rejectionReason }),
        }
      );

      if (response.ok) {
        alert('Cost evaluation rejected. SME will revise resources.');
        router.push(`/projects/${projectId}`);
      }
    } catch (error) {
      console.error('Error rejecting:', error);
      alert('Failed to reject cost evaluation');
    }
  };

  const toggleAlternative = (alternativeName: string) => {
    setSelectedAlternatives((prev) =>
      prev.includes(alternativeName)
        ? prev.filter((name) => name !== alternativeName)
        : [...prev, alternativeName]
    );
  };

  const getResourceIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'journal':
      case 'book':
        return <Book className="w-5 h-5 text-blue-600" />;
      case 'database':
        return <Database className="w-5 h-5 text-purple-600" />;
      case 'tool':
      case 'software':
        return <Wrench className="w-5 h-5 text-green-600" />;
      default:
        return <Package className="w-5 h-5 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading cost evaluation...</p>
        </div>
      </div>
    );
  }

  if (evaluating) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-2xl">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Analyzing Resource Costs...</h2>
          <p className="text-gray-600">
            AI is scanning all 14 components, identifying paid resources, calculating costs, and
            suggesting free alternatives. This may take a minute.
          </p>
        </div>
      </div>
    );
  }

  if (!costEval) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
          <p className="text-gray-600">Cost evaluation not found</p>
        </div>
      </div>
    );
  }

  const totalSavings = (costEval.aiSuggestedAlternatives || []).reduce(
    (sum, alt) => sum + alt.costSaving,
    0
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Resource Cost Evaluation</h1>
              <p className="mt-2 text-sm text-gray-600">
                Stage 3: Review costs, evaluate alternatives, and approve resources
              </p>
            </div>
            <button
              onClick={() => router.push(`/projects/${projectId}`)}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Cost Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Estimated Cost</p>
                <p className="text-3xl font-bold text-gray-900">
                  ${costEval.totalEstimatedCost.toLocaleString()}
                </p>
              </div>
              <DollarSign className="w-12 h-12 text-red-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Potential Savings</p>
                <p className="text-3xl font-bold text-green-600">
                  ${totalSavings.toLocaleString()}
                </p>
              </div>
              <TrendingDown className="w-12 h-12 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Paid Resources Found</p>
                <p className="text-3xl font-bold text-gray-900">
                  {(costEval.paidResources || []).length}
                </p>
              </div>
              <Package className="w-12 h-12 text-blue-500" />
            </div>
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Cost Breakdown</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(costEval.costBreakdown || {}).map(([category, amount]) => (
              <div key={category} className="text-center">
                <p className="text-sm text-gray-600 capitalize">{category}</p>
                <p className="text-lg font-semibold text-gray-900">${amount.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Paid Resources List */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Identified Paid Resources ({(costEval.paidResources || []).length})
          </h2>
          <div className="space-y-4">
            {(costEval.paidResources || []).map((resource, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    {getResourceIcon(resource.resourceType)}
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{resource.resourceName}</h3>
                      <p className="text-sm text-gray-600 mt-1">{resource.reasoning}</p>
                      <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                        <span className="capitalize">{resource.resourceType}</span>
                        <span>•</span>
                        <span>Found in: {resource.identifiedIn}</span>
                        <span>•</span>
                        <span className="capitalize">{resource.subscriptionType}</span>
                      </div>
                      {resource.url && (
                        <a
                          href={resource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-sm mt-2 inline-block"
                        >
                          View Resource →
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-2xl font-bold text-gray-900">
                      ${resource.cost.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500">{resource.currency}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Suggested Alternatives */}
        {(costEval.aiSuggestedAlternatives || []).length > 0 && (
          <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              🤖 AI-Suggested Free Alternatives ({(costEval.aiSuggestedAlternatives || []).length})
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              Select alternatives to replace paid resources and reduce costs while maintaining
              quality
            </p>
            <div className="space-y-4">
              {(costEval.aiSuggestedAlternatives || []).map((alternative, index) => (
                <div key={index} className="bg-white border-2 border-gray-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <input
                      type="checkbox"
                      checked={selectedAlternatives.includes(alternative.alternativeName)}
                      onChange={() => toggleAlternative(alternative.alternativeName)}
                      className="mt-1 h-5 w-5 text-blue-600 border-gray-300 rounded"
                    />
                    <div className="ml-4 flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm text-gray-600">
                            Alternative for:{' '}
                            <span className="font-medium">{alternative.originalResource}</span>
                          </p>
                          <h3 className="text-lg font-semibold text-gray-900 mt-1">
                            {alternative.alternativeName}
                          </h3>
                          <p className="text-sm text-gray-700 mt-2">{alternative.reasoning}</p>
                          <div className="flex items-center space-x-4 mt-3">
                            <span
                              className={`text-xs px-2 py-1 rounded-full ${
                                alternative.qualityComparison === 'better'
                                  ? 'bg-green-100 text-green-800'
                                  : alternative.qualityComparison === 'similar'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-yellow-100 text-yellow-800'
                              }`}
                            >
                              Quality: {alternative.qualityComparison}
                            </span>
                            <span className="text-sm text-green-600 font-medium">
                              Saves: ${alternative.costSaving.toLocaleString()}
                            </span>
                          </div>
                          {alternative.url && (
                            <a
                              href={alternative.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-sm mt-2 inline-block"
                            >
                              View Alternative →
                            </a>
                          )}
                        </div>
                        <div className="text-right ml-4">
                          <p className="text-2xl font-bold text-green-600">
                            $
                            {alternative.alternativeCost === 0
                              ? 'FREE'
                              : alternative.alternativeCost.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Management Decision */}
        {costEval.managementDecision === 'pending' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Management Decision Required</h2>
            <p className="text-gray-600 mb-6">
              Review the costs and alternatives above, then approve or reject this evaluation.
            </p>
            <div className="flex space-x-4">
              <button
                onClick={handleApprove}
                className="flex-1 flex items-center justify-center px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium"
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                Approve & Continue to Stage 4
              </button>
              <button
                onClick={() => setShowRejectModal(true)}
                className="flex-1 flex items-center justify-center px-6 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium"
              >
                <XCircle className="w-5 h-5 mr-2" />
                Reject & Request Revision
              </button>
            </div>
          </div>
        )}

        {/* Approved Status */}
        {costEval.managementDecision === 'approved' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-center">
              <CheckCircle className="w-6 h-6 text-green-600 mr-3" />
              <div>
                <h3 className="font-semibold text-green-900">Cost Evaluation Approved</h3>
                <p className="text-sm text-green-700 mt-1">
                  Approved on {new Date(costEval.approvedAt!).toLocaleDateString()} • Ready for
                  Stage 4
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Rejected Status */}
        {costEval.managementDecision === 'rejected' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-start">
              <XCircle className="w-6 h-6 text-red-600 mr-3 mt-1" />
              <div>
                <h3 className="font-semibold text-red-900">Cost Evaluation Rejected</h3>
                <p className="text-sm text-red-700 mt-1">
                  Rejected on {new Date(costEval.rejectedAt!).toLocaleDateString()}
                </p>
                <p className="text-sm text-gray-700 mt-2">
                  <strong>Reason:</strong> {costEval.rejectionReason}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Reject Cost Evaluation</h3>
            <p className="text-sm text-gray-600 mb-4">
              Please provide a reason for rejection. The SME will revise the resources based on your
              feedback.
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g., Too many expensive resources. Please find more open-access alternatives."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              rows={4}
            />
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
