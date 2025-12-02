'use client';

import { useState, useEffect } from 'react';
import { useSubmitStep7, useApproveStep7 } from '@/hooks/useWorkflow';
import {
  CurriculumWorkflow,
  Step7FormData,
  MCQQuestion,
  Quiz,
  BloomLevel,
  BLOOM_LEVELS,
} from '@/types/workflow';
import { useGeneration, GenerationProgressBar } from '@/contexts/GenerationContext';

interface Props {
  workflow: CurriculumWorkflow;
  onComplete: () => void;
  onRefresh: () => void;
}

// Difficulty colors
const DIFFICULTY_COLORS = {
  easy: 'bg-green-500/20 text-green-400 border-green-500/30',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  hard: 'bg-red-500/20 text-red-400 border-red-500/30',
};

// Bloom level colors
const BLOOM_COLORS: Record<BloomLevel, string> = {
  remember: 'bg-slate-500/20 text-slate-400',
  understand: 'bg-blue-500/20 text-blue-400',
  apply: 'bg-green-500/20 text-green-400',
  analyze: 'bg-amber-500/20 text-amber-400',
  evaluate: 'bg-orange-500/20 text-orange-400',
  create: 'bg-red-500/20 text-red-400',
};

// MCQ Card Component
function MCQCard({ question, index }: { question: MCQQuestion; index: number }) {
  const [showAnswer, setShowAnswer] = useState(false);

  return (
    <div className="bg-slate-900/50 rounded-lg border border-slate-700 overflow-hidden">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-500">Q{index + 1}</span>
            <span
              className={`text-xs px-2 py-0.5 rounded ${DIFFICULTY_COLORS[question.difficulty]}`}
            >
              {question.difficulty}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded ${BLOOM_COLORS[question.bloomLevel]}`}>
              {question.bloomLevel}
            </span>
          </div>
          <span className="text-xs text-cyan-400">{question.linkedMLO}</span>
        </div>

        {/* Stem */}
        <p className="text-white font-medium mb-4">{question.stem}</p>

        {/* Options */}
        <div className="space-y-2 mb-4">
          {question.options.map((option, idx) => {
            const isCorrect = option.isCorrect || option.id === question.correctOption;
            return (
              <div
                key={option.id}
                className={`p-3 rounded-lg text-sm transition-colors ${
                  showAnswer && isCorrect
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : showAnswer && !isCorrect
                      ? 'bg-slate-800/50 text-slate-400 border border-transparent'
                      : 'bg-slate-800/50 text-slate-300 border border-transparent hover:border-slate-600'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="font-mono font-bold shrink-0">
                    {String.fromCharCode(65 + idx)}.
                  </span>
                  <span>{option.text}</span>
                </div>
                {showAnswer && option.explanation && (
                  <p className="mt-2 text-xs text-slate-500 pl-6">{option.explanation}</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Show/Hide Button */}
        <button
          onClick={() => setShowAnswer(!showAnswer)}
          className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          {showAnswer ? '← Hide Answer & Rationale' : 'Show Answer & Rationale →'}
        </button>

        {/* Rationale */}
        {showAnswer && question.rationale && (
          <div className="mt-3 p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
            <p className="text-xs text-emerald-400 font-medium mb-1">Rationale:</p>
            <p className="text-sm text-slate-300">{question.rationale}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Quiz Summary Card
function QuizSummaryCard({ quiz }: { quiz: Quiz }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-slate-900/30 rounded-lg border border-slate-700 overflow-hidden">
      <div
        className="p-4 cursor-pointer hover:bg-slate-800/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-white font-medium">{quiz.title}</h4>
            <p className="text-sm text-slate-400">{quiz.moduleTitle}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-lg font-bold text-cyan-400">{quiz.questionCount}</p>
              <p className="text-xs text-slate-500">Questions</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-amber-400">{quiz.weight}%</p>
              <p className="text-xs text-slate-500">Weight</p>
            </div>
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

        {/* MLO Coverage */}
        <div className="mt-3 flex flex-wrap gap-1">
          {quiz.mlosCovered?.map((mlo) => (
            <span key={mlo} className="text-xs px-2 py-0.5 bg-slate-700 rounded text-slate-300">
              {mlo}
            </span>
          ))}
        </div>
      </div>

      {/* Expanded: Bloom Distribution */}
      {expanded && quiz.bloomDistribution && (
        <div className="px-4 pb-4 border-t border-slate-700/50 pt-3">
          <p className="text-xs text-slate-500 mb-2">Bloom's Distribution:</p>
          <div className="flex gap-2">
            {Object.entries(quiz.bloomDistribution).map(
              ([level, count]) =>
                count > 0 && (
                  <span
                    key={level}
                    className={`text-xs px-2 py-1 rounded ${BLOOM_COLORS[level as BloomLevel]}`}
                  >
                    {level}: {count}
                  </span>
                )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Step7Form({ workflow, onComplete, onRefresh }: Props) {
  const submitStep7 = useSubmitStep7();
  const approveStep7 = useApproveStep7();
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'config' | 'modules'>('config');
  const { startGeneration, completeGeneration, failGeneration, isGenerating } = useGeneration();

  const isCurrentlyGenerating = isGenerating(workflow._id, 7) || submitStep7.isPending;

  const modules = workflow.step4?.modules || [];
  const moduleCount = modules.length;

  // Form state with defaults per workflow v2.2
  const [formData, setFormData] = useState<Step7FormData>({
    finalExamWeight: 40,
    passMark: 60,
    questionsPerQuiz: 20,
    questionsForFinal: 60,
    bankMultiplier: 3,
    randomize: true,
    enableCloze: false,
    clozeCountPerModule: 5,
    timeLimit: 30,
    finalExamTimeLimit: 90,
    openBook: false,
    calculatorPermitted: false,
    moduleSettings: modules.map((mod: any) => ({
      moduleId: mod.id,
      mlosCovered: mod.mlos?.map((mlo: any) => mlo.id) || [],
      bloomEmphasis: ['apply', 'analyze'] as BloomLevel[],
    })),
  });

  // Check for completion when data appears
  useEffect(() => {
    if ((workflow.step7?.quizzes?.length ?? 0) > 0 || (workflow.step7?.totalQuestions ?? 0) > 0) {
      completeGeneration(workflow._id, 7);
    }
  }, [workflow.step7, workflow._id, completeGeneration]);

  // Calculate quiz weight
  const quizWeight = 100 - formData.finalExamWeight;
  const perQuizWeight = moduleCount > 0 ? Math.round((quizWeight / moduleCount) * 10) / 10 : 0;

  // Bank sizes
  const bankPerModule = formData.questionsPerQuiz * formData.bankMultiplier;
  const finalBankSize = formData.questionsForFinal * formData.bankMultiplier;

  const handleGenerate = async () => {
    setError(null);
    startGeneration(workflow._id, 7, 120); // 2 minutes estimated
    try {
      await submitStep7.mutateAsync({
        id: workflow._id,
        data: formData,
      });
      completeGeneration(workflow._id, 7);
      onRefresh();
    } catch (err: any) {
      console.error('Failed to generate assessments:', err);
      failGeneration(workflow._id, 7, err.message || 'Failed to generate');
      setError(err.message || 'Failed to generate assessments');
    }
  };

  const handleApprove = async () => {
    setError(null);
    try {
      await approveStep7.mutateAsync(workflow._id);
      onComplete();
    } catch (err: any) {
      console.error('Failed to approve Step 7:', err);
      setError(err.message || 'Failed to approve Step 7');
    }
  };

  const hasStep7Data =
    workflow.step7 &&
    (workflow.step7.quizzes?.length > 0 || workflow.step7.questionBank?.length > 0);
  const isApproved = !!workflow.step7?.approvedAt;
  const validation = workflow.step7?.validationReport;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Show generating state even when navigating back */}
      {isCurrentlyGenerating && !hasStep7Data && (
        <div className="mb-6 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <div>
              <h3 className="text-lg font-semibold text-white">
                Generating Auto-Gradable Assessments...
              </h3>
              <p className="text-sm text-slate-400">
                This may take 2 minutes. You can navigate away and come back.
              </p>
            </div>
          </div>
          <GenerationProgressBar workflowId={workflow._id} step={7} />
        </div>
      )}

      {!hasStep7Data && !isCurrentlyGenerating ? (
        // Configuration Form
        <div className="space-y-6">
          {/* About This Step */}
          <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl p-5">
            <h3 className="text-cyan-400 font-semibold mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                />
              </svg>
              Step 7: Auto-Gradable Assessments (MCQ-First)
            </h3>
            <p className="text-sm text-slate-300 mb-4">
              Create comprehensive <strong className="text-cyan-400">auto-gradable only</strong>{' '}
              assessment materials including MCQ question banks, module quizzes, and final exam
              blueprint.
              <strong className="text-amber-400"> No manual grading required.</strong>
            </p>

            {/* Bank Multiplier Explanation */}
            <div className="bg-slate-900/50 rounded-lg p-3 text-sm">
              <p className="text-slate-400">
                <strong className="text-white">
                  Bank Multiplier ({formData.bankMultiplier}×):
                </strong>{' '}
                {formData.questionsPerQuiz}-question quiz → Generate {bankPerModule} questions
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Enables: Different versions, question rotation, resits, quality monitoring
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('config')}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                activeTab === 'config'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              Global Settings
            </button>
            <button
              onClick={() => setActiveTab('modules')}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                activeTab === 'modules'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              Per-Module Settings
            </button>
          </div>

          {activeTab === 'config' ? (
            <div className="space-y-6">
              {/* Required Settings */}
              <div>
                <h4 className="text-white font-medium mb-4">Required Settings</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">
                      Final Exam Weight (%)
                    </label>
                    <input
                      type="number"
                      min={30}
                      max={50}
                      value={formData.finalExamWeight}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          finalExamWeight: parseInt(e.target.value) || 40,
                        }))
                      }
                      className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                    />
                    <p className="text-xs text-slate-500 mt-1">Quizzes: {quizWeight}%</p>
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Pass Mark (%)</label>
                    <input
                      type="number"
                      min={50}
                      max={80}
                      value={formData.passMark}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          passMark: parseInt(e.target.value) || 60,
                        }))
                      }
                      className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Questions per Quiz</label>
                    <input
                      type="number"
                      min={10}
                      max={40}
                      value={formData.questionsPerQuiz}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          questionsPerQuiz: parseInt(e.target.value) || 20,
                        }))
                      }
                      className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                    />
                    <p className="text-xs text-slate-500 mt-1">Bank: {bankPerModule} per module</p>
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Questions for Final</label>
                    <input
                      type="number"
                      min={40}
                      max={100}
                      value={formData.questionsForFinal}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          questionsForFinal: parseInt(e.target.value) || 60,
                        }))
                      }
                      className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                    />
                    <p className="text-xs text-slate-500 mt-1">Bank: {finalBankSize}</p>
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Bank Multiplier</label>
                    <select
                      value={formData.bankMultiplier}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          bankMultiplier: parseInt(e.target.value),
                        }))
                      }
                      className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value={2}>2× (Minimum)</option>
                      <option value={3}>3× (Recommended)</option>
                      <option value={4}>4× (Large Bank)</option>
                      <option value={5}>5× (Maximum)</option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.randomize}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, randomize: e.target.checked }))
                        }
                        className="w-4 h-4 rounded border-slate-600 text-cyan-500 focus:ring-cyan-500 bg-slate-800"
                      />
                      <span className="text-sm text-slate-300">Randomize questions & options</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Optional Settings */}
              <div>
                <h4 className="text-white font-medium mb-4">Optional Settings</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                      <input
                        type="checkbox"
                        checked={formData.enableCloze}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, enableCloze: e.target.checked }))
                        }
                        className="w-4 h-4 rounded border-slate-600 text-cyan-500 focus:ring-cyan-500 bg-slate-800"
                      />
                      <span className="text-sm text-slate-300">Enable Cloze (fill-in-blank)</span>
                    </label>
                    {formData.enableCloze && (
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={formData.clozeCountPerModule || 5}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            clozeCountPerModule: parseInt(e.target.value),
                          }))
                        }
                        placeholder="Count per module"
                        className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-2">
                      Quiz Time Limit (min)
                    </label>
                    <input
                      type="number"
                      min={15}
                      max={120}
                      value={formData.timeLimit || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          timeLimit: parseInt(e.target.value) || undefined,
                        }))
                      }
                      placeholder="No limit"
                      className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-2">
                      Final Exam Time (min)
                    </label>
                    <input
                      type="number"
                      min={30}
                      max={180}
                      value={formData.finalExamTimeLimit || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          finalExamTimeLimit: parseInt(e.target.value) || undefined,
                        }))
                      }
                      placeholder="No limit"
                      className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div className="flex items-end gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.openBook || false}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, openBook: e.target.checked }))
                        }
                        className="w-4 h-4 rounded border-slate-600 text-cyan-500 focus:ring-cyan-500 bg-slate-800"
                      />
                      <span className="text-sm text-slate-300">Open Book</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.calculatorPermitted || false}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            calculatorPermitted: e.target.checked,
                          }))
                        }
                        className="w-4 h-4 rounded border-slate-600 text-cyan-500 focus:ring-cyan-500 bg-slate-800"
                      />
                      <span className="text-sm text-slate-300">Calculator</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Weight Summary */}
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                <h4 className="text-white font-medium mb-3">Assessment Weight Distribution</h4>
                <div className="flex items-center gap-2 h-6 rounded-full overflow-hidden bg-slate-800">
                  <div
                    className="h-full bg-cyan-500 flex items-center justify-center text-xs text-white font-medium"
                    style={{ width: `${quizWeight}%` }}
                  >
                    Quizzes {quizWeight}%
                  </div>
                  <div
                    className="h-full bg-amber-500 flex items-center justify-center text-xs text-white font-medium"
                    style={{ width: `${formData.finalExamWeight}%` }}
                  >
                    Final {formData.finalExamWeight}%
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {moduleCount} modules × {perQuizWeight}% each = {quizWeight}% total quiz weight
                </p>
              </div>
            </div>
          ) : (
            // Per-Module Settings
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                Configure which MLOs to assess and Bloom's emphasis for each module.
              </p>
              {modules.map((mod: any, idx: number) => {
                const modSettings = formData.moduleSettings?.find((s) => s.moduleId === mod.id);
                const mlos = mod.mlos || [];

                return (
                  <div
                    key={mod.id}
                    className="bg-slate-900/30 rounded-lg p-4 border border-slate-700"
                  >
                    <h4 className="text-white font-medium mb-3">{mod.title}</h4>

                    {/* MLO Selection */}
                    <div className="mb-3">
                      <p className="text-xs text-slate-500 mb-2">MLOs to Assess:</p>
                      <div className="flex flex-wrap gap-2">
                        {mlos.map((mlo: any) => {
                          const isSelected = modSettings?.mlosCovered?.includes(mlo.id);
                          return (
                            <button
                              key={mlo.id}
                              onClick={() => {
                                setFormData((prev) => ({
                                  ...prev,
                                  moduleSettings: prev.moduleSettings?.map((s) =>
                                    s.moduleId === mod.id
                                      ? {
                                          ...s,
                                          mlosCovered: isSelected
                                            ? s.mlosCovered.filter((id) => id !== mlo.id)
                                            : [...s.mlosCovered, mlo.id],
                                        }
                                      : s
                                  ),
                                }));
                              }}
                              className={`text-xs px-2 py-1 rounded transition-colors ${
                                isSelected
                                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500'
                                  : 'bg-slate-800 text-slate-400 border border-slate-700'
                              }`}
                            >
                              {mlo.id}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Bloom's Emphasis */}
                    <div>
                      <p className="text-xs text-slate-500 mb-2">Bloom's Emphasis (1-2):</p>
                      <div className="flex flex-wrap gap-2">
                        {BLOOM_LEVELS.slice(2).map((level) => {
                          const isSelected = modSettings?.bloomEmphasis?.includes(level);
                          return (
                            <button
                              key={level}
                              onClick={() => {
                                setFormData((prev) => ({
                                  ...prev,
                                  moduleSettings: prev.moduleSettings?.map((s) =>
                                    s.moduleId === mod.id
                                      ? {
                                          ...s,
                                          bloomEmphasis: isSelected
                                            ? s.bloomEmphasis.filter((l) => l !== level)
                                            : [...(s.bloomEmphasis || []), level].slice(-2),
                                        }
                                      : s
                                  ),
                                }));
                              }}
                              className={`text-xs px-2 py-1 rounded capitalize transition-colors ${
                                isSelected
                                  ? `${BLOOM_COLORS[level]} border border-current`
                                  : 'bg-slate-800 text-slate-400 border border-slate-700'
                              }`}
                            >
                              {level}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

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
            className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium rounded-lg transition-all disabled:opacity-50"
          >
            {isCurrentlyGenerating ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating MCQ Banks ({bankPerModule * moduleCount + finalBankSize} questions)...
              </span>
            ) : (
              'Generate Auto-Gradable Assessments'
            )}
          </button>
        </div>
      ) : (
        // Display Generated Assessments
        <div className="space-y-6">
          {/* Overall Stats */}
          <div className="grid grid-cols-5 gap-4">
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700 text-center">
              <p className="text-3xl font-bold text-white">
                {workflow.step7?.quizzes?.length || 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">Quizzes</p>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700 text-center">
              <p className="text-3xl font-bold text-cyan-400">
                {workflow.step7?.totalBankQuestions || workflow.step7?.questionBank?.length || 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">Bank Questions</p>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700 text-center">
              <p className="text-3xl font-bold text-amber-400">
                {workflow.step7?.finalExam?.questionCount || 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">Final Exam Qs</p>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700 text-center">
              <p className="text-3xl font-bold text-purple-400">
                {workflow.step7?.mlosCovered?.length || 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">MLOs Covered</p>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700 text-center">
              <p
                className={`text-3xl font-bold ${workflow.step7?.isValid ? 'text-emerald-400' : 'text-red-400'}`}
              >
                {workflow.step7?.isValid ? '✓' : '✗'}
              </p>
              <p className="text-xs text-slate-500 mt-1">Valid</p>
            </div>
          </div>

          {/* Validation Report */}
          {validation && (
            <div
              className={`rounded-lg p-4 border ${workflow.step7?.isValid ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}
            >
              <h4
                className={`font-medium mb-3 ${workflow.step7?.isValid ? 'text-emerald-400' : 'text-amber-400'}`}
              >
                Validation Report
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <span className={validation.weightsSum100 ? 'text-emerald-400' : 'text-red-400'}>
                  {validation.weightsSum100 ? '✓' : '✗'} Weights = 100%
                </span>
                <span className={validation.everyMLOAssessed ? 'text-emerald-400' : 'text-red-400'}>
                  {validation.everyMLOAssessed ? '✓' : '✗'} Every MLO Assessed
                </span>
                <span
                  className={
                    validation.bloomDistributionMatch ? 'text-emerald-400' : 'text-red-400'
                  }
                >
                  {validation.bloomDistributionMatch ? '✓' : '✗'} Bloom Distribution
                </span>
                <span
                  className={validation.allHaveRationales ? 'text-emerald-400' : 'text-red-400'}
                >
                  {validation.allHaveRationales ? '✓' : '✗'} All Have Rationales
                </span>
                <span className={validation.allAutoGradable ? 'text-emerald-400' : 'text-red-400'}>
                  {validation.allAutoGradable ? '✓' : '✗'} All Auto-Gradable
                </span>
                <span className={validation.noDuplicates ? 'text-emerald-400' : 'text-red-400'}>
                  {validation.noDuplicates ? '✓' : '✗'} No Duplicates
                </span>
                <span
                  className={validation.finalProportional ? 'text-emerald-400' : 'text-red-400'}
                >
                  {validation.finalProportional ? '✓' : '✗'} Final Proportional
                </span>
                <span
                  className={validation.noQuizFinalOverlap ? 'text-emerald-400' : 'text-red-400'}
                >
                  {validation.noQuizFinalOverlap ? '✓' : '✗'} No Quiz/Final Overlap
                </span>
              </div>

              {/* Missing MLOs */}
              {workflow.step7?.missingMLOs && workflow.step7.missingMLOs.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-700/50">
                  <p className="text-amber-400 text-sm font-medium mb-1">Missing MLO Coverage:</p>
                  <p className="text-xs text-slate-400">{workflow.step7.missingMLOs.join(', ')}</p>
                </div>
              )}
            </div>
          )}

          {/* Blueprint Summary */}
          {workflow.step7?.blueprint && (
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
              <h4 className="text-white font-medium mb-3">Assessment Blueprint</h4>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-slate-400">Final Exam:</span>
                  <span className="text-white ml-2">
                    {workflow.step7.blueprint.finalExamWeight}%
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Quizzes:</span>
                  <span className="text-white ml-2">
                    {workflow.step7.blueprint.totalQuizWeight}%
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Pass Mark:</span>
                  <span className="text-white ml-2">{workflow.step7.blueprint.passMark}%</span>
                </div>
                <div>
                  <span className="text-slate-400">Bank Multiplier:</span>
                  <span className="text-white ml-2">
                    {workflow.step7.blueprint.bankMultiplier}×
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Quizzes */}
          {workflow.step7?.quizzes && workflow.step7.quizzes.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Module Quizzes</h3>
              <div className="space-y-3">
                {workflow.step7.quizzes.map((quiz) => (
                  <QuizSummaryCard key={quiz.id} quiz={quiz} />
                ))}
              </div>
            </div>
          )}

          {/* Sample Questions */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Sample Questions</h3>
            <div className="space-y-4">
              {workflow.step7?.questionBank?.slice(0, 5).map((question, index) => (
                <MCQCard key={question.id} question={question} index={index} />
              ))}
            </div>
            {(workflow.step7?.questionBank?.length || 0) > 5 && (
              <p className="text-sm text-slate-500 mt-4 text-center">
                +{(workflow.step7?.questionBank?.length || 0) - 5} more questions in bank
              </p>
            )}
          </div>

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
              disabled={submitStep7.isPending}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              Regenerate
            </button>
            <div className="flex gap-3">
              {!isApproved && (
                <button
                  onClick={handleApprove}
                  disabled={approveStep7.isPending || !workflow.step7?.isValid}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-medium rounded-lg transition-all disabled:opacity-50"
                >
                  {approveStep7.isPending ? 'Approving...' : 'Approve & Continue →'}
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

          {!workflow.step7?.isValid && !isApproved && (
            <p className="text-xs text-amber-400 text-center">
              All validation checks must pass before approval.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
