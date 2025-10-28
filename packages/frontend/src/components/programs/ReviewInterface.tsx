'use client';

import { useState } from 'react';
import { useProgram, useUpdateProgramStatus, useSubmitFeedback } from '@/hooks/usePrograms';
import { ProgramStatus } from '@/types/program';

export function ReviewInterface({ programId }: { programId: string }) {
  const { data: program, isLoading } = useProgram(programId);
  const updateStatus = useUpdateProgramStatus();
  const submitFeedback = useSubmitFeedback();
  const [feedback, setFeedback] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<ProgramStatus>('under review');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (feedback.trim()) {
        await submitFeedback.mutateAsync({
          program_id: programId,
          reviewer_id: 'current-user-id', // TODO: Get from auth
          feedback_text: feedback,
        });
      }

      await updateStatus.mutateAsync({
        id: programId,
        status: selectedStatus,
      });

      setFeedback('');
      alert('Review submitted successfully');
    } catch (error) {
      alert('Failed to submit review');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!program) {
    return <div>Program not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Review: {program.program_name}
        </h2>
        <p className="text-gray-600 mb-4">
          Current Status: <span className="font-semibold">{program.status}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Feedback
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={6}
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Provide detailed feedback for the SME..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Update Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as ProgramStatus)}
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="under review">Under Review</option>
              <option value="approved">Approved</option>
            </select>
          </div>

          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateStatus.isPending || submitFeedback.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {updateStatus.isPending || submitFeedback.isPending
                ? 'Submitting...'
                : 'Submit Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
