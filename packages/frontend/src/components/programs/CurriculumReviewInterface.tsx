'use client';

import { useState, useEffect } from 'react';

interface ProgramSpec {
  introduction: string;
  courseOverview: string;
  needsAnalysis: string;
  knowledgeSkillsCompetenciesMatrix: any;
  comparativeAnalysis: string;
  targetAudience: string;
  entryRequirements: string;
  careerOutcomes: string;
  generatedAt: string;
}

interface UnitSpec {
  unitId: string;
  moduleCode: string;
  unitTitle: string;
  unitOverview: any;
  learningOutcomes: any;
  indicativeContent: any;
  teachingStrategies: any;
  assessmentMethods: any;
  readingList: any;
  generatedAt: string;
}

interface QAIssue {
  severity: 'error' | 'warning';
  category: string;
  description: string;
  location: string;
  suggestion: string;
}

interface QAReport {
  overallScore: number;
  complianceIssues: QAIssue[];
  recommendations: string[];
  passedChecks: string[];
}

interface CurriculumData {
  programSpec: ProgramSpec;
  unitSpecs: UnitSpec[];
  qaReport: QAReport;
}

interface CurriculumReviewInterfaceProps {
  programId: string;
}

export function CurriculumReviewInterface({ programId }: CurriculumReviewInterfaceProps) {
  const [curriculum, setCurriculum] = useState<CurriculumData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'program' | 'units' | 'qa'>('program');
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>('');

  useEffect(() => {
    loadCurriculum();
  }, [programId]);

  const loadCurriculum = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Load curriculum data
      const curriculumResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/curriculum/${programId}`
      );

      if (!curriculumResponse.ok) {
        throw new Error('Failed to load curriculum');
      }

      const curriculumData = await curriculumResponse.json();

      // Load QA report
      const qaResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/curriculum/${programId}/qa-report`
      );

      let qaData = null;
      if (qaResponse.ok) {
        const qaResult = await qaResponse.json();
        qaData = qaResult.data;
      }

      setCurriculum({
        programSpec: curriculumData.data.programSpec || {},
        unitSpecs: curriculumData.data.modules || [],
        modules: curriculumData.data.modules || [],
        assessments: curriculumData.data.assessments || [],
        skillMappings: curriculumData.data.skillMappings || [],
        qaReport: qaData || {
          overallScore: 0,
          complianceIssues: [],
          recommendations: [],
          passedChecks: [],
        },
      });

      if (curriculumData.data.modules && curriculumData.data.modules.length > 0) {
        setSelectedUnit(curriculumData.data.modules[0].moduleCode);
      }
    } catch (err: any) {
      console.error('Failed to load curriculum:', err);
      setError(err.message || 'Failed to load curriculum');
    } finally {
      setIsLoading(false);
    }
  };

  const startEditing = (section: string, content: string) => {
    setEditingSection(section);
    setEditContent(content);
  };

  const cancelEditing = () => {
    setEditingSection(null);
    setEditContent('');
  };

  const saveEdit = async () => {
    // In a real implementation, this would save to the backend
    console.log('Saving edit:', editingSection, editContent);
    setEditingSection(null);
    setEditContent('');
  };

  const regenerateSection = async (section: string) => {
    // In a real implementation, this would trigger regeneration
    console.log('Regenerating section:', section);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  if (!curriculum) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-yellow-800">No curriculum data available</p>
      </div>
    );
  }

  const renderProgramSpec = () => (
    <div className="space-y-6">
      {Object.entries(curriculum.programSpec).map(([key, value]) => {
        if (key === 'generatedAt' || key === 'knowledgeSkillsCompetenciesMatrix') return null;
        
        const sectionTitle = key
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, (str) => str.toUpperCase());

        const isEditing = editingSection === key;
        const content = typeof value === 'string' ? value : JSON.stringify(value, null, 2);

        return (
          <div key={key} className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">{sectionTitle}</h3>
              <div className="flex space-x-2">
                {!isEditing && (
                  <>
                    <button
                      onClick={() => startEditing(key, content)}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => regenerateSection(key)}
                      className="text-sm text-green-600 hover:text-green-700"
                    >
                      Regenerate
                    </button>
                  </>
                )}
              </div>
            </div>
            {isEditing ? (
              <div className="space-y-4">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={cancelEditing}
                    className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveEdit}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            ) : (
              <div className="prose max-w-none">
                <p className="text-gray-700 whitespace-pre-wrap">{content}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderUnitSpecs = () => {
    const selectedUnitData = curriculum.unitSpecs.find(u => u.unitId === selectedUnit);

    return (
      <div className="grid grid-cols-12 gap-6">
        {/* Unit List */}
        <div className="col-span-3">
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-900">Units</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {curriculum.unitSpecs.map((unit) => (
                <button
                  key={unit.unitId}
                  onClick={() => setSelectedUnit(unit.unitId)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                    selectedUnit === unit.unitId ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                  }`}
                >
                  <p className="text-sm font-medium text-gray-900">{unit.moduleCode}</p>
                  <p className="text-xs text-gray-600 mt-1 truncate">{unit.unitTitle}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Unit Content */}
        <div className="col-span-9">
          {selectedUnitData ? (
            <div className="space-y-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h2 className="text-xl font-bold text-gray-900">{selectedUnitData.unitTitle}</h2>
                <p className="text-sm text-gray-600 mt-1">{selectedUnitData.moduleCode}</p>
              </div>

              {Object.entries(selectedUnitData).map(([key, value]) => {
                if (key === 'unitId' || key === 'moduleCode' || key === 'unitTitle' || key === 'generatedAt') return null;

                const sectionTitle = key
                  .replace(/([A-Z])/g, ' $1')
                  .replace(/^./, (str) => str.toUpperCase());

                const content = typeof value === 'string' ? value : JSON.stringify(value, null, 2);

                return (
                  <div key={key} className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium text-gray-900">{sectionTitle}</h3>
                      <div className="flex space-x-2">
                        <button className="text-sm text-blue-600 hover:text-blue-700">
                          Edit
                        </button>
                        <button className="text-sm text-green-600 hover:text-green-700">
                          Regenerate
                        </button>
                      </div>
                    </div>
                    <div className="prose max-w-none">
                      <p className="text-gray-700 whitespace-pre-wrap">{content}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
              <p className="text-gray-600">Select a unit to view details</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderQAReport = () => (
    <div className="space-y-6">
      {/* Overall Score */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Overall Quality Score</h3>
            <p className="text-sm text-gray-600 mt-1">
              Based on AGCQ standards and compliance checks
            </p>
          </div>
          <div className="text-right">
            <div className={`text-4xl font-bold ${
              curriculum.qaReport.overallScore >= 80 ? 'text-green-600' :
              curriculum.qaReport.overallScore >= 60 ? 'text-yellow-600' :
              'text-red-600'
            }`}>
              {curriculum.qaReport.overallScore}
            </div>
            <p className="text-sm text-gray-600">out of 100</p>
          </div>
        </div>
      </div>

      {/* Compliance Issues */}
      {curriculum.qaReport.complianceIssues.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              Compliance Issues ({curriculum.qaReport.complianceIssues.length})
            </h3>
          </div>
          <div className="divide-y divide-gray-200">
            {curriculum.qaReport.complianceIssues.map((issue, index) => (
              <div key={index} className="px-6 py-4">
                <div className="flex items-start">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    issue.severity === 'error' 
                      ? 'bg-red-100 text-red-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {issue.severity}
                  </span>
                  <div className="ml-4 flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-gray-900">{issue.category}</h4>
                      <span className="text-xs text-gray-500">{issue.location}</span>
                    </div>
                    <p className="text-sm text-gray-700 mt-1">{issue.description}</p>
                    {issue.suggestion && (
                      <div className="mt-2 bg-blue-50 border border-blue-200 rounded p-3">
                        <p className="text-sm text-blue-800">
                          <span className="font-medium">Suggestion:</span> {issue.suggestion}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {curriculum.qaReport.recommendations.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Recommendations</h3>
          <ul className="space-y-2">
            {curriculum.qaReport.recommendations.map((rec, index) => (
              <li key={index} className="flex items-start">
                <svg className="h-5 w-5 text-blue-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-gray-700">{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Passed Checks */}
      {curriculum.qaReport.passedChecks.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Passed Checks ({curriculum.qaReport.passedChecks.length})
          </h3>
          <ul className="grid grid-cols-2 gap-2">
            {curriculum.qaReport.passedChecks.map((check, index) => (
              <li key={index} className="flex items-center text-sm text-gray-700">
                <svg className="h-4 w-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {check}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('program')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'program'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Program Specification
          </button>
          <button
            onClick={() => setActiveTab('units')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'units'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Unit Specifications
          </button>
          <button
            onClick={() => setActiveTab('qa')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'qa'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Quality Assurance
            {curriculum.qaReport.complianceIssues.length > 0 && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                {curriculum.qaReport.complianceIssues.filter(i => i.severity === 'error').length}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'program' && renderProgramSpec()}
        {activeTab === 'units' && renderUnitSpecs()}
        {activeTab === 'qa' && renderQAReport()}
      </div>
    </div>
  );
}
