'use client';

import { useState, useEffect } from 'react';
import { useSubmitStep9, useApproveStep9 } from '@/hooks/useWorkflow';
import { api } from '@/lib/api';
import { CurriculumWorkflow, GlossaryTerm, ModuleTermList, TermPriority } from '@/types/workflow';
import { useGeneration, GenerationProgressBar } from '@/contexts/GenerationContext';
import { useStepStatus } from '@/hooks/useStepStatus';
import { EditTarget } from './EditWithAIButton';

interface Props {
  workflow: CurriculumWorkflow;
  onComplete: () => void;
  onRefresh: () => void;
  onOpenCanvas?: (target: EditTarget) => void;
}

// Priority colors
const PRIORITY_COLORS: Record<TermPriority, string> = {
  must_include: 'bg-red-500/20 text-red-400 border-red-500/30',
  should_include: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  optional: 'bg-teal-400/20 text-teal-600 border-teal-400/30',
};

const PRIORITY_LABELS: Record<TermPriority, string> = {
  must_include: 'Must Include',
  should_include: 'Should Include',
  optional: 'Optional',
};

// Glossary Term Edit Modal Component
function GlossaryTermEditModal({
  term,
  onSave,
  onCancel,
  isSaving,
}: {
  term: GlossaryTerm;
  onSave: (updatedTerm: GlossaryTerm) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [termText, setTermText] = useState(term.term || '');
  const [definition, setDefinition] = useState(term.definition || '');
  const [exampleSentence, setExampleSentence] = useState(term.exampleSentence || '');
  const [technicalNote, setTechnicalNote] = useState(term.technicalNote || '');
  const [relatedTerms, setRelatedTerms] = useState<string[]>(term.relatedTerms || []);
  const [broaderTerms, setBroaderTerms] = useState<string[]>(term.broaderTerms || []);
  const [narrowerTerms, setNarrowerTerms] = useState<string[]>(term.narrowerTerms || []);
  const [synonyms, setSynonyms] = useState<string[]>(term.synonyms || []);
  const [isAcronym, setIsAcronym] = useState(term.isAcronym || false);
  const [acronymExpansion, setAcronymExpansion] = useState(term.acronymExpansion || '');
  const [category, setCategory] = useState(term.category || '');
  const [priority, setPriority] = useState<TermPriority>(term.priority || 'should_include');
  const [usedInAssessment, setUsedInAssessment] = useState(term.usedInAssessment || false);
  const [relatedInput, setRelatedInput] = useState('');
  const [broaderInput, setBroaderInput] = useState('');
  const [narrowerInput, setNarrowerInput] = useState('');
  const [synonymInput, setSynonymInput] = useState('');

  const wordCount = definition.split(/\s+/).filter(Boolean).length;

  const handleSave = () => {
    onSave({
      ...term,
      term: termText,
      definition,
      wordCount,
      exampleSentence,
      technicalNote,
      relatedTerms,
      broaderTerms,
      narrowerTerms,
      synonyms,
      isAcronym,
      acronymExpansion,
      category,
      priority,
      usedInAssessment,
    });
  };

  const addRelatedTerm = () => {
    if (relatedInput.trim()) {
      setRelatedTerms([...relatedTerms, relatedInput.trim()]);
      setRelatedInput('');
    }
  };

  const removeRelatedTerm = (index: number) => {
    setRelatedTerms(relatedTerms.filter((_, i) => i !== index));
  };

  const addBroaderTerm = () => {
    if (broaderInput.trim()) {
      setBroaderTerms([...broaderTerms, broaderInput.trim()]);
      setBroaderInput('');
    }
  };

  const removeBroaderTerm = (index: number) => {
    setBroaderTerms(broaderTerms.filter((_, i) => i !== index));
  };

  const addNarrowerTerm = () => {
    if (narrowerInput.trim()) {
      setNarrowerTerms([...narrowerTerms, narrowerInput.trim()]);
      setNarrowerInput('');
    }
  };

  const removeNarrowerTerm = (index: number) => {
    setNarrowerTerms(narrowerTerms.filter((_, i) => i !== index));
  };

  const addSynonym = () => {
    if (synonymInput.trim()) {
      setSynonyms([...synonyms, synonymInput.trim()]);
      setSynonymInput('');
    }
  };

  const removeSynonym = (index: number) => {
    setSynonyms(synonyms.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 bg-teal-900/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl border border-teal-200 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-teal-200">
          <h3 className="text-lg font-semibold text-teal-800 flex items-center gap-2">
            Edit <span className="text-emerald-400">Glossary Term</span>
          </h3>
        </div>

        <div className="p-6 space-y-5">
          {/* Term */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">Term</label>
            <input
              type="text"
              value={termText}
              onChange={(e) => setTermText(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-emerald-500"
              placeholder="Enter term..."
            />
          </div>

          {/* Definition */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">
              Definition
              <span
                className={`ml-2 text-xs ${wordCount >= 20 && wordCount <= 40 ? 'text-emerald-400' : 'text-amber-400'}`}
              >
                ({wordCount}/20-40 words)
              </span>
            </label>
            <textarea
              value={definition}
              onChange={(e) => setDefinition(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-emerald-500 resize-none"
              placeholder="Enter definition (20-40 words)..."
            />
          </div>

          {/* Category and Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-teal-700 mb-2">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-emerald-500"
                placeholder="e.g., Technical, Business"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-teal-700 mb-2">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TermPriority)}
                className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 focus:outline-none focus:border-emerald-500"
              >
                <option value="must_include">Must Include</option>
                <option value="should_include">Should Include</option>
                <option value="optional">Optional</option>
              </select>
            </div>
          </div>

          {/* Acronym */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isAcronym"
                checked={isAcronym}
                onChange={(e) => setIsAcronym(e.target.checked)}
                className="w-4 h-4 text-emerald-600 bg-teal-50 border-teal-300 rounded focus:ring-emerald-500"
              />
              <label htmlFor="isAcronym" className="text-sm text-teal-700">
                Is Acronym
              </label>
            </div>
            {isAcronym && (
              <div>
                <label className="block text-sm font-medium text-teal-700 mb-2">
                  Acronym Expansion
                </label>
                <input
                  type="text"
                  value={acronymExpansion}
                  onChange={(e) => setAcronymExpansion(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-emerald-500"
                  placeholder="Full form of acronym..."
                />
              </div>
            )}
          </div>

          {/* Used in Assessment */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="usedInAssessment"
              checked={usedInAssessment}
              onChange={(e) => setUsedInAssessment(e.target.checked)}
              className="w-4 h-4 text-emerald-600 bg-teal-50 border-teal-300 rounded focus:ring-emerald-500"
            />
            <label htmlFor="usedInAssessment" className="text-sm text-teal-700">
              Used in Assessment
            </label>
          </div>

          {/* Example Sentence */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">
              Example Sentence (Optional)
            </label>
            <textarea
              value={exampleSentence}
              onChange={(e) => setExampleSentence(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-emerald-500 resize-none"
              placeholder="Example sentence demonstrating usage..."
            />
          </div>

          {/* Technical Note */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">
              Technical Note (Optional)
            </label>
            <textarea
              value={technicalNote}
              onChange={(e) => setTechnicalNote(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-emerald-500 resize-none"
              placeholder="Additional technical details..."
            />
          </div>

          {/* Related Terms */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">Related Terms</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={relatedInput}
                onChange={(e) => setRelatedInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addRelatedTerm())}
                className="flex-1 px-4 py-2 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-emerald-500"
                placeholder="Add a related term..."
              />
              <button
                type="button"
                onClick={addRelatedTerm}
                className="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors"
              >
                Add
              </button>
            </div>
            {relatedTerms.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {relatedTerms.map((relatedTerm, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-sm flex items-center gap-2"
                  >
                    {relatedTerm}
                    <button
                      type="button"
                      onClick={() => removeRelatedTerm(i)}
                      className="text-teal-500 hover:text-red-400"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Broader and Narrower Terms */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-teal-700 mb-2">Broader Terms</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={broaderInput}
                  onChange={(e) => setBroaderInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addBroaderTerm())}
                  className="flex-1 px-4 py-2 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-emerald-500"
                  placeholder="Add broader term..."
                />
                <button
                  type="button"
                  onClick={addBroaderTerm}
                  className="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors"
                >
                  Add
                </button>
              </div>
              {broaderTerms.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {broaderTerms.map((broaderTerm, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-teal-100 text-teal-700 rounded text-xs flex items-center gap-1"
                    >
                      {broaderTerm}
                      <button
                        type="button"
                        onClick={() => removeBroaderTerm(i)}
                        className="text-teal-500 hover:text-red-400"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-teal-700 mb-2">Narrower Terms</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={narrowerInput}
                  onChange={(e) => setNarrowerInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addNarrowerTerm())}
                  className="flex-1 px-4 py-2 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-emerald-500"
                  placeholder="Add narrower term..."
                />
                <button
                  type="button"
                  onClick={addNarrowerTerm}
                  className="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors"
                >
                  Add
                </button>
              </div>
              {narrowerTerms.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {narrowerTerms.map((narrowerTerm, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-teal-100 text-teal-700 rounded text-xs flex items-center gap-1"
                    >
                      {narrowerTerm}
                      <button
                        type="button"
                        onClick={() => removeNarrowerTerm(i)}
                        className="text-teal-500 hover:text-red-400"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Synonyms */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">Synonyms</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={synonymInput}
                onChange={(e) => setSynonymInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSynonym())}
                className="flex-1 px-4 py-2 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-emerald-500"
                placeholder="Add a synonym..."
              />
              <button
                type="button"
                onClick={addSynonym}
                className="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors"
              >
                Add
              </button>
            </div>
            {synonyms.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {synonyms.map((synonym, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-sm flex items-center gap-2"
                  >
                    {synonym}
                    <button
                      type="button"
                      onClick={() => removeSynonym(i)}
                      className="text-teal-500 hover:text-red-400"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
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
            disabled={isSaving || !termText.trim() || !definition.trim()}
            className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-teal-800 font-medium rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
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

// Term Card Component
function TermCard({ term, onEdit }: { term: GlossaryTerm; onEdit?: (term: GlossaryTerm) => void }) {
  const [expanded, setExpanded] = useState(false);
  const definitionValid = term.wordCount >= 20 && term.wordCount <= 40;

  return (
    <div className="bg-white rounded-lg border border-teal-200 overflow-hidden">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <h4 className="text-teal-800 font-semibold">{term.term}</h4>
            {term.isAcronym && (
              <span className="text-xs px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 rounded">
                Acronym
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-2 py-0.5 rounded border ${PRIORITY_COLORS[term.priority]}`}
            >
              {PRIORITY_LABELS[term.priority]}
            </span>
            {term.usedInAssessment && (
              <span className="text-xs px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                📝 Assessment
              </span>
            )}
          </div>
        </div>

        {/* Acronym Expansion */}
        {term.isAcronym && term.acronymExpansion && (
          <p className="text-sm text-cyan-400 mb-2">→ {term.acronymExpansion}</p>
        )}

        {/* Definition */}
        <p className="text-sm text-teal-700 mb-2">{term.definition}</p>
        <span className={`text-xs ${definitionValid ? 'text-teal-500' : 'text-amber-400'}`}>
          {term.wordCount} words {!definitionValid && '(should be 20-40)'}
        </span>

        {/* Example Sentence */}
        {term.exampleSentence && (
          <div className="mt-2 bg-teal-50 rounded p-2">
            <p className="text-xs text-teal-500 mb-1">Example:</p>
            <p className="text-sm text-teal-600 italic">"{term.exampleSentence}"</p>
          </div>
        )}

        {/* Category and Modules */}
        <div className="mt-3 flex items-center gap-3 text-xs">
          {term.category && (
            <span className="px-2 py-0.5 bg-teal-100 rounded text-teal-600">{term.category}</span>
          )}
          {term.sourceModules && term.sourceModules.length > 0 && (
            <span className="text-teal-500">Used in: {term.sourceModules.join(', ')}</span>
          )}
        </div>

        {/* Edit Button */}
        {onEdit && (
          <div className="mt-2">
            <button
              onClick={() => onEdit(term)}
              className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Edit
            </button>
          </div>
        )}
      </div>

      {/* Expand Button */}
      {(term.relatedTerms?.length || term.technicalNote || term.synonyms?.length) && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full px-4 py-2 flex items-center justify-between text-xs text-teal-600 hover:bg-teal-50/30 transition-colors border-t border-teal-200/50"
          >
            <span>
              {term.relatedTerms?.length ? `${term.relatedTerms.length} related` : ''}
              {term.synonyms?.length ? ` · ${term.synonyms.length} synonyms` : ''}
            </span>
            <svg
              className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {expanded && (
            <div className="px-4 pb-4 space-y-3 border-t border-teal-200/50">
              {/* Technical Note */}
              {term.technicalNote && (
                <div className="pt-3">
                  <p className="text-xs text-teal-500 mb-1">Technical Note:</p>
                  <p className="text-sm text-teal-600">{term.technicalNote}</p>
                </div>
              )}

              {/* Related Terms */}
              {term.relatedTerms && term.relatedTerms.length > 0 && (
                <div>
                  <p className="text-xs text-teal-500 mb-1">Related Terms:</p>
                  <div className="flex flex-wrap gap-1">
                    {term.relatedTerms.map((rt) => (
                      <span
                        key={rt}
                        className="text-xs px-2 py-0.5 bg-cyan-500/10 text-cyan-400 rounded"
                      >
                        {rt}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Broader/Narrower Terms */}
              {(term.broaderTerms?.length || term.narrowerTerms?.length) && (
                <div className="flex gap-4">
                  {term.broaderTerms && term.broaderTerms.length > 0 && (
                    <div>
                      <p className="text-xs text-teal-500 mb-1">Broader:</p>
                      <span className="text-xs text-teal-600">{term.broaderTerms.join(', ')}</span>
                    </div>
                  )}
                  {term.narrowerTerms && term.narrowerTerms.length > 0 && (
                    <div>
                      <p className="text-xs text-teal-500 mb-1">Narrower:</p>
                      <span className="text-xs text-teal-600">{term.narrowerTerms.join(', ')}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Synonyms */}
              {term.synonyms && term.synonyms.length > 0 && (
                <div>
                  <p className="text-xs text-teal-500 mb-1">Synonyms:</p>
                  <span className="text-xs text-teal-600">{term.synonyms.join(', ')}</span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Module Term List Card
function ModuleTermListCard({ moduleList }: { moduleList: ModuleTermList }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-teal-50/50 rounded-lg border border-teal-200 overflow-hidden">
      <div
        className="p-4 cursor-pointer hover:bg-teal-50/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-teal-800 font-medium">{moduleList.moduleTitle}</h4>
            <p className="text-xs text-teal-500">{moduleList.moduleId}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-cyan-400">{moduleList.termCount}</span>
            <svg
              className={`w-5 h-5 text-teal-600 transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-teal-200/50 pt-3">
          <div className="flex flex-wrap gap-2">
            {moduleList.terms.map((term) => (
              <span
                key={term.id}
                className="text-xs px-2 py-1 bg-white rounded text-teal-700 hover:bg-teal-100 cursor-default"
                title={term.definition}
              >
                {term.term}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Step9View({ workflow, onComplete: _onComplete, onRefresh }: Props) {
  const submitStep9 = useSubmitStep9();
  const approveStep9 = useApproveStep9();
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'alphabetical' | 'modules'>('alphabetical');
  const [justGenerated, setJustGenerated] = useState(false);
  const { startGeneration, completeGeneration, failGeneration, isGenerating } = useGeneration();

  // Background job polling for Step 9
  const {
    status: stepStatus,
    startPolling,
    isPolling,
    isGenerationActive: isQueueActive,
  } = useStepStatus(workflow._id, 9, {
    pollInterval: 10000,
    autoStart: true, // Detect ongoing generation on mount
    onComplete: () => {
      completeGeneration(workflow._id, 9);
      onRefresh();
      setJustGenerated(true);
    },
    onFailed: (err) => {
      failGeneration(workflow._id, 9, err);
      setError(err);
    },
  });

  // Edit state for glossary terms
  const [editingTerm, setEditingTerm] = useState<GlossaryTerm | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const isCurrentlyGenerating =
    isGenerating(workflow._id, 9) || submitStep9.isPending || isPolling || isQueueActive;

  // Check for completion when data appears
  useEffect(() => {
    if ((workflow.step9?.terms?.length ?? 0) > 0) {
      completeGeneration(workflow._id, 9);
    }
  }, [workflow.step9, workflow._id, completeGeneration]);

  const handleGenerate = async () => {
    setError(null);
    startGeneration(workflow._id, 9, 45);
    try {
      const response = await submitStep9.mutateAsync(workflow._id);
      // Check if async (202 with jobId) or sync (200 with data)
      if ((response as any)?.data?.jobId) {
        // Async: start polling for completion
        startPolling();
      } else {
        // Sync fallback: generation already completed
        completeGeneration(workflow._id, 9);
        await onRefresh();
        setJustGenerated(true);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate glossary';
      console.error('Failed to generate glossary:', err);
      failGeneration(workflow._id, 9, errorMessage);
      setError(errorMessage);
    }
  };

  const handleApprove = async () => {
    setError(null);
    try {
      await approveStep9.mutateAsync(workflow._id);
      await onRefresh();
      _onComplete();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to approve Step 9';
      console.error('Failed to approve Step 9:', err);
      setError(errorMessage);
    }
  };

  // Handle editing a glossary term
  const handleEditTerm = (term: GlossaryTerm) => {
    setEditingTerm(term);
  };

  // Handle saving edited glossary term
  const handleSaveTerm = async (updatedTerm: GlossaryTerm) => {
    setIsSavingEdit(true);
    setError(null);

    console.log('Saving glossary term:', updatedTerm);
    console.log('Workflow ID:', workflow._id);
    console.log('Term ID:', updatedTerm.id);

    try {
      const response = await api.put(
        `/api/v3/workflow/${workflow._id}/step9/term/${updatedTerm.id}`,
        {
          term: updatedTerm.term,
          definition: updatedTerm.definition,
          exampleSentence: updatedTerm.exampleSentence,
          technicalNote: updatedTerm.technicalNote,
          relatedTerms: updatedTerm.relatedTerms,
          broaderTerms: updatedTerm.broaderTerms,
          narrowerTerms: updatedTerm.narrowerTerms,
          synonyms: updatedTerm.synonyms,
          isAcronym: updatedTerm.isAcronym,
          acronymExpansion: updatedTerm.acronymExpansion,
          category: updatedTerm.category,
          priority: updatedTerm.priority,
          usedInAssessment: updatedTerm.usedInAssessment,
        }
      );

      console.log('Save response:', response.data);

      // Close modal first
      setEditingTerm(null);

      // Force refresh the workflow data
      console.log('Refreshing workflow data...');
      await onRefresh();
      console.log('Refresh complete');
    } catch (err: any) {
      console.error('Failed to save glossary term:', err);
      console.error('Error response:', err.response?.data);
      setError(err.response?.data?.error || err.message || 'Failed to save changes');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Handle canceling term edit
  const handleCancelTermEdit = () => {
    setEditingTerm(null);
  };

  const hasStep9Data = workflow.step9 && workflow.step9.terms?.length > 0;
  const isApproved =
    workflow.status === 'step9_complete' ||
    workflow.status === 'step10_pending' ||
    workflow.status === 'step10_complete' ||
    workflow.status === 'step11_pending' ||
    workflow.status === 'step11_complete' ||
    workflow.status === 'review_pending' ||
    workflow.status === 'published';
  const validation = workflow.step9?.validationReport;

  // Filter terms
  const filteredTerms =
    workflow.step9?.terms?.filter((term) => {
      const matchesSearch = searchTerm
        ? term.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
          term.definition.toLowerCase().includes(searchTerm.toLowerCase())
        : true;
      const matchesCategory = selectedCategory ? term.category === selectedCategory : true;
      return matchesSearch && matchesCategory;
    }) || [];

  // Sort alphabetically
  const sortedTerms = [...filteredTerms].sort((a, b) => a.term.localeCompare(b.term));

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Show generating state even when navigating back */}
      {isCurrentlyGenerating && !hasStep9Data && (
        <div className="mb-6 bg-gradient-to-br from-emerald-500/10 to-green-500/10 border border-emerald-500/30 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <div>
              <h3 className="text-lg font-semibold text-teal-800">Generating Glossary...</h3>
              <p className="text-sm text-teal-600">
                This may take 45 seconds. You can navigate away and come back.
              </p>
            </div>
          </div>
          <GenerationProgressBar
            workflowId={workflow._id}
            step={9}
            queueStatus={stepStatus?.status}
          />
        </div>
      )}

      {!hasStep9Data && !isCurrentlyGenerating ? (
        // Pre-Generation View
        <div className="space-y-6">
          {/* About This Step */}
          <div className="bg-gradient-to-br from-emerald-500/10 to-green-500/10 border border-emerald-500/30 rounded-xl p-5">
            <h3 className="text-emerald-400 font-semibold mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
              Step 9: Glossary (Auto-Generated)
            </h3>
            <p className="text-sm text-teal-700 mb-4">
              <strong className="text-emerald-400">No SME input required</strong> - this step runs
              automatically by harvesting and defining all key terms from your curriculum content.
            </p>

            {/* Harvesting Sources */}
            <div className="bg-white rounded-lg p-4 mb-4">
              <p className="text-teal-600 font-medium mb-3">Comprehensive Harvesting From:</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                <span className="px-2 py-1 bg-white rounded text-teal-700">
                  Step 1: Program Description
                </span>
                <span className="px-2 py-1 bg-white rounded text-teal-700">
                  Step 2: Competency Framework
                </span>
                <span className="px-2 py-1 bg-white rounded text-teal-700">Step 3: PLOs</span>
                <span className="px-2 py-1 bg-white rounded text-teal-700">Step 4: MLOs</span>
                <span className="px-2 py-1 bg-white rounded text-teal-700">
                  Steps 5-6: Reading Lists
                </span>
                <span className="px-2 py-1 bg-white rounded text-teal-700">
                  Step 7: Assessments
                </span>
                <span className="px-2 py-1 bg-white rounded text-teal-700">
                  Step 8: Case Studies
                </span>
              </div>
            </div>

            {/* Definition Quality */}
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="bg-white rounded-lg p-3">
                <p className="text-cyan-400 font-medium mb-2">Each Entry Includes:</p>
                <ul className="text-xs text-teal-600 space-y-1">
                  <li>• Main Definition (20-40 words)</li>
                  <li>• Example Sentence (optional)</li>
                  <li>• Technical Note (optional)</li>
                  <li>• Cross-References</li>
                  <li>• Module Mapping</li>
                </ul>
              </div>
              <div className="bg-white rounded-lg p-3">
                <p className="text-purple-400 font-medium mb-2">Term Priority:</p>
                <ul className="text-xs text-teal-600 space-y-1">
                  <li>
                    • <span className="text-red-400">Must Include:</span> Assessment terms,
                    Essential competencies
                  </li>
                  <li>
                    • <span className="text-amber-400">Should Include:</span> Reading titles, Case
                    study terms
                  </li>
                  <li>
                    • <span className="text-teal-600">May Exclude:</span> Common English words
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Final Step Banner */}
          <div className="text-center py-8">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-emerald-500/20 to-green-500/20 flex items-center justify-center">
              <span className="text-4xl">🎉</span>
            </div>
            <h3 className="text-xl font-semibold text-teal-800 mb-2">Final Step!</h3>
            <p className="text-teal-600 mb-2">
              Generate the glossary to complete your curriculum package
            </p>
            <p className="text-xs text-teal-500">
              Typical size: Certificate (30-50 terms) | Diploma (50-80 terms)
            </p>
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
            className="w-full py-4 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-teal-800 font-medium rounded-lg transition-all disabled:opacity-50"
          >
            {isCurrentlyGenerating ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating Glossary...
              </span>
            ) : (
              '🎉 Generate Glossary & Complete Workflow'
            )}
          </button>
        </div>
      ) : (
        // Display Generated Glossary
        <div className="space-y-6">
          {/* Completion Banner */}
          <div className="bg-gradient-to-r from-emerald-500/20 to-green-500/20 border border-emerald-500/30 rounded-xl p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-emerald-400 mb-2">
              {justGenerated
                ? '🎉 Glossary Generated!'
                : isApproved
                  ? 'Step 9 Approved!'
                  : 'Glossary Complete!'}
            </h3>
            <p className="text-teal-700 mb-4">
              {isApproved
                ? 'Step 9 is approved. You can now proceed to Step 10: Lesson Plans & PPT Generation.'
                : 'Review your glossary below and approve to continue to Step 10.'}
            </p>
            {!isApproved && (
              <button
                onClick={handleApprove}
                disabled={approveStep9.isPending}
                className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-teal-800 font-medium rounded-lg transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20"
              >
                {approveStep9.isPending ? 'Approving...' : 'Approve & Continue to Step 10 →'}
              </button>
            )}
            {isApproved && (
              <p className="text-cyan-400 text-sm animate-pulse">
                ✓ Approved - Navigate to Step 10 using the sidebar
              </p>
            )}
          </div>

          {/* Overall Stats */}
          <div className="grid grid-cols-5 gap-4">
            <div className="bg-white rounded-xl p-4 border border-teal-200 text-center">
              <p className="text-3xl font-bold text-teal-800">{workflow.step9?.totalTerms || 0}</p>
              <p className="text-xs text-teal-500 mt-1">Total Terms</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-teal-200 text-center">
              <p className="text-3xl font-bold text-cyan-400">
                {workflow.step9?.categories?.length || 0}
              </p>
              <p className="text-xs text-teal-500 mt-1">Categories</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-teal-200 text-center">
              <p className="text-3xl font-bold text-purple-400">
                {workflow.step9?.assessmentTermsCount || 0}
              </p>
              <p className="text-xs text-teal-500 mt-1">Assessment Terms</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-teal-200 text-center">
              <p className="text-3xl font-bold text-amber-400">
                {workflow.step9?.acronymCount || 0}
              </p>
              <p className="text-xs text-teal-500 mt-1">Acronyms</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-teal-200 text-center">
              <p
                className={`text-3xl font-bold ${workflow.step9?.isValid ? 'text-emerald-400' : 'text-red-400'}`}
              >
                {workflow.step9?.isValid ? '✓' : '✗'}
              </p>
              <p className="text-xs text-teal-500 mt-1">Valid</p>
            </div>
          </div>

          {/* Validation Report */}
          {validation && (
            <div
              className={`rounded-lg p-4 border ${workflow.step9?.isValid ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}
            >
              <h4
                className={`font-medium mb-3 ${workflow.step9?.isValid ? 'text-emerald-400' : 'text-amber-400'}`}
              >
                Validation Report
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <span
                  className={
                    validation.allAssessmentTermsIncluded ? 'text-emerald-400' : 'text-red-400'
                  }
                >
                  {validation.allAssessmentTermsIncluded ? '✓' : '✗'} 100% Assessment Terms
                </span>
                <span
                  className={validation.definitionLengthValid ? 'text-emerald-400' : 'text-red-400'}
                >
                  {validation.definitionLengthValid ? '✓' : '✗'} Definitions 20-40 words
                </span>
                <span
                  className={validation.noCircularDefinitions ? 'text-emerald-400' : 'text-red-400'}
                >
                  {validation.noCircularDefinitions ? '✓' : '✗'} No Circular Definitions
                </span>
                <span
                  className={
                    validation.allCrossReferencesValid ? 'text-emerald-400' : 'text-red-400'
                  }
                >
                  {validation.allCrossReferencesValid ? '✓' : '✗'} Cross-References Valid
                </span>
                <span
                  className={validation.ukEnglishConsistent ? 'text-emerald-400' : 'text-red-400'}
                >
                  {validation.ukEnglishConsistent ? '✓' : '✗'} UK English Consistent
                </span>
                <span
                  className={
                    validation.allTermsMappedToModule ? 'text-emerald-400' : 'text-red-400'
                  }
                >
                  {validation.allTermsMappedToModule ? '✓' : '✗'} All Mapped to Module
                </span>
                <span
                  className={validation.noDuplicateEntries ? 'text-emerald-400' : 'text-red-400'}
                >
                  {validation.noDuplicateEntries ? '✓' : '✗'} No Duplicates
                </span>
              </div>

              {/* Validation Issues */}
              {workflow.step9?.validationIssues && workflow.step9.validationIssues.length > 0 && (
                <div className="mt-3 pt-3 border-t border-teal-200/50">
                  <p className="text-amber-400 text-sm font-medium mb-1">Issues:</p>
                  <ul className="text-xs text-teal-600 space-y-1">
                    {workflow.step9.validationIssues.map((issue, i) => (
                      <li key={i}>• {issue}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Export Formats */}
          {workflow.step9?.exportFormats && (
            <div className="bg-white rounded-lg p-4 border border-teal-200">
              <h4 className="text-teal-800 font-medium mb-3">Available Export Formats</h4>
              <div className="flex flex-wrap gap-2">
                {workflow.step9.exportFormats.alphabeticalPDF && (
                  <span className="text-xs px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded">
                    📄 Alphabetical PDF
                  </span>
                )}
                {workflow.step9.exportFormats.moduleLinkedPDF && (
                  <span className="text-xs px-3 py-1 bg-blue-500/20 text-blue-400 rounded">
                    📚 Module-Linked PDF
                  </span>
                )}
                {workflow.step9.exportFormats.lmsImport && (
                  <span className="text-xs px-3 py-1 bg-purple-500/20 text-purple-400 rounded">
                    🔗 LMS Import
                  </span>
                )}
                {workflow.step9.exportFormats.spreadsheet && (
                  <span className="text-xs px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded">
                    📊 Spreadsheet
                  </span>
                )}
                {workflow.step9.exportFormats.mobileWeb && (
                  <span className="text-xs px-3 py-1 bg-amber-500/20 text-amber-400 rounded">
                    📱 Mobile Web
                  </span>
                )}
              </div>
            </div>
          )}

          {/* View Mode Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('alphabetical')}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                viewMode === 'alphabetical'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500'
                  : 'bg-white text-teal-600 border border-teal-200'
              }`}
            >
              A-Z Alphabetical
            </button>
            <button
              onClick={() => setViewMode('modules')}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                viewMode === 'modules'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500'
                  : 'bg-white text-teal-600 border border-teal-200'
              }`}
            >
              By Module
            </button>
          </div>

          {viewMode === 'alphabetical' ? (
            <>
              {/* Search & Filter */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search terms..."
                    className="w-full px-4 py-2 bg-white border border-teal-200 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-teal-500"
                  />
                </div>
                <select
                  value={selectedCategory || ''}
                  onChange={(e) => setSelectedCategory(e.target.value || null)}
                  className="px-4 py-2 bg-white border border-teal-200 rounded-lg text-teal-800 focus:outline-none focus:border-teal-500"
                >
                  <option value="">All Categories</option>
                  {workflow.step9?.categories?.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Alphabetical Term List */}
              <div>
                <h3 className="text-lg font-semibold text-teal-800 mb-4">
                  Glossary ({sortedTerms.length} terms)
                </h3>
                <div className="space-y-3">
                  {sortedTerms.map((term) => (
                    <TermCard key={term.id} term={term} onEdit={handleEditTerm} />
                  ))}
                </div>
              </div>
            </>
          ) : (
            // Module View
            <div>
              <h3 className="text-lg font-semibold text-teal-800 mb-4">Terms by Module</h3>
              <div className="space-y-3">
                {workflow.step9?.moduleTermLists?.map((moduleList) => (
                  <ModuleTermListCard key={moduleList.moduleId} moduleList={moduleList} />
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

          {/* Regenerate Button */}
          <div className="flex items-center justify-center pt-6 border-t border-teal-200">
            <button
              onClick={handleGenerate}
              disabled={submitStep9.isPending}
              className="px-4 py-2 text-teal-600 hover:text-teal-600 transition-colors"
            >
              Regenerate Glossary
            </button>
          </div>
        </div>
      )}

      {/* Glossary Term Edit Modal */}
      {editingTerm && (
        <GlossaryTermEditModal
          term={editingTerm}
          onSave={handleSaveTerm}
          onCancel={handleCancelTermEdit}
          isSaving={isSavingEdit}
        />
      )}
    </div>
  );
}
