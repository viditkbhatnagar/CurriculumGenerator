'use client';

import { useState } from 'react';
import { useSubmitStep7, useApproveStep7 } from '@/hooks/useWorkflow';
import { CurriculumWorkflow, Step7FormData, MCQQuestion, BLOOM_LEVELS } from '@/types/workflow';

interface Props {
  workflow: CurriculumWorkflow;
  onComplete: () => void;
  onRefresh: () => void;
}

function MCQCard({ question }: { question: MCQQuestion }) {
  const [showAnswer, setShowAnswer] = useState(false);

  const difficultyColors = {
    easy: 'bg-green-500/20 text-green-400',
    medium: 'bg-amber-500/20 text-amber-400',
    hard: 'bg-red-500/20 text-red-400',
  };

  return (
    <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="text-white">{question.stem}</p>
        <div className="flex gap-2">
          <span className={`text-xs px-2 py-1 rounded ${difficultyColors[question.difficulty]}`}>
            {question.difficulty}
          </span>
          <span className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-400 capitalize">
            {question.bloomLevel}
          </span>
        </div>
      </div>
      <div className="space-y-2 mb-3">
        {question.options.map((option, idx) => (
          <div
            key={option.id}
            className={`p-2 rounded text-sm ${
              showAnswer && option.isCorrect
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-slate-800/50 text-slate-300'
            }`}
          >
            <span className="font-mono mr-2">{String.fromCharCode(65 + idx)}.</span>
            {option.text}
          </div>
        ))}
      </div>
      <button
        onClick={() => setShowAnswer(!showAnswer)}
        className="text-xs text-cyan-400 hover:text-cyan-300"
      >
        {showAnswer ? 'Hide Answer' : 'Show Answer'}
      </button>
      {showAnswer && (
        <p className="mt-2 text-sm text-slate-400">
          <strong>Explanation:</strong> {question.explanation}
        </p>
      )}
    </div>
  );
}

