'use client';

import { useState } from 'react';
import { KnowledgeBaseSource } from '@/types/knowledgeBase';
import { useDeleteSource } from '@/hooks/useKnowledgeBase';

interface SourceCardProps {
  source: KnowledgeBaseSource;
}

export function SourceCard({ source }: SourceCardProps) {
  const [expanded, setExpanded] = useState(false);
  const deleteSource = useDeleteSource();

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this source?')) {
      try {
        await deleteSource.mutateAsync(source.id);
      } catch (error) {
        alert('Failed to delete source');
      }
    }
  };

  const getCredibilityColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 mb-2">
            {source.metadata?.title || 'Untitled'}
          </h3>
          <div className="flex flex-wrap gap-2 text-sm text-gray-600">
            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
              {source.domain}
            </span>
            <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded">
              {source.source_type}
            </span>
            <span className={`font-semibold ${getCredibilityColor(source.credibility_score)}`}>
              Credibility: {source.credibility_score}/100
            </span>
          </div>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleteSource.isPending}
          className="text-red-600 hover:text-red-800 text-sm"
        >
          Delete
        </button>
      </div>

      <div className="mb-4">
        <p className="text-sm text-gray-600">
          Published: {new Date(source.publication_date).toLocaleDateString()}
        </p>
        {source.source_url && (
          <a
            href={source.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline"
          >
            View Source →
          </a>
        )}
      </div>

      <div className="border-t border-gray-200 pt-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          {expanded ? 'Hide Content' : 'Show Content'}
        </button>
        {expanded && (
          <div className="mt-4 text-sm text-gray-700 max-h-64 overflow-y-auto">
            {source.content}
          </div>
        )}
      </div>
    </div>
  );
}
