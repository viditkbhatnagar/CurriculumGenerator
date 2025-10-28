'use client';

import { useState } from 'react';
import { SimulationInterface } from '@/components/simulation/SimulationInterface';

export default function SimulationsPage() {
  // In a real app, these would come from auth context
  const [studentId] = useState('demo-student-id');
  const [courseId] = useState('demo-course-id');

  return (
    <div className="container mx-auto px-4">
      <div className="mb-6 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900">Interactive Simulations</h1>
        <p className="text-gray-600 mt-2">
          Practice your skills in realistic workplace scenarios and receive detailed feedback.
        </p>
      </div>

      <SimulationInterface studentId={studentId} courseId={courseId} />
    </div>
  );
}