export default function Step7Form({ workflow, onComplete, onRefresh }: Props) {
  const submitStep7 = useSubmitStep7();
  const approveStep7 = useApproveStep7();

  const [formData, setFormData] = useState<Step7FormData>({
    finalExamWeight: 40,
    passMark: 60,
    questionsPerQuiz: 20,
    questionsForFinal: 60,
    bankMultiplier: 3,
    randomize: true,
    enableCloze: false,
  });

  const handleGenerate = async () => {
    try {
      await submitStep7.mutateAsync({
        id: workflow._id,
        data: formData,
      });
      onRefresh();
    } catch (err) {
      console.error('Failed to generate assessments:', err);
    }
  };

  const handleApprove = async () => {
    try {
      await approveStep7.mutateAsync(workflow._id);
      onComplete();
    } catch (err) {
      console.error('Failed to approve Step 7:', err);
    }
  };

  const hasStep7Data =
    workflow.step7 &&
    (workflow.step7.quizzes?.length > 0 || workflow.step7.questionBank?.length > 0);
  const isApproved = !!workflow.step7?.approvedAt;

  return (
    <div className="p-6">
      {!hasStep7Data ? (
        <div className="space-y-6">
          <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
            <h3 className="text-cyan-400 font-medium mb-2">MCQ-First Auto-Gradable Assessments</h3>
            <p className="text-sm text-slate-300">
              All assessments are automatically gradable - MCQ (Multiple Choice Questions) with
              optional Cloze (fill-in-the-blank). Questions are generated for each MLO and organized
              into module quizzes and a final exam.
            </p>
          </div>

          {/* Configuration */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Final Exam Weight (%)
              </label>
              <input
                type="number"
                min={30}
                max={50}
                value={formData.finalExamWeight}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, finalExamWeight: parseInt(e.target.value) }))
                }
                className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                Quizzes: {100 - (formData.finalExamWeight || 40)}%
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Pass Mark (%)</label>
              <input
                type="number"
                min={50}
                max={80}
                value={formData.passMark}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, passMark: parseInt(e.target.value) }))
                }
                className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Questions per Quiz
              </label>
              <input
                type="number"
                min={10}
                max={40}
                value={formData.questionsPerQuiz}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, questionsPerQuiz: parseInt(e.target.value) }))
                }
                className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Questions for Final Exam
              </label>
              <input
                type="number"
                min={40}
                max={100}
                value={formData.questionsForFinal}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, questionsForFinal: parseInt(e.target.value) }))
                }
                className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.randomize}
                onChange={(e) => setFormData((prev) => ({ ...prev, randomize: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-600 text-cyan-500 focus:ring-cyan-500 bg-slate-800"
              />
              <span className="text-sm text-slate-300">Randomize question order</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.enableCloze}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, enableCloze: e.target.checked }))
                }
                className="w-4 h-4 rounded border-slate-600 text-cyan-500 focus:ring-cyan-500 bg-slate-800"
              />
              <span className="text-sm text-slate-300">Include Cloze questions</span>
            </label>
          </div>

          <button
            onClick={handleGenerate}
            disabled={submitStep7.isPending}
            className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium rounded-lg transition-all disabled:opacity-50"
          >
            {submitStep7.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating MCQ Banks...
              </span>
            ) : (
              'Generate Auto-Gradable Assessments'
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700 text-center">
              <p className="text-2xl font-bold text-white">
                {workflow.step7?.quizzes?.length || 0}
              </p>
              <p className="text-xs text-slate-500">Quizzes</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700 text-center">
              <p className="text-2xl font-bold text-cyan-400">
                {workflow.step7?.questionBank?.length || 0}
              </p>
              <p className="text-xs text-slate-500">Question Bank</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700 text-center">
              <p className="text-2xl font-bold text-emerald-400">
                {workflow.step7?.finalExam?.questions?.length || 0}
              </p>
              <p className="text-xs text-slate-500">Final Exam Qs</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700 text-center">
              <p
                className={`text-2xl font-bold ${workflow.step7?.validation?.allAutoGradable ? 'text-emerald-400' : 'text-red-400'}`}
              >
                {workflow.step7?.validation?.allAutoGradable ? '✓' : '✗'}
              </p>
              <p className="text-xs text-slate-500">Auto-Gradable</p>
            </div>
          </div>

          {/* Assessment Structure */}
          <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
            <h4 className="text-white font-medium mb-3">Assessment Structure</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-slate-400">Final Exam Weight:</span>
                <span className="text-white ml-2">
                  {workflow.step7?.structure?.finalExamWeight}%
                </span>
              </div>
              <div>
                <span className="text-slate-400">Quiz Weight:</span>
                <span className="text-white ml-2">{workflow.step7?.structure?.quizWeight}%</span>
              </div>
              <div>
                <span className="text-slate-400">Pass Mark:</span>
                <span className="text-white ml-2">{workflow.step7?.structure?.passMark}%</span>
              </div>
            </div>
          </div>

          {/* MLO Coverage */}
          {workflow.step7?.validation && (
            <div
              className={`rounded-lg p-4 border ${
                workflow.step7.validation.missingMLOs?.length === 0
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-amber-500/10 border-amber-500/30'
              }`}
            >
              <h4
                className={`font-medium mb-2 ${
                  workflow.step7.validation.missingMLOs?.length === 0
                    ? 'text-emerald-400'
                    : 'text-amber-400'
                }`}
              >
                MLO Coverage: {workflow.step7.validation.mlosCovered?.length || 0} covered
              </h4>
              {workflow.step7.validation.missingMLOs?.length > 0 && (
                <p className="text-sm text-slate-400">
                  Missing: {workflow.step7.validation.missingMLOs.join(', ')}
                </p>
              )}
            </div>
          )}

          {/* Sample Questions */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">Sample Questions</h3>
            <div className="grid gap-3">
              {workflow.step7?.questionBank?.slice(0, 5).map((question) => (
                <MCQCard key={question.id} question={question} />
              ))}
            </div>
            {(workflow.step7?.questionBank?.length || 0) > 5 && (
              <p className="text-sm text-slate-500 mt-3 text-center">
                +{(workflow.step7?.questionBank?.length || 0) - 5} more questions in bank
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-700">
            <button
              onClick={handleGenerate}
              disabled={submitStep7.isPending}
              className="px-4 py-2 text-slate-400 hover:text-white"
            >
              Regenerate
            </button>
            <div className="flex gap-3">
              {!isApproved && (
                <button
                  onClick={handleApprove}
                  disabled={approveStep7.isPending || !workflow.step7?.validation?.allAutoGradable}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-medium rounded-lg transition-all disabled:opacity-50"
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
        </div>
      )}
    </div>
  );
}
