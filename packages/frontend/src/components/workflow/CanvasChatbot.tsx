'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { CurriculumWorkflow } from '@/types/workflow';
import { api } from '@/lib/api';

// Canvas mode types
type EditTarget = {
  type: 'item' | 'section';
  stepNumber: number;
  itemId?: string;
  sectionId?: string;
  originalContent: any;
  fieldPath: string;
};

type CanvasMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  editTarget?: EditTarget;
  proposedChanges?: any;
  suggestions?: Array<{
    label: string;
    text: string;
    targetItem?: string;
  }>;
  status?: 'pending' | 'applied' | 'rejected';
};

// Global chat history (not per step)
type ChatHistory = CanvasMessage[];

interface CanvasChatbotProps {
  workflow: CurriculumWorkflow;
  isOpen: boolean;
  onClose: () => void;
  currentStep: number; // For context but chatbot works on ALL steps
  editTarget?: EditTarget;
  onApplyChanges: (target: EditTarget, newContent: any) => Promise<void>;
  onRefresh: () => Promise<void>;
}

// Component to render step data in a readable format
function StepDataViewer({
  workflow,
  stepNumber,
}: {
  workflow: CurriculumWorkflow;
  stepNumber: number;
}) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleItem = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderStep3PLOs = () => {
    const plos = (workflow.step3 as any)?.outcomes || [];
    if (plos.length === 0) return <p className="text-teal-500 text-sm">No PLOs generated yet.</p>;

    return (
      <div className="space-y-2">
        {plos.map((plo: any, idx: number) => (
          <div
            key={plo.id || idx}
            className="bg-teal-50 rounded-lg p-3 border border-teal-200"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <span className="text-xs font-mono text-cyan-400">PLO{idx + 1}</span>
                <p className="text-sm text-teal-800 mt-1">{plo.statement}</p>
              </div>
              <span className="text-xs px-2 py-0.5 bg-teal-100 rounded text-teal-600">
                {plo.bloomLevel}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderStep4Modules = () => {
    const modules = (workflow.step4 as any)?.modules || [];
    if (modules.length === 0)
      return <p className="text-teal-500 text-sm">No modules generated yet.</p>;

    return (
      <div className="space-y-2">
        {modules.map((mod: any, idx: number) => (
          <div key={mod.id || idx} className="bg-teal-50 rounded-lg border border-teal-200">
            <button
              onClick={() => toggleItem(mod.id)}
              className="w-full p-3 flex items-center justify-between text-left"
            >
              <div>
                <span className="text-xs font-mono text-cyan-400">
                  {mod.code || `Module ${idx + 1}`}
                </span>
                <p className="text-sm text-teal-800 font-medium">{mod.title}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-teal-600">{mod.totalHours}h</span>
                <svg
                  className={`w-4 h-4 text-teal-600 transition-transform ${expandedItems.has(mod.id) ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </button>
            {expandedItems.has(mod.id) && (
              <div className="px-3 pb-3 pt-0 border-t border-teal-200/50">
                <p className="text-xs text-teal-600 mt-2">{mod.description}</p>
                {mod.mlos?.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-teal-500">MLOs:</p>
                    {mod.mlos.map((mlo: any, mloIdx: number) => (
                      <p key={mloIdx} className="text-xs text-teal-700 mt-1">
                        • {mlo.statement}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderStep5Sources = () => {
    const sources = (workflow.step5 as any)?.sources || (workflow.step5 as any)?.topicSources || [];
    if (sources.length === 0)
      return <p className="text-teal-500 text-sm">No sources generated yet.</p>;

    return (
      <div className="space-y-2">
        {sources.slice(0, 10).map((source: any, idx: number) => (
          <div
            key={source.id || idx}
            className="bg-teal-50 rounded-lg p-3 border border-teal-200"
          >
            <p className="text-sm text-teal-800 font-medium">{source.title}</p>
            <p className="text-xs text-teal-600 mt-1">
              {source.authors?.join(', ')} ({source.year})
            </p>
            <div className="flex gap-2 mt-2">
              <span
                className={`text-xs px-2 py-0.5 rounded ${source.category === 'peer_reviewed_journal' ? 'bg-purple-500/20 text-purple-400' : 'bg-teal-100 text-teal-600'}`}
              >
                {source.category?.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        ))}
        {sources.length > 10 && (
          <p className="text-xs text-teal-500 text-center">+ {sources.length - 10} more sources</p>
        )}
      </div>
    );
  };

  const renderStep6Readings = () => {
    const readings = (workflow.step6 as any)?.readings || [];
    if (readings.length === 0)
      return <p className="text-teal-500 text-sm">No readings generated yet.</p>;

    return (
      <div className="space-y-2">
        {readings.slice(0, 10).map((reading: any, idx: number) => (
          <div
            key={reading.id || idx}
            className="bg-teal-50 rounded-lg p-3 border border-teal-200"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${reading.category === 'core' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-teal-100 text-teal-600'}`}
                >
                  {reading.category}
                </span>
                <p className="text-sm text-teal-800 mt-1">{reading.title}</p>
              </div>
              <span className="text-xs text-teal-600">{reading.estimatedReadingMinutes}min</span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderStep7Quizzes = () => {
    const quizzes = (workflow.step7 as any)?.quizzes || [];
    const totalQuestions = (workflow.step7 as any)?.totalQuestions || 0;

    if (quizzes.length === 0 && totalQuestions === 0) {
      return <p className="text-teal-500 text-sm">No assessments generated yet.</p>;
    }

    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-teal-50 rounded-lg p-3 border border-teal-200 text-center">
            <p className="text-xl font-bold text-cyan-400">{quizzes.length}</p>
            <p className="text-xs text-teal-500">Quizzes</p>
          </div>
          <div className="bg-teal-50 rounded-lg p-3 border border-teal-200 text-center">
            <p className="text-xl font-bold text-emerald-400">{totalQuestions}</p>
            <p className="text-xs text-teal-500">Questions</p>
          </div>
        </div>
        {quizzes.map((quiz: any, idx: number) => (
          <div
            key={quiz.id || idx}
            className="bg-teal-50 rounded-lg p-3 border border-teal-200"
          >
            <p className="text-sm text-teal-800 font-medium">
              {quiz.moduleTitle || `Module ${idx + 1} Quiz`}
            </p>
            <p className="text-xs text-teal-600 mt-1">
              {quiz.questionCount || quiz.questions?.length || 0} questions
            </p>
          </div>
        ))}
      </div>
    );
  };

  const renderStep9Glossary = () => {
    const terms = (workflow.step9 as any)?.terms || [];
    if (terms.length === 0)
      return <p className="text-teal-500 text-sm">No glossary generated yet.</p>;

    return (
      <div className="space-y-2">
        {terms.slice(0, 15).map((term: any, idx: number) => (
          <div
            key={term.id || idx}
            className="bg-teal-50 rounded-lg p-2 border border-teal-200"
          >
            <p className="text-sm text-cyan-400 font-medium">{term.term}</p>
            <p className="text-xs text-teal-600 mt-0.5 line-clamp-2">{term.definition}</p>
          </div>
        ))}
        {terms.length > 15 && (
          <p className="text-xs text-teal-500 text-center">+ {terms.length - 15} more terms</p>
        )}
      </div>
    );
  };

  const renderContent = () => {
    switch (stepNumber) {
      case 3:
        return renderStep3PLOs();
      case 4:
        return renderStep4Modules();
      case 5:
        return renderStep5Sources();
      case 6:
        return renderStep6Readings();
      case 7:
        return renderStep7Quizzes();
      case 9:
        return renderStep9Glossary();
      default:
        return <p className="text-teal-500 text-sm">Select an item to edit from the main view.</p>;
    }
  };

  return <div className="overflow-y-auto max-h-[50vh]">{renderContent()}</div>;
}

// Message bubble component
function MessageBubble({
  message,
  onApply,
  onReject,
}: {
  message: CanvasMessage;
  onApply?: () => void;
  onReject?: () => void;
}) {
  const [showDiff, setShowDiff] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const isUser = message.role === 'user';

  const handleCopy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Parse markdown-style formatting in message
  const formatMessage = (content: string) => {
    // Split by double newlines to create paragraphs
    const parts = content.split(/\n\n/);
    return parts.map((part, idx) => {
      // Handle bold text with **
      const formatted = part.split(/(\*\*[^*]+\*\*)/).map((segment, segIdx) => {
        if (segment.startsWith('**') && segment.endsWith('**')) {
          return (
            <strong key={segIdx} className="text-cyan-400 font-semibold">
              {segment.slice(2, -2)}
            </strong>
          );
        }
        return segment;
      });
      return (
        <p key={idx} className={idx > 0 ? 'mt-3' : ''}>
          {formatted}
        </p>
      );
    });
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-teal-800'
            : 'bg-white border border-teal-200 text-teal-400'
        }`}
      >
        <div className="text-sm whitespace-pre-wrap">{formatMessage(message.content)}</div>

        {/* Suggestions with Copy Buttons */}
        {message.suggestions && message.suggestions.length > 0 && (
          <div className="mt-4 space-y-3">
            {message.suggestions.map((suggestion, idx) => (
              <div key={idx} className="bg-teal-50 rounded-lg p-3 border border-teal-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-cyan-400">
                    {suggestion.label}
                    {suggestion.targetItem && (
                      <span className="text-teal-500 ml-1">({suggestion.targetItem})</span>
                    )}
                  </span>
                  <button
                    onClick={() => handleCopy(suggestion.text, idx)}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-all ${
                      copiedIndex === idx
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-teal-100 text-teal-700 hover:bg-teal-200'
                    }`}
                  >
                    {copiedIndex === idx ? (
                      <>
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <p className="text-sm text-teal-700 leading-relaxed">{suggestion.text}</p>
              </div>
            ))}
            <p className="text-xs text-teal-500 mt-2">
              💡 Copy any suggestion above and paste it using the Edit button on the item
            </p>
          </div>
        )}

        {/* Proposed Changes with Diff View */}
        {message.proposedChanges && message.status === 'pending' && (
          <div className="mt-3 pt-3 border-t border-teal-300/50">
            <button
              onClick={() => setShowDiff(!showDiff)}
              className="text-xs text-cyan-400 hover:text-cyan-300 mb-2 flex items-center gap-1"
            >
              {showDiff ? '▼' : '▶'} {showDiff ? 'Hide' : 'Show'} Changes
            </button>

            {showDiff && (
              <div className="bg-teal-50 rounded-lg p-4 mb-3 border border-teal-200">
                <h4 className="text-xs font-semibold text-teal-600 uppercase tracking-wider mb-3">
                  Proposed Changes Preview
                </h4>

                {/* Render proposed changes in a readable format */}
                {(() => {
                  const changes = message.proposedChanges;
                  if (!changes)
                    return <p className="text-teal-500 text-sm">No changes to preview</p>;

                  // If it's sources, render them nicely
                  if (changes.sources && Array.isArray(changes.sources)) {
                    return (
                      <div className="space-y-3">
                        <p className="text-xs text-cyan-400 font-medium">
                          📚 {changes.sources.length} New/Updated Sources:
                        </p>
                        {changes.sources.slice(0, 5).map((src: any, idx: number) => (
                          <div
                            key={idx}
                            className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3"
                          >
                            <p className="text-sm font-medium text-emerald-400">{src.title}</p>
                            <p className="text-xs text-teal-600 mt-1">
                              {src.authors?.join(', ')} ({src.year})
                            </p>
                            {src.category && (
                              <span className="inline-block mt-2 px-2 py-0.5 bg-teal-100 rounded text-xs text-teal-700">
                                {src.category.replace(/_/g, ' ')}
                              </span>
                            )}
                            {src.linkedMLOs && src.linkedMLOs.length > 0 && (
                              <p className="text-xs text-cyan-400/70 mt-1">
                                MLOs: {src.linkedMLOs.join(', ')}
                              </p>
                            )}
                          </div>
                        ))}
                        {changes.sources.length > 5 && (
                          <p className="text-xs text-teal-500">
                            + {changes.sources.length - 5} more sources
                          </p>
                        )}
                      </div>
                    );
                  }

                  // If it's readings, render them nicely
                  if (changes.readings && Array.isArray(changes.readings)) {
                    return (
                      <div className="space-y-3">
                        <p className="text-xs text-cyan-400 font-medium">
                          📖 {changes.readings.length} New/Updated Readings:
                        </p>
                        {changes.readings.slice(0, 5).map((reading: any, idx: number) => (
                          <div
                            key={idx}
                            className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3"
                          >
                            <p className="text-sm font-medium text-emerald-400">{reading.title}</p>
                            {reading.chapter && (
                              <p className="text-xs text-teal-600">Chapter: {reading.chapter}</p>
                            )}
                            {reading.pages && (
                              <p className="text-xs text-teal-600">Pages: {reading.pages}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  }

                  // For other content, show formatted JSON
                  return (
                    <pre className="text-xs text-emerald-400 bg-teal-50 p-3 rounded overflow-auto max-h-48 whitespace-pre-wrap">
                      {JSON.stringify(changes, null, 2)}
                    </pre>
                  );
                })()}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={onApply}
                className="flex-1 px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs hover:bg-emerald-500/30 transition-colors"
              >
                ✓ Apply Changes
              </button>
              <button
                onClick={onReject}
                className="px-3 py-1.5 bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-xs hover:bg-red-500/30 transition-colors"
              >
                ✗ Discard
              </button>
            </div>
          </div>
        )}

        {message.status === 'applied' && (
          <div className="mt-2 text-xs text-emerald-400 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            Changes applied
          </div>
        )}

        <p className="text-[10px] mt-2 opacity-60">{message.timestamp.toLocaleTimeString()}</p>
      </div>
    </div>
  );
}

export default function CanvasChatbot({
  workflow,
  isOpen,
  onClose,
  currentStep,
  editTarget,
  onApplyChanges,
  onRefresh,
}: CanvasChatbotProps) {
  // GLOBAL chat history - persists across steps
  const [chatHistory, setChatHistory] = useState<ChatHistory>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isTyping]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Set initial context when editTarget changes
  useEffect(() => {
    if (editTarget && isOpen) {
      const contextMessage = getContextMessage(editTarget);
      setInputValue(contextMessage);
    }
  }, [editTarget, isOpen]);

  const getContextMessage = (target: EditTarget): string => {
    if (target.type === 'item') {
      return `Edit this ${target.fieldPath}: `;
    }
    return `Edit the ${target.sectionId} section: `;
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isTyping) return;

    const userMessage: CanvasMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
      editTarget,
    };

    // Add user message to GLOBAL history
    setChatHistory((prev) => [...prev, userMessage]);

    setInputValue('');
    setIsTyping(true);

    try {
      // Create edit target with GLOBAL context (not step-specific)
      const effectiveEditTarget = editTarget || {
        type: 'section' as const,
        stepNumber: currentStep,
        sectionId: 'workflow',
        originalContent: null, // Backend will get full workflow
        fieldPath: 'workflow',
      };

      // Call Canvas AI API - it has full workflow context on backend
      const response = await api.post('/api/v3/workflow/canvas-edit', {
        workflowId: workflow._id,
        stepNumber: currentStep, // For context only
        userMessage: inputValue,
        editTarget: effectiveEditTarget,
        context: {
          programTitle: workflow.step1?.programTitle,
          academicLevel: workflow.step1?.academicLevel,
          // Backend has full workflow - don't need to send it all
        },
      });

      const data = response.data;
      const proposedChanges = data.proposedChanges || data.data?.proposedChanges;
      const suggestions = data.suggestions || data.data?.suggestions;

      const assistantMessage: CanvasMessage = {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant',
        content: data.message || data.data?.message || 'Here are the proposed changes:',
        timestamp: new Date(),
        editTarget: effectiveEditTarget,
        proposedChanges,
        suggestions,
        status: proposedChanges ? 'pending' : undefined,
      };

      setChatHistory((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Canvas AI error:', error);

      const errorMessage: CanvasMessage = {
        id: `msg-${Date.now()}-error`,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };

      setChatHistory((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleApplyChanges = async (messageId: string) => {
    const message = chatHistory.find((m) => m.id === messageId);

    if (message?.editTarget && message.proposedChanges) {
      setIsApplying(true);
      try {
        // Show loading state
        setChatHistory((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, status: 'applying' as any } : m))
        );

        // Apply the changes
        await onApplyChanges(message.editTarget, message.proposedChanges);

        // Update message status to applied
        setChatHistory((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, status: 'applied' as const } : m))
        );

        // Refresh the data to update UI dynamically
        await onRefresh();

        // Add success feedback message
        const successMsg: CanvasMessage = {
          id: `msg-${Date.now()}-success`,
          role: 'assistant',
          content:
            '✅ Changes applied and saved! The page has been refreshed with the latest data.',
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, successMsg]);
      } catch (error) {
        console.error('Failed to apply changes:', error);

        // Revert status and show error
        setChatHistory((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, status: 'pending' as const } : m))
        );

        const errorMsg: CanvasMessage = {
          id: `msg-${Date.now()}-error`,
          role: 'assistant',
          content: '❌ Failed to apply changes. Please try again or check the console for errors.',
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, errorMsg]);
      } finally {
        setIsApplying(false);
      }
    }
  };

  const handleRejectChanges = (messageId: string) => {
    setChatHistory((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, status: 'rejected' as const } : m))
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getStepData = (wf: CurriculumWorkflow, step: number) => {
    switch (step) {
      case 2:
        return wf.step2;
      case 3:
        return wf.step3;
      case 4:
        return wf.step4;
      case 5:
        return wf.step5;
      case 6:
        return wf.step6;
      case 7:
        return wf.step7;
      case 8:
        return wf.step8;
      case 9:
        return wf.step9;
      default:
        return null;
    }
  };

  const getStepName = (step: number) => {
    const names: Record<number, string> = {
      2: 'KSC Framework',
      3: 'PLOs',
      4: 'Modules & MLOs',
      5: 'Academic Sources',
      6: 'Reading Lists',
      7: 'Assessments',
      8: 'Case Studies',
      9: 'Glossary',
    };
    return names[step] || `Step ${step}`;
  };

  const [activeTab, setActiveTab] = useState<'content' | 'chat'>('content');

  if (!isOpen) return null;

  return (
    <div
      className="fixed right-0 top-0 h-full w-[480px] bg-white/95 backdrop-blur-xl border-l border-teal-200 shadow-2xl z-50 flex flex-col transform transition-transform duration-300"
      style={{ transform: isOpen ? 'translateX(0)' : 'translateX(100%)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-teal-200 bg-gradient-to-r from-cyan-500/10 to-blue-500/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <svg
              className="w-4 h-4 text-teal-800"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-teal-800 font-semibold text-sm">Curriculum AI Assistant</h2>
            <p className="text-xs text-cyan-400">Edit anything in your workflow</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white rounded-lg transition-colors">
          <svg
            className="w-5 h-5 text-teal-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-teal-200">
        <button
          onClick={() => setActiveTab('content')}
          className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'content'
              ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/5'
              : 'text-teal-600 hover:text-teal-600'
          }`}
        >
          📄 Generated Content
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'chat'
              ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/5'
              : 'text-teal-600 hover:text-teal-600'
          }`}
        >
          💬 Chat ({chatHistory.length})
        </button>
      </div>

      {/* Edit Target Context */}
      {editTarget && (
        <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20">
          <div className="flex items-center gap-2">
            <span className="text-xs text-amber-400">
              {editTarget.type === 'item' ? '📝 Editing item:' : '📁 Editing section:'}
            </span>
            <span className="text-xs text-teal-800 font-mono truncate">
              {editTarget.fieldPath || editTarget.sectionId}
            </span>
          </div>
        </div>
      )}

      {/* Content Tab */}
      {activeTab === 'content' && (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="mb-4">
            <h3 className="text-sm font-medium text-teal-800 mb-2">
              Current {getStepName(currentStep)}
            </h3>
            <p className="text-xs text-teal-500 mb-4">
              Review the generated content below. Click an item to edit it, or switch to Chat tab to
              request changes.
            </p>
          </div>
          <StepDataViewer workflow={workflow} stepNumber={currentStep} />

          {/* Switch to chat prompt */}
          <div className="mt-6 p-4 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-xl border border-cyan-500/20">
            <p className="text-sm text-teal-800 font-medium mb-2">Want to make changes?</p>
            <p className="text-xs text-teal-600 mb-3">
              Switch to the Chat tab and describe what you'd like to change. The AI will generate
              updated content for your approval.
            </p>
            <button
              onClick={() => setActiveTab('chat')}
              className="w-full px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-teal-800 text-sm font-medium rounded-lg hover:from-cyan-400 hover:to-blue-500 transition-all"
            >
              Start Editing →
            </button>
          </div>
        </div>
      )}

      {/* Chat Tab */}
      {activeTab === 'chat' && (
        <>
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {chatHistory.length === 0 ? (
              <div className="text-center text-teal-500 mt-4">
                <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-white flex items-center justify-center">
                  <svg
                    className="w-7 h-7 text-cyan-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </div>
                <p className="text-sm font-medium text-teal-600 mb-2">Canvas Editor</p>
                <p className="text-xs text-teal-500 max-w-[280px] mx-auto mb-4">
                  Describe the changes you want to make. I'll generate updated content and show you
                  a diff before applying.
                </p>

                {/* Quick Actions */}
                <div className="space-y-2 text-left">
                  <p className="text-xs text-teal-300 mb-2">Quick actions:</p>
                  <button
                    onClick={() => setInputValue('Make this more concise and professional')}
                    className="w-full text-left px-3 py-2 bg-teal-50 border border-teal-200 rounded-lg text-xs text-teal-600 hover:border-cyan-500/50 hover:text-cyan-400 transition-colors"
                  >
                    ✨ Make more concise
                  </button>
                  <button
                    onClick={() => setInputValue('Add more detail and examples')}
                    className="w-full text-left px-3 py-2 bg-teal-50 border border-teal-200 rounded-lg text-xs text-teal-600 hover:border-cyan-500/50 hover:text-cyan-400 transition-colors"
                  >
                    📝 Add more detail
                  </button>
                  <button
                    onClick={() => setInputValue('Align this better with industry standards')}
                    className="w-full text-left px-3 py-2 bg-teal-50 border border-teal-200 rounded-lg text-xs text-teal-600 hover:border-cyan-500/50 hover:text-cyan-400 transition-colors"
                  >
                    🎯 Align with standards
                  </button>
                  <button
                    onClick={() =>
                      setInputValue('Regenerate all items in this step with better quality')
                    }
                    className="w-full text-left px-3 py-2 bg-teal-50 border border-teal-200 rounded-lg text-xs text-teal-600 hover:border-cyan-500/50 hover:text-cyan-400 transition-colors"
                  >
                    🔄 Regenerate with better quality
                  </button>
                </div>
              </div>
            ) : (
              chatHistory.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  onApply={msg.status === 'pending' ? () => handleApplyChanges(msg.id) : undefined}
                  onReject={
                    msg.status === 'pending' ? () => handleRejectChanges(msg.id) : undefined
                  }
                />
              ))
            )}

            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white border border-teal-200 rounded-2xl px-4 py-3">
                  <div className="flex space-x-1">
                    <div
                      className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce"
                      style={{ animationDelay: '0ms' }}
                    />
                    <div
                      className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce"
                      style={{ animationDelay: '150ms' }}
                    />
                    <div
                      className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce"
                      style={{ animationDelay: '300ms' }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area - Only in Chat Tab */}
          <div className="border-t border-teal-200 p-4 bg-white">
            <div className="relative">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe the changes you want..."
                rows={3}
                className="w-full px-4 py-3 pr-12 bg-white border border-teal-200 rounded-xl text-teal-800 placeholder-teal-400 focus:outline-none focus:border-teal-500 resize-none text-sm"
              />
              <button
                onClick={handleSend}
                disabled={!inputValue.trim() || isTyping}
                className="absolute right-3 bottom-3 p-2 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg text-teal-800 disabled:opacity-50 hover:from-cyan-400 hover:to-blue-500 transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              </button>
            </div>
            <p className="text-[10px] text-teal-300 mt-2 text-center">
              Enter to send • Shift+Enter for new line • Chat history is session-only
            </p>
          </div>
        </>
      )}
    </div>
  );
}
