'use client';

import { useState } from 'react';
import { ChatInterface } from '@/components/tutor-bot/ChatInterface';

export default function TutorPage() {
  // In a real app, these would come from auth context or route params
  const [studentId] = useState('demo-student-id');
  const [courseId] = useState('demo-course-id');
  const [courseName] = useState('Introduction to Business Intelligence');

  return (
    <div className="container mx-auto px-4 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">AI Tutor</h1>
        <p className="text-gray-600 mt-2">
          Get personalized help with your coursework. Ask questions and receive guided support.
        </p>
      </div>

      <div className="h-[calc(100vh-250px)]">
        <ChatInterface
          studentId={studentId}
          courseId={courseId}
          courseName={courseName}
        />
      </div>
    </div>
  );
}
