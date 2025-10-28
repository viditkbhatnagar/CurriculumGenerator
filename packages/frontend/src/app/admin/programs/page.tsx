'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProgramList } from '@/components/programs/ProgramList';
import { BulkExportModal } from '@/components/export/BulkExportModal';
import { ProgramCreateModal } from '@/components/programs/ProgramCreateModal';

export default function ProgramsPage() {
  const router = useRouter();
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [showBulkExport, setShowBulkExport] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleProgramCreated = (programId: string) => {
    router.push(`/admin/programs/${programId}`);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Programs</h1>
        <div className="flex space-x-4">
          {selectedPrograms.length > 0 && (
            <button
              onClick={() => setShowBulkExport(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              📥 Export Selected ({selectedPrograms.length})
            </button>
          )}
          <button 
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Program
          </button>
        </div>
      </div>
      <ProgramList />
      <BulkExportModal
        programIds={selectedPrograms}
        isOpen={showBulkExport}
        onClose={() => setShowBulkExport(false)}
      />
      <ProgramCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleProgramCreated}
      />
    </div>
  );
}
