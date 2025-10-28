'use client';

import { useState } from 'react';
import { useSimulation } from '@/hooks/useSimulation';
import { CreateScenarioRequest } from '@/types/simulation';
import { ScenarioSetup } from './ScenarioSetup';
import { ScenarioDisplay } from './ScenarioDisplay';
import { ActionSelector } from './ActionSelector';
import { FeedbackDisplay } from './FeedbackDisplay';
import { ProgressBar } from './ProgressBar';
import { PerformanceReportDisplay } from './PerformanceReportDisplay';

interface SimulationInterfaceProps {
  studentId: string;
  courseId?: string;
}

export function SimulationInterface({ studentId, courseId }: SimulationInterfaceProps) {
  const {
    currentScenario,
    currentState,
    performanceReport,
    createScenario,
    processAction,
    resetScenario,
    getPerformanceReport,
    isCreating,
    isProcessing,
    isResetting,
  } = useSimulation(studentId);

  const [showReport, setShowReport] = useState(false);

  const handleCreateScenario = (request: CreateScenarioRequest) => {
    createScenario({ ...request, courseId });
    setShowReport(false);
  };

  const handleActionSelect = (actionId: string) => {
    processAction(actionId);
  };

  const handleComplete = async () => {
    const result = await getPerformanceReport();
    if (result.data) {
      setShowReport(true);
    }
  };

  const handleReplay = () => {
    resetScenario();
    setShowReport(false);
  };

  const handleNewScenario = () => {
    setShowReport(false);
  };

  // Show setup screen if no scenario
  if (!currentScenario || !currentState) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <ScenarioSetup onCreateScenario={handleCreateScenario} isCreating={isCreating} />
      </div>
    );
  }

  // Show performance report if complete and report is available
  if (showReport && performanceReport) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <PerformanceReportDisplay
          report={performanceReport}
          onReplay={handleReplay}
          onNewScenario={handleNewScenario}
          isResetting={isResetting}
        />
      </div>
    );
  }

  // Show completion screen if scenario is complete
  if (currentState.isComplete && !showReport) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Scenario Complete!</h2>
          <p className="text-gray-600 mb-6">
            You've completed all steps in this simulation. Let's see how you did!
          </p>
          <div className="flex justify-center space-x-4">
            <button
              onClick={handleComplete}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              View Performance Report
            </button>
            <button
              onClick={handleReplay}
              disabled={isResetting}
              className="bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
            >
              {isResetting ? 'Resetting...' : 'Try Again'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show active simulation
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{currentScenario.title}</h1>
            <p className="text-sm text-gray-600 mt-1">
              Difficulty: {currentScenario.difficulty}/5 | Topic: {currentScenario.topic}
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-blue-600">{currentState.score}</div>
            <div className="text-sm text-gray-600">Score</div>
          </div>
        </div>
        <ProgressBar
          currentStep={currentState.currentStep}
          totalSteps={currentState.totalSteps}
        />
      </div>

      {/* Scenario Context */}
      <ScenarioDisplay
        context={currentScenario.context}
        currentSituation={currentState.currentSituation}
        learningObjectives={currentScenario.learningObjectives}
      />

      {/* Feedback from previous action */}
      {currentState.feedback && (
        <FeedbackDisplay
          feedback={currentState.feedback}
          previousAction={
            currentState.previousActions[currentState.previousActions.length - 1]
          }
        />
      )}

      {/* Action Selection */}
      <ActionSelector
        actions={currentState.availableActions}
        onActionSelect={handleActionSelect}
        disabled={isProcessing}
      />

      {/* Previous Actions Summary */}
      {currentState.previousActions.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Actions</h3>
          <div className="space-y-3">
            {currentState.previousActions.map((action, index) => (
              <div key={index} className="flex items-start space-x-3 text-sm">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <p className="text-gray-900">{action.description}</p>
                  <p className="text-gray-600 text-xs mt-1">{action.feedback}</p>
                </div>
                <div className="flex-shrink-0 text-blue-600 font-semibold">
                  +{action.score}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
