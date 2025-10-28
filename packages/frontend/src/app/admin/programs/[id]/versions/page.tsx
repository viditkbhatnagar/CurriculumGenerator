'use client';

import { useState } from 'react';
import Link from 'next/link';
import { VersionHistory } from '@/components/versions/VersionHistory';
import { VersionDiff } from '@/components/versions/VersionDiff';

export default function VersionsPage({ params }: { params: { id: string } }) {
  const [compareVersions, setCompareVersions] = useState<[number, number] | null>(null);

  const handleCompare = (v1: number, v2: number) => {
    setCompareVersions([v1, v2]);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <Link
          href={`/admin/programs/${params.id}`}
          className="text-blue-600 hover:text-blue-800"
        >
          ← Back to Program
        </Link>
        {compareVersions && (
          <button
            onClick={() => setCompareVersions(null)}
            className="text-gray-600 hover:text-gray-800"
          >
            Clear Comparison
          </button>
        )}
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-6">Version History</h1>

      {compareVersions ? (
        <VersionDiff
          programId={params.id}
          version1={compareVersions[0]}
          version2={compareVersions[1]}
        />
      ) : (
        <VersionHistory programId={params.id} onCompare={handleCompare} />
      )}
    </div>
  );
}
