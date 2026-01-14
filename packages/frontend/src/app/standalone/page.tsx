'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { StepSelector, STANDALONE_STEPS } from '@/components/standalone/StepSelector';
import { StepOutput, OutputState, StepOutputData } from '@/components/standalone/StepOutput';
import { DescriptionInput } from '@/components/standalone/DescriptionInput';
import { executeStep, exportStepAsWord } from '@/lib/standaloneApi';

// Session storage key for persisting output
const SESSION_STORAGE_KEY = 'standalone_step_output';

// Analytics logging helper
const logAnalytics = (event: string, data: Record<string, unknown>) => {
  console.info(`[Analytics] ${event}`, {
    ...data,
    timestamp: new Date().toISOString(),
  });
};

export default function StandalonePage() {
  const router = useRouter();
  
  // State management per design document
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [outputState, setOutputState] = useState<OutputState>('idle');
  const [output, setOutput] = useState<StepOutputData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load output from session storage on mount - Requirement 7.1, 7.2
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.output) {
          setOutput(parsed.output);
          setSelectedStep(parsed.selectedStep);
          setDescription(parsed.description || '');
          setOutputState('success');
          logAnalytics('session_restored', { stepNumber: parsed.selectedStep });
        }
      }
    } catch (err) {
      // Ignore session storage errors
      console.warn('Failed to restore session:', err);
    }
  }, []);

  // Save output to session storage when it changes - Requirement 7.3
  useEffect(() => {
    if (output && outputState === 'success') {
      try {
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
          output,
          selectedStep,
          description,
        }));
      } catch (err) {
        console.warn('Failed to save to session:', err);
      }
    }
  }, [output, outputState, selectedStep, description]);

  // Keyboard shortcut for generating (Ctrl/Cmd + Enter) - Accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const isValid = selectedStep !== null && description.trim().length >= 10;
        if (isValid && outputState !== 'loading') {
          e.preventDefault();
          handleGenerate();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedStep, description, outputState]);

  // Get selected step metadata
  const selectedStepData = selectedStep
    ? STANDALONE_STEPS.find((s) => s.step === selectedStep)
    : null;

  // Handle step selection
  const handleSelectStep = (stepNumber: number) => {
    setSelectedStep(stepNumber);
    setDescription('');
    setOutput(null);
    setError(null);
    setOutputState('idle');
    
    // Clear session storage when selecting new step - Requirement 7.4
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (err) {
      // Ignore
    }
    
    logAnalytics('step_selected', { stepNumber });
  };

  // Validate description (minimum 10 characters per requirements)
  const isDescriptionValid = description.trim().length >= 10;

  // Handle generate button click - integrated with backend API
  const handleGenerate = useCallback(async () => {
    if (!selectedStep || !isDescriptionValid) return;

    setOutputState('loading');
    setError(null);
    setOutput(null);

    logAnalytics('generation_started', {
      stepNumber: selectedStep,
      descriptionLength: description.trim().length,
    });

    try {
      const response = await executeStep(selectedStep, description.trim());
      
      if (response.success) {
        const outputData: StepOutputData = {
          stepNumber: response.stepNumber,
          stepName: response.stepName,
          content: response.output,
          generatedAt: response.metadata.executedAt,
        };
        setOutput(outputData);
        setOutputState('success');
        
        logAnalytics('generation_completed', {
          stepNumber: selectedStep,
          stepName: response.stepName,
          contentLength: typeof response.output === 'string' ? response.output.length : JSON.stringify(response.output).length,
        });
      } else {
        const errorMsg = 'Generation failed. Please try again.';
        setError(errorMsg);
        setOutputState('error');
        
        logAnalytics('generation_failed', {
          stepNumber: selectedStep,
          error: errorMsg,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Generation failed. Please try again.';
      setError(errorMessage);
      setOutputState('error');
      
      logAnalytics('generation_error', {
        stepNumber: selectedStep,
        error: errorMessage,
      });
    }
  }, [selectedStep, description, isDescriptionValid]);

  // Handle download as Word document - Requirements: 6.2, 6.3, 6.4, 6.5
  const handleDownload = async () => {
    if (!output || !selectedStep) return;

    logAnalytics('download_started', {
      stepNumber: output.stepNumber,
      stepName: output.stepName,
    });

    try {
      await exportStepAsWord({
        stepNumber: output.stepNumber,
        stepName: output.stepName,
        description: description.trim(),
        content: output.content,
      });
      
      logAnalytics('download_completed', {
        stepNumber: output.stepNumber,
        stepName: output.stepName,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to download Word document.';
      setError(errorMessage);
      
      logAnalytics('download_failed', {
        stepNumber: output.stepNumber,
        error: errorMessage,
      });
    }
  };

  // Handle retry after error - Requirement 10.4
  const handleRetry = () => {
    setError(null);
    handleGenerate();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-sage-50">
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-teal-400 focus:text-white focus:rounded-lg"
      >
        Skip to main content
      </a>

      {/* Header */}
      <header className="border-b border-teal-200/50 backdrop-blur-sm bg-white/80 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="p-2 hover:bg-teal-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400"
              aria-label="Back to home"
            >
              <ArrowLeft className="w-5 h-5 text-teal-600" />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-teal-500 to-sage-500 bg-clip-text text-transparent">
                Standalone Step Execution
              </h1>
              <p className="text-teal-600 text-xs sm:text-sm mt-1 hidden sm:block">
                Generate individual curriculum components without a full workflow
              </p>
            </div>
          </div>
          {/* Keyboard shortcut hint */}
          <div className="hidden md:block text-xs text-teal-500">
            <kbd className="px-2 py-1 bg-teal-100 rounded border border-teal-200 text-teal-700">Ctrl</kbd>
            {' + '}
            <kbd className="px-2 py-1 bg-teal-100 rounded border border-teal-200 text-teal-700">Enter</kbd>
            {' to generate'}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8" role="main">
        {/* Step Selector Section */}
        <section className="mb-6 sm:mb-8" aria-labelledby="step-selector-heading">
          <h2 id="step-selector-heading" className="text-lg font-semibold text-teal-800 mb-4">
            Select a Step
          </h2>
          <StepSelector selectedStep={selectedStep} onSelectStep={handleSelectStep} />
        </section>

        {/* Description Input Section - Using DescriptionInput component */}
        {selectedStep && selectedStepData && (
          <section className="mb-6 sm:mb-8" aria-labelledby="description-input-heading">
            <h2 id="description-input-heading" className="sr-only">
              Enter Description for {selectedStepData.name}
            </h2>
            <DescriptionInput
              stepNumber={selectedStep}
              stepName={selectedStepData.name}
              stepIcon={selectedStepData.icon}
              stepDescription={selectedStepData.description}
              value={description}
              onChange={setDescription}
              onGenerate={handleGenerate}
              isGenerating={outputState === 'loading'}
              isValid={isDescriptionValid}
            />
          </section>
        )}

        {/* Error Display */}
        {error && outputState === 'error' && (
          <section className="mb-6 sm:mb-8" aria-live="polite" role="alert">
            <StepOutput
              state="error"
              output={null}
              error={error}
              onRetry={handleRetry}
            />
          </section>
        )}

        {/* Output Display Section - Using StepOutput component */}
        {output && outputState === 'success' && (
          <section className="mb-6 sm:mb-8" aria-labelledby="output-heading">
            <h2 id="output-heading" className="sr-only">Generated Output</h2>
            <StepOutput
              state="success"
              output={output}
              error={null}
              onDownload={handleDownload}
            />
          </section>
        )}

        {/* Loading State */}
        {outputState === 'loading' && (
          <section className="mb-6 sm:mb-8" aria-live="polite" aria-busy="true">
            <StepOutput
              state="loading"
              output={null}
              error={null}
            />
          </section>
        )}

        {/* Empty State - When no step is selected */}
        {!selectedStep && (
          <section className="text-center py-8 sm:py-12">
            <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-4 sm:mb-6 rounded-full bg-teal-100 flex items-center justify-center">
              <span className="text-3xl sm:text-4xl" role="img" aria-label="Target">🎯</span>
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-teal-800 mb-2">Select a Step to Begin</h3>
            <p className="text-teal-600 max-w-md mx-auto text-sm sm:text-base px-4">
              Choose any step from 2-10 above to generate individual curriculum components.
              No workflow context required.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
