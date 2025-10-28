'use client';

import { SearchFilters } from '@/types/knowledgeBase';

interface FilterPanelProps {
  filters: SearchFilters;
  onFilterChange: (filters: SearchFilters) => void;
}

export function FilterPanel({ filters, onFilterChange }: FilterPanelProps) {
  const updateFilter = (key: keyof SearchFilters, value: string) => {
    onFilterChange({ ...filters, [key]: value || undefined });
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <h3 className="font-semibold text-gray-900 mb-4">Filters</h3>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Domain
        </label>
        <select
          value={filters.domain || ''}
          onChange={(e) => updateFilter('domain', e.target.value)}
          className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Domains</option>
          <option value="business-intelligence">Business Intelligence</option>
          <option value="data-science">Data Science</option>
          <option value="software-engineering">Software Engineering</option>
          <option value="project-management">Project Management</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Source Type
        </label>
        <select
          value={filters.source_type || ''}
          onChange={(e) => updateFilter('source_type', e.target.value)}
          className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Types</option>
          <option value="peer-reviewed">Peer-Reviewed</option>
          <option value="professional">Professional</option>
          <option value="textbook">Textbook</option>
          <option value="web">Web</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Date From
        </label>
        <input
          type="date"
          value={filters.date_from || ''}
          onChange={(e) => updateFilter('date_from', e.target.value)}
          className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Date To
        </label>
        <input
          type="date"
          value={filters.date_to || ''}
          onChange={(e) => updateFilter('date_to', e.target.value)}
          className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Min Credibility Score
        </label>
        <input
          type="number"
          min="0"
          max="100"
          value={filters.min_credibility || ''}
          onChange={(e) => updateFilter('min_credibility', e.target.value)}
          className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <button
        onClick={() => onFilterChange({})}
        className="w-full px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
      >
        Clear Filters
      </button>
    </div>
  );
}
