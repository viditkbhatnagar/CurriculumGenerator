'use client';

import { useState } from 'react';
import { ProgramDetail } from '@/components/programs/ProgramDetail';
import { ExportButton } from '@/components/export/ExportButton';
import { ExcelUploadInterface } from '@/components/programs/ExcelUploadInterface';
import { CurriculumGenerationInterface } from '@/components/programs/CurriculumGenerationInterface';
import { CurriculumReviewInterface } from '@/components/programs/CurriculumReviewInterface';
import { BenchmarkingResultsView } from '@/components/programs/BenchmarkingResultsView';
import Link from 'next/link';

type WorkflowStep = 'details' | 'upload' | 'generate' | 'review' | 'benchmark';

export default function ProgramDetailPage({ params }: { params: { id: string } }) {
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('details');

  // Add debugging and safety check
  console.log('ProgramDetailPage params:', params);
  
  if (!params?.id || params.id === 'undefined') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h2 className="text-xl font-bold text-red-900 mb-2">Error: No Program ID</h2>
        <p className="text-red-700">Program ID is missing from the URL.</p>
        <Link
          href="/admin/programs"
          className="inline-block mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          ← Back to Programs
        </Link>
      </div>
    );
  }

  const steps = [
    { id: 'details' as WorkflowStep, label: 'Program Details', icon: '📋' },
    { id: 'upload' as WorkflowStep, label: 'Upload Data', icon: '📤' },
    { id: 'generate' as WorkflowStep, label: 'Generate', icon: '⚡' },
    { id: 'review' as WorkflowStep, label: 'Review', icon: '📝' },
    { id: 'benchmark' as WorkflowStep, label: 'Benchmark', icon: '📊' },
  ];

  const getStepIndex = (step: WorkflowStep) => steps.findIndex(s => s.id === step);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/admin/programs"
          className="text-blue-600 hover:text-blue-800"
        >
          ← Back to Programs
        </Link>
        <div className="flex space-x-4">
          <Link
            href={`/admin/programs/${params.id}/versions`}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            📜 Version History
          </Link>
          <ExportButton programId={params.id} />
        </div>
      </div>

      {/* Workflow Steps */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <nav aria-label="Progress">
          <ol className="flex items-center justify-between">
            {steps.map((step, index) => (
              <li key={step.id} className="relative flex-1">
                <button
                  onClick={() => setCurrentStep(step.id)}
                  className={`group flex flex-col items-center ${
                    index !== steps.length - 1 ? 'pr-8' : ''
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${
                      getStepIndex(currentStep) >= index
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-gray-300 bg-white text-gray-500 group-hover:border-gray-400'
                    }`}
                  >
                    <span className="text-lg">{step.icon}</span>
                  </span>
                  <span className="mt-2 text-xs font-medium text-gray-900">
                    {step.label}
                  </span>
                </button>
                {index !== steps.length - 1 && (
                  <div
                    className={`absolute top-5 left-1/2 h-0.5 w-full transition-colors ${
                      getStepIndex(currentStep) > index ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                    style={{ transform: 'translateY(-50%)' }}
                  />
                )}
              </li>
            ))}
          </ol>
        </nav>
      </div>

      {/* Step Content */}
      <div>
        {currentStep === 'details' && (
          <div>
            <ProgramDetail programId={params.id} />
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setCurrentStep('upload')}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Next: Upload Data →
              </button>
            </div>
          </div>
        )}

        {currentStep === 'upload' && (
          <div>
            <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload SME Data</h2>
              <p className="text-sm text-gray-600">
                Upload your Excel file containing the curriculum data from subject matter experts.
              </p>
            </div>
            <ExcelUploadInterface
              programId={params.id}
              onValidationSuccess={() => setCurrentStep('generate')}
            />
          </div>
        )}

        {currentStep === 'generate' && (
          <div>
            <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Generate Curriculum</h2>
              <p className="text-sm text-gray-600">
                Trigger the AI-powered curriculum generation process.
              </p>
            </div>
            <CurriculumGenerationInterface
              programId={params.id}
              onGenerationComplete={() => setCurrentStep('review')}
            />
          </div>
        )}

        {currentStep === 'review' && (
          <div>
            <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Review Curriculum</h2>
                  <p className="text-sm text-gray-600">
                    Review and edit the generated curriculum content and quality assurance report.
                  </p>
                </div>
                <button
                  onClick={() => setCurrentStep('benchmark')}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Next: View Benchmarking →
                </button>
              </div>
            </div>
            <CurriculumReviewInterface programId={params.id} />
          </div>
        )}

        {currentStep === 'benchmark' && (
          <div>
            <BenchmarkingResultsView programId={params.id} />
          </div>
        )}
      </div>
    </div>
  );
}
