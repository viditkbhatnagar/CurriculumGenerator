'use client';

import React from 'react';

// Step configuration matching the design document
export const STANDALONE_STEPS = [
  {
    step: 2,
    name: 'Competency Framework (KSC)',
    time: '10-15 min',
    icon: '🎯',
    description: 'Generate Knowledge, Skills, and Competencies (KSC) framework',
  },
  {
    step: 3,
    name: 'Program Learning Outcomes',
    time: '15-20 min',
    icon: '⚡',
    description: "Create measurable Program Learning Outcomes using Bloom's Taxonomy",
  },
  {
    step: 4,
    name: 'Course Framework & MLOs',
    time: '25-30 min',
    icon: '📚',
    description: 'Structure modules, topics, and Module Learning Outcomes',
  },
  {
    step: 5,
    name: 'Topic-Level Sources',
    time: '10 min',
    icon: '📖',
    description: 'Assign AGI-compliant academic sources to topics',
  },
  {
    step: 6,
    name: 'Reading Lists',
    time: '8 min',
    icon: '📕',
    description: 'Create core and supplementary reading lists per module',
  },
  {
    step: 7,
    name: 'Auto-Gradable Assessments',
    time: '15-20 min',
    icon: '✅',
    description: 'Generate MCQ-first auto-gradable assessments and quizzes',
  },
  {
    step: 8,
    name: 'Case Studies',
    time: '10-15 min',
    icon: '🏢',
    description: 'Create engagement hooks and case study scenarios',
  },
  {
    step: 9,
    name: 'Glossary',
    time: '5 min',
    icon: '📖',
    description: 'Auto-generate glossary from all curriculum content',
  },
  {
    step: 10,
    name: 'Lesson Plans & PPT',
    time: '10-15 min',
    icon: '📝',
    description: 'Generate detailed lesson plans and PowerPoint decks',
  },
];

export interface StepSelectorProps {
  selectedStep: number | null;
  onSelectStep: (stepNumber: number) => void;
}

export function StepSelector({ selectedStep, onSelectStep }: StepSelectorProps) {
  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent, stepNumber: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelectStep(stepNumber);
    }
  };

  return (
    <div 
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4"
      role="listbox"
      aria-label="Select a curriculum step"
    >
      {STANDALONE_STEPS.map((step) => {
        const isSelected = selectedStep === step.step;
        return (
          <button
            key={step.step}
            onClick={() => onSelectStep(step.step)}
            onKeyDown={(e) => handleKeyDown(e, step.step)}
            role="option"
            aria-selected={isSelected}
            aria-label={`Step ${step.step}: ${step.name}. Estimated time: ${step.time}. ${step.description}`}
            className={`
              p-3 sm:p-4 rounded-xl border text-left transition-all
              focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 focus:ring-offset-teal-50
              ${
                isSelected
                  ? 'bg-teal-100 border-teal-400 ring-2 ring-teal-300/50'
                  : 'bg-white border-teal-200/50 hover:border-teal-300 hover:bg-teal-50 shadow-teal-sm'
              }
            `}
          >
            <div className="flex items-start gap-2 sm:gap-3">
              <span className="text-xl sm:text-2xl" role="img" aria-hidden="true">{step.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-teal-500">Step {step.step}</span>
                  <span className="text-xs text-teal-500">{step.time}</span>
                </div>
                <h3
                  className={`font-medium mt-1 text-sm sm:text-base ${isSelected ? 'text-teal-700' : 'text-teal-800'}`}
                >
                  {step.name}
                </h3>
                <p className="text-xs text-teal-600 mt-1 line-clamp-2">{step.description}</p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default StepSelector;
