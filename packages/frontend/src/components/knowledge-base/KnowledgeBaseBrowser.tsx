'use client';

import { useState } from 'react';
import { SearchBar } from './SearchBar';
import { FilterPanel } from './FilterPanel';
import { SourceCard } from './SourceCard';
import { useKnowledgeBaseSources, useSearchKnowledgeBase } from '@/hooks/useKnowledgeBase';
import { SearchFilters } from '@/types/knowledgeBase';

export function KnowledgeBaseBrowser() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});

  const { data: allSources, isLoading: loadingAll } = useKnowledgeBaseSources(filters);
  const { data: searchResults, isLoading: loadingSearch } = useSearchKnowledgeBase(
    searchQuery,
    filters
  );

  const sources = searchQuery ? searchResults : allSources;
  const isLoading = searchQuery ? loadingSearch : loadingAll;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-1">
        <FilterPanel filters={filters} onFilterChange={setFilters} />
      </div>

      <div className="lg:col-span-3 space-y-6">
        <SearchBar onSearch={setSearchQuery} />

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : sources && sources.length > 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Found {sources.length} source{sources.length !== 1 ? 's' : ''}
            </p>
            {sources.map((source) => (
              <SourceCard key={source.id} source={source} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">
              {searchQuery ? 'No sources found matching your search' : 'No sources available'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
