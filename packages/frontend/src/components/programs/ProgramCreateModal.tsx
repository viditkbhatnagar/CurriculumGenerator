'use client';

import { ProgramCreateForm } from './ProgramCreateForm';

interface ProgramCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (programId: string) => void;
}

export function ProgramCreateModal({ isOpen, onClose, onSuccess }: ProgramCreateModalProps) {
  if (!isOpen) return null;

  const handleSuccess = (programId: string) => {
    if (onSuccess) {
      onSuccess(programId);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        ></div>

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          <div className="bg-white px-6 pt-6 pb-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Create New Program</h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500 focus:outline-none"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Enter the basic details for your new program. You'll be able to upload the detailed curriculum data in the next step.
            </p>
          </div>

          <div className="px-6 pb-6">
            <ProgramCreateForm onSuccess={handleSuccess} onCancel={onClose} />
          </div>
        </div>
      </div>
    </div>
  );
}
