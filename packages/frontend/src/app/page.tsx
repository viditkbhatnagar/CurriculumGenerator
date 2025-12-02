'use client';

import { useRouter } from 'next/navigation';
import { ArrowRight, Sparkles, BookOpen, Zap, CheckCircle, Clock, Target } from 'lucide-react';

const WORKFLOW_STEPS = [
  { step: 1, name: 'Program Foundation', time: '15-20 min', icon: '📋' },
  { step: 2, name: 'Competency Framework (KSC)', time: '10-15 min', icon: '🎯' },
  { step: 3, name: 'Program Learning Outcomes', time: '15-20 min', icon: '⚡' },
  { step: 4, name: 'Course Framework & MLOs', time: '25-30 min', icon: '📚' },
  { step: 5, name: 'Topic-Level Sources', time: '10 min', icon: '📖' },
  { step: 6, name: 'Reading Lists', time: '8 min', icon: '📕' },
  { step: 7, name: 'Auto-Gradable Assessments', time: '15-20 min', icon: '✅' },
  { step: 8, name: 'Case Studies', time: '10-15 min', icon: '🏢' },
  { step: 9, name: 'Glossary', time: '5 min (auto)', icon: '📖' },
];

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          {/* Badge */}
          <div className="inline-flex items-center px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-full text-sm font-medium mb-8 border border-cyan-500/30">
            <Sparkles className="w-4 h-4 mr-2" />
            NEW: 9-Step AI-Powered Workflow v2.2
          </div>

          {/* Main Heading */}
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            AI-Integrated Curriculum
            <br />
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Generator
            </span>
          </h1>

          {/* Subheading */}
          <p className="text-xl text-slate-300 mb-12 max-w-3xl mx-auto">
            Generate complete, AGI-compliant curricula in ~2 hours. 9-step workflow with SME
            checkpoints, auto-gradable MCQ assessments, and full credit system support (UK/ECTS/US).
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <button
              onClick={() => router.push('/workflow')}
              className="group inline-flex items-center justify-center px-8 py-4 text-lg font-medium text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 rounded-lg shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all"
            >
              Start New Curriculum
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => router.push('/workflow')}
              className="inline-flex items-center justify-center px-8 py-4 text-lg font-medium text-white bg-slate-700 hover:bg-slate-600 rounded-lg shadow-lg transition-all border border-slate-600"
            >
              View My Workflows
            </button>
          </div>

          {/* 9-Step Workflow Preview */}
          <div className="bg-slate-800/50 rounded-2xl p-8 border border-slate-700/50 max-w-4xl mx-auto mb-16">
            <h2 className="text-2xl font-bold text-white mb-6">9-Step Workflow</h2>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
              {WORKFLOW_STEPS.slice(0, 5).map((step) => (
                <div
                  key={step.step}
                  className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50 text-center"
                >
                  <span className="text-2xl mb-2 block">{step.icon}</span>
                  <p className="text-xs text-slate-400">{step.name}</p>
                  <p className="text-xs text-cyan-400 mt-1">{step.time}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-3 mt-3">
              {WORKFLOW_STEPS.slice(5).map((step) => (
                <div
                  key={step.step}
                  className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50 text-center"
                >
                  <span className="text-2xl mb-2 block">{step.icon}</span>
                  <p className="text-xs text-slate-400">{step.name}</p>
                  <p className="text-xs text-cyan-400 mt-1">{step.time}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Feature 1 */}
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 hover:border-cyan-500/50 transition-colors">
              <div className="w-12 h-12 bg-cyan-500/20 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <Zap className="w-6 h-6 text-cyan-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">MCQ-First Assessments</h3>
              <p className="text-slate-400 text-sm">
                Auto-gradable only. MCQ with optional Cloze. No manual grading required.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 hover:border-cyan-500/50 transition-colors">
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <BookOpen className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">AGI Academic Standards</h3>
              <p className="text-slate-400 text-sm">
                Strict source validation. Peer-reviewed journals &lt;5 years, textbooks &lt;10
                years.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 hover:border-cyan-500/50 transition-colors">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <Target className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Multi-Credit Systems</h3>
              <p className="text-slate-400 text-sm">
                UK Credits, ECTS, US Semester Hours. Automatic contact hour calculations.
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
              <div className="text-3xl font-bold text-cyan-400 mb-1">9</div>
              <div className="text-sm text-slate-500">Steps</div>
            </div>
            <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
              <div className="text-3xl font-bold text-emerald-400 mb-1">~2h</div>
              <div className="text-sm text-slate-500">Total Time</div>
            </div>
            <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
              <div className="text-3xl font-bold text-purple-400 mb-1">100%</div>
              <div className="text-sm text-slate-500">Auto-Gradable</div>
            </div>
            <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
              <div className="text-3xl font-bold text-amber-400 mb-1">3</div>
              <div className="text-sm text-slate-500">Credit Systems</div>
            </div>
          </div>

          {/* Quick Start */}
          <div className="mt-16 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-2xl p-8 border border-cyan-500/20 max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-white mb-4">Ready to Start?</h2>
            <p className="text-slate-300 mb-6">
              Create your first curriculum in about 2 hours with AI assistance at every step.
            </p>
            <button
              onClick={() => router.push('/workflow')}
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 text-lg font-medium text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 rounded-lg transition-all"
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
