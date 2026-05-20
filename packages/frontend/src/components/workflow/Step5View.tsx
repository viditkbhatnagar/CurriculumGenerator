'use client';

import { useState, useEffect } from 'react';
import { useSubmitStep5, useApproveStep5 } from '@/hooks/useWorkflow';
import { api } from '@/lib/api';
import {
  CurriculumWorkflow,
  Source,
  ModuleSourceSummary,
  SourceCategory,
  SourceAccessStatus,
  SourceType,
} from '@/types/workflow';
import { useGeneration, GenerationProgressBar } from '@/contexts/GenerationContext';
import { useStepStatus } from '@/hooks/useStepStatus';
import EditWithAIButton, { EditTarget } from './EditWithAIButton';
import StepDownloadButton from './StepDownloadButton';
import { downloadFile } from '@/lib/download';

interface Props {
  workflow: CurriculumWorkflow;
  onComplete: () => void;
  onRefresh: () => void;
  onOpenCanvas?: (target: EditTarget) => void;
}

type SourceStatus = 'accepted' | 'rejected' | 'pending';

// Category colors and labels
const CATEGORY_LABELS: Record<SourceCategory, string> = {
  peer_reviewed_journal: 'Peer-Reviewed',
  academic_textbook: 'Academic Text',
  professional_body: 'Professional Body',
  open_access: 'Open Access',
  institutional: 'Institutional',
};

const CATEGORY_COLORS: Record<SourceCategory, string> = {
  peer_reviewed_journal: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  academic_textbook: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  professional_body: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  open_access: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  institutional: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

const TYPE_LABELS: Record<SourceType, string> = {
  academic: 'Academic',
  applied: 'Applied',
  industry: 'Industry',
};

// Access status display helper
const ACCESS_STATUS_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  agi_library: { label: 'AGI Library', icon: '📚', color: 'bg-emerald-500/20 text-emerald-400' },
  knowledge_base: { label: 'Knowledge Base', icon: '🗄️', color: 'bg-cyan-500/20 text-cyan-400' },
  open_access: { label: 'Open Access', icon: '🔓', color: 'bg-green-500/20 text-green-400' },
  institutional_subscription: {
    label: 'Institutional Access',
    icon: '🏛️',
    color: 'bg-amber-500/20 text-amber-400',
  },
  requires_purchase: {
    label: 'Requires Purchase',
    icon: '💰',
    color: 'bg-red-500/20 text-red-400',
  },
  verified_accessible: {
    label: 'Verified Access',
    icon: '✓',
    color: 'bg-emerald-500/20 text-emerald-400',
  },
  requires_approval: {
    label: 'Needs Approval',
    icon: '⚠',
    color: 'bg-amber-500/20 text-amber-400',
  },
  rejected: { label: 'Not Accessible', icon: '✗', color: 'bg-red-500/20 text-red-400' },
  flagged_for_review: {
    label: 'Under Review',
    icon: '🔍',
    color: 'bg-teal-400/20 text-teal-600',
  },
};

