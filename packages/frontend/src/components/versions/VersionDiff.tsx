'use client';

import { useVersionComparison } from '@/hooks/useVersions';

interface VersionDiffProps {
  programId: string;
  version1: number;
  version2: number;
}

export function VersionDiff({ programId, version1, version2 }: VersionDiffProps) {
  const { data: diffs, isLoading } = useVersionComparison(programId, version1, version2);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!diffs || diffs.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-500">No differences found between versions</p>
      </div>
    );
  }

  const getChangeColor = (changeType: string) => {
    switch (changeType) {
      case 'added':
        return 'bg-green-50 border-green-200';
      case 'removed':
        return 'bg-red-50 border-red-200';
      case 'modified':
        return 'bg-yellow-50 border-yellow-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getChangeIcon = (changeType: string) => {
    switch (changeType) {
      case 'added':
        return '✅';
      case 'removed':
        return '❌';
      case 'modified':
        return '✏️';
      default:
        return '•';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Comparing v{version1} with v{version2}
      </h3>
      <div className="space-y-4">
        {diffs.map((diff, index) => (
          <div
            key={index}
            className={`border rounded-lg p-4 ${getChangeColor(diff.changeType)}`}
          >
            <div className="flex items-start">
              <span className="text-xl mr-3">{getChangeIcon(diff.changeType)}</span>
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 mb-2">
                  {diff.field}
                  <span className="ml-2 text-sm font-normal text-gray-600">
                    ({diff.changeType})
                  </span>
                </h4>
                <div className="space-y-2">
                  {diff.changeType !== 'added' && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Old Value:</p>
                      <pre className="text-sm text-gray-700 bg-white p-2 rounded border border-gray-200 overflow-x-auto">
                        {typeof diff.oldValue === 'object'
                          ? JSON.stringify(diff.oldValue, null, 2)
                          : diff.oldValue}
                      </pre>
                    </div>
                  )}
                  {diff.changeType !== 'removed' && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">New Value:</p>
                      <pre className="text-sm text-gray-700 bg-white p-2 rounded border border-gray-200 overflow-x-auto">
                        {typeof diff.newValue === 'object'
                          ? JSON.stringify(diff.newValue, null, 2)
                          : diff.newValue}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
