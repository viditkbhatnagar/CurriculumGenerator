/**
 * Example: How to integrate streaming into Step7Form.tsx
 *
 * This shows the minimal changes needed to add streaming alongside your existing implementation
 */

import { useStep7Streaming } from '@/hooks/useStep7Streaming';
import { useEffect } from 'react';

export default function Step7Form({ workflow, onComplete, onRefresh }: Props) {
  // EXISTING: Keep your current implementation
  const submitStep7 = useSubmitStep7();
  const [formData, setFormData] = useState<AssessmentUserPreferences>({
    /* your initial state */
  });

  // NEW: Add streaming hook
  const streaming = useStep7Streaming();

  // EXISTING: Keep your current handleGenerate
  const handleGenerate = async () => {
    // ... existing code
  };

  // NEW: Add streaming handler
  const handleGenerateStreaming = () => {
    console.log('[Step7Form] Starting streaming generation');
    streaming.startStreaming(workflow._id, formData);
  };

  // NEW: Auto-refresh when streaming completes
  useEffect(() => {
    if (!streaming.isStreaming && streaming.formativeCount > 0) {
      console.log('[Step7Form] Streaming complete, refreshing data');
      onRefresh(); // This will reload the workflow data
    }
  }, [streaming.isStreaming, streaming.formativeCount, onRefresh]);

  return (
    <div className="space-y-6">
      {!workflow.step7 ? (
        <>
          {/* EXISTING: Your existing form fields stay the same */}
          {/* Assessment Structure */}
          {/* Formative Settings */}
          {/* Summative Format */}
          {/* Weightages */}
          {/* Advanced Options */}

          {/* EXISTING: Keep your existing generate button */}
          <button
            onClick={handleGenerate}
            disabled={isCurrentlyGenerating}
            className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600..."
          >
            {isCurrentlyGenerating ? 'Generating (Traditional)...' : 'Generate Assessment Package'}
          </button>

          {/* NEW: Add streaming button (TEST MODE) */}
          <div className="border-t border-slate-700 pt-4 mt-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded">
                ⚡ NEW: Streaming Mode
              </span>
              <span className="text-xs text-slate-500">
                No timeouts • Real-time progress • Incremental saves
              </span>
            </div>

            <button
              onClick={handleGenerateStreaming}
              disabled={streaming.isStreaming}
              className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-400 hover:to-pink-500 text-white font-medium rounded-lg transition-all disabled:opacity-50"
            >
              {streaming.isStreaming ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating with Streaming...
                </span>
              ) : (
                '⚡ Generate with Streaming (Beta)'
              )}
            </button>

            {/* NEW: Streaming progress display */}
            {streaming.isStreaming && (
              <div className="mt-4 p-4 bg-slate-900/50 border border-purple-500/30 rounded-lg">
                <h4 className="text-sm font-medium text-purple-400 mb-3">Real-Time Progress</h4>

                {/* Stage and current item */}
                {streaming.progress && (
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Stage:</span>
                      <span className="text-white capitalize">{streaming.progress.stage}</span>
                    </div>
                    {streaming.progress.currentModule && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Current Module:</span>
                        <span className="text-white">{streaming.progress.currentModule}</span>
                      </div>
                    )}
                    {streaming.progress.currentType && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Current Type:</span>
                        <span className="text-white uppercase">
                          {streaming.progress.currentType}
                        </span>
                      </div>
                    )}
                    {streaming.progress.totalSteps && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Progress:</span>
                        <span className="text-white">
                          {streaming.progress.completedSteps}/{streaming.progress.totalSteps}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Real-time counts */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-800/50 p-3 rounded">
                    <div className="text-xs text-slate-400 mb-1">Formatives</div>
                    <div className="text-2xl font-bold text-cyan-400">
                      {streaming.formativeCount}
                    </div>
                  </div>
                  <div className="bg-slate-800/50 p-3 rounded">
                    <div className="text-xs text-slate-400 mb-1">Summatives</div>
                    <div className="text-2xl font-bold text-blue-400">
                      {streaming.summativeCount}
                    </div>
                  </div>
                </div>

                {/* Sample counts */}
                <div className="mt-3 p-3 bg-slate-800/50 rounded">
                  <div className="text-xs text-slate-400 mb-2">Sample Questions</div>
                  <div className="grid grid-cols-5 gap-2 text-center">
                    <div>
                      <div className="text-xs text-slate-500">MCQ</div>
                      <div className="text-lg font-semibold text-white">
                        {streaming.sampleCounts.mcq}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">SJT</div>
                      <div className="text-lg font-semibold text-white">
                        {streaming.sampleCounts.sjt}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Case</div>
                      <div className="text-lg font-semibold text-white">
                        {streaming.sampleCounts.case}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Essay</div>
                      <div className="text-lg font-semibold text-white">
                        {streaming.sampleCounts.essay}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Practical</div>
                      <div className="text-lg font-semibold text-white">
                        {streaming.sampleCounts.practical}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-xs text-slate-500 text-center">
                  💾 Saved to database after each batch • No timeouts!
                </div>
              </div>
            )}

            {/* NEW: Streaming error display */}
            {streaming.error && (
              <div className="mt-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm">{streaming.error}</p>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* EXISTING: Your existing results display stays the same */}
          {/* Display formativeAssessments */}
          {/* Display summativeAssessments */}
          {/* Display sampleQuestions */}
          {/* Display validation */}
          {/* Approve button */}
        </>
      )}
    </div>
  );
}
