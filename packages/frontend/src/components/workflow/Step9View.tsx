'use client';

import { useState, useEffect } from 'react';
import { useSubmitStep9, useApproveStep9 } from '@/hooks/useWorkflow';
import { CurriculumWorkflow, GlossaryTerm, ModuleTermList, TermPriority } from '@/types/workflow';
import { useGeneration, GenerationProgressBar } from '@/contexts/GenerationContext';
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
  optional: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const PRIORITY_LABELS: Record<TermPriority, string> = {
  must_include: 'Must Include',
  should_include: 'Should Include',
  optional: 'Optional',
};

// Term Card Component
function TermCard({ term }: { term: GlossaryTerm }) {
  const [expanded, setExpanded] = useState(false);
  const definitionValid = term.wordCount >= 20 && term.wordCount <= 40;

  return (
    <div className="bg-slate-900/50 rounded-lg border border-slate-700 overflow-hidden">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <h4 className="text-white font-semibold">{term.term}</h4>
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
        <p className="text-sm text-slate-300 mb-2">{term.definition}</p>
        <span className={`text-xs ${definitionValid ? 'text-slate-500' : 'text-amber-400'}`}>
          {term.wordCount} words {!definitionValid && '(should be 20-40)'}
        </span>

        {/* Example Sentence */}
        {term.exampleSentence && (
          <div className="mt-2 bg-slate-800/50 rounded p-2">
            <p className="text-xs text-slate-500 mb-1">Example:</p>
            <p className="text-sm text-slate-400 italic">"{term.exampleSentence}"</p>
          </div>
        )}

        {/* Category and Modules */}
        <div className="mt-3 flex items-center gap-3 text-xs">
          {term.category && (
            <span className="px-2 py-0.5 bg-slate-700 rounded text-slate-400">{term.category}</span>
          )}
          {term.sourceModules && term.sourceModules.length > 0 && (
            <span className="text-slate-500">Used in: {term.sourceModules.join(', ')}</span>
          )}
        </div>
      </div>

      {/* Expand Button */}
      {(term.relatedTerms?.length || term.technicalNote || term.synonyms?.length) && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full px-4 py-2 flex items-center justify-between text-xs text-slate-400 hover:bg-slate-800/30 transition-colors border-t border-slate-700/50"
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
            <div className="px-4 pb-4 space-y-3 border-t border-slate-700/50">
              {/* Technical Note */}
              {term.technicalNote && (
                <div className="pt-3">
                  <p className="text-xs text-slate-500 mb-1">Technical Note:</p>
                  <p className="text-sm text-slate-400">{term.technicalNote}</p>
                </div>
              )}

              {/* Related Terms */}
              {term.relatedTerms && term.relatedTerms.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Related Terms:</p>
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
                      <p className="text-xs text-slate-500 mb-1">Broader:</p>
                      <span className="text-xs text-slate-400">{term.broaderTerms.join(', ')}</span>
                    </div>
                  )}
                  {term.narrowerTerms && term.narrowerTerms.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Narrower:</p>
                      <span className="text-xs text-slate-400">
                        {term.narrowerTerms.join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Synonyms */}
              {term.synonyms && term.synonyms.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Synonyms:</p>
                  <span className="text-xs text-slate-400">{term.synonyms.join(', ')}</span>
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
    <div className="bg-slate-900/30 rounded-lg border border-slate-700 overflow-hidden">
      <div
        className="p-4 cursor-pointer hover:bg-slate-800/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-white font-medium">{moduleList.moduleTitle}</h4>
            <p className="text-xs text-slate-500">{moduleList.moduleId}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-cyan-400">{moduleList.termCount}</span>
            <svg
              className={`w-5 h-5 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
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
        <div className="px-4 pb-4 border-t border-slate-700/50 pt-3">
          <div className="flex flex-wrap gap-2">
            {moduleList.terms.map((term) => (
              <span
                key={term.id}
                className="text-xs px-2 py-1 bg-slate-800 rounded text-slate-300 hover:bg-slate-700 cursor-default"
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

  const isCurrentlyGenerating = isGenerating(workflow._id, 9) || submitStep9.isPending;

  // Check for completion when data appears
  useEffect(() => {
    if ((workflow.step9?.terms?.length ?? 0) > 0) {
      completeGeneration(workflow._id, 9);
    }
  }, [workflow.step9, workflow._id, completeGeneration]);

  const handleGenerate = async () => {
    setError(null);
    startGeneration(workflow._id, 9, 45); // 45 seconds estimated
    try {
      await submitStep9.mutateAsync(workflow._id);
      completeGeneration(workflow._id, 9);
      await onRefresh();
      setJustGenerated(true);
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

  const hasStep9Data = workflow.step9 && workflow.step9.terms?.length > 0;
  const isApproved =
    workflow.status === 'step9_complete' ||
    workflow.status === 'step10_pending' ||
    workflow.status === 'step10_complete' ||
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
              <h3 className="text-lg font-semibold text-white">Generating Glossary...</h3>
              <p className="text-sm text-slate-400">
                This may take 45 seconds. You can navigate away and come back.
              </p>
            </div>
          </div>
          <GenerationProgressBar workflowId={workflow._id} step={9} />
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
            <p className="text-sm text-slate-300 mb-4">
              <strong className="text-emerald-400">No SME input required</strong> - this step runs
              automatically by harvesting and defining all key terms from your curriculum content.
            </p>

            {/* Harvesting Sources */}
            <div className="bg-slate-900/50 rounded-lg p-4 mb-4">
              <p className="text-slate-400 font-medium mb-3">Comprehensive Harvesting From:</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                <span className="px-2 py-1 bg-slate-800 rounded text-slate-300">
                  Step 1: Program Description
                </span>
                <span className="px-2 py-1 bg-slate-800 rounded text-slate-300">
                  Step 2: Competency Framework
                </span>
                <span className="px-2 py-1 bg-slate-800 rounded text-slate-300">Step 3: PLOs</span>
                <span className="px-2 py-1 bg-slate-800 rounded text-slate-300">Step 4: MLOs</span>
                <span className="px-2 py-1 bg-slate-800 rounded text-slate-300">
                  Steps 5-6: Reading Lists
                </span>
                <span className="px-2 py-1 bg-slate-800 rounded text-slate-300">
                  Step 7: Assessments
                </span>
                <span className="px-2 py-1 bg-slate-800 rounded text-slate-300">
                  Step 8: Case Studies
                </span>
              </div>
            </div>

            {/* Definition Quality */}
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="bg-slate-900/50 rounded-lg p-3">
                <p className="text-cyan-400 font-medium mb-2">Each Entry Includes:</p>
                <ul className="text-xs text-slate-400 space-y-1">
                  <li>• Main Definition (20-40 words)</li>
                  <li>• Example Sentence (optional)</li>
                  <li>• Technical Note (optional)</li>
                  <li>• Cross-References</li>
                  <li>• Module Mapping</li>
                </ul>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3">
                <p className="text-purple-400 font-medium mb-2">Term Priority:</p>
                <ul className="text-xs text-slate-400 space-y-1">
                  <li>
                    • <span className="text-red-400">Must Include:</span> Assessment terms,
                    Essential competencies
                  </li>
                  <li>
                    • <span className="text-amber-400">Should Include:</span> Reading titles, Case
                    study terms
                  </li>
                  <li>
                    • <span className="text-slate-400">May Exclude:</span> Common English words
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
            <h3 className="text-xl font-semibold text-white mb-2">Final Step!</h3>
            <p className="text-slate-400 mb-2">
              Generate the glossary to complete your curriculum package
            </p>
            <p className="text-xs text-slate-500">
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
            className="w-full py-4 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-medium rounded-lg transition-all disabled:opacity-50"
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
            <p className="text-slate-300 mb-4">
              {isApproved
                ? 'Step 9 is approved. You can now proceed to Step 10: Lesson Plans & PPT Generation.'
                : 'Review your glossary below and approve to continue to Step 10.'}
            </p>
            {!isApproved && (
              <button
                onClick={handleApprove}
                disabled={approveStep9.isPending}
                className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-medium rounded-lg transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20"
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
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700 text-center">
              <p className="text-3xl font-bold text-white">{workflow.step9?.totalTerms || 0}</p>
              <p className="text-xs text-slate-500 mt-1">Total Terms</p>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700 text-center">
              <p className="text-3xl font-bold text-cyan-400">
                {workflow.step9?.categories?.length || 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">Categories</p>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700 text-center">
              <p className="text-3xl font-bold text-purple-400">
                {workflow.step9?.assessmentTermsCount || 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">Assessment Terms</p>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700 text-center">
              <p className="text-3xl font-bold text-amber-400">
                {workflow.step9?.acronymCount || 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">Acronyms</p>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700 text-center">
              <p
                className={`text-3xl font-bold ${workflow.step9?.isValid ? 'text-emerald-400' : 'text-red-400'}`}
              >
                {workflow.step9?.isValid ? '✓' : '✗'}
              </p>
              <p className="text-xs text-slate-500 mt-1">Valid</p>
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
                <div className="mt-3 pt-3 border-t border-slate-700/50">
                  <p className="text-amber-400 text-sm font-medium mb-1">Issues:</p>
                  <ul className="text-xs text-slate-400 space-y-1">
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
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
              <h4 className="text-white font-medium mb-3">Available Export Formats</h4>
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
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              A-Z Alphabetical
            </button>
            <button
              onClick={() => setViewMode('modules')}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                viewMode === 'modules'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
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
                    className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <select
                  value={selectedCategory || ''}
                  onChange={(e) => setSelectedCategory(e.target.value || null)}
                  className="px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
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
                <h3 className="text-lg font-semibold text-white mb-4">
                  Glossary ({sortedTerms.length} terms)
                </h3>
                <div className="space-y-3">
                  {sortedTerms.map((term) => (
                    <TermCard key={term.id} term={term} />
                  ))}
                </div>
              </div>
            </>
          ) : (
            // Module View
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Terms by Module</h3>
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
          <div className="flex items-center justify-center pt-6 border-t border-slate-700">
            <button
              onClick={handleGenerate}
              disabled={submitStep9.isPending}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              Regenerate Glossary
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
