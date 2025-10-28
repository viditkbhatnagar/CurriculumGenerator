'use client';

import { ChatMessage } from '@/types/tutorBot';
import { formatDistanceToNow } from 'date-fns';

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isStudent = message.role === 'student';
  const timestamp = formatDistanceToNow(new Date(message.timestamp), { addSuffix: true });

  return (
    <div className={`flex ${isStudent ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[75%] ${isStudent ? 'order-2' : 'order-1'}`}>
        <div
          className={`rounded-lg px-4 py-3 ${
            isStudent
              ? 'bg-blue-600 text-white rounded-br-none'
              : 'bg-gray-100 text-gray-900 rounded-bl-none'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        </div>
        <div
          className={`text-xs text-gray-500 mt-1 px-1 ${
            isStudent ? 'text-right' : 'text-left'
          }`}
        >
          {timestamp}
        </div>
      </div>
      {!isStudent && (
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-2 flex-shrink-0">
          <span className="text-blue-600 text-sm font-semibold">AI</span>
        </div>
      )}
      {isStudent && (
        <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center ml-2 flex-shrink-0">
          <span className="text-gray-600 text-sm font-semibold">You</span>
        </div>
      )}
    </div>
  );
}
