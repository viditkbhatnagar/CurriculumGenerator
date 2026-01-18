'use client';

import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Sparkles,
  BookOpen,
  Zap,
  Target,
  Layers,
  FileText,
  Lightbulb,
  GraduationCap,
  Search,
  BookMarked,
  CheckSquare,
  Building2,
  Book,
  FileEdit,
  Presentation,
} from 'lucide-react';

const WORKFLOW_STEPS = [
  { step: 1, name: 'Program Foundation', time: '15-20 min', icon: FileText },
  { step: 2, name: 'Competency Framework (KSC)', time: '10-15 min', icon: Target },
  { step: 3, name: 'Program Learning Outcomes', time: '15-20 min', icon: Lightbulb },
  { step: 4, name: 'Course Framework & MLOs', time: '25-30 min', icon: GraduationCap },
  { step: 5, name: 'Topic-Level Sources', time: '10 min', icon: Search },
  { step: 6, name: 'Reading Lists', time: '8 min', icon: BookMarked },
  { step: 7, name: 'Auto-Gradable Assessments', time: '15-20 min', icon: CheckSquare },
  { step: 8, name: 'Case Studies', time: '10-15 min', icon: Building2 },
  { step: 9, name: 'Glossary', time: '5 min (auto)', icon: Book },
  { step: 10, name: 'Lesson Plans', time: '10-15 min', icon: FileEdit },
  { step: 11, name: 'PPT Generation', time: '10-15 min', icon: Presentation },
];

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-sage-50">
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          {/* Badge */}
          <div className="inline-flex items-center px-4 py-2 bg-teal-100 text-teal-700 rounded-full text-sm font-medium mb-8 border border-teal-200">
            <Sparkles className="w-4 h-4 mr-2" />
            NEW: 11-Step AI-Powered Workflow v2.2
          </div>

          {/* Main Heading */}
          <h1 className="text-5xl md:text-6xl font-bold text-teal-800 mb-6">
            AI-Integrated Curriculum
            <br />
            <span className="bg-gradient-to-r from-teal-500 to-teal-600 bg-clip-text text-transparent">
              Generator
            </span>
          </h1>

          {/* Subheading */}
          <p className="text-xl text-teal-600 mb-12 max-w-3xl mx-auto">
            Generate complete, AGI-compliant curricula in ~2 hours. 11-step workflow with SME
            checkpoints, auto-gradable MCQ assessments, and full credit system support (UK/ECTS/US).
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <button
              onClick={() => router.push('/workflow')}
              className="group inline-flex items-center justify-center px-8 py-4 text-lg font-medium text-white bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 rounded-lg shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40 transition-all"
              aria-label="Start a new curriculum workflow"
            >
              Start New Curriculum
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => router.push('/standalone')}
              className="group inline-flex items-center justify-center px-8 py-4 text-lg font-medium text-white bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 rounded-lg shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all"
              aria-label="Generate individual curriculum steps without a full workflow"
            >
              <Layers className="mr-2 w-5 h-5" />
              Standalone Step
            </button>

            <button
              onClick={() => router.push('/workflow')}
              className="inline-flex items-center justify-center px-8 py-4 text-lg font-medium text-teal-700 bg-white hover:bg-teal-50 rounded-lg shadow-lg transition-all border border-teal-200"
              aria-label="View your existing workflows"
            >
              View My Workflows
            </button>
          </div>

          {/* 11-Step Workflow Preview */}
          <div className="bg-white rounded-2xl p-8 border border-teal-200/50 max-w-5xl mx-auto mb-16 shadow-sm">
            <h2 className="text-2xl font-bold text-teal-800 mb-6">11-Step Workflow</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {WORKFLOW_STEPS.slice(0, 6).map((step) => {
                const IconComponent = step.icon;
                return (
                  <div
                    key={step.step}
                    className="bg-teal-50/50 rounded-xl p-4 border border-teal-100 text-center hover:border-teal-300 hover:bg-teal-50 transition-all"
                  >
                    <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-teal-100 flex items-center justify-center">
                      <IconComponent className="w-5 h-5 text-teal-600" />
                    </div>
                    <p className="text-xs font-medium text-teal-800 leading-tight">{step.name}</p>
                    <p className="text-xs text-teal-500 mt-1">{step.time}</p>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
              {WORKFLOW_STEPS.slice(6).map((step) => {
                const IconComponent = step.icon;
                return (
                  <div
                    key={step.step}
                    className="bg-teal-50/50 rounded-xl p-4 border border-teal-100 text-center hover:border-teal-300 hover:bg-teal-50 transition-all"
                  >
                    <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-teal-100 flex items-center justify-center">
                      <IconComponent className="w-5 h-5 text-teal-600" />
                    </div>
                    <p className="text-xs font-medium text-teal-800 leading-tight">{step.name}</p>
                    <p className="text-xs text-teal-500 mt-1">{step.time}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {/* Feature 1 - Standalone */}
            <div
              className="bg-white rounded-xl p-6 border border-teal-200/50 hover:border-purple-300 hover:shadow-md transition-all cursor-pointer"
              onClick={() => router.push('/standalone')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && router.push('/standalone')}
            >
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <Layers className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-teal-800 mb-2">Standalone Steps</h3>
              <p className="text-teal-600 text-sm">
                Generate individual curriculum components without a full workflow. Quick and
                flexible.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white rounded-xl p-6 border border-teal-200/50 hover:border-teal-300 hover:shadow-md transition-all">
              <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <Zap className="w-6 h-6 text-teal-600" />
              </div>
              <h3 className="text-lg font-semibold text-teal-800 mb-2">MCQ-First Assessments</h3>
              <p className="text-teal-600 text-sm">
                Auto-gradable only. MCQ with optional Cloze. No manual grading required.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white rounded-xl p-6 border border-teal-200/50 hover:border-teal-300 hover:shadow-md transition-all">
              <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <BookOpen className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold text-teal-800 mb-2">AGI Academic Standards</h3>
              <p className="text-teal-600 text-sm">
                Strict source validation. Peer-reviewed journals &lt;5 years, textbooks &lt;10
                years.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white rounded-xl p-6 border border-teal-200/50 hover:border-teal-300 hover:shadow-md transition-all">
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <Target className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-lg font-semibold text-teal-800 mb-2">Multi-Credit Systems</h3>
              <p className="text-teal-600 text-sm">
                UK Credits, ECTS, US Semester Hours. Automatic contact hour calculations.
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            <div className="bg-white rounded-xl p-4 border border-teal-200/50 shadow-sm">
              <div className="text-3xl font-bold text-teal-600 mb-1">11</div>
              <div className="text-sm text-teal-500">Steps</div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-teal-200/50 shadow-sm">
              <div className="text-3xl font-bold text-emerald-600 mb-1">~2h</div>
              <div className="text-sm text-teal-500">Total Time</div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-teal-200/50 shadow-sm">
              <div className="text-3xl font-bold text-purple-600 mb-1">100%</div>
              <div className="text-sm text-teal-500">Auto-Gradable</div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-teal-200/50 shadow-sm">
              <div className="text-3xl font-bold text-amber-600 mb-1">3</div>
              <div className="text-sm text-teal-500">Credit Systems</div>
            </div>
          </div>

          {/* Quick Start */}
          <div className="mt-16 bg-gradient-to-r from-teal-100/80 to-teal-50 rounded-2xl p-8 border border-teal-200 max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-teal-800 mb-4">Ready to Start?</h2>
            <p className="text-teal-700 mb-6">
              Create your first curriculum in about 2 hours with AI assistance at every step.
            </p>
            <button
              onClick={() => router.push('/workflow')}
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 text-lg font-medium text-white bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 rounded-lg transition-all shadow-lg shadow-teal-500/25"
            >
              Create New Curriculum
              <ArrowRight className="ml-2 w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
