'use client';

import { useRouter } from 'next/navigation';
import { ArrowRight, Sparkles, BookOpen, Zap } from 'lucide-react';

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          {/* Badge */}
          <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium mb-8">
            <Sparkles className="w-4 h-4 mr-2" />
            New AI-Powered 5-Stage Workflow
          </div>

          {/* Main Heading */}
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            AI-Powered Curriculum
            <br />
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Generator
            </span>
          </h1>

          {/* Subheading */}
          <p className="text-xl text-gray-600 mb-12 max-w-3xl mx-auto">
            Generate AGI-compliant curricula in hours instead of weeks. Powered by OpenAI GPT-4 with
            real-time SME collaboration.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <button
              onClick={() => router.push('/prompts')}
              className="group inline-flex items-center justify-center px-8 py-4 text-lg font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-lg hover:shadow-xl transition-all"
            >
              Start Generating Now
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => router.push('/dashboard')}
              className="inline-flex items-center justify-center px-8 py-4 text-lg font-medium text-gray-700 bg-white hover:bg-gray-50 rounded-lg shadow-lg hover:shadow-xl transition-all border border-gray-200"
            >
              View Dashboard
            </button>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Feature 1 */}
            <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <Zap className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">AI-Powered Generation</h3>
              <p className="text-gray-600 text-sm">
                OpenAI GPT-4 generates all 14 AGI components with proper citations and UK English
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <BookOpen className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">AGI-Compliant</h3>
              <p className="text-gray-600 text-sm">
                14-component structure with Bloom's taxonomy, APA 7 citations, and verified sources
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <Sparkles className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">2-3 Hours vs 2-3 Weeks</h3>
              <p className="text-gray-600 text-sm">
                Real-time chat collaboration with AI for instant refinements and approvals
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-4 gap-8 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 mb-2">120</div>
              <div className="text-sm text-gray-600">Hours per Course</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-purple-600 mb-2">15</div>
              <div className="text-sm text-gray-600">ECTS Credits</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-green-600 mb-2">14</div>
              <div className="text-sm text-gray-600">AGI Components</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-orange-600 mb-2">99%</div>
              <div className="text-sm text-gray-600">Cost Reduction</div>
            </div>
          </div>

          {/* Templates Available */}
          <div className="mt-16 bg-white rounded-xl p-8 shadow-lg max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Available Templates</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="text-left p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-1">CHRP Certification Prep</h3>
                <p className="text-sm text-gray-600">
                  Human Resource Management • 120 hrs • 15 ECTS
                </p>
              </div>
              <div className="text-left p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-1">Advanced Data Analytics</h3>
                <p className="text-sm text-gray-600">Data Analytics • 150 hrs • 20 ECTS</p>
              </div>
            </div>
            <button
              onClick={() => router.push('/prompts')}
              className="mt-6 w-full inline-flex items-center justify-center px-6 py-3 text-base font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              Browse All Templates
              <ArrowRight className="ml-2 w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
