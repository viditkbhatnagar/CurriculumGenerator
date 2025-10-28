'use client';

import Link from 'next/link';

export default function StudentDashboard() {
  return (
    <div className="container mx-auto px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Welcome to Your Learning Portal</h1>
        <p className="text-lg text-gray-600">
          Access AI-powered tutoring and interactive simulations to enhance your learning experience.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* AI Tutor Card */}
        <Link href="/student/tutor">
          <div className="bg-white rounded-lg shadow-lg p-8 hover:shadow-xl transition-shadow cursor-pointer border-2 border-transparent hover:border-blue-500">
            <div className="text-5xl mb-4">💬</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">AI Tutor</h2>
            <p className="text-gray-600 mb-4">
              Get personalized help with your coursework. Ask questions and receive guided support
              using the Socratic method to deepen your understanding.
            </p>
            <div className="flex items-center text-blue-600 font-medium">
              Start chatting
              <svg
                className="w-5 h-5 ml-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </div>
        </Link>

        {/* Simulations Card */}
        <Link href="/student/simulations">
          <div className="bg-white rounded-lg shadow-lg p-8 hover:shadow-xl transition-shadow cursor-pointer border-2 border-transparent hover:border-blue-500">
            <div className="text-5xl mb-4">🎯</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Interactive Simulations</h2>
            <p className="text-gray-600 mb-4">
              Practice your skills in realistic workplace scenarios. Make decisions, receive
              feedback, and see detailed performance reports.
            </p>
            <div className="flex items-center text-blue-600 font-medium">
              Start simulation
              <svg
                className="w-5 h-5 ml-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </div>
        </Link>
      </div>

      {/* Features Overview */}
      <div className="mt-12 bg-blue-50 rounded-lg p-8">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Learning Features</h3>
        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <div className="text-2xl mb-2">🧠</div>
            <h4 className="font-semibold text-gray-900 mb-1">Adaptive Learning</h4>
            <p className="text-sm text-gray-600">
              AI adapts to your comprehension level and learning pace
            </p>
          </div>
          <div>
            <div className="text-2xl mb-2">📊</div>
            <h4 className="font-semibold text-gray-900 mb-1">Performance Tracking</h4>
            <p className="text-sm text-gray-600">
              Detailed reports help you understand your strengths and areas for improvement
            </p>
          </div>
          <div>
            <div className="text-2xl mb-2">🎓</div>
            <h4 className="font-semibold text-gray-900 mb-1">Real-World Practice</h4>
            <p className="text-sm text-gray-600">
              Simulations based on actual workplace scenarios and best practices
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
