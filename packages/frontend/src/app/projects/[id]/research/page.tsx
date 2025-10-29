'use client';

/**
 * AI Research & Chat Interface Page (Stage 2)
 * Real-time collaboration with AI to generate and refine 14 AGI components
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MessageSquare, CheckCircle, Clock, Sparkles } from 'lucide-react';

export default function AIResearchPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [prelimPackage, setPrelimPackage] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Check if component has actual content (not just empty object/array)
  const hasContent = (component: any) => {
    if (!component) return false;

    if (Array.isArray(component)) {
      // For arrays, check if it has at least one element
      return component.length > 0;
    }

    if (typeof component === 'object') {
      // For objects, check if it has keys AND at least one non-empty value
      const keys = Object.keys(component);
      if (keys.length === 0) return false;

      return Object.values(component).some((v) => {
        if (v === null || v === undefined || v === '') return false;
        if (Array.isArray(v)) return v.length > 0;
        if (typeof v === 'object') return Object.keys(v).length > 0;
        return true;
      });
    }

    return false;
  };

  useEffect(() => {
    // Use a flag to prevent double-calling (React 18 StrictMode calls useEffect twice)
    let initiated = false;

    if (!initiated) {
      initiated = true;
      startAIGeneration();
    }

    return () => {
      initiated = false;
    };
  }, []); // Empty dependency array - only run ONCE on mount

  const startAIGeneration = async () => {
    setLoading(true);
    setIsGenerating(true);
    try {
      console.log('🚀 Starting AI generation for project:', projectId);

      // Start the AI generation (backend handles duplicates gracefully)
      const startResponse = await fetch(
        `http://localhost:4000/api/v2/projects/${projectId}/research/start`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (startResponse.ok) {
        const result = await startResponse.json();
        console.log('✅ AI generation started:', result);
      } else {
        console.warn(
          '⚠️ Start request failed:',
          startResponse.status,
          '- Will try polling anyway (package might already exist)'
        );
      }

      // Exit loading state so UI shows the component grid
      setLoading(false);

      // Always start polling, even if POST failed (package might already exist)
      pollForPackage();
    } catch (error) {
      console.error('❌ Error starting AI generation:', error);
      setLoading(false); // Exit loading state
      // Still try polling - the package might exist from a previous call
      pollForPackage();
    }
  };

  const pollForPackage = async () => {
    const maxAttempts = 100; // Poll for up to 5 minutes (3 seconds * 100)
    let attempts = 0;

    const poll = async () => {
      try {
        console.log(`📡 Polling for package... (attempt ${attempts + 1}/${maxAttempts})`);
        const response = await fetch(
          `http://localhost:4000/api/v2/projects/${projectId}/research/package`
        );

        if (response.ok) {
          const data = await response.json();
          const pkg = data.data;

          // Check if package has actual content (not just empty structure)
          const hasActualContent =
            pkg &&
            (hasContent(pkg.programOverview) ||
              hasContent(pkg.competencyFramework) ||
              hasContent(pkg.learningOutcomes));

          if (hasActualContent) {
            // Package has content! Stop polling and update UI
            setPrelimPackage(pkg);
            setIsGenerating(false);
            console.log('✅ Preliminary package with content received:', pkg);
            return;
          } else {
            // Package exists but is empty - keep polling
            console.log('📦 Package found but empty, continuing to poll...');
            setPrelimPackage(pkg); // Still update UI to show progress
          }
        }
      } catch (error) {
        console.error('❌ Error fetching preliminary package:', error);
      }

      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(poll, 3000); // Poll every 3 seconds (TESTING MODE - change to 30000 for production)
      } else {
        setIsGenerating(false);
        console.log('⏰ Polling timeout - check backend logs');
      }
    };

    poll();
  };

  const fetchPreliminaryPackage = async () => {
    try {
      console.log('🔄 Manually refreshing package data...');
      const response = await fetch(
        `http://localhost:4000/api/v2/projects/${projectId}/research/package`
      );

      if (response.ok) {
        const data = await response.json();
        console.log('🔄 Refreshed package:', data.data);
        setPrelimPackage(data.data);
      } else {
        console.error('❌ Refresh failed:', response.status);
      }
    } catch (error) {
      console.error('❌ Error fetching preliminary package:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading AI Research Interface...</p>
        </div>
      </div>
    );
  }

  const components = [
    {
      name: 'Program Overview',
      icon: '📋',
      status: hasContent(prelimPackage?.programOverview) ? 'complete' : 'pending',
    },
    {
      name: 'Competency Framework',
      icon: '🎯',
      status: hasContent(prelimPackage?.competencyFramework) ? 'complete' : 'pending',
    },
    {
      name: 'Learning Outcomes',
      icon: '📚',
      status: hasContent(prelimPackage?.learningOutcomes) ? 'complete' : 'pending',
    },
    {
      name: 'Course Framework',
      icon: '🗂️',
      status: hasContent(prelimPackage?.courseFramework) ? 'complete' : 'pending',
    },
    {
      name: 'Topic Sources',
      icon: '📖',
      status: hasContent(prelimPackage?.topicSources) ? 'complete' : 'pending',
    },
    {
      name: 'Reading List',
      icon: '📕',
      status: hasContent(prelimPackage?.readingList) ? 'complete' : 'pending',
    },
    {
      name: 'Assessments',
      icon: '✅',
      status: hasContent(prelimPackage?.assessments) ? 'complete' : 'pending',
    },
    {
      name: 'Glossary',
      icon: '📝',
      status: hasContent(prelimPackage?.glossary) ? 'complete' : 'pending',
    },
    {
      name: 'Case Studies',
      icon: '💼',
      status: hasContent(prelimPackage?.caseStudies) ? 'complete' : 'pending',
    },
    {
      name: 'Delivery & Tools',
      icon: '🛠️',
      status: hasContent(prelimPackage?.deliveryTools) ? 'complete' : 'pending',
    },
    {
      name: 'References',
      icon: '🔗',
      status: hasContent(prelimPackage?.references) ? 'complete' : 'pending',
    },
    {
      name: 'Submission Metadata',
      icon: '📄',
      status: hasContent(prelimPackage?.submissionMetadata) ? 'complete' : 'pending',
    },
    {
      name: 'Outcome Writing Guide',
      icon: '✏️',
      status: hasContent(prelimPackage?.outcomeWritingGuide) ? 'complete' : 'pending',
    },
    {
      name: 'Comparative Benchmarking',
      icon: '📊',
      status: hasContent(prelimPackage?.comparativeBenchmarking) ? 'complete' : 'pending',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">AI Research & SME Review</h1>
              <p className="mt-2 text-sm text-gray-600">
                Stage 2: Generate and refine 14 AGI-compliant components
              </p>
            </div>
            <button
              onClick={() => router.push(`/projects/${projectId}`)}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center mb-6">
            <Sparkles className="w-6 h-6 text-blue-600 mr-2" />
            <h2 className="text-xl font-bold text-gray-900">AI is generating your curriculum...</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {components.map((component, index) => (
              <div
                key={index}
                className={`
                  p-4 rounded-lg border-2 transition-colors
                  ${
                    component.status === 'complete'
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 bg-gray-50'
                  }
                `}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{component.icon}</span>
                    <div>
                      <h3 className="font-medium text-gray-900">{component.name}</h3>
                    </div>
                  </div>
                  {component.status === 'complete' ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <Clock className="w-5 h-5 text-gray-400 animate-pulse" />
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <MessageSquare className="w-5 h-5 text-blue-600 mt-1 mr-3" />
              <div>
                <h4 className="font-medium text-blue-900 mb-1">AI Generation in Progress</h4>
                <p className="text-sm text-blue-700">
                  The AI is generating all 14 components of your AGI-compliant curriculum. This
                  typically takes 15-30 minutes. You'll be able to review and refine each component
                  via chat once generation is complete.
                </p>
                <div className="mt-3">
                  <div className="inline-flex items-center space-x-2 text-sm text-blue-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span>Generating components...</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={fetchPreliminaryPackage}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Refresh Status
            </button>
            <button
              onClick={() => router.push(`/projects/${projectId}`)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Return to Dashboard
            </button>
          </div>
        </div>

        {/* Chat Interface Placeholder */}
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Chat with AI</h3>
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">
              Chat interface will be available once the initial generation is complete.
            </p>
            <p className="text-sm text-gray-500 mt-2">
              You'll be able to review each component and request refinements in real-time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
