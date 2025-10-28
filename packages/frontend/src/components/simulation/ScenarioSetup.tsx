'use client';

import { useState } from 'react';
import { CreateScenarioRequest } from '@/types/simulation';

interface ScenarioSetupProps {
  onCreateScenario: (request: CreateScenarioRequest) => void;
  isCreating: boolean;
}

export function ScenarioSetup({ onCreateScenario, isCreating }: ScenarioSetupProps) {
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState(3);
  const [industry, setIndustry] = useState('');
  const [roleType, setRoleType] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (topic.trim()) {
      onCreateScenario({
        topic: topic.trim(),
        difficulty,
        industry: industry.trim() || undefined,
        roleType: roleType.trim() || undefined,
      });
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-8">
      <div className="text-center mb-8">
        <div className="text-5xl mb-4">🎯</div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Start a New Simulation</h2>
        <p className="text-gray-600">
          Practice your skills in realistic workplace scenarios
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="topic" className="block text-sm font-medium text-gray-700 mb-2">
            Topic *
          </label>
          <input
            type="text"
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g., Business Communication, Project Management"
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="difficulty" className="block text-sm font-medium text-gray-700 mb-2">
            Difficulty Level: {difficulty}/5
          </label>
          <input
            type="range"
            id="difficulty"
            min="1"
            max="5"
            value={difficulty}
            onChange={(e) => setDifficulty(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-600 mt-1">
            <span>Beginner</span>
            <span>Intermediate</span>
            <span>Expert</span>
          </div>
        </div>

        <div>
          <label htmlFor="industry" className="block text-sm font-medium text-gray-700 mb-2">
            Industry (Optional)
          </label>
          <input
            type="text"
            id="industry"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="e.g., Healthcare, Technology, Finance"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="roleType" className="block text-sm font-medium text-gray-700 mb-2">
            Your Role (Optional)
          </label>
          <input
            type="text"
            id="roleType"
            value={roleType}
            onChange={(e) => setRoleType(e.target.value)}
            placeholder="e.g., Manager, Team Lead, Analyst"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="submit"
          disabled={isCreating || !topic.trim()}
          className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {isCreating ? 'Creating Scenario...' : 'Start Simulation'}
        </button>
      </form>
    </div>
  );
}
