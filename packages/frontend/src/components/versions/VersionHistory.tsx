'use client';

import { useState } from 'react';
import { useVersionHistory, useRestoreVersion } from '@/hooks/useVersions';
import { CurriculumVersion } from '@/types/version';

interface VersionHistoryProps {
  programId: string;
  onCompare?: (v1: number, v2: number) => void;
}

export function VersionHistory({ programId, onCompare }: VersionHistoryProps) {
  const { data: versions, isLoading } = useVersionHistory(programId);
  const restoreVersion = useRestoreVersion();
  const [selectedVersions, setSelectedVersions] = useState<number[]>([]);

  const handleVersionSelect = (versionNumber: number) => {
    if (selectedVersions.includes(versionNumber)) {
      setSelectedVersions(selectedVersions.filter((v) => v !== versionNumber));
    } else if (selectedVersions.length < 2) {
      setSelectedVersions([...selectedVersions, versionNumber]);
    }
  };

  const handleCompare = () => {
    if (selectedVersions.length === 2 && onCompare) {
      onCompare(selectedVersions[0], selectedVersions[1]);
    }
  };

  const handleRestore = async (versionId: string) => {
    if (confirm('Are you sure you want to restore this version? This will create a new version.')) {
      try {
        await restoreVersion.mutateAsync({ programId, versionId });
        alert('Version restored successfully');
      } catch (error) {
        alert('Failed to restore version');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!versions || versions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-500">No version history available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {selectedVersions.length === 2 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex justify-between items-center">
          <p className="text-blue-800">
            Selected versions {selectedVersions[0]} and {selectedVersions[1]} for comparison
          </p>
          <button
            onClick={handleCompare}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Compare Versions
          </button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Select
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Version
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Author
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Changes
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {versions.map((version) => (
              <tr key={version.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={selectedVersions.includes(version.version_number)}
                    onChange={() => handleVersionSelect(version.version_number)}
                    disabled={
                      selectedVersions.length === 2 &&
                      !selectedVersions.includes(version.version_number)
                    }
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-medium text-gray-900">
                    v{version.version_number}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {version.author_email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(version.created_at).toLocaleString()}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {version.changes_summary || 'No description'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => handleRestore(version.id)}
                    disabled={restoreVersion.isPending}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    Restore
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
