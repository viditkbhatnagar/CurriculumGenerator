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
import { EditTarget } from './EditWithAIButton';

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
  other: { label: 'Resource', icon: '📁', color: 'bg-slate-500/20 text-slate-400' },
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
  const [readingType, setReadingType] = useState<'academic' | 'applied' | 'industry'>(reading.readingType || 'academic');
  const [complexity, setComplexity] = useState<ReadingComplexity>(reading.complexity || 'intermediate');
  const [estimatedReadingMinutes, setEstimatedReadingMinutes] = useState(reading.estimatedReadingMinutes || 0);
  const [specificChapters, setSpecificChapters] = useState(reading.specificChapters || '');
  const [pageRange, setPageRange] = useState(reading.pageRange || '');
  const [sectionNames, setSectionNames] = useState<string[]>(reading.sectionNames || []);
  const [notes, setNotes] = useState(reading.notes || '');
  const [suggestedWeek, setSuggestedWeek] = useState(reading.suggestedWeek || '');
  const [linkedMLOs, setLinkedMLOs] = useState<string[]>(reading.linkedMLOs || []);
  const [assessmentRelevance, setAssessmentRelevance] = useState<'high' | 'medium' | 'low'>(reading.assessmentRelevance || 'medium');
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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            Edit <span className="text-blue-400">Reading Item</span>
          </h3>
        </div>
        
        <div className="p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              placeholder="Enter reading title..."
            />
          </div>

          {/* Authors */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Authors</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={authorsInput}
                onChange={(e) => setAuthorsInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAuthor())}
                className="flex-1 px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
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
                    className="px-3 py-1 bg-slate-700 text-slate-300 rounded-full text-sm flex items-center gap-2"
                  >
                    {author}
                    <button
                      type="button"
                      onClick={() => removeAuthor(i)}
                      className="text-slate-500 hover:text-red-400"
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
              <label className="block text-sm font-medium text-slate-300 mb-2">Year</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value) || new Date().getFullYear())}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as 'core' | 'supplementary')}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                <option value="core">Core</option>
                <option value="supplementary">Supplementary</option>
              </select>
            </div>
          </div>

          {/* Content Type and Reading Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Content Type</label>
              <select
                value={contentType}
                onChange={(e) => setContentType(e.target.value as any)}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                {Object.entries(CONTENT_TYPE_CONFIG).map(([value, config]) => (
                  <option key={value} value={value}>
                    {config.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Reading Type</label>
              <select
                value={readingType}
                onChange={(e) => setReadingType(e.target.value as 'academic' | 'applied' | 'industry')}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
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
              <label className="block text-sm font-medium text-slate-300 mb-2">Complexity</label>
              <select
                value={complexity}
                onChange={(e) => setComplexity(e.target.value as ReadingComplexity)}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                <option value="introductory">Introductory</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Reading Time (minutes)</label>
              <input
                type="number"
                value={estimatedReadingMinutes}
                onChange={(e) => setEstimatedReadingMinutes(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Specific Assignment Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Specific Chapters</label>
              <input
                type="text"
                value={specificChapters}
                onChange={(e) => setSpecificChapters(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                placeholder="e.g., Chapter 1: Introduction"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Page Range</label>
              <input
                type="text"
                value={pageRange}
                onChange={(e) => setPageRange(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                placeholder="e.g., pp. 17-24"
              />
            </div>
          </div>

          {/* Section Names */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Section Names</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={sectionInput}
                onChange={(e) => setSectionInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSection())}
                className="flex-1 px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
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
                    className="px-3 py-1 bg-slate-700 text-slate-300 rounded-full text-sm flex items-center gap-2"
                  >
                    {section}
                    <button
                      type="button"
                      onClick={() => removeSection(i)}
                      className="text-slate-500 hover:text-red-400"
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
              <label className="block text-sm font-medium text-slate-300 mb-2">Suggested Week</label>
              <input
                type="text"
                value={suggestedWeek}
                onChange={(e) => setSuggestedWeek(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                placeholder="e.g., Week 1-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Assessment Relevance</label>
              <select
                value={assessmentRelevance}
                onChange={(e) => setAssessmentRelevance(e.target.value as 'high' | 'medium' | 'low')}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          {/* Linked MLOs */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Linked MLOs</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={mloInput}
                onChange={(e) => setMloInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addMLO())}
                className="flex-1 px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
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
                    className="px-3 py-1 bg-slate-700 text-slate-300 rounded-full text-sm flex items-center gap-2"
                  >
                    {mlo}
                    <button
                      type="button"
                      onClick={() => removeMLO(i)}
                      className="text-slate-500 hover:text-red-400"
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
            <label className="block text-sm font-medium text-slate-300 mb-2">Citation</label>
            <textarea
              value={citation}
              onChange={(e) => setCitation(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
              placeholder="Enter APA citation..."
            />
          </div>

          {/* DOI and URL */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">DOI</label>
              <input
                type="text"
                value={doi}
                onChange={(e) => setDoi(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                placeholder="10.1000/example"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                placeholder="https://..."
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
              placeholder="Additional notes..."
            />
          </div>
        </div>

        <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="px-5 py-2.5 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !title.trim()}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white font-medium rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
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

// Reading Item Card
function ReadingCard({ reading, onEdit }: { reading: ReadingItem; onEdit?: (reading: ReadingItem) => void }) {
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
          : 'bg-slate-900/30 border-slate-700'
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
                    : 'bg-slate-700 text-slate-400'
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
                <span className="text-xs text-slate-500">{reading.suggestedWeek}</span>
              )}
            </div>
            <h4 className="text-white font-medium">{reading.title}</h4>
            <p className="text-sm text-slate-400">
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
        <p className="text-xs text-slate-500 font-mono bg-slate-800/50 p-2 rounded">
          {reading.citation}
        </p>

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
            <span className="text-xs text-slate-500">Supports:</span>
            {reading.linkedMLOs.map((mlo) => (
              <span key={mlo} className="text-xs px-1.5 py-0.5 bg-slate-700 rounded text-cyan-400">
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

        {/* Edit Button */}
        {onEdit && (
          <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onEdit(reading)}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              Edit
            </button>
          </div>
        )}
      </div>

      {/* Reference Note */}
      {reading.isReference && reading.originalModuleId && (
        <div className="px-4 pb-3 text-xs text-slate-500">
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
      className={`bg-slate-900/30 rounded-lg p-4 border ${
        summary.agiCompliant && isTimeValid ? 'border-emerald-500/30' : 'border-amber-500/30'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-white font-medium">{summary.moduleTitle}</h4>
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
          <p className="text-xs text-slate-500">Core (3-6)</p>
        </div>
        <div
          className={`text-center p-2 rounded ${isSupplementaryValid ? 'bg-amber-500/10' : 'bg-red-500/10'}`}
        >
          <p
            className={`text-lg font-bold ${isSupplementaryValid ? 'text-amber-400' : 'text-red-400'}`}
          >
            {summary.supplementaryCount}
          </p>
          <p className="text-xs text-slate-500">Supplementary (4-8)</p>
        </div>
      </div>

      {/* Time Allocation */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Core reading:</span>
          <span className="text-cyan-400">{formatTime(summary.coreReadingMinutes)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Supplementary:</span>
          <span className="text-amber-400">{formatTime(summary.supplementaryReadingMinutes)}</span>
        </div>
        <div className="flex justify-between text-xs font-medium border-t border-slate-700 pt-1 mt-1">
          <span className="text-slate-300">Total:</span>
          <span className={isTimeValid ? 'text-emerald-400' : 'text-red-400'}>
            {formatTime(summary.totalReadingMinutes)} /{' '}
            {formatTime(summary.independentStudyMinutes)}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-2">
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${isTimeValid ? 'bg-emerald-500' : 'bg-red-500'}`}
            style={{ width: `${Math.min(summary.readingTimePercent, 100)}%` }}
          />
        </div>
        <p className={`text-xs text-right mt-1 ${isTimeValid ? 'text-slate-500' : 'text-red-400'}`}>
          {summary.readingTimePercent}% of independent study
        </p>
      </div>

      {/* Validation Indicators */}
      <div className="mt-2 pt-2 border-t border-slate-700 flex gap-2 text-xs">
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
  
  // Edit state for reading items
  const [editingReading, setEditingReading] = useState<ReadingItem | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const isCurrentlyGenerating = isGenerating(workflow._id, 6) || submitStep6.isPending;

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
    startGeneration(workflow._id, 6, 60); // 60 seconds estimated
    try {
      await submitStep6.mutateAsync(workflow._id);
      completeGeneration(workflow._id, 6);
      onRefresh();
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
      const response = await api.put(`/api/v3/workflow/${workflow._id}/step6/reading/${updatedReading.id}`, {
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
      });
      
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
              <h3 className="text-lg font-semibold text-white">Generating Reading Lists...</h3>
              <p className="text-sm text-slate-400">
                This may take a minute. You can navigate away and come back.
              </p>
            </div>
          </div>
          <GenerationProgressBar workflowId={workflow._id} step={6} />
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
            <p className="text-sm text-slate-300 mb-4">
              Transform your AGI-validated sources into structured reading lists with
              <strong className="text-cyan-400"> Core (Indicative)</strong> and
              <strong className="text-amber-400"> Supplementary (Additional)</strong>{' '}
              classifications, effort estimates, and scheduling.
            </p>

            {/* Classification Guide */}
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="bg-cyan-500/10 rounded-lg p-3 border border-cyan-500/20">
                <p className="text-cyan-400 font-medium mb-2">📘 Core Reading (3-6 per module)</p>
                <ul className="text-xs text-slate-400 space-y-1">
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
                <ul className="text-xs text-slate-400 space-y-1">
                  <li>• Deepen understanding</li>
                  <li>• Alternative perspectives</li>
                  <li>• Support diverse learning styles</li>
                  <li>• Extension for advanced learners</li>
                </ul>
              </div>
            </div>

            {/* Effort Estimation */}
            <div className="mt-4 bg-slate-900/50 rounded-lg p-3">
              <p className="text-slate-400 font-medium mb-2">📊 Effort Estimation</p>
              <div className="grid grid-cols-3 gap-3 text-xs text-center">
                <div>
                  <span
                    className={`inline-block px-2 py-0.5 rounded ${COMPLEXITY_COLORS.introductory}`}
                  >
                    Introductory
                  </span>
                  <p className="text-slate-500 mt-1">200 words/min</p>
                </div>
                <div>
                  <span
                    className={`inline-block px-2 py-0.5 rounded ${COMPLEXITY_COLORS.intermediate}`}
                  >
                    Intermediate
                  </span>
                  <p className="text-slate-500 mt-1">167 words/min</p>
                </div>
                <div>
                  <span
                    className={`inline-block px-2 py-0.5 rounded ${COMPLEXITY_COLORS.advanced}`}
                  >
                    Advanced
                  </span>
                  <p className="text-slate-500 mt-1">133 words/min</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2 text-center">
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
            className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white font-medium rounded-lg transition-all disabled:opacity-50"
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
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700 text-center">
              <p className="text-3xl font-bold text-white">
                {workflow.step6?.totalReadings || workflow.step6?.readings?.length || 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">Total Readings</p>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700 text-center">
              <p className="text-3xl font-bold text-cyan-400">{workflow.step6?.coreCount || 0}</p>
              <p className="text-xs text-slate-500 mt-1">Core</p>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700 text-center">
              <p className="text-3xl font-bold text-amber-400">
                {workflow.step6?.supplementaryCount || 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">Supplementary</p>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700 text-center">
              <p className="text-3xl font-bold text-purple-400">
                {formatTime(workflow.step6?.totalReadingMinutes || 0)}
              </p>
              <p className="text-xs text-slate-500 mt-1">Total Time</p>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700 text-center">
              <p
                className={`text-3xl font-bold ${workflow.step6?.isValid ? 'text-emerald-400' : 'text-red-400'}`}
              >
                {workflow.step6?.isValid ? '✓' : '✗'}
              </p>
              <p className="text-xs text-slate-500 mt-1">Valid</p>
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
                <div className="mt-3 pt-3 border-t border-slate-700/50">
                  <p className="text-amber-400 text-sm font-medium mb-2">Issues:</p>
                  <ul className="text-xs text-slate-400 space-y-1">
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
              <h3 className="text-lg font-semibold text-white mb-4">Module Summaries</h3>
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
                      : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
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
                        : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
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
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-cyan-400" />
                Core Reading ({coreReadings.length})
              </h3>
              <div className="space-y-3">
                {coreReadings.map((reading) => (
                  <ReadingCard 
                    key={reading.id} 
                    reading={reading} 
                    onEdit={handleEditReading}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Supplementary Readings */}
          {supplementaryReadings.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-400" />
                Supplementary Reading ({supplementaryReadings.length})
              </h3>
              <div className="space-y-3">
                {supplementaryReadings.map((reading) => (
                  <ReadingCard 
                    key={reading.id} 
                    reading={reading} 
                    onEdit={handleEditReading}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-6 border-t border-slate-700">
            <button
              onClick={handleGenerate}
              disabled={submitStep6.isPending}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              Regenerate
            </button>
            <div className="flex gap-3">
              {!isApproved && (
                <button
                  onClick={handleApprove}
                  disabled={approveStep6.isPending}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-medium rounded-lg transition-all disabled:opacity-50"
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
    </div>
  );
}
