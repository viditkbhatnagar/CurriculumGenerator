'use client';

import { useSubmitStep8, useApproveStep8 } from '@/hooks/useWorkflow';
import { CurriculumWorkflow, CaseStudy } from '@/types/workflow';

interface Props {
  workflow: CurriculumWorkflow;
  onComplete: () => void;
  onRefresh: () => void;
}

function CaseStudyCard({ caseStudy }: { caseStudy: CaseStudy }) {
  const complexityColors = {
    introductory: 'bg-green-500/20 text-green-400',
    intermediate: 'bg-amber-500/20 text-amber-400',
    advanced: 'bg-red-500/20 text-red-400',
  };

  return (
    <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
      <div className="flex items-start justify-between gap-2 mb-3">
        <h4 className="text-white font-medium">{caseStudy.title}</h4>
        <span className={`text-xs px-2 py-1 rounded ${complexityColors[caseStudy.complexity]}`}>
          {caseStudy.complexity}
        </span>
      </div>

      {/* Hook - The attention grabber */}
      <div className="bg-cyan-500/10 border border-cyan-500/30 rounded p-3 mb-3">
        <p className="text-xs text-cyan-400 font-medium mb-1">Hook</p>
        <p className="text-sm text-white">{caseStudy.hook}</p>
      </div>

      {/* Scenario */}
      <div className="mb-3">
        <p className="text-xs text-slate-500 mb-1">Scenario</p>
        <p className="text-sm text-slate-300">{caseStudy.scenario}</p>
      </div>

      {/* Context */}
      <div className="mb-3">
        <p className="text-xs text-slate-500 mb-1">Context</p>
        <p className="text-sm text-slate-400">{caseStudy.context}</p>
      </div>

      {/* Metadata */}
      <div className="flex items-center gap-4 text-xs text-slate-500 pt-3 border-t border-slate-700">
        {caseStudy.industry && <span>Industry: {caseStudy.industry}</span>}
        <span>Topics: {caseStudy.linkedTopics?.length || 0}</span>
        <span>MLOs: {caseStudy.linkedMLOs?.length || 0}</span>
      </div>
    </div>
  );
}

export default function Step8View({ workflow, onComplete, onRefresh }: Props) {
  const submitStep8 = useSubmitStep8();
  const approveStep8 = useApproveStep8();

  const handleGenerate = async () => {
    try {
      await submitStep8.mutateAsync(workflow._id);
      onRefresh();
    } catch (err) {
      console.error('Failed to generate case studies:', err);
    }
  };

  const handleApprove = async () => {
    try {
      await approveStep8.mutateAsync(workflow._id);
      onComplete();
    } catch (err) {
      console.error('Failed to approve Step 8:', err);
    }
  };

  const hasStep8Data = workflow.step8 && workflow.step8.caseStudies?.length > 0;
  const isApproved = !!workflow.step8?.approvedAt;

  return (
    <div className="p-6">
      {!hasStep8Data ? (
        <div className="space-y-6">
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
            <h3 className="text-purple-400 font-medium mb-2">Case Studies as Hooks</h3>
            <p className="text-sm text-slate-300">
              Case studies are designed as engagement hooks - real-world scenarios that capture
              learner attention and provide context for the learning content. They are not
              assessment questions, but narrative introductions to topics.
            </p>
          </div>

          <button
            onClick={handleGenerate}
            disabled={submitStep8.isPending}
            className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium rounded-lg transition-all disabled:opacity-50"
          >
            {submitStep8.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating Case Studies...
              </span>
            ) : (
              'Generate Case Study Hooks'
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700 text-center">
              <p className="text-2xl font-bold text-white">{workflow.step8?.totalCases || 0}</p>
              <p className="text-xs text-slate-500">Total Cases</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700 text-center">
              <p className="text-2xl font-bold text-green-400">
                {workflow.step8?.caseStudies?.filter((c) => c.complexity === 'introductory')
                  .length || 0}
              </p>
              <p className="text-xs text-slate-500">Introductory</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700 text-center">
              <p className="text-2xl font-bold text-amber-400">
                {workflow.step8?.caseStudies?.filter((c) => c.complexity === 'intermediate')
                  .length || 0}
              </p>
              <p className="text-xs text-slate-500">Intermediate</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700 text-center">
              <p className="text-2xl font-bold text-red-400">
                {workflow.step8?.caseStudies?.filter((c) => c.complexity === 'advanced').length ||
                  0}
              </p>
              <p className="text-xs text-slate-500">Advanced</p>
            </div>
          </div>

          {/* Case Studies */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">Case Studies</h3>
            <div className="grid gap-4">
              {workflow.step8?.caseStudies?.map((caseStudy) => (
                <CaseStudyCard key={caseStudy.id} caseStudy={caseStudy} />
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-700">
            <button
              onClick={handleGenerate}
              disabled={submitStep8.isPending}
              className="px-4 py-2 text-slate-400 hover:text-white"
            >
              Regenerate
            </button>
            <div className="flex gap-3">
              {!isApproved && (
                <button
                  onClick={handleApprove}
                  disabled={approveStep8.isPending}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-medium rounded-lg transition-all disabled:opacity-50"
                >
                  {approveStep8.isPending ? 'Approving...' : 'Approve & Continue →'}
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
