'use client';

import { Resource } from '@/types/tutorBot';

interface SuggestedResourcesProps {
  resources: Resource[];
  onResourceClick: (resourceId: string) => void;
}

export function SuggestedResources({ resources, onResourceClick }: SuggestedResourcesProps) {
  const getResourceIcon = (type: string) => {
    switch (type) {
      case 'reading':
        return '📖';
      case 'video':
        return '🎥';
      case 'exercise':
        return '✏️';
      case 'module':
        return '📚';
      default:
        return '📄';
    }
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">Suggested Resources</h3>
      <div className="space-y-2">
        {resources.map((resource) => (
          <button
            key={resource.id}
            onClick={() => onResourceClick(resource.id)}
            className="w-full text-left bg-blue-50 hover:bg-blue-100 rounded-lg px-3 py-2 transition-colors"
          >
            <div className="flex items-start space-x-2">
              <span className="text-lg flex-shrink-0">{getResourceIcon(resource.type)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{resource.title}</p>
                <p className="text-xs text-gray-600 line-clamp-2">{resource.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
