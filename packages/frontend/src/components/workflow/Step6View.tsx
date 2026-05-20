'use client';

import { useState, useEffect } from 'react';
import { useSubmitStep6, useApproveStep6 } from '@/hooks/useWorkflow';
import { api } from '@/lib/api';
import {
  CurriculumWorkflow,
  ReadingItem,
  ModuleReadingSummary,
  ReadingComplexity,
} from '@/types/workflow';
import { useGeneration, GenerationProgressBar } from '@/contexts/GenerationContext';
import { useStepStatus } from '@/hooks/useStepStatus';
import { EditTarget } from './EditWithAIButton';
import StepDownloadButton from './StepDownloadButton';

interface Props {
  workflow: CurriculumWorkflow;
  onComplete: () => void;
  onRefresh: () => void;
  onOpenCanvas?: (target: EditTarget) => void;
}

// Complexity colors
const COMPLEXITY_COLORS: Record<ReadingComplexity, string> = {
  introductory: 'bg-green-500/20 text-green-400',
  intermediate: 'bg-amber-500/20 text-amber-400',
  advanced: 'bg-red-500/20 text-red-400',
};

// Format minutes to hours and minutes
function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

// Content type labels and colors
const CONTENT_TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  textbook_chapter: {
    label: 'Textbook Chapter',
    icon: '📖',
    color: 'bg-blue-500/20 text-blue-400',
  },
  journal_article: {
    label: 'Journal Article',
    icon: '📄',
    color: 'bg-purple-500/20 text-purple-400',
  },
  online_article: { label: 'Online Article', icon: '🌐', color: 'bg-cyan-500/20 text-cyan-400' },
  report: { label: 'Report', icon: '📊', color: 'bg-amber-500/20 text-amber-400' },
  case_study: { label: 'Case Study', icon: '💼', color: 'bg-emerald-500/20 text-emerald-400' },
  video: { label: 'Video', icon: '🎬', color: 'bg-red-500/20 text-red-400' },
  other: { label: 'Resource', icon: '📁', color: 'bg-teal-400/20 text-teal-600' },
};

