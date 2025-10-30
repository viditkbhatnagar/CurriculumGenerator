'use client';

/**
 * AI Research & Chat Interface Page (Stage 2)
 * Real-time collaboration with AI to generate and refine 14 AGI components
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MessageSquare, CheckCircle, Clock, Sparkles, Eye, X, Send } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export default function AIResearchPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [prelimPackage, setPrelimPackage] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Modal & Chat states
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);

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

  const handleViewComponent = (componentKey: string) => {
    setSelectedComponent(componentKey);
    setChatMessages([
      {
        role: 'system',
        content: `Viewing: ${componentKey.replace(/([A-Z])/g, ' $1').trim()}. You can review the content below and request changes via chat.`,
        timestamp: new Date(),
      },
    ]);
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !selectedComponent) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: chatInput,
      timestamp: new Date(),
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput('');
    setIsSendingMessage(true);

    try {
      // TODO: Connect to backend API for AI chat refinement
      // For now, simulate a response
      setTimeout(() => {
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: `I understand you want to refine the ${selectedComponent} component. I'll update it based on your feedback. (Note: Full AI refinement will be enabled once backend chat endpoint is connected.)`,
          timestamp: new Date(),
        };
        setChatMessages((prev) => [...prev, assistantMessage]);
        setIsSendingMessage(false);
      }, 1000);
    } catch (error) {
      console.error('❌ Error sending message:', error);
      setIsSendingMessage(false);
    }
  };

  const renderComponentContent = (componentKey: string) => {
    const data = prelimPackage?.[componentKey];

    if (!data) {
      return <p className="text-gray-500 italic">No content available</p>;
    }

    return (
      <pre className="bg-gray-50 p-4 rounded-lg overflow-auto max-h-96 text-sm">
        {JSON.stringify(data, null, 2)}
      </pre>
    );
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
      key: 'programOverview',
      name: 'Program Overview',
      icon: '📋',
      status: hasContent(prelimPackage?.programOverview) ? 'complete' : 'pending',
    },
    {
      key: 'competencyFramework',
      name: 'Competency Framework',
      icon: '🎯',
      status: hasContent(prelimPackage?.competencyFramework) ? 'complete' : 'pending',
    },
    {
      key: 'learningOutcomes',
      name: 'Learning Outcomes',
      icon: '📚',
      status: hasContent(prelimPackage?.learningOutcomes) ? 'complete' : 'pending',
    },
    {
      key: 'courseFramework',
      name: 'Course Framework',
      icon: '🗂️',
      status: hasContent(prelimPackage?.courseFramework) ? 'complete' : 'pending',
    },
    {
      key: 'topicSources',
      name: 'Topic Sources',
      icon: '📖',
      status: hasContent(prelimPackage?.topicSources) ? 'complete' : 'pending',
    },
    {
      key: 'readingList',
      name: 'Reading List',
      icon: '📕',
      status: hasContent(prelimPackage?.readingList) ? 'complete' : 'pending',
    },
    {
      key: 'assessments',
      name: 'Assessments',
      icon: '✅',
      status: hasContent(prelimPackage?.assessments) ? 'complete' : 'pending',
    },
    {
      key: 'glossary',
      name: 'Glossary',
      icon: '📝',
      status: hasContent(prelimPackage?.glossary) ? 'complete' : 'pending',
    },
    {
      key: 'caseStudies',
      name: 'Case Studies',
      icon: '💼',
      status: hasContent(prelimPackage?.caseStudies) ? 'complete' : 'pending',
    },
    {
      key: 'deliveryTools',
      name: 'Delivery & Tools',
      icon: '🛠️',
      status: hasContent(prelimPackage?.deliveryTools) ? 'complete' : 'pending',
    },
    {
      key: 'references',
      name: 'References',
      icon: '🔗',
      status: hasContent(prelimPackage?.references) ? 'complete' : 'pending',
    },
    {
      key: 'submissionMetadata',
      name: 'Submission Metadata',
      icon: '📄',
      status: hasContent(prelimPackage?.submissionMetadata) ? 'complete' : 'pending',
    },
    {
      key: 'outcomeWritingGuide',
      name: 'Outcome Writing Guide',
      icon: '✏️',
      status: hasContent(prelimPackage?.outcomeWritingGuide) ? 'complete' : 'pending',
    },
    {
      key: 'comparativeBenchmarking',
      name: 'Comparative Benchmarking',
      icon: '📊',
      status: hasContent(prelimPackage?.comparativeBenchmarking) ? 'complete' : 'pending',
    },
  ];

  const completedCount = components.filter((c) => c.status === 'complete').length;
  const allComplete = completedCount === components.length;

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
              <p className="mt-1 text-lg font-semibold text-blue-600">
                {completedCount} / {components.length} Components Complete
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
            <h2 className="text-xl font-bold text-gray-900">
              {allComplete ? '✅ Curriculum Generated!' : 'AI is generating your curriculum...'}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
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
                  <div className="flex items-center space-x-2">
                    {component.status === 'complete' ? (
                      <>
                        <button
                          onClick={() => handleViewComponent(component.key)}
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-md transition-colors"
                          title="View content"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </>
                    ) : (
                      <Clock className="w-5 h-5 text-gray-400 animate-pulse" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {!allComplete && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <MessageSquare className="w-5 h-5 text-blue-600 mt-1 mr-3" />
                <div>
                  <h4 className="font-medium text-blue-900 mb-1">AI Generation in Progress</h4>
                  <p className="text-sm text-blue-700">
                    The AI is generating all 14 components of your AGI-compliant curriculum. Click
                    the eye icon on any completed component to view its content and chat with AI for
                    refinements.
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
          )}

          {allComplete && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <CheckCircle className="w-5 h-5 text-green-600 mt-1 mr-3" />
                <div>
                  <h4 className="font-medium text-green-900 mb-1">✨ All Components Generated!</h4>
                  <p className="text-sm text-green-700">
                    Your preliminary curriculum package is complete. Click the eye icon on any
                    component to review its content and request refinements via chat.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <button
              onClick={fetchPreliminaryPackage}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Refresh Status
            </button>
            {allComplete && (
              <button
                onClick={() => router.push(`/projects/${projectId}/cost`)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Continue to Cost Evaluation →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content Viewer & Chat Modal */}
      {selectedComponent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-900">
                {components.find((c) => c.key === selectedComponent)?.name}
              </h2>
              <button
                onClick={() => setSelectedComponent(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content - Split View */}
            <div className="flex-1 overflow-hidden flex">
              {/* Left: Content Viewer */}
              <div className="w-1/2 p-6 overflow-auto border-r">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Generated Content</h3>
                {renderComponentContent(selectedComponent)}
              </div>

              {/* Right: Chat Interface */}
              <div className="w-1/2 p-6 flex flex-col">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Chat with AI</h3>

                {/* Chat Messages */}
                <div className="flex-1 overflow-auto bg-gray-50 rounded-lg p-4 mb-4 space-y-3">
                  {chatMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg ${
                        msg.role === 'user'
                          ? 'bg-blue-100 ml-8'
                          : msg.role === 'assistant'
                            ? 'bg-white mr-8'
                            : 'bg-yellow-50 text-center text-sm'
                      }`}
                    >
                      <p className="text-sm text-gray-800">{msg.content}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {msg.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  ))}
                  {isSendingMessage && (
                    <div className="bg-white p-3 rounded-lg mr-8">
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        <span className="text-sm text-gray-600">AI is thinking...</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Chat Input */}
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Ask AI to refine this component..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isSendingMessage}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={isSendingMessage || !chatInput.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
