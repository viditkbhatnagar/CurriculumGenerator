'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle,
  XCircle,
  Clock,
  ArrowLeft,
  Loader2,
  Send,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';

interface CurriculumReview {
  _id: string;
  projectId: string;
  fullCurriculumId: string;
  reviewedBy: string;
  reviewStatus: 'in_review' | 'refinements_requested' | 'approved' | 'rejected';
  refinements: any[];
  smeApproval?: {
    userId: string;
    timestamp: Date;
    ipAddress: string;
    digitalSignature?: string;
  };
  publicationApproval?: {
    adminId: string;
    approvedAt: Date;
    notes?: string;
  };
  publishedAt?: Date;
  publishedToLMS: boolean;
  lmsId?: string;
  lmsCourseUrl?: string;
  rejectionReason?: string;
  rejectedBy?: string;
  rejectedAt?: Date;
}

export default function FinalReviewPage({ params }: { params: { id: string } }) {
  const projectId = params.id;
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState<CurriculumReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);

  useEffect(() => {
    fetchReview();
  }, [projectId]);

  const fetchReview = async () => {
    try {
      const response = await fetch(`http://localhost:4000/api/v2/projects/${projectId}/review`);

      if (response.ok) {
        const data = await response.json();
        setReview(data.data);
        setLoading(false);
      } else if (response.status === 404) {
        // Review doesn't exist yet, start it
        await startReview();
      } else {
        throw new Error('Failed to fetch review');
      }
    } catch (err) {
      console.error('Error fetching review:', err);
      setError('Failed to load review');
      setLoading(false);
    }
  };

  const startReview = async () => {
    try {
      const response = await fetch(
        `http://localhost:4000/api/v2/projects/${projectId}/review/start`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to start review');
      }

      // Fetch the newly created review
      await fetchReview();
    } catch (err) {
      console.error('Error starting review:', err);
      setError('Failed to start review');
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    try {
      setActionInProgress(true);
      setError(null);

      const response = await fetch(
        `http://localhost:4000/api/v2/projects/${projectId}/review/approve`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to approve curriculum');
      }

      await fetchReview();
      setActionInProgress(false);
    } catch (err) {
      console.error('Error approving curriculum:', err);
      setError('Failed to approve curriculum');
      setActionInProgress(false);
    }
  };

  const handleReject = async () => {
    try {
      if (!rejectionReason.trim()) {
        setError('Please provide a rejection reason');
        return;
      }

      setActionInProgress(true);
      setError(null);

      const response = await fetch(
        `http://localhost:4000/api/v2/projects/${projectId}/review/reject`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reason: rejectionReason }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to reject curriculum');
      }

      await fetchReview();
      setShowRejectModal(false);
      setActionInProgress(false);
    } catch (err) {
      console.error('Error rejecting curriculum:', err);
      setError('Failed to reject curriculum');
      setActionInProgress(false);
    }
  };

  const handlePublish = async () => {
    try {
      setActionInProgress(true);
      setError(null);

      const response = await fetch(`http://localhost:4000/api/v2/projects/${projectId}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lmsConfig: {
            lmsType: 'canvas',
            settings: {},
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to publish curriculum');
      }

      await fetchReview();
      setActionInProgress(false);
    } catch (err) {
      console.error('Error publishing curriculum:', err);
      setError('Failed to publish curriculum');
      setActionInProgress(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading review...</p>
        </div>
      </div>
    );
  }

  if (!review) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">No review found</p>
        </div>
      </div>
    );
  }

  const getStatusIcon = () => {
    switch (review.reviewStatus) {
      case 'approved':
        return <CheckCircle className="w-8 h-8 text-green-500" />;
      case 'rejected':
        return <XCircle className="w-8 h-8 text-red-500" />;
      default:
        return <Clock className="w-8 h-8 text-yellow-500" />;
    }
  };

  const getStatusText = () => {
    switch (review.reviewStatus) {
      case 'in_review':
        return 'Awaiting SME Review';
      case 'refinements_requested':
        return 'Refinements Requested';
      case 'approved':
        return review.publishedToLMS ? 'Published to LMS' : 'Approved - Ready for Publication';
      case 'rejected':
        return 'Rejected';
      default:
        return 'Unknown Status';
    }
  };

  const getStatusColor = () => {
    switch (review.reviewStatus) {
      case 'approved':
        return 'text-green-600';
      case 'rejected':
        return 'text-red-600';
      default:
        return 'text-yellow-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link
            href={`/projects/${projectId}`}
            className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Project
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Stage 5: Final SME Review & Publication
              </h1>
              <p className="mt-2 text-gray-600">
                Review and approve curriculum for LMS publication
              </p>
            </div>
            <div className="flex items-center space-x-3">
              {getStatusIcon()}
              <div>
                <div className="text-sm text-gray-600">Status</div>
                <div className={`text-lg font-semibold ${getStatusColor()}`}>{getStatusText()}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Review Status Card */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Review Status</h2>

          <div className="space-y-4">
            {/* SME Approval */}
            <div className="flex items-center justify-between pb-4 border-b">
              <div>
                <h3 className="font-semibold text-gray-900">SME Approval</h3>
                <p className="text-sm text-gray-600">
                  {review.smeApproval
                    ? `Approved on ${new Date(review.smeApproval.timestamp).toLocaleDateString()}`
                    : 'Pending SME review and approval'}
                </p>
              </div>
              {review.smeApproval ? (
                <CheckCircle className="w-6 h-6 text-green-500" />
              ) : (
                <Clock className="w-6 h-6 text-yellow-500" />
              )}
            </div>

            {/* Publication Approval */}
            <div className="flex items-center justify-between pb-4 border-b">
              <div>
                <h3 className="font-semibold text-gray-900">Publication Approval</h3>
                <p className="text-sm text-gray-600">
                  {review.publicationApproval
                    ? `Approved on ${new Date(review.publicationApproval.approvedAt).toLocaleDateString()}`
                    : 'Pending management approval for publication'}
                </p>
              </div>
              {review.publicationApproval ? (
                <CheckCircle className="w-6 h-6 text-green-500" />
              ) : (
                <Clock className="w-6 h-6 text-yellow-500" />
              )}
            </div>

            {/* LMS Publication */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">LMS Publication</h3>
                <p className="text-sm text-gray-600">
                  {review.publishedToLMS ? (
                    <>
                      Published on{' '}
                      {review.publishedAt && new Date(review.publishedAt).toLocaleDateString()}
                      <br />
                      <a
                        href={review.lmsCourseUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        View in LMS →
                      </a>
                    </>
                  ) : (
                    'Curriculum not yet published to LMS'
                  )}
                </p>
              </div>
              {review.publishedToLMS ? (
                <CheckCircle className="w-6 h-6 text-green-500" />
              ) : (
                <Clock className="w-6 h-6 text-gray-400" />
              )}
            </div>
          </div>
        </div>

        {/* Rejection Info (if rejected) */}
        {review.reviewStatus === 'rejected' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
            <h3 className="font-semibold text-red-900 mb-2">❌ Curriculum Rejected</h3>
            <p className="text-red-800 mb-2">
              <strong>Reason:</strong> {review.rejectionReason}
            </p>
            <p className="text-sm text-red-700">
              Rejected on {review.rejectedAt && new Date(review.rejectedAt).toLocaleDateString()}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        {review.reviewStatus === 'in_review' && !review.smeApproval && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-4">SME Review Actions</h3>
            <p className="text-gray-600 mb-6">
              Review the full curriculum package and either approve for publication or reject with
              feedback.
            </p>
            <div className="flex space-x-4">
              <button
                onClick={handleApprove}
                disabled={actionInProgress}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {actionInProgress ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <ThumbsUp className="w-5 h-5 mr-2" />
                    Approve Curriculum
                  </>
                )}
              </button>
              <button
                onClick={() => setShowRejectModal(true)}
                disabled={actionInProgress}
                className="flex-1 bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
              >
                <ThumbsDown className="w-5 h-5 mr-2" />
                Reject Curriculum
              </button>
            </div>
          </div>
        )}

        {/* Publish Button (if approved but not published) */}
        {review.reviewStatus === 'approved' && !review.publishedToLMS && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-4">🚀 Ready for Publication</h3>
            <p className="text-gray-600 mb-6">
              Curriculum has been approved. Click below to publish to the LMS.
            </p>
            <button
              onClick={handlePublish}
              disabled={actionInProgress}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {actionInProgress ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5 mr-2" />
                  Publish to LMS
                </>
              )}
            </button>
          </div>
        )}

        {/* Success Message (if published) */}
        {review.publishedToLMS && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <h3 className="font-semibold text-green-900 mb-2">✅ Successfully Published!</h3>
            <p className="text-green-800 mb-4">
              Curriculum has been published to the LMS and is now available to students.
            </p>
            <a
              href={review.lmsCourseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-green-700 hover:text-green-900 font-semibold"
            >
              View Course in LMS →
            </a>
          </div>
        )}
      </div>

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Reject Curriculum</h3>
            <p className="text-gray-600 mb-4">
              Please provide a reason for rejection. This will be shared with the curriculum team.
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 mb-4 min-h-[120px]"
              placeholder="Enter rejection reason..."
            />
            <div className="flex space-x-3">
              <button
                onClick={() => setShowRejectModal(false)}
                disabled={actionInProgress}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={actionInProgress || !rejectionReason.trim()}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg font-semibold hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {actionInProgress ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