// Source Edit Modal Component
function SourceEditModal({
  source,
  onSave,
  onCancel,
  isSaving,
}: {
  source: Source;
  onSave: (updatedSource: Source) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [title, setTitle] = useState(source.title || '');
  const [authors, setAuthors] = useState<string[]>(source.authors || []);
  const [year, setYear] = useState(source.year || new Date().getFullYear());
  const [citation, setCitation] = useState(source.citation || '');
  const [doi, setDoi] = useState(source.doi || '');
  const [url, setUrl] = useState(source.url || '');
  const [category, setCategory] = useState<SourceCategory>(
    source.category || 'peer_reviewed_journal'
  );
  const [type, setType] = useState<SourceType>(source.type || 'academic');
  const [complexityLevel, setComplexityLevel] = useState<
    'introductory' | 'intermediate' | 'advanced'
  >((source.complexityLevel as 'introductory' | 'intermediate' | 'advanced') || 'intermediate');
  const [accessStatus, setAccessStatus] = useState<SourceAccessStatus>(
    source.accessStatus || 'verified_accessible'
  );
  const [authorsInput, setAuthorsInput] = useState('');

  const handleSave = () => {
    onSave({
      ...source,
      title,
      authors,
      year,
      citation,
      doi,
      url,
      category,
      type,
      complexityLevel,
      accessStatus,
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

  return (
    <div className="fixed inset-0 bg-teal-900/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl border border-teal-200 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-teal-200">
          <h3 className="text-lg font-semibold text-teal-800 flex items-center gap-2">
            Edit <span className="text-amber-400">Source</span>
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
              className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-amber-500"
              placeholder="Enter source title..."
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
                className="flex-1 px-4 py-2 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-amber-500"
                placeholder="Add an author..."
              />
              <button
                type="button"
                onClick={addAuthor}
                className="px-4 py-2 bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors"
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
                className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-teal-700 mb-2">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as SourceCategory)}
                className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 focus:outline-none focus:border-amber-500"
              >
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Type and Complexity */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-teal-700 mb-2">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as SourceType)}
                className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 focus:outline-none focus:border-amber-500"
              >
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-teal-700 mb-2">
                Complexity Level
              </label>
              <select
                value={complexityLevel}
                onChange={(e) =>
                  setComplexityLevel(e.target.value as 'introductory' | 'intermediate' | 'advanced')
                }
                className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 focus:outline-none focus:border-amber-500"
              >
                <option value="introductory">Introductory</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          </div>

          {/* Access Status */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">Access Status</label>
            <select
              value={accessStatus}
              onChange={(e) => setAccessStatus(e.target.value as SourceAccessStatus)}
              className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 focus:outline-none focus:border-amber-500"
            >
              {Object.entries(ACCESS_STATUS_CONFIG).map(([value, config]) => (
                <option key={value} value={value}>
                  {config.label}
                </option>
              ))}
            </select>
          </div>

          {/* Citation */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">Citation</label>
            <textarea
              value={citation}
              onChange={(e) => setCitation(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-amber-500 resize-none"
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
                className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-amber-500"
                placeholder="10.1000/example"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-teal-700 mb-2">URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-amber-500"
                placeholder="https://..."
              />
            </div>
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
            className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-teal-800 font-medium rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
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

// Source Add Modal — compact form for SMEs to drop in a resource the
// AI pipeline didn't surface (documents, YouTube links, e-books,
// articles, physical books). Backend fills defaults for the rest.
const RESOURCE_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'document', label: 'Document' },
  { value: 'video', label: 'YouTube / video' },
  { value: 'ebook', label: 'E-book' },
  { value: 'article', label: 'Article' },
  { value: 'book', label: 'Physical book' },
  { value: 'webpage', label: 'Webpage' },
  { value: 'other', label: 'Other' },
];

function SourceAddModal({
  moduleOptions,
  defaultModuleId,
  onSave,
  onCancel,
  isSaving,
}: {
  moduleOptions: Array<{ id: string; code: string; title: string }>;
  defaultModuleId: string;
  onSave: (
    payload: {
      moduleId: string;
      title: string;
      authors: string[];
      year: number;
      resourceType: string;
      type: 'academic' | 'applied' | 'industry';
      complexityLevel: 'introductory' | 'intermediate' | 'advanced';
      publisher?: string;
      url?: string;
      isbn?: string;
      complianceNotes?: string;
    },
    file?: File | null
  ) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [moduleId, setModuleId] = useState(defaultModuleId);
  const [title, setTitle] = useState('');
  const [authors, setAuthors] = useState<string[]>([]);
  const [authorsInput, setAuthorsInput] = useState('');
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [resourceType, setResourceType] = useState<string>('article');
  const [type, setType] = useState<'academic' | 'applied' | 'industry'>('applied');
  const [complexityLevel, setComplexityLevel] = useState<
    'introductory' | 'intermediate' | 'advanced'
  >('intermediate');
  const [publisher, setPublisher] = useState('');
  const [url, setUrl] = useState('');
  const [isbn, setIsbn] = useState('');
  const [complianceNotes, setComplianceNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const MAX_FILE_MB = 25;
  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] || null;
    if (picked && picked.size > MAX_FILE_MB * 1024 * 1024) {
      setFileError(`File is too large — maximum ${MAX_FILE_MB}MB.`);
      setFile(null);
      e.target.value = '';
      return;
    }
    setFileError(null);
    setFile(picked);
  };

  const addAuthor = () => {
    const v = authorsInput.trim();
    if (v) {
      setAuthors([...authors, v]);
      setAuthorsInput('');
    }
  };
  const removeAuthor = (i: number) => setAuthors(authors.filter((_, ix) => ix !== i));

  // Authors are optional — a webpage / video resource often has no
  // clear author, and requiring one blocked SMEs from adding plain
  // links. Only title / module / year gate the save.
  const canSave = title.trim().length > 0 && !!moduleId && year >= 1800;

  const handleSave = () => {
    if (!canSave) return;
    // Fold any pending (un-"Add"ed) author text into the list so a
    // typed-but-uncommitted name isn't lost.
    const pending = authorsInput.trim();
    const finalAuthors = pending ? [...authors, pending] : authors;
    onSave(
      {
        moduleId,
        title: title.trim(),
        authors: finalAuthors,
        year,
        resourceType,
        type,
        complexityLevel,
        publisher: publisher.trim() || undefined,
        url: url.trim() || undefined,
        isbn: isbn.trim() || undefined,
        complianceNotes: complianceNotes.trim() || undefined,
      },
      file
    );
  };

  return (
    <div className="fixed inset-0 bg-teal-900/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl border border-teal-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-teal-200">
          <h3 className="text-lg font-semibold text-teal-800 flex items-center gap-2">
            Add resource
            <span className="text-xs font-normal text-teal-500">
              (manual — bypasses AGI compliance checks)
            </span>
          </h3>
        </div>

        <div className="p-6 space-y-5">
          {/* Module + Resource type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-teal-700 mb-2">Module</label>
              <select
                value={moduleId}
                onChange={(e) => setModuleId(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 focus:outline-none focus:border-cyan-500"
              >
                {moduleOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.code} — {m.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-teal-700 mb-2">Resource type</label>
              <select
                value={resourceType}
                onChange={(e) => setResourceType(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 focus:outline-none focus:border-cyan-500"
              >
                {RESOURCE_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">
              Title / resource name
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-cyan-500"
              placeholder="e.g. Designing Brand Identity"
              autoFocus
            />
          </div>

          {/* Authors */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">
              Author(s) / channel (optional)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={authorsInput}
                onChange={(e) => setAuthorsInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAuthor())}
                className="flex-1 px-4 py-2 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-cyan-500"
                placeholder="Add an author and press Enter (e.g. Wheeler, A.)"
              />
              <button
                type="button"
                onClick={addAuthor}
                className="px-4 py-2 bg-cyan-500/20 text-cyan-500 rounded-lg hover:bg-cyan-500/30 transition-colors"
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

          {/* Year + Type + Complexity */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-teal-700 mb-2">Year</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value) || new Date().getFullYear())}
                className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-teal-700 mb-2">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as 'academic' | 'applied' | 'industry')}
                className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 focus:outline-none focus:border-cyan-500"
              >
                <option value="academic">Academic</option>
                <option value="applied">Applied</option>
                <option value="industry">Industry</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-teal-700 mb-2">Complexity</label>
              <select
                value={complexityLevel}
                onChange={(e) =>
                  setComplexityLevel(e.target.value as 'introductory' | 'intermediate' | 'advanced')
                }
                className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 focus:outline-none focus:border-cyan-500"
              >
                <option value="introductory">Introductory</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          </div>

          {/* URL */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">
              Link / URL (optional)
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-cyan-500"
              placeholder="https://… (YouTube link, article URL, e-book link)"
            />
          </div>

          {/* Publisher + ISBN */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-teal-700 mb-2">
                Publisher (optional)
              </label>
              <input
                type="text"
                value={publisher}
                onChange={(e) => setPublisher(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-cyan-500"
                placeholder="e.g. Wiley"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-teal-700 mb-2">
                ISBN (optional, for books)
              </label>
              <input
                type="text"
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-cyan-500"
                placeholder="978-…"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">Notes (optional)</label>
            <textarea
              value={complianceNotes}
              onChange={(e) => setComplianceNotes(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-cyan-500 resize-none"
              placeholder="Why this resource belongs on the list"
            />
          </div>

          {/* File upload — optional. The actual file is stored in MongoDB
              (GridFS); the source links to it with a download link. */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">
              Attach a file (optional)
            </label>
            {file ? (
              <div className="flex items-center justify-between gap-3 px-4 py-3 bg-cyan-50 border border-cyan-200 rounded-lg">
                <span className="text-sm text-teal-800 truncate">
                  📎 {file.name}{' '}
                  <span className="text-teal-500">({(file.size / 1024).toFixed(0)} KB)</span>
                </span>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="text-sm text-rose-500 hover:text-rose-600 shrink-0"
                >
                  Remove
                </button>
              </div>
            ) : (
              <input
                type="file"
                onChange={handleFilePick}
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.epub,.mobi,.rtf,.txt"
                className="block w-full text-sm text-teal-700 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-cyan-500/15 file:text-cyan-700 hover:file:bg-cyan-500/25 file:cursor-pointer cursor-pointer"
              />
            )}
            <p className="text-xs text-teal-500 mt-1">
              Word, PDF, PowerPoint, Excel, EPUB, MOBI, RTF or text — up to 25MB. Stored securely in
              the curriculum database.
            </p>
            {fileError && <p className="text-xs text-rose-500 mt-1">{fileError}</p>}
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
              'Add resource'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Source Card Component
function SourceCard({
  source,
  onAccept,
  onReject,
  onEdit,
  onDelete,
  status = 'pending',
  isReplacement = false,
}: {
  source: Source;
  onAccept?: (sourceId: string) => void;
  onReject?: (sourceId: string) => void;
  onEdit?: (source: Source) => void;
  onDelete?: (source: Source) => void;
  status?: SourceStatus;
  isReplacement?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const currentYear = new Date().getFullYear();
  const isRecent = currentYear - source.year <= 5;
  const accessConfig =
    ACCESS_STATUS_CONFIG[source.accessStatus] || ACCESS_STATUS_CONFIG.flagged_for_review;

  const getBorderColor = () => {
    if (status === 'accepted') return 'border-emerald-500/50';
    if (status === 'rejected') return 'border-red-500/50 opacity-50';
    return 'border-teal-200';
  };

  return (
    <div
      className={`bg-white rounded-lg border overflow-hidden group ${getBorderColor()} ${isReplacement ? 'ring-2 ring-cyan-500/30' : ''}`}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1">
            <h4 className="text-teal-800 font-medium leading-tight">{source.title}</h4>
            <p className="text-sm text-teal-600 mt-1">
              {source.authors?.join(', ')} ({source.year})
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span
              className={`text-xs px-2 py-1 rounded-full border ${CATEGORY_COLORS[source.category] || 'bg-teal-100 text-teal-600'}`}
            >
              {CATEGORY_LABELS[source.category] || source.category}
            </span>
            <span
              className={`text-xs ${source.agiCompliant ? 'text-emerald-400' : 'text-red-400'}`}
            >
              {source.agiCompliant ? '✓ AGI Compliant' : '✗ Non-compliant'}
            </span>
            {/* SME-added marker — reviewers can spot which entries
                bypassed the AGI compliance pipeline. */}
            {(source as any).userAdded && (
              <span
                className="text-xs px-2 py-0.5 rounded-full border border-amber-400 text-amber-700 bg-amber-50"
                title="Added manually — skips AGI compliance checks"
              >
                Added manually
              </span>
            )}
          </div>
        </div>

        {/* Citation */}
        <p className="text-xs text-teal-500 font-mono bg-teal-50 p-2 rounded mt-2">
          {source.citation}
        </p>

        {/* Uploaded file — download from GridFS via the auth-aware helper */}
        {(source as any).uploadedFile?.fileId && (
          <button
            type="button"
            onClick={() =>
              downloadFile(
                `/api/v3/files/${(source as any).uploadedFile.fileId}`,
                (source as any).uploadedFile.filename || 'source-file'
              ).catch(() => alert('Could not download the file.'))
            }
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 mt-2 bg-cyan-500/15 text-cyan-700 rounded hover:bg-cyan-500/25 transition-colors"
            title="Download the attached file"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            {(source as any).uploadedFile.filename || 'Download file'}
          </button>
        )}

        {/* Clickable DOI/URL Links */}
        {(source.doi || source.url) && (
          <div className="flex flex-wrap gap-2 mt-2">
            {source.doi && (
              <a
                href={source.doi.startsWith('http') ? source.doi : `https://doi.org/${source.doi}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors"
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
            {source.url && (
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded hover:bg-cyan-500/30 transition-colors"
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

        {/* Access Status Badge */}
        <div className="mt-2">
          <span
            className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded ${accessConfig.color}`}
          >
            <span>{accessConfig.icon}</span>
            {accessConfig.label}
          </span>
        </div>

        {/* Compliance Badges */}
        <div className="flex flex-wrap gap-2 mt-3">
          {source.complianceBadges?.peerReviewed && (
            <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded">
              ✓ Peer-Reviewed
            </span>
          )}
          {source.complianceBadges?.academicText && (
            <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">
              ✓ Academic Text
            </span>
          )}
          {source.complianceBadges?.professionalBody && (
            <span className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded">
              ✓ Professional Body
            </span>
          )}
          {isRecent ? (
            <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded">
              ✓ Recent (&lt;5 years)
            </span>
          ) : source.isSeminal ? (
            <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded">
              ⚠ Seminal (&gt;5 years)
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded">
              ✗ Outdated
            </span>
          )}
          {source.complianceBadges?.verifiedAccess && (
            <span className="text-xs px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded">
              ✓ Verified Access
            </span>
          )}
          {source.complianceBadges?.apaValidated && (
            <span className="text-xs px-2 py-0.5 bg-teal-400/20 text-teal-600 rounded">
              ✓ APA Validated
            </span>
          )}
        </div>

        {/* Accept/Reject Buttons */}
        {(onAccept || onReject) && status === 'pending' && (
          <div className="flex gap-2 mt-3 pt-3 border-t border-teal-200/50">
            {onAccept && (
              <button
                onClick={() => onAccept(source.id)}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs hover:bg-emerald-500/20 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Accept
              </button>
            )}
            {onReject && (
              <button
                onClick={() => onReject(source.id)}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs hover:bg-red-500/20 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                Reject & Replace
              </button>
            )}
          </div>
        )}

        {/* Status Indicator */}
        {status === 'accepted' && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-teal-200/50 text-emerald-400 text-xs">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            Accepted
          </div>
        )}
        {status === 'rejected' && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-teal-200/50 text-red-400 text-xs">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            Rejected - Replacement pending
          </div>
        )}

        {/* Replacement Badge */}
        {isReplacement && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-cyan-500/30 text-cyan-400 text-xs">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            AI-Generated Replacement
          </div>
        )}

        {/* Edit + Delete */}
        {(onEdit || onDelete) && (
          <div className="mt-2 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
            {onEdit && (
              <button
                onClick={() => onEdit(source)}
                className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
              >
                Edit
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(source)}
                className="text-xs text-rose-500 hover:text-rose-600 transition-colors"
                title="Remove this source from the list"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>

      {/* Expand Button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2 flex items-center justify-between text-xs text-teal-600 hover:bg-teal-50/30 transition-colors border-t border-teal-200/50"
      >
        <span>
          {TYPE_LABELS[source.type]} | {source.complexityLevel} |
          {source.estimatedReadingHours ? ` ${source.estimatedReadingHours}h reading` : ''}
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-teal-200/50">
          {/* DOI/URL */}
          {(source.doi || source.url) && (
            <div className="text-xs">
              {source.doi && <p className="text-cyan-400">DOI: {source.doi}</p>}
              {source.url && (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  {source.url}
                </a>
              )}
            </div>
          )}

          {/* Seminal Justification */}
          {source.isSeminal && source.seminalJustification && (
            <div className="bg-amber-500/10 rounded-lg p-2 text-xs">
              <p className="text-amber-400 font-medium mb-1">Seminal Work Justification:</p>
              <p className="text-teal-600">{source.seminalJustification}</p>
              {source.pairedRecentSourceId && (
                <p className="text-teal-500 mt-1">
                  Paired with recent source: {source.pairedRecentSourceId}
                </p>
              )}
            </div>
          )}

          {/* MLO Links */}
          {source.linkedMLOs && source.linkedMLOs.length > 0 && (
            <div>
              <p className="text-xs text-teal-500 mb-1">Supports MLOs:</p>
              <div className="flex flex-wrap gap-1">
                {source.linkedMLOs.map((mlo) => (
                  <span key={mlo} className="text-xs px-2 py-0.5 bg-teal-100 rounded text-teal-700">
                    {mlo}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Topics */}
          {source.relevantTopics && source.relevantTopics.length > 0 && (
            <div>
              <p className="text-xs text-teal-500 mb-1">Relevant Topics:</p>
              <p className="text-xs text-teal-600">{source.relevantTopics.join(', ')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Module Summary Card
function ModuleSummaryCard({ summary }: { summary: ModuleSourceSummary }) {
  return (
    <div
      className={`bg-teal-50/50 rounded-lg p-4 border ${summary.agiCompliant ? 'border-emerald-500/30' : 'border-amber-500/30'}`}
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-teal-800 font-medium">{summary.moduleTitle}</h4>
        <span
          className={`text-xs px-2 py-1 rounded ${summary.agiCompliant ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}
        >
          {summary.agiCompliant ? '✓ Compliant' : '⚠ Review'}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center text-xs">
        <div>
          <p className="text-lg font-bold text-teal-800">{summary.totalSources}</p>
          <p className="text-teal-500">Sources</p>
        </div>
        <div>
          <p
            className={`text-lg font-bold ${summary.peerReviewedPercent >= 50 ? 'text-emerald-400' : 'text-amber-400'}`}
          >
            {summary.peerReviewedPercent}%
          </p>
          <p className="text-teal-500">Peer-Reviewed</p>
        </div>
        <div>
          <p className="text-lg font-bold text-cyan-400">{summary.recentCount}</p>
          <p className="text-teal-500">Recent</p>
        </div>
        <div>
          <p
            className={`text-lg font-bold ${summary.allMLOsSupported ? 'text-emerald-400' : 'text-red-400'}`}
          >
            {summary.allMLOsSupported ? '✓' : '✗'}
          </p>
          <p className="text-teal-500">MLOs</p>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-teal-200/50 flex items-center justify-between text-xs">
        <span className="text-teal-500">
          Academic: {summary.academicCount} | Applied: {summary.appliedCount}
        </span>
        <span className="text-teal-500">
          {summary.totalReadingHours}h / {summary.allocatedIndependentHours}h
        </span>
      </div>
    </div>
  );
}

export default function Step5View({ workflow, onComplete, onRefresh, onOpenCanvas }: Props) {
  // Source status management
  const [sourceStatuses, setSourceStatuses] = useState<Record<string, SourceStatus>>({});
  const [replacementSources, setReplacementSources] = useState<Record<string, Source[]>>({});
  const [isRequestingReplacement, setIsRequestingReplacement] = useState(false);

  // Edit state for sources
  const [editingSource, setEditingSource] = useState<Source | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  // Add-source modal state
  const [addingSource, setAddingSource] = useState(false);
  const [isAddingSource, setIsAddingSource] = useState(false);
  // Inline toast for add / delete (auto-dismisses after 3.5s)
  const [sourceToast, setSourceToast] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  useEffect(() => {
    if (!sourceToast) return;
    const t = setTimeout(() => setSourceToast(null), 3500);
    return () => clearTimeout(t);
  }, [sourceToast]);

  const handleAcceptSource = (sourceId: string) => {
    setSourceStatuses((prev) => ({ ...prev, [sourceId]: 'accepted' }));
  };

  const handleRejectSource = async (sourceId: string) => {
    setSourceStatuses((prev) => ({ ...prev, [sourceId]: 'rejected' }));
    setIsRequestingReplacement(true);

    try {
      // Request AI to generate replacement source
      const response = await api.post('/api/v3/workflow/replace-source', {
        workflowId: workflow._id,
        rejectedSourceId: sourceId,
        moduleId: (workflow.step5?.sources || []).find((s: Source) => s.id === sourceId)?.moduleId,
      });

      if (response.data?.data?.replacementSource) {
        setReplacementSources((prev) => ({
          ...prev,
          [sourceId]: [...(prev[sourceId] || []), response.data.data.replacementSource],
        }));
      }
    } catch (error) {
      console.error('Failed to request replacement source:', error);
    } finally {
      setIsRequestingReplacement(false);
    }
  };

  // Handle editing a source
  const handleEditSource = (source: Source) => {
    setEditingSource(source);
  };

  // Handle saving edited source
  const handleSaveSource = async (updatedSource: Source) => {
    setIsSavingEdit(true);
    setError(null);

    console.log('Saving source:', updatedSource);
    console.log('Workflow ID:', workflow._id);
    console.log('Source ID:', updatedSource.id);

    try {
      const response = await api.put(
        `/api/v3/workflow/${workflow._id}/step5/source/${updatedSource.id}`,
        {
          title: updatedSource.title,
          authors: updatedSource.authors,
          year: updatedSource.year,
          citation: updatedSource.citation,
          doi: updatedSource.doi,
          url: updatedSource.url,
          category: updatedSource.category,
          type: updatedSource.type,
          complexityLevel: updatedSource.complexityLevel,
          accessStatus: updatedSource.accessStatus,
        }
      );

      console.log('Save response:', response.data);

      // Close modal first
      setEditingSource(null);

      // Force refresh the workflow data
      console.log('Refreshing workflow data...');
      await onRefresh();
      console.log('Refresh complete');
    } catch (err: any) {
      console.error('Failed to save source:', err);
      console.error('Error response:', err.response?.data);
      setError(err.response?.data?.error || err.message || 'Failed to save changes');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Handle canceling source edit
  const handleCancelSourceEdit = () => {
    setEditingSource(null);
  };

  // Add source — when a file is attached, upload it to GridFS first
  // (POST /api/v3/files/upload), then POST the source with the file
  // reference. Backend builds the full Source with userAdded=true.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleAddSource = async (payload: any, file?: File | null) => {
    setIsAddingSource(true);
    setError(null);
    try {
      let uploadedFile;
      if (file) {
        const form = new FormData();
        form.append('file', file);
        const uploadResp = await api.post('/api/v3/files/upload', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        uploadedFile = uploadResp.data?.data;
      }
      await api.post(`/api/v3/workflow/${workflow._id}/step5/source`, {
        ...payload,
        ...(uploadedFile ? { uploadedFile } : {}),
      });
      setAddingSource(false);
      await onRefresh();
      setSourceToast({
        type: 'success',
        text: file ? 'Resource + file added' : 'Resource added',
      });
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to add resource';
      setError(msg);
      setSourceToast({ type: 'error', text: msg });
    } finally {
      setIsAddingSource(false);
    }
  };

  // Delete source — confirmed inline, hits DELETE /step5/source/:id.
  const handleDeleteSource = async (source: Source) => {
    if (!confirm(`Remove "${source.title}" from the sources list?`)) return;
    setError(null);
    try {
      await api.delete(`/api/v3/workflow/${workflow._id}/step5/source/${source.id}`);
      await onRefresh();
      setSourceToast({ type: 'success', text: 'Resource removed' });
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to remove resource';
      setError(msg);
      setSourceToast({ type: 'error', text: msg });
    }
  };

  const submitStep5 = useSubmitStep5();
  const approveStep5 = useApproveStep5();
  const [error, setError] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const { startGeneration, completeGeneration, failGeneration, isGenerating } = useGeneration();

  // Background job polling for Step 5
  const {
    status: stepStatus,
    startPolling,
    isPolling,
    isGenerationActive: isQueueActive,
  } = useStepStatus(workflow._id, 5, {
    pollInterval: 10000,
    autoStart: true,
    onComplete: () => {
      completeGeneration(workflow._id, 5);
      onRefresh();
    },
    onFailed: (err) => {
      failGeneration(workflow._id, 5, err);
      setError(err);
    },
  });

  const isCurrentlyGenerating =
    isGenerating(workflow._id, 5) || submitStep5.isPending || isPolling || isQueueActive;

  // Check for completion when data appears
  useEffect(() => {
    if ((workflow.step5?.sources?.length ?? 0) > 0 || (workflow.step5?.totalSources ?? 0) > 0) {
      completeGeneration(workflow._id, 5);
    }
  }, [workflow.step5, workflow._id, completeGeneration]);

  const handleGenerate = async () => {
    setError(null);
    startGeneration(workflow._id, 5, 120);
    try {
      const response = await submitStep5.mutateAsync(workflow._id);
      if ((response as any)?.data?.jobId) {
        startPolling();
      } else {
        completeGeneration(workflow._id, 5);
        onRefresh();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate sources';
      console.error('Failed to generate sources:', err);
      failGeneration(workflow._id, 5, errorMessage);
      setError(errorMessage);
    }
  };

  const handleApprove = async () => {
    setError(null);
    try {
      await approveStep5.mutateAsync(workflow._id);
      onComplete();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to approve Step 5';
      console.error('Failed to approve Step 5:', err);
      setError(errorMessage);
    }
  };

  const hasStep5Data =
    workflow.step5 && (workflow.step5.sources?.length > 0 || workflow.step5.totalSources > 0);
  const isApproved = !!workflow.step5?.approvedAt;
  const validation = workflow.step5?.validationReport;

  // Get sources for selected module or all
  const displayedSources =
    selectedModule && workflow.step5?.sourcesByModule
      ? workflow.step5.sourcesByModule[selectedModule] || []
      : workflow.step5?.sources || [];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Show generating state even when navigating back */}
      {isCurrentlyGenerating && !hasStep5Data && (
        <div className="mb-6 bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <div>
              <h3 className="text-lg font-semibold text-teal-800">
                Generating Topic-Level Sources...
              </h3>
              <p className="text-sm text-teal-600">
                This may take 2 minutes. You can navigate away and come back.
              </p>
            </div>
          </div>
          <GenerationProgressBar
            workflowId={workflow._id}
            step={5}
            queueStatus={stepStatus?.status}
          />
        </div>
      )}

      {!hasStep5Data && !isCurrentlyGenerating ? (
        // Generation Form
        <div className="space-y-6">
          {/* About This Step */}
          <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-5">
            <h3 className="text-amber-400 font-semibold mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
              Step 5: Topic-Level Sources (AGI Academic Standards)
            </h3>
            <p className="text-sm text-teal-700 mb-4">
              The AI will identify high-quality academic and professional sources for each module,
              validated against <strong className="text-amber-300">AGI Academic Standards</strong>{' '}
              with APA 7th edition citations.
            </p>

            {/* AGI Standards Summary */}
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="bg-white rounded-lg p-3">
                <p className="text-emerald-400 font-medium mb-2">✓ Approved Sources</p>
                <ul className="text-xs text-teal-600 space-y-1">
                  <li>• Peer-reviewed academic journals</li>
                  <li>• Published academic textbooks</li>
                  <li>• Professional body publications (SHRM, PMI, etc.)</li>
                  <li>• Open-access repositories (DOAJ, PubMed)</li>
                </ul>
              </div>
              <div className="bg-white rounded-lg p-3">
                <p className="text-red-400 font-medium mb-2">✗ Prohibited Sources</p>
                <ul className="text-xs text-teal-600 space-y-1">
                  <li>• Blogs, Wikipedia, Medium</li>
                  <li>• AI-generated content</li>
                  <li>• Marketing materials</li>
                  <li>• Unverified sources</li>
                </ul>
              </div>
              <div className="bg-white rounded-lg p-3">
                <p className="text-cyan-400 font-medium mb-2">📅 Recency Rules</p>
                <ul className="text-xs text-teal-600 space-y-1">
                  <li>• Standard: Within past 5 years</li>
                  <li>• Seminal: &gt;5 years with justification + recent pairing</li>
                </ul>
              </div>
              <div className="bg-white rounded-lg p-3">
                <p className="text-purple-400 font-medium mb-2">📊 Requirements</p>
                <ul className="text-xs text-teal-600 space-y-1">
                  <li>• 2-3 sources per topic</li>
                  <li>• ≥50% peer-reviewed per module</li>
                  <li>• Academic + Applied balance</li>
                </ul>
              </div>
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
            className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-teal-800 font-medium rounded-lg transition-all disabled:opacity-50"
          >
            {isCurrentlyGenerating ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating AGI-Compliant Sources...
              </span>
            ) : (
              'Generate Topic-Level Sources'
            )}
          </button>
        </div>
      ) : (
        // Display Generated Sources
        <div className="space-y-6">
          {/* Overall Stats */}
          <div className="grid grid-cols-5 gap-4">
            <div className="bg-white rounded-xl p-4 border border-teal-200 text-center">
              <p className="text-3xl font-bold text-teal-800">
                {workflow.step5?.totalSources || workflow.step5?.sources?.length || 0}
              </p>
              <p className="text-xs text-teal-500 mt-1">Total Sources</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-teal-200 text-center">
              <p
                className={`text-3xl font-bold ${(workflow.step5?.peerReviewedPercent || 0) >= 50 ? 'text-emerald-400' : 'text-amber-400'}`}
              >
                {workflow.step5?.peerReviewedPercent || 0}%
              </p>
              <p className="text-xs text-teal-500 mt-1">Peer-Reviewed</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-teal-200 text-center">
              <p className="text-3xl font-bold text-cyan-400">
                {workflow.step5?.recentSourcesPercent || 0}%
              </p>
              <p className="text-xs text-teal-500 mt-1">Recent (&lt;5yr)</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-teal-200 text-center">
              <p
                className={`text-3xl font-bold ${workflow.step5?.academicAppliedBalance ? 'text-emerald-400' : 'text-amber-400'}`}
              >
                {workflow.step5?.academicAppliedBalance ? '✓' : '⚠'}
              </p>
              <p className="text-xs text-teal-500 mt-1">Balance</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-teal-200 text-center">
              <p
                className={`text-3xl font-bold ${workflow.step5?.agiCompliant ? 'text-emerald-400' : 'text-red-400'}`}
              >
                {workflow.step5?.agiCompliant ? '✓' : '✗'}
              </p>
              <p className="text-xs text-teal-500 mt-1">AGI Compliant</p>
            </div>
          </div>

          {/* Validation Report */}
          {validation && (
            <div
              className={`rounded-lg p-4 border ${workflow.step5?.agiCompliant ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}
            >
              <h4
                className={`font-medium mb-3 ${workflow.step5?.agiCompliant ? 'text-emerald-400' : 'text-amber-400'}`}
              >
                AGI Standards Validation
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <span
                  className={validation.allSourcesApproved ? 'text-emerald-400' : 'text-red-400'}
                >
                  {validation.allSourcesApproved ? '✓' : '✗'} Approved Sources
                </span>
                <span
                  className={validation.recencyCompliance ? 'text-emerald-400' : 'text-red-400'}
                >
                  {validation.recencyCompliance ? '✓' : '✗'} Recency
                </span>
                <span
                  className={
                    validation.minimumSourcesPerTopic ? 'text-emerald-400' : 'text-red-400'
                  }
                >
                  {validation.minimumSourcesPerTopic ? '✓' : '✗'} Min Sources
                </span>
                <span
                  className={
                    validation.academicAppliedBalance ? 'text-emerald-400' : 'text-red-400'
                  }
                >
                  {validation.academicAppliedBalance ? '✓' : '✗'} Balance
                </span>
                <span className={validation.peerReviewRatio ? 'text-emerald-400' : 'text-red-400'}>
                  {validation.peerReviewRatio ? '✓' : '✗'} Peer-Review ≥50%
                </span>
                <span
                  className={validation.completeCitations ? 'text-emerald-400' : 'text-red-400'}
                >
                  {validation.completeCitations ? '✓' : '✗'} Complete Citations
                </span>
                <span className={validation.apaAccuracy ? 'text-emerald-400' : 'text-red-400'}>
                  {validation.apaAccuracy ? '✓' : '✗'} APA ≥95%
                </span>
                <span
                  className={validation.everyMLOSupported ? 'text-emerald-400' : 'text-red-400'}
                >
                  {validation.everyMLOSupported ? '✓' : '✗'} All MLOs Supported
                </span>
              </div>

              {/* Compliance Issues */}
              {workflow.step5?.complianceIssues && workflow.step5.complianceIssues.length > 0 && (
                <div className="mt-3 pt-3 border-t border-teal-200/50">
                  <p className="text-amber-400 text-sm font-medium mb-2">Issues to Resolve:</p>
                  <ul className="text-xs text-teal-600 space-y-1">
                    {workflow.step5.complianceIssues.map((issue, i) => (
                      <li key={i}>• {issue}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Module Summaries */}
          {workflow.step5?.moduleSummaries && workflow.step5.moduleSummaries.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-teal-800 mb-4">Module Summaries</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {workflow.step5.moduleSummaries.map((summary) => (
                  <ModuleSummaryCard key={summary.moduleId} summary={summary} />
                ))}
              </div>
            </div>
          )}

          {/* Module Filter */}
          {workflow.step5?.sourcesByModule &&
            Object.keys(workflow.step5.sourcesByModule).length > 0 && (
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setSelectedModule(null)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    selectedModule === null
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500'
                      : 'bg-white text-teal-600 border border-teal-200 hover:border-teal-300'
                  }`}
                >
                  All Modules
                </button>
                {Object.keys(workflow.step5.sourcesByModule).map((modId) => (
                  <button
                    key={modId}
                    onClick={() => setSelectedModule(modId)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      selectedModule === modId
                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500'
                        : 'bg-white text-teal-600 border border-teal-200 hover:border-teal-300'
                    }`}
                  >
                    {modId}
                  </button>
                ))}
              </div>
            )}

          {/* Sources List */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-teal-800">
                Sources ({displayedSources.length})
              </h3>
              {workflow.step4?.modules && workflow.step4.modules.length > 0 && (
                <button
                  onClick={() => setAddingSource(true)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700 border border-cyan-200 rounded-lg text-sm font-medium transition-colors"
                >
                  <span className="text-lg leading-none">+</span>
                  Add resource
                  {selectedModule && (
                    <span className="text-xs text-cyan-500">to {selectedModule}</span>
                  )}
                </button>
              )}
            </div>
            <div className="space-y-3">
              {displayedSources.map((source) => (
                <SourceCard
                  key={source.id}
                  source={source}
                  onEdit={handleEditSource}
                  onDelete={handleDeleteSource}
                />
              ))}
            </div>
          </div>

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
              disabled={submitStep5.isPending}
              className="px-4 py-2 text-teal-600 hover:text-teal-600 transition-colors"
            >
              Regenerate
            </button>
            <div className="flex gap-3">
              {!isApproved && (
                <button
                  onClick={handleApprove}
                  disabled={approveStep5.isPending}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-teal-800 font-medium rounded-lg transition-all disabled:opacity-50"
                >
                  {approveStep5.isPending ? 'Approving...' : 'Approve & Continue →'}
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
              {!!workflow.step5 && (
                <StepDownloadButton
                  workflowId={workflow._id}
                  stepNumber={5}
                  programName={workflow.projectName || workflow.step1?.programTitle || ''}
                />
              )}
            </div>
          </div>

          {!workflow.step5?.agiCompliant && !isApproved && (
            <p className="text-xs text-amber-400 text-center">
              Note: Some AGI standards not fully met. Approval will proceed with warnings logged.
            </p>
          )}
        </div>
      )}

      {/* Source Edit Modal */}
      {editingSource && (
        <SourceEditModal
          source={editingSource}
          onSave={handleSaveSource}
          onCancel={handleCancelSourceEdit}
          isSaving={isSavingEdit}
        />
      )}

      {/* Source Add Modal */}
      {addingSource && workflow.step4?.modules && (
        <SourceAddModal
          moduleOptions={workflow.step4.modules.map((m) => ({
            id: m.id,
            code: m.code,
            title: m.title,
          }))}
          defaultModuleId={selectedModule || workflow.step4.modules[0]?.id || ''}
          onSave={handleAddSource}
          onCancel={() => setAddingSource(false)}
          isSaving={isAddingSource}
        />
      )}

      {/* Add / delete toast */}
      {sourceToast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 right-6 z-[60] px-4 py-3 rounded-lg shadow-lg border text-sm font-medium ${
            sourceToast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          {sourceToast.text}
        </div>
      )}
    </div>
  );
}