const READING_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  academic: { label: 'Academic', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' },
  applied: { label: 'Applied', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  industry: { label: 'Industry', color: 'bg-teal-500/20 text-teal-400 border-teal-500/30' },
};

// Reading Edit Modal Component
function ReadingEditModal({
  reading,
  onSave,
  onCancel,
  isSaving,
}: {
  reading: ReadingItem;
  onSave: (updatedReading: ReadingItem) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [title, setTitle] = useState(reading.title || '');
  const [authors, setAuthors] = useState<string[]>(reading.authors || []);
  const [year, setYear] = useState(reading.year || new Date().getFullYear());
  const [citation, setCitation] = useState(reading.citation || '');
  const [doi, setDoi] = useState(reading.doi || '');
  const [url, setUrl] = useState(reading.url || '');
  const [category, setCategory] = useState<'core' | 'supplementary'>(reading.category || 'core');
  const [contentType, setContentType] = useState(reading.contentType || 'textbook_chapter');
  const [readingType, setReadingType] = useState<'academic' | 'applied' | 'industry'>(
    reading.readingType || 'academic'
  );
  const [complexity, setComplexity] = useState<ReadingComplexity>(
    reading.complexity || 'intermediate'
  );
  const [estimatedReadingMinutes, setEstimatedReadingMinutes] = useState(
    reading.estimatedReadingMinutes || 0
  );
  const [specificChapters, setSpecificChapters] = useState(reading.specificChapters || '');
  const [pageRange, setPageRange] = useState(reading.pageRange || '');
  const [sectionNames, setSectionNames] = useState<string[]>(reading.sectionNames || []);
  const [notes, setNotes] = useState(reading.notes || '');
  const [suggestedWeek, setSuggestedWeek] = useState(reading.suggestedWeek || '');
  const [linkedMLOs, setLinkedMLOs] = useState<string[]>(reading.linkedMLOs || []);
  const [assessmentRelevance, setAssessmentRelevance] = useState<'high' | 'medium' | 'low'>(
    reading.assessmentRelevance || 'medium'
  );
  const [authorsInput, setAuthorsInput] = useState('');
  const [sectionInput, setSectionInput] = useState('');
  const [mloInput, setMloInput] = useState('');

  const handleSave = () => {
    onSave({
      ...reading,
      title,
      authors,
      year,
      citation,
      doi,
      url,
      category,
      contentType,
      readingType,
      complexity,
      estimatedReadingMinutes,
      specificChapters,
      pageRange,
      sectionNames,
      notes,
      suggestedWeek,
      linkedMLOs,
      assessmentRelevance,
    });
  };

  const addAuthor = () => {
    if (authorsInput.trim()) {
      setAuthors([...authors, authorsInput.trim()]);
      setAuthorsInput('');
    }
  };

  const removeAuthor = (index: number) => {
    setAuthors(authors.filter((_, i) => i !== index));
  };

  const addSection = () => {
    if (sectionInput.trim()) {
      setSectionNames([...sectionNames, sectionInput.trim()]);
      setSectionInput('');
    }
  };

  const removeSection = (index: number) => {
    setSectionNames(sectionNames.filter((_, i) => i !== index));
  };

  const addMLO = () => {
    if (mloInput.trim()) {
      setLinkedMLOs([...linkedMLOs, mloInput.trim()]);
      setMloInput('');
    }
  };

  const removeMLO = (index: number) => {
    setLinkedMLOs(linkedMLOs.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 bg-teal-900/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl border border-teal-200 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-teal-200">
          <h3 className="text-lg font-semibold text-teal-800 flex items-center gap-2">
            Edit <span className="text-blue-400">Reading Item</span>
          </h3>
        </div>

        <div className="p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-blue-500"
              placeholder="Enter reading title..."
            />
          </div>

          {/* Authors */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">Authors</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={authorsInput}
                onChange={(e) => setAuthorsInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAuthor())}
                className="flex-1 px-4 py-2 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-blue-500"
                placeholder="Add an author..."
              />
              <button
                type="button"
                onClick={addAuthor}
                className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors"
              >
                Add
              </button>
            </div>
            {authors.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {authors.map((author, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-sm flex items-center gap-2"
                  >
                    {author}
                    <button
                      type="button"
                      onClick={() => removeAuthor(i)}
                      className="text-teal-500 hover:text-red-400"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Year and Category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-teal-700 mb-2">Year</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value) || new Date().getFullYear())}
                className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-teal-700 mb-2">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as 'core' | 'supplementary')}
                className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 focus:outline-none focus:border-blue-500"
              >
                <option value="core">Core</option>
                <option value="supplementary">Supplementary</option>
              </select>
            </div>
          </div>

          {/* Content Type and Reading Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-teal-700 mb-2">Content Type</label>
              <select
                value={contentType}
                onChange={(e) => setContentType(e.target.value as any)}
                className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 focus:outline-none focus:border-blue-500"
              >
                {Object.entries(CONTENT_TYPE_CONFIG).map(([value, config]) => (
                  <option key={value} value={value}>
                    {config.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-teal-700 mb-2">Reading Type</label>
              <select
                value={readingType}
                onChange={(e) =>
                  setReadingType(e.target.value as 'academic' | 'applied' | 'industry')
                }
                className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 focus:outline-none focus:border-blue-500"
              >
                <option value="academic">Academic</option>
                <option value="applied">Applied</option>
                <option value="industry">Industry</option>
              </select>
            </div>
          </div>

          {/* Complexity and Reading Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-teal-700 mb-2">Complexity</label>
              <select
                value={complexity}
                onChange={(e) => setComplexity(e.target.value as ReadingComplexity)}
                className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 focus:outline-none focus:border-blue-500"
              >
                <option value="introductory">Introductory</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-teal-700 mb-2">
                Reading Time (minutes)
              </label>
              <input
                type="number"
                value={estimatedReadingMinutes}
                onChange={(e) => setEstimatedReadingMinutes(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Specific Assignment Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-teal-700 mb-2">
                Specific Chapters
              </label>
              <input
                type="text"
                value={specificChapters}
                onChange={(e) => setSpecificChapters(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-blue-500"
                placeholder="e.g., Chapter 1: Introduction"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-teal-700 mb-2">Page Range</label>
              <input
                type="text"
                value={pageRange}
                onChange={(e) => setPageRange(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-blue-500"
                placeholder="e.g., pp. 17-24"
              />
            </div>
          </div>

          {/* Section Names */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">Section Names</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={sectionInput}
                onChange={(e) => setSectionInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSection())}
                className="flex-1 px-4 py-2 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-blue-500"
                placeholder="Add a section name..."
              />
              <button
                type="button"
                onClick={addSection}
                className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors"
              >
                Add
              </button>
            </div>
            {sectionNames.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {sectionNames.map((section, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-sm flex items-center gap-2"
                  >
                    {section}
                    <button
                      type="button"
                      onClick={() => removeSection(i)}
                      className="text-teal-500 hover:text-red-400"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Suggested Week and Assessment Relevance */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-teal-700 mb-2">Suggested Week</label>
              <input
                type="text"
                value={suggestedWeek}
                onChange={(e) => setSuggestedWeek(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-blue-500"
                placeholder="e.g., Week 1-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-teal-700 mb-2">
                Assessment Relevance
              </label>
              <select
                value={assessmentRelevance}
                onChange={(e) =>
                  setAssessmentRelevance(e.target.value as 'high' | 'medium' | 'low')
                }
                className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 focus:outline-none focus:border-blue-500"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          {/* Linked MLOs */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">Linked MLOs</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={mloInput}
                onChange={(e) => setMloInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addMLO())}
                className="flex-1 px-4 py-2 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-blue-500"
                placeholder="Add an MLO..."
              />
              <button
                type="button"
                onClick={addMLO}
                className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors"
              >
                Add
              </button>
            </div>
            {linkedMLOs.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {linkedMLOs.map((mlo, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-sm flex items-center gap-2"
                  >
                    {mlo}
                    <button
                      type="button"
                      onClick={() => removeMLO(i)}
                      className="text-teal-500 hover:text-red-400"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Citation */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">Citation</label>
            <textarea
              value={citation}
              onChange={(e) => setCitation(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-blue-500 resize-none"
              placeholder="Enter APA citation..."
            />
          </div>

          {/* DOI and URL */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-teal-700 mb-2">DOI</label>
              <input
                type="text"
                value={doi}
                onChange={(e) => setDoi(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-blue-500"
                placeholder="10.1000/example"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-teal-700 mb-2">URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-blue-500"
                placeholder="https://..."
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-blue-500 resize-none"
              placeholder="Additional notes..."
            />
          </div>
        </div>

        <div className="p-6 border-t border-teal-200 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="px-5 py-2.5 text-teal-600 hover:text-teal-600 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !title.trim()}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-teal-800 font-medium rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Reading Add Modal — compact form for SMEs to drop in a source the AI
// pipeline didn't surface. Mirrors ReadingEditModal's styling but only
// asks for what's needed; backend fills sensible defaults for the rest.
function ReadingAddModal({
  moduleOptions,
  defaultModuleId,
  onSave,
  onCancel,
  isSaving,
}: {
  moduleOptions: Array<{ id: string; code: string; title: string }>;
  defaultModuleId: string;
  onSave: (payload: {
    moduleId: string;
    title: string;
    authors: string[];
    year: number;
    category: 'core' | 'supplementary';
    contentType: string;
    readingType: 'academic' | 'applied' | 'industry';
    estimatedReadingMinutes: number;
    url?: string;
    doi?: string;
    specificChapters?: string;
    pageRange?: string;
    notes?: string;
  }) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [moduleId, setModuleId] = useState(defaultModuleId);
  const [title, setTitle] = useState('');
  const [authors, setAuthors] = useState<string[]>([]);
  const [authorsInput, setAuthorsInput] = useState('');
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [category, setCategory] = useState<'core' | 'supplementary'>('core');
  const [contentType, setContentType] = useState<string>('textbook_chapter');
  const [readingType, setReadingType] = useState<'academic' | 'applied' | 'industry'>('academic');
  const [estimatedReadingMinutes, setEstimatedReadingMinutes] = useState<number>(60);
  const [url, setUrl] = useState('');
  const [doi, setDoi] = useState('');
  const [specificChapters, setSpecificChapters] = useState('');
  const [pageRange, setPageRange] = useState('');
  const [notes, setNotes] = useState('');

  const addAuthor = () => {
    const v = authorsInput.trim();
    if (v) {
      setAuthors([...authors, v]);
      setAuthorsInput('');
    }
  };
  const removeAuthor = (i: number) => setAuthors(authors.filter((_, ix) => ix !== i));

  // Authors are optional — a webpage / video reading often has no clear
  // author, and requiring one blocked SMEs from adding plain links.
  // Only title / module / year gate the save.
  const canSave = title.trim().length > 0 && !!moduleId && year >= 1800;

  const handleSave = () => {
    if (!canSave) return;
    // Fold any pending (un-"Add"ed) author text in so it isn't lost.
    const pending = authorsInput.trim();
    const finalAuthors = pending ? [...authors, pending] : authors;
    onSave({
      moduleId,
      title: title.trim(),
      authors: finalAuthors,
      year,
      category,
      contentType,
      readingType,
      estimatedReadingMinutes,
      url: url.trim() || undefined,
      doi: doi.trim() || undefined,
      specificChapters: specificChapters.trim() || undefined,
      pageRange: pageRange.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-teal-900/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl border border-teal-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-teal-200">
          <h3 className="text-lg font-semibold text-teal-800 flex items-center gap-2">
            Add reading
            <span className="text-xs font-normal text-teal-500">
              (manual — bypasses AGI compliance checks)
            </span>
          </h3>
        </div>

        <div className="p-6 space-y-5">
          {/* Module + Category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-teal-700 mb-2">Module</label>
              <select
                value={moduleId}
                onChange={(e) => setModuleId(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 focus:outline-none focus:border-blue-500"
              >
                {moduleOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.code} — {m.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-teal-700 mb-2">Category</label>
              <div className="grid grid-cols-2 gap-2">
                {(['core', 'supplementary'] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={`py-2 px-3 rounded-lg border text-sm capitalize transition-all ${
                      category === c
                        ? c === 'core'
                          ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                          : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        : 'bg-white border-teal-300 text-teal-600 hover:border-teal-400'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-blue-500"
              placeholder="e.g. Retailing Management"
              autoFocus
            />
          </div>

          {/* Authors */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">
              Authors (optional)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={authorsInput}
                onChange={(e) => setAuthorsInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAuthor())}
                className="flex-1 px-4 py-2 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-blue-500"
                placeholder="Add an author and press Enter (e.g. Levy, M.)"
              />
              <button
                type="button"
                onClick={addAuthor}
                className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors"
              >
                Add
              </button>
            </div>
            {authors.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {authors.map((a, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-sm flex items-center gap-2"
                  >
                    {a}
                    <button
                      type="button"
                      onClick={() => removeAuthor(i)}
                      className="text-teal-500 hover:text-red-400"
                      aria-label={`Remove ${a}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Year + Content type + Reading type */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-teal-700 mb-2">Year</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value) || new Date().getFullYear())}
                className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-teal-700 mb-2">Content type</label>
              <select
                value={contentType}
                onChange={(e) => setContentType(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 focus:outline-none focus:border-blue-500"
              >
                <option value="textbook_chapter">Textbook chapter</option>
                <option value="journal_article">Journal article</option>
                <option value="online_article">Online article</option>
                <option value="report">Report</option>
                <option value="case_study">Case study</option>
                <option value="video">Video</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-teal-700 mb-2">Reading type</label>
              <select
                value={readingType}
                onChange={(e) =>
                  setReadingType(e.target.value as 'academic' | 'applied' | 'industry')
                }
                className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 focus:outline-none focus:border-blue-500"
              >
                <option value="academic">Academic</option>
                <option value="applied">Applied</option>
                <option value="industry">Industry</option>
              </select>
            </div>
          </div>

          {/* URL / DOI */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-teal-700 mb-2">URL (optional)</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-blue-500"
                placeholder="https://…"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-teal-700 mb-2">DOI (optional)</label>
              <input
                type="text"
                value={doi}
                onChange={(e) => setDoi(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-blue-500"
                placeholder="10.…"
              />
            </div>
          </div>

          {/* Chapters / Pages / Minutes */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-teal-700 mb-2">
                Chapters (optional)
              </label>
              <input
                type="text"
                value={specificChapters}
                onChange={(e) => setSpecificChapters(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-blue-500"
                placeholder="e.g. Chapters 1-4"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-teal-700 mb-2">
                Page range (optional)
              </label>
              <input
                type="text"
                value={pageRange}
                onChange={(e) => setPageRange(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-blue-500"
                placeholder="pp. 17-58"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-teal-700 mb-2">Read minutes</label>
              <input
                type="number"
                value={estimatedReadingMinutes}
                onChange={(e) => setEstimatedReadingMinutes(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-blue-500 resize-none"
              placeholder="Why this source belongs on the list"
            />
          </div>
        </div>

        <div className="p-6 border-t border-teal-200 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="px-5 py-2.5 text-teal-600 hover:text-teal-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !canSave}
            className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Adding…
              </>
            ) : (
              'Add reading'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Reading Item Card
function ReadingCard({
  reading,
  onEdit,
  onDelete,
}: {
  reading: ReadingItem;
  onEdit?: (reading: ReadingItem) => void;
  onDelete?: (reading: ReadingItem) => void;
}) {
  const [_expanded, _setExpanded] = useState(false);
  const contentConfig =
    CONTENT_TYPE_CONFIG[(reading as any).contentType] || CONTENT_TYPE_CONFIG.other;
  const readingTypeConfig =
    READING_TYPE_CONFIG[(reading as any).readingType] || READING_TYPE_CONFIG.academic;

  return (
    <div
      className={`rounded-lg border overflow-hidden group ${
        reading.category === 'core'
          ? 'bg-cyan-500/5 border-cyan-500/30'
          : 'bg-teal-50/50 border-teal-200'
      }`}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span
                className={`text-xs px-2 py-0.5 rounded font-medium ${
                  reading.category === 'core'
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'bg-teal-100 text-teal-600'
                }`}
              >
                {reading.category === 'core' ? '📘 Core' : '📙 Supplementary'}
              </span>
              {/* Content Type Badge */}
              <span className={`text-xs px-2 py-0.5 rounded ${contentConfig.color}`}>
                {contentConfig.icon} {contentConfig.label}
              </span>
              {/* Reading Type Badge (Academic/Applied/Industry) */}
              <span className={`text-xs px-2 py-0.5 rounded border ${readingTypeConfig.color}`}>
                {readingTypeConfig.label}
              </span>
              {reading.suggestedWeek && (
                <span className="text-xs text-teal-500">{reading.suggestedWeek}</span>
              )}
              {/* SME-added marker — reviewers can spot at a glance which
                  entries bypassed the AGI compliance pipeline. */}
              {(reading as any).userAdded && (
                <span
                  className="text-xs px-2 py-0.5 rounded border border-amber-400 text-amber-700 bg-amber-50"
                  title="Added manually — skips AGI compliance checks"
                >
                  Added manually
                </span>
              )}
            </div>
            <h4 className="text-teal-800 font-medium">{reading.title}</h4>
            <p className="text-sm text-teal-600">
              {reading.authors?.join(', ')} ({reading.year})
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-cyan-400 font-semibold">
              {formatTime(reading.estimatedReadingMinutes)}
            </p>
            <span
              className={`text-xs px-2 py-0.5 rounded ${COMPLEXITY_COLORS[reading.complexity]}`}
            >
              {reading.complexity}
            </span>
          </div>
        </div>

        {/* Specific Assignment - Enhanced with chapter, pages, sections */}
        {(reading.specificChapters ||
          reading.pageRange ||
          (reading as any).sectionNames?.length > 0) && (
          <div className="mb-2 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded">
            <p className="text-xs text-emerald-400 font-medium mb-1">📖 What to Read:</p>
            {reading.specificChapters && (
              <p className="text-sm text-emerald-300">{reading.specificChapters}</p>
            )}
            {reading.pageRange && (
              <p className="text-xs text-emerald-400/80">Pages: {reading.pageRange}</p>
            )}
            {(reading as any).sectionNames?.length > 0 && (
              <p className="text-xs text-emerald-400/80 mt-1">
                Sections: {(reading as any).sectionNames.join(', ')}
              </p>
            )}
          </div>
        )}

        {/* Citation */}
        <p className="text-xs text-teal-500 font-mono bg-teal-50 p-2 rounded">{reading.citation}</p>

        {/* Clickable Links */}
        {(reading.doi || reading.url) && (
          <div className="flex gap-2 mt-2">
            {reading.doi && (
              <a
                href={
                  reading.doi.startsWith('http') ? reading.doi : `https://doi.org/${reading.doi}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
                DOI
              </a>
            )}
            {reading.url && (
              <a
                href={reading.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded hover:bg-cyan-500/30"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
                Open Link
              </a>
            )}
          </div>
        )}

        {/* MLO Links (for Core) */}
        {reading.category === 'core' && reading.linkedMLOs && reading.linkedMLOs.length > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-teal-500">Supports:</span>
            {reading.linkedMLOs.map((mlo) => (
              <span key={mlo} className="text-xs px-1.5 py-0.5 bg-teal-100 rounded text-cyan-400">
                {mlo}
              </span>
            ))}
            {reading.assessmentRelevance === 'high' && (
              <span className="text-xs text-emerald-400">| Assessment: High</span>
            )}
          </div>
        )}

        {/* AGI Compliance Badges */}
        {reading.complianceBadges && (
          <div className="mt-2 flex flex-wrap gap-1">
            {reading.complianceBadges.peerReviewed && (
              <span className="text-xs px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                ✓ Peer-Reviewed
              </span>
            )}
            {reading.complianceBadges.academicText && (
              <span className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                ✓ Academic Text
              </span>
            )}
            {reading.complianceBadges.recent && (
              <span className="text-xs px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">
                ✓ Recent
              </span>
            )}
            {reading.complianceBadges.verifiedAccess && (
              <span className="text-xs px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 rounded">
                ✓ Verified Access
              </span>
            )}
          </div>
        )}

        {/* Edit + Delete */}
        {(onEdit || onDelete) && (
          <div className="mt-2 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
            {onEdit && (
              <button
                onClick={() => onEdit(reading)}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Edit
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(reading)}
                className="text-xs text-rose-500 hover:text-rose-600 transition-colors"
                title="Remove this reading from the list"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>

      {/* Reference Note */}
      {reading.isReference && reading.originalModuleId && (
        <div className="px-4 pb-3 text-xs text-teal-500">
          → See {reading.originalModuleId} for full entry
        </div>
      )}
    </div>
  );
}

// Module Reading Summary Card
function ModuleSummaryCard({ summary }: { summary: ModuleReadingSummary }) {
  const isTimeValid = summary.readingTimePercent <= 100;
  const isCoreValid = summary.coreCount >= 3 && summary.coreCount <= 6;
  const isSupplementaryValid = summary.supplementaryCount >= 4 && summary.supplementaryCount <= 8;

  return (
    <div
      className={`bg-teal-50/50 rounded-lg p-4 border ${
        summary.agiCompliant && isTimeValid ? 'border-emerald-500/30' : 'border-amber-500/30'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-teal-800 font-medium">{summary.moduleTitle}</h4>
        <span
          className={`text-xs px-2 py-1 rounded ${
            summary.agiCompliant
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-amber-500/20 text-amber-400'
          }`}
        >
          {summary.agiCompliant ? '✓ Valid' : '⚠ Review'}
        </span>
      </div>

      {/* Counts */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div
          className={`text-center p-2 rounded ${isCoreValid ? 'bg-cyan-500/10' : 'bg-red-500/10'}`}
        >
          <p className={`text-lg font-bold ${isCoreValid ? 'text-cyan-400' : 'text-red-400'}`}>
            {summary.coreCount}
          </p>
          <p className="text-xs text-teal-500">Core (3-6)</p>
        </div>
        <div
          className={`text-center p-2 rounded ${isSupplementaryValid ? 'bg-amber-500/10' : 'bg-red-500/10'}`}
        >
          <p
            className={`text-lg font-bold ${isSupplementaryValid ? 'text-amber-400' : 'text-red-400'}`}
          >
            {summary.supplementaryCount}
          </p>
          <p className="text-xs text-teal-500">Supplementary (4-8)</p>
        </div>
      </div>

      {/* Time Allocation */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-teal-600">Core reading:</span>
          <span className="text-cyan-400">{formatTime(summary.coreReadingMinutes)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-teal-600">Supplementary:</span>
          <span className="text-amber-400">{formatTime(summary.supplementaryReadingMinutes)}</span>
        </div>
        <div className="flex justify-between text-xs font-medium border-t border-teal-200 pt-1 mt-1">
          <span className="text-teal-700">Total:</span>
          <span className={isTimeValid ? 'text-emerald-400' : 'text-red-400'}>
            {formatTime(summary.totalReadingMinutes)} /{' '}
            {formatTime(summary.independentStudyMinutes)}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-2">
        <div className="h-2 bg-teal-100 rounded-full overflow-hidden">
          <div
            className={`h-full ${isTimeValid ? 'bg-emerald-500' : 'bg-red-500'}`}
            style={{ width: `${Math.min(summary.readingTimePercent, 100)}%` }}
          />
        </div>
        <p className={`text-xs text-right mt-1 ${isTimeValid ? 'text-teal-500' : 'text-red-400'}`}>
          {summary.readingTimePercent}% of independent study
        </p>
      </div>

      {/* Validation Indicators */}
      <div className="mt-2 pt-2 border-t border-teal-200 flex gap-2 text-xs">
        <span className={summary.allCoreMapToMLO ? 'text-emerald-400' : 'text-amber-400'}>
          {summary.allCoreMapToMLO ? '✓' : '⚠'} MLO mapped
        </span>
        <span className={summary.academicAppliedBalance ? 'text-emerald-400' : 'text-amber-400'}>
          {summary.academicAppliedBalance ? '✓' : '⚠'} Balanced
        </span>
      </div>
    </div>
  );
}

export default function Step6View({ workflow, onComplete, onRefresh }: Props) {
  const submitStep6 = useSubmitStep6();
  const approveStep6 = useApproveStep6();
  const [error, setError] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const { startGeneration, completeGeneration, failGeneration, isGenerating } = useGeneration();

  // Background job polling for Step 6
  const {
    status: stepStatus,
    startPolling,
    isPolling,
    isGenerationActive: isQueueActive,
  } = useStepStatus(workflow._id, 6, {
    pollInterval: 10000,
    autoStart: true,
    onComplete: () => {
      completeGeneration(workflow._id, 6);
      onRefresh();
    },
    onFailed: (err) => {
      failGeneration(workflow._id, 6, err);
      setError(err);
    },
  });

  // Edit state for reading items
  const [editingReading, setEditingReading] = useState<ReadingItem | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  // Add-reading modal state
  const [addingReading, setAddingReading] = useState(false);
  const [isAddingReading, setIsAddingReading] = useState(false);
  // Inline toast for add / delete (auto-dismisses after 3.5s)
  const [readingToast, setReadingToast] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  useEffect(() => {
    if (!readingToast) return;
    const t = setTimeout(() => setReadingToast(null), 3500);
    return () => clearTimeout(t);
  }, [readingToast]);

  const isCurrentlyGenerating =
    isGenerating(workflow._id, 6) || submitStep6.isPending || isPolling || isQueueActive;

  // Check for completion when data appears
  useEffect(() => {
    if (
      workflow.step6 &&
      (workflow.step6.readings?.length > 0 || workflow.step6.totalReadings > 0)
    ) {
      completeGeneration(workflow._id, 6);
    }
  }, [workflow.step6, workflow._id, completeGeneration]);

  const handleGenerate = async () => {
    setError(null);
    startGeneration(workflow._id, 6, 60);
    try {
      const response = await submitStep6.mutateAsync(workflow._id);
      if ((response as any)?.data?.jobId) {
        startPolling();
      } else {
        completeGeneration(workflow._id, 6);
        onRefresh();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate reading lists';
      console.error('Failed to generate reading lists:', err);
      failGeneration(workflow._id, 6, errorMessage);
      setError(errorMessage);
    }
  };

  const handleApprove = async () => {
    setError(null);
    try {
      await approveStep6.mutateAsync(workflow._id);
      onComplete();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to approve Step 6';
      console.error('Failed to approve Step 6:', err);
      setError(errorMessage);
    }
  };

  // Handle editing a reading item
  const handleEditReading = (reading: ReadingItem) => {
    setEditingReading(reading);
  };

  // Handle saving edited reading item
  const handleSaveReading = async (updatedReading: ReadingItem) => {
    setIsSavingEdit(true);
    setError(null);

    console.log('Saving reading item:', updatedReading);
    console.log('Workflow ID:', workflow._id);
    console.log('Reading ID:', updatedReading.id);

    try {
      const response = await api.put(
        `/api/v3/workflow/${workflow._id}/step6/reading/${updatedReading.id}`,
        {
          title: updatedReading.title,
          authors: updatedReading.authors,
          year: updatedReading.year,
          citation: updatedReading.citation,
          doi: updatedReading.doi,
          url: updatedReading.url,
          category: updatedReading.category,
          contentType: updatedReading.contentType,
          readingType: updatedReading.readingType,
          complexity: updatedReading.complexity,
          estimatedReadingMinutes: updatedReading.estimatedReadingMinutes,
          specificChapters: updatedReading.specificChapters,
          pageRange: updatedReading.pageRange,
          sectionNames: updatedReading.sectionNames,
          notes: updatedReading.notes,
          suggestedWeek: updatedReading.suggestedWeek,
          linkedMLOs: updatedReading.linkedMLOs,
          assessmentRelevance: updatedReading.assessmentRelevance,
        }
      );

      console.log('Save response:', response.data);

      // Close modal first
      setEditingReading(null);

      // Force refresh the workflow data
      console.log('Refreshing workflow data...');
      await onRefresh();
      console.log('Refresh complete');
    } catch (err: any) {
      console.error('Failed to save reading item:', err);
      console.error('Error response:', err.response?.data);
      setError(err.response?.data?.error || err.message || 'Failed to save changes');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Handle canceling reading edit
  const handleCancelReadingEdit = () => {
    setEditingReading(null);
  };

  // Add reading — POSTs to the new /step6/reading route. Backend builds
  // the full ReadingItem with userAdded=true; we just refresh + toast.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleAddReading = async (payload: any) => {
    setIsAddingReading(true);
    setError(null);
    try {
      await api.post(`/api/v3/workflow/${workflow._id}/step6/reading`, payload);
      setAddingReading(false);
      await onRefresh();
      setReadingToast({ type: 'success', text: 'Reading added' });
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to add reading';
      setError(msg);
      setReadingToast({ type: 'error', text: msg });
    } finally {
      setIsAddingReading(false);
    }
  };

  // Delete reading — confirmed in-line, hits DELETE /step6/reading/:id.
  const handleDeleteReading = async (reading: ReadingItem) => {
    if (!confirm(`Remove "${reading.title}" from the reading list?`)) return;
    setError(null);
    try {
      await api.delete(`/api/v3/workflow/${workflow._id}/step6/reading/${reading.id}`);
      await onRefresh();
      setReadingToast({ type: 'success', text: 'Reading removed' });
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to remove reading';
      setError(msg);
      setReadingToast({ type: 'error', text: msg });
    }
  };

  const hasStep6Data =
    workflow.step6 && (workflow.step6.readings?.length > 0 || workflow.step6.totalReadings > 0);
  const isApproved = !!workflow.step6?.approvedAt;
  const validation = workflow.step6?.validationReport;

  // Get readings for selected module or all
  const displayedReadings =
    selectedModule && workflow.step6?.moduleReadings
      ? workflow.step6.moduleReadings[selectedModule] || []
      : workflow.step6?.readings || [];

  // Separate core and supplementary
  const coreReadings = displayedReadings.filter((r) => r.category === 'core');
  const supplementaryReadings = displayedReadings.filter((r) => r.category === 'supplementary');

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Show generating state even when navigating back */}
      {isCurrentlyGenerating && !hasStep6Data && (
        <div className="mb-6 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/30 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <div>
              <h3 className="text-lg font-semibold text-teal-800">Generating Reading Lists...</h3>
              <p className="text-sm text-teal-600">
                This may take a minute. You can navigate away and come back.
              </p>
            </div>
          </div>
          <GenerationProgressBar
            workflowId={workflow._id}
            step={6}
            queueStatus={stepStatus?.status}
          />
        </div>
      )}

      {!hasStep6Data && !isCurrentlyGenerating ? (
        // Generation Form
        <div className="space-y-6">
          {/* About This Step */}
          <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/30 rounded-xl p-5">
            <h3 className="text-blue-400 font-semibold mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
              Step 6: Indicative & Additional Reading Lists
            </h3>
            <p className="text-sm text-teal-700 mb-4">
              Transform your AGI-validated sources into structured reading lists with
              <strong className="text-cyan-400"> Core (Indicative)</strong> and
              <strong className="text-amber-400"> Supplementary (Additional)</strong>{' '}
              classifications, effort estimates, and scheduling.
            </p>

            {/* Classification Guide */}
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="bg-cyan-500/10 rounded-lg p-3 border border-cyan-500/20">
                <p className="text-cyan-400 font-medium mb-2">📘 Core Reading (3-6 per module)</p>
                <ul className="text-xs text-teal-600 space-y-1">
                  <li>• Essential for meeting MLOs</li>
                  <li>• Required for assessment preparation</li>
                  <li>• Foundation of module content</li>
                  <li>• Must map to ≥1 MLO</li>
                </ul>
              </div>
              <div className="bg-amber-500/10 rounded-lg p-3 border border-amber-500/20">
                <p className="text-amber-400 font-medium mb-2">
                  📙 Supplementary Reading (4-8 per module)
                </p>
                <ul className="text-xs text-teal-600 space-y-1">
                  <li>• Deepen understanding</li>
                  <li>• Alternative perspectives</li>
                  <li>• Support diverse learning styles</li>
                  <li>• Extension for advanced learners</li>
                </ul>
              </div>
            </div>

            {/* Effort Estimation */}
            <div className="mt-4 bg-white rounded-lg p-3">
              <p className="text-teal-600 font-medium mb-2">📊 Effort Estimation</p>
              <div className="grid grid-cols-3 gap-3 text-xs text-center">
                <div>
                  <span
                    className={`inline-block px-2 py-0.5 rounded ${COMPLEXITY_COLORS.introductory}`}
                  >
                    Introductory
                  </span>
                  <p className="text-teal-500 mt-1">200 words/min</p>
                </div>
                <div>
                  <span
                    className={`inline-block px-2 py-0.5 rounded ${COMPLEXITY_COLORS.intermediate}`}
                  >
                    Intermediate
                  </span>
                  <p className="text-teal-500 mt-1">167 words/min</p>
                </div>
                <div>
                  <span
                    className={`inline-block px-2 py-0.5 rounded ${COMPLEXITY_COLORS.advanced}`}
                  >
                    Advanced
                  </span>
                  <p className="text-teal-500 mt-1">133 words/min</p>
                </div>
              </div>
              <p className="text-xs text-teal-500 mt-2 text-center">
                Total reading time must not exceed independent study hours allocation
              </p>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isCurrentlyGenerating}
            className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-teal-800 font-medium rounded-lg transition-all disabled:opacity-50"
          >
            {isCurrentlyGenerating ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating Reading Lists...
              </span>
            ) : (
              'Generate Reading Lists'
            )}
          </button>
        </div>
      ) : (
        // Display Generated Reading Lists
        <div className="space-y-6">
          {/* Overall Stats */}
          <div className="grid grid-cols-5 gap-4">
            <div className="bg-white rounded-xl p-4 border border-teal-200 text-center">
              <p className="text-3xl font-bold text-teal-800">
                {workflow.step6?.totalReadings || workflow.step6?.readings?.length || 0}
              </p>
              <p className="text-xs text-teal-500 mt-1">Total Readings</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-teal-200 text-center">
              <p className="text-3xl font-bold text-cyan-400">{workflow.step6?.coreCount || 0}</p>
              <p className="text-xs text-teal-500 mt-1">Core</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-teal-200 text-center">
              <p className="text-3xl font-bold text-amber-400">
                {workflow.step6?.supplementaryCount || 0}
              </p>
              <p className="text-xs text-teal-500 mt-1">Supplementary</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-teal-200 text-center">
              <p className="text-3xl font-bold text-purple-400">
                {formatTime(workflow.step6?.totalReadingMinutes || 0)}
              </p>
              <p className="text-xs text-teal-500 mt-1">Total Time</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-teal-200 text-center">
              <p
                className={`text-3xl font-bold ${workflow.step6?.isValid ? 'text-emerald-400' : 'text-red-400'}`}
              >
                {workflow.step6?.isValid ? '✓' : '✗'}
              </p>
              <p className="text-xs text-teal-500 mt-1">Valid</p>
            </div>
          </div>

          {/* Validation Report */}
          {validation && (
            <div
              className={`rounded-lg p-4 border ${workflow.step6?.isValid ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}
            >
              <h4
                className={`font-medium mb-3 ${workflow.step6?.isValid ? 'text-emerald-400' : 'text-amber-400'}`}
              >
                Validation Report
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <span className={validation.coreCountValid ? 'text-emerald-400' : 'text-red-400'}>
                  {validation.coreCountValid ? '✓' : '✗'} Core Count (3-6)
                </span>
                <span
                  className={
                    validation.supplementaryCountValid ? 'text-emerald-400' : 'text-red-400'
                  }
                >
                  {validation.supplementaryCountValid ? '✓' : '✗'} Supplementary (4-8)
                </span>
                <span className={validation.allCoreMapToMLO ? 'text-emerald-400' : 'text-red-400'}>
                  {validation.allCoreMapToMLO ? '✓' : '✗'} Core → MLO
                </span>
                <span className={validation.allAGICompliant ? 'text-emerald-400' : 'text-red-400'}>
                  {validation.allAGICompliant ? '✓' : '✗'} AGI Compliant
                </span>
                <span
                  className={validation.academicAppliedMix ? 'text-emerald-400' : 'text-red-400'}
                >
                  {validation.academicAppliedMix ? '✓' : '✗'} Academic/Applied Mix
                </span>
                <span
                  className={
                    validation.readingTimeWithinBudget ? 'text-emerald-400' : 'text-red-400'
                  }
                >
                  {validation.readingTimeWithinBudget ? '✓' : '✗'} Time Within Budget
                </span>
                <span className={validation.allAccessible ? 'text-emerald-400' : 'text-red-400'}>
                  {validation.allAccessible ? '✓' : '✗'} All Accessible
                </span>
              </div>

              {/* Validation Issues */}
              {workflow.step6?.validationIssues && workflow.step6.validationIssues.length > 0 && (
                <div className="mt-3 pt-3 border-t border-teal-200/50">
                  <p className="text-amber-400 text-sm font-medium mb-2">Issues:</p>
                  <ul className="text-xs text-teal-600 space-y-1">
                    {workflow.step6.validationIssues.map((issue, i) => (
                      <li key={i}>• {issue}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Module Summaries */}
          {workflow.step6?.moduleSummaries && workflow.step6.moduleSummaries.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-teal-800 mb-4">Module Summaries</h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {workflow.step6.moduleSummaries.map((summary) => (
                  <ModuleSummaryCard key={summary.moduleId} summary={summary} />
                ))}
              </div>
            </div>
          )}

          {/* Module Filter */}
          {workflow.step6?.moduleReadings &&
            Object.keys(workflow.step6.moduleReadings).length > 0 && (
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setSelectedModule(null)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    selectedModule === null
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500'
                      : 'bg-white text-teal-600 border border-teal-200 hover:border-teal-300'
                  }`}
                >
                  All Modules
                </button>
                {Object.keys(workflow.step6.moduleReadings).map((modId) => (
                  <button
                    key={modId}
                    onClick={() => setSelectedModule(modId)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      selectedModule === modId
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500'
                        : 'bg-white text-teal-600 border border-teal-200 hover:border-teal-300'
                    }`}
                  >
                    {modId}
                  </button>
                ))}
              </div>
            )}

          {/* Core Readings */}
          {coreReadings.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-teal-800 mb-4 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-cyan-400" />
                Core Reading ({coreReadings.length})
              </h3>
              <div className="space-y-3">
                {coreReadings.map((reading) => (
                  <ReadingCard
                    key={reading.id}
                    reading={reading}
                    onEdit={handleEditReading}
                    onDelete={handleDeleteReading}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Supplementary Readings */}
          {supplementaryReadings.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-teal-800 mb-4 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-400" />
                Supplementary Reading ({supplementaryReadings.length})
              </h3>
              <div className="space-y-3">
                {supplementaryReadings.map((reading) => (
                  <ReadingCard
                    key={reading.id}
                    reading={reading}
                    onEdit={handleEditReading}
                    onDelete={handleDeleteReading}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Add reading — manual entry for SMEs. Pre-fills the selected
              module when one is filtered; defaults to the first module
              when viewing the full list. */}
          {workflow.step4?.modules && workflow.step4.modules.length > 0 && (
            <div className="flex justify-end">
              <button
                onClick={() => setAddingReading(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 border border-blue-200 rounded-lg text-sm font-medium transition-colors"
              >
                <span className="text-lg leading-none">+</span>
                Add reading
                {selectedModule && (
                  <span className="text-xs text-blue-500">to {selectedModule}</span>
                )}
              </button>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-6 border-t border-teal-200">
            <button
              onClick={handleGenerate}
              disabled={submitStep6.isPending}
              className="px-4 py-2 text-teal-600 hover:text-teal-600 transition-colors"
            >
              Regenerate
            </button>
            <div className="flex gap-3">
              {!isApproved && (
                <button
                  onClick={handleApprove}
                  disabled={approveStep6.isPending}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-teal-800 font-medium rounded-lg transition-all disabled:opacity-50"
                >
                  {approveStep6.isPending ? 'Approving...' : 'Approve & Continue →'}
                </button>
              )}
              {isApproved && (
                <span className="px-4 py-2.5 bg-emerald-500/20 text-emerald-400 rounded-lg flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Approved
                </span>
              )}
              {!!workflow.step6 && (
                <StepDownloadButton
                  workflowId={workflow._id}
                  stepNumber={6}
                  programName={workflow.projectName || workflow.step1?.programTitle || ''}
                />
              )}
            </div>
          </div>

          {!workflow.step6?.isValid && !isApproved && (
            <p className="text-xs text-amber-400 text-center">
              All validation checks must pass before approval.
            </p>
          )}
        </div>
      )}

      {/* Reading Edit Modal */}
      {editingReading && (
        <ReadingEditModal
          reading={editingReading}
          onSave={handleSaveReading}
          onCancel={handleCancelReadingEdit}
          isSaving={isSavingEdit}
        />
      )}

      {/* Reading Add Modal */}
      {addingReading && workflow.step4?.modules && (
        <ReadingAddModal
          moduleOptions={workflow.step4.modules.map((m) => ({
            id: m.id,
            code: m.code,
            title: m.title,
          }))}
          defaultModuleId={selectedModule || workflow.step4.modules[0]?.id || ''}
          onSave={handleAddReading}
          onCancel={() => setAddingReading(false)}
          isSaving={isAddingReading}
        />
      )}

      {/* Add / delete toast */}
      {readingToast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 right-6 z-[60] px-4 py-3 rounded-lg shadow-lg border text-sm font-medium ${
            readingToast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          {readingToast.text}
        </div>
      )}
    </div>
  );
}
