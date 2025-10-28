'use client';

import { useState, useRef, useEffect } from 'react';
import { useTutorBot } from '@/hooks/useTutorBot';
import { ChatMessage } from '@/types/tutorBot';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { SuggestedResources } from './SuggestedResources';
import { FollowUpQuestions } from './FollowUpQuestions';

interface ChatInterfaceProps {
  studentId: string;
  courseId: string;
  courseName?: string;
}

export function ChatInterface({ studentId, courseId, courseName }: ChatInterfaceProps) {
  const { messages, isLoading, isTyping, sendMessage, trackResource, lastResponse } = useTutorBot(
    studentId,
    courseId
  );
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSendMessage = () => {
    if (inputValue.trim()) {
      sendMessage(inputValue);
      setInputValue('');
    }
  };

  const handleFollowUpClick = (question: string) => {
    setInputValue(question);
  };

  const handleResourceClick = (resourceId: string) => {
    trackResource(resourceId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading conversation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="bg-blue-600 text-white px-6 py-4 rounded-t-lg">
        <h2 className="text-xl font-semibold">AI Tutor</h2>
        {courseName && <p className="text-sm text-blue-100 mt-1">{courseName}</p>}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <div className="text-4xl mb-4">💬</div>
            <p className="text-lg font-medium mb-2">Welcome to your AI Tutor!</p>
            <p className="text-sm">
              Ask me anything about the course material. I'm here to guide your learning.
            </p>
          </div>
        ) : (
          <MessageList messages={messages} isTyping={isTyping} />
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Resources */}
      {lastResponse?.suggestedResources && lastResponse.suggestedResources.length > 0 && (
        <div className="px-6 py-3 border-t border-gray-200">
          <SuggestedResources
            resources={lastResponse.suggestedResources}
            onResourceClick={handleResourceClick}
          />
        </div>
      )}

      {/* Follow-up Questions */}
      {lastResponse?.followUpQuestions && lastResponse.followUpQuestions.length > 0 && (
        <div className="px-6 py-3 border-t border-gray-200">
          <FollowUpQuestions
            questions={lastResponse.followUpQuestions}
            onQuestionClick={handleFollowUpClick}
          />
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-gray-200 px-6 py-4">
        <ChatInput
          value={inputValue}
          onChange={setInputValue}
          onSend={handleSendMessage}
          disabled={isTyping}
          placeholder="Ask a question about the course..."
        />
      </div>
    </div>
  );
}
