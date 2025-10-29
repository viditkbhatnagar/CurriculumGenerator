'use client';

/**
 * Prompt Library Page
 * Displays available AGI-compliant course prompts
 * Users can browse, filter, and select prompts to start new projects
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Filter, Plus, BookOpen, Clock, Award } from 'lucide-react';

interface CoursePrompt {
  _id: string;
  promptTitle: string;
  domain: string;
  level: 'bachelor' | 'master' | 'certificate' | 'diploma';
  totalHours: number;
  ectsCredits: number;
  moduleCount: number;
  learningObjectives: string[];
  targetAudience: string;
  prerequisites: string[];
  curriculumRules: {
    agiCompliance: boolean;
    bloomTaxonomyLevels: string[];
    assessmentTypes: string[];
    sourceRecencyYears: number;
    citationFormat: string;
  };
  status: 'active' | 'inactive' | 'draft';
  createdAt: string;
  updatedAt: string;
}

export default function PromptLibraryPage() {
  const router = useRouter();
  const [prompts, setPrompts] = useState<CoursePrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [selectedPrompt, setSelectedPrompt] = useState<CoursePrompt | null>(null);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [projectName, setProjectName] = useState('');

  // Fetch prompts
  useEffect(() => {
    fetchPrompts();
  }, [selectedDomain, selectedLevel]);

  const fetchPrompts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedDomain) params.append('domain', selectedDomain);
      if (selectedLevel) params.append('level', selectedLevel);

      const response = await fetch(`http://localhost:4000/api/v2/prompts?${params.toString()}`);

      if (response.ok) {
        const data = await response.json();
        setPrompts(data.data || []);
      } else {
        console.error('Failed to fetch prompts:', response.statusText);
      }
    } catch (error) {
      console.error('Error fetching prompts:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter prompts by search term
  const filteredPrompts = prompts.filter(
    (prompt) =>
      prompt.promptTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prompt.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prompt.targetAudience.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get unique domains and levels
  const domains = Array.from(new Set(prompts.map((p) => p.domain)));
  const levels = ['bachelor', 'master', 'certificate', 'diploma'];

  // Handle create project
  const handleCreateProject = async () => {
    if (!selectedPrompt || !projectName.trim()) {
      alert('Please enter a project name');
      return;
    }

    try {
      const response = await fetch('http://localhost:4000/api/v2/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          promptId: selectedPrompt._id,
          projectName: projectName.trim(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Navigate to project dashboard
        router.push(`/projects/${data.data._id}`);
      } else {
        alert('Failed to create project');
      }
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Error creating project');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Prompt Library</h1>
              <p className="mt-2 text-sm text-gray-600">
                Select an AGI-compliant course template to start your curriculum project
              </p>
            </div>
            <button
              onClick={() => router.push('/')}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              ← Back to Home
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search prompts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Domain Filter */}
            <select
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Domains</option>
              {domains.map((domain) => (
                <option key={domain} value={domain}>
                  {domain}
                </option>
              ))}
            </select>

            {/* Level Filter */}
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Levels</option>
              {levels.map((level) => (
                <option key={level} value={level}>
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Prompts Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading prompts...</p>
          </div>
        ) : filteredPrompts.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <BookOpen className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No prompts found</h3>
            <p className="text-gray-600 mb-6">Try adjusting your filters or create a new prompt</p>
            <button
              onClick={() => router.push('/prompts/new')}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create New Prompt
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPrompts.map((prompt) => (
              <div
                key={prompt._id}
                className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => {
                  setSelectedPrompt(prompt);
                  setProjectName(
                    `${prompt.promptTitle} - ${new Date().toISOString().split('T')[0]}`
                  );
                  setShowNewProjectModal(true);
                }}
              >
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {prompt.promptTitle}
                      </h3>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {prompt.domain}
                      </span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <Clock className="w-4 h-4 mr-2" />
                      <span>{prompt.totalHours} hours</span>
                      <span className="mx-2">•</span>
                      <Award className="w-4 h-4 mr-1" />
                      <span>{prompt.ectsCredits} ECTS</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <BookOpen className="w-4 h-4 mr-2" />
                      <span>{prompt.moduleCount} modules</span>
                      <span className="mx-2">•</span>
                      <span className="capitalize">{prompt.level}</span>
                    </div>
                  </div>

                  {/* Target Audience */}
                  <div className="mb-4">
                    <p className="text-sm text-gray-700 line-clamp-2">{prompt.targetAudience}</p>
                  </div>

                  {/* Learning Objectives */}
                  <div className="mb-4">
                    <h4 className="text-xs font-semibold text-gray-700 uppercase mb-2">
                      Learning Objectives
                    </h4>
                    <ul className="space-y-1">
                      {(prompt.learningObjectives || []).slice(0, 3).map((obj, idx) => (
                        <li key={idx} className="text-xs text-gray-600 flex items-start">
                          <span className="mr-2">•</span>
                          <span className="line-clamp-1">{obj}</span>
                        </li>
                      ))}
                      {(prompt.learningObjectives || []).length > 3 && (
                        <li className="text-xs text-blue-600">
                          +{(prompt.learningObjectives || []).length - 3} more
                        </li>
                      )}
                    </ul>
                  </div>

                  {/* AGI Badge */}
                  {prompt.curriculumRules?.agiCompliance && (
                    <div className="flex items-center text-xs text-green-600">
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      AGI Compliant
                    </div>
                  )}

                  {/* Action Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPrompt(prompt);
                      setProjectName(
                        `${prompt.promptTitle} - ${new Date().toISOString().split('T')[0]}`
                      );
                      setShowNewProjectModal(true);
                    }}
                    className="mt-4 w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Start New Project
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Project Modal */}
      {showNewProjectModal && selectedPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Create New Curriculum Project
              </h2>

              {/* Prompt Summary */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-gray-900 mb-2">{selectedPrompt.promptTitle}</h3>
                <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                  <div>
                    <span className="font-medium">Domain:</span> {selectedPrompt.domain}
                  </div>
                  <div>
                    <span className="font-medium">Level:</span>{' '}
                    {selectedPrompt.level.charAt(0).toUpperCase() + selectedPrompt.level.slice(1)}
                  </div>
                  <div>
                    <span className="font-medium">Duration:</span> {selectedPrompt.totalHours} hours
                  </div>
                  <div>
                    <span className="font-medium">Credits:</span> {selectedPrompt.ectsCredits} ECTS
                  </div>
                </div>
              </div>

              {/* Project Name Input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g., CHRP Certification 2025"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Choose a descriptive name for your curriculum project
                </p>
              </div>

              {/* Prerequisites */}
              {(selectedPrompt.prerequisites || []).length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Prerequisites</h4>
                  <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                    {(selectedPrompt.prerequisites || []).map((prereq, idx) => (
                      <li key={idx}>{prereq}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowNewProjectModal(false);
                    setSelectedPrompt(null);
                    setProjectName('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateProject}
                  disabled={!projectName.trim()}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Project & Start AI Research
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
