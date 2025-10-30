'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle,
  Circle,
  FileText,
  BookOpen,
  Layout,
  Database,
  Award,
  Download,
  ArrowLeft,
  Loader2,
} from 'lucide-react';

interface FullCurriculumPackage {
  _id: string;
  projectId: string;
  modulePlans: any[];
  caseStudies: any[];
  simulations: any[];
  assessmentBank: any[];
  slideDecks: any[];
  rubrics: any[];
  sourcesCited: any[];
  agiCompliance: {
    validated: boolean;
    complianceScore: number;
    issues: string[];
  };
  createdAt: string;
  updatedAt: string;
}

export default function CurriculumGenerationPage({ params }: { params: { id: string } }) {
  const projectId = params.id;
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [fullPackage, setFullPackage] = useState<FullCurriculumPackage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFullPackage();
    const interval = setInterval(fetchFullPackage, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [projectId]);

  const fetchFullPackage = async () => {
    try {
      const response = await fetch(
        `http://localhost:4000/api/v2/projects/${projectId}/curriculum/package`
      );

      if (response.ok) {
        const data = await response.json();
        setFullPackage(data.data);
        setLoading(false);
      } else if (response.status === 404) {
        setFullPackage(null);
        setLoading(false);
      } else {
        throw new Error('Failed to fetch curriculum package');
      }
    } catch (err) {
      console.error('Error fetching curriculum package:', err);
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!fullPackage) return;

    try {
      // Call backend endpoint to generate and download DOCX
      const response = await fetch(
        `http://localhost:4000/api/v2/projects/${projectId}/curriculum/download`
      );

      if (!response.ok) {
        throw new Error('Failed to download curriculum');
      }

      // Get the blob from response
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      // Create download link
      const link = document.createElement('a');
      link.href = url;
      link.download = `curriculum-package-${projectId}-${new Date().toISOString().split('T')[0]}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading curriculum:', err);
      alert('Failed to download curriculum package. Please try again.');
    }
  };

  const handleStartGeneration = async () => {
    try {
      setGenerating(true);
      setError(null);

      const response = await fetch(
        `http://localhost:4000/api/v2/projects/${projectId}/curriculum/generate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to start generation');
      }

      const data = await response.json();
      console.log('✅ Generation started:', data);

      // Start polling
      setTimeout(() => {
        fetchFullPackage();
      }, 2000);
    } catch (err) {
      console.error('❌ Failed to start generation:', err);
      setError('Failed to start curriculum generation');
      setGenerating(false);
    }
  };

  const getComponentIcon = (component: string) => {
    switch (component) {
      case 'modulePlans':
        return <BookOpen className="w-6 h-6 text-blue-500" />;
      case 'caseStudies':
        return <FileText className="w-6 h-6 text-green-500" />;
      case 'simulations':
        return <Layout className="w-6 h-6 text-purple-500" />;
      case 'assessmentBank':
        return <Database className="w-6 h-6 text-orange-500" />;
      case 'slideDecks':
        return <FileText className="w-6 h-6 text-red-500" />;
      case 'rubrics':
        return <Award className="w-6 h-6 text-yellow-500" />;
      default:
        return <Circle className="w-6 h-6 text-gray-400" />;
    }
  };

  const components = [
    { key: 'modulePlans', label: 'Module Plans' },
    { key: 'caseStudies', label: 'Case Studies' },
    { key: 'simulations', label: 'Interactive Simulations' },
    { key: 'assessmentBank', label: 'Assessment Bank (100+ MCQs)' },
    { key: 'slideDecks', label: 'Branded Slide Decks' },
    { key: 'rubrics', label: 'Grading Rubrics' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading curriculum generation...</p>
        </div>
      </div>
    );
  }

  // If no package exists, show start button
  if (!fullPackage) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <Link
              href={`/projects/${projectId}`}
              className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Project
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">
              Stage 4: Full Curriculum Generation
            </h1>
            <p className="mt-2 text-gray-600">Generate complete teaching materials with AI</p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Ready to Generate Full Curriculum Package
            </h2>
            <p className="text-gray-600 mb-6">This will generate:</p>
            <ul className="space-y-3 mb-8">
              {components.map((comp) => (
                <li key={comp.key} className="flex items-center">
                  {getComponentIcon(comp.key)}
                  <span className="ml-3 text-gray-700">{comp.label}</span>
                </li>
              ))}
            </ul>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800">{error}</p>
              </div>
            )}

            <button
              onClick={handleStartGeneration}
              disabled={generating}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {generating ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Starting Generation...
                </>
              ) : (
                'Start Full Curriculum Generation'
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Package exists, show progress/results
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link
            href={`/projects/${projectId}`}
            className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Project
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Full Curriculum Package</h1>
              <p className="mt-2 text-gray-600">Complete teaching materials generated</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">AGI Compliance Score</div>
              <div className="text-3xl font-bold text-green-600">
                {fullPackage.agiCompliance.complianceScore}%
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Components Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {components.map((comp) => {
            const count = (fullPackage as any)[comp.key]?.length || 0;
            const isComplete = count > 0;

            return (
              <div key={comp.key} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  {getComponentIcon(comp.key)}
                  {isComplete ? (
                    <CheckCircle className="w-6 h-6 text-green-500" />
                  ) : (
                    <Circle className="w-6 h-6 text-gray-300" />
                  )}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{comp.label}</h3>
                <p className="text-sm text-gray-600">
                  {isComplete ? `${count} items generated` : 'Pending...'}
                </p>
              </div>
            );
          })}
        </div>

        {/* AGI Compliance Issues */}
        {fullPackage.agiCompliance.issues.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
            <h3 className="font-semibold text-yellow-900 mb-3">⚠️ Compliance Issues</h3>
            <ul className="list-disc list-inside space-y-2">
              {fullPackage.agiCompliance.issues.map((issue, index) => (
                <li key={index} className="text-yellow-800">
                  {issue}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Buttons */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Next Steps</h3>
          <div className="flex space-x-4">
            <Link
              href={`/projects/${projectId}/review`}
              className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 text-center"
            >
              Proceed to Final SME Review (Stage 5)
            </Link>
            <button
              onClick={handleDownload}
              className="flex items-center justify-center px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50"
            >
              <Download className="w-5 h-5 mr-2" />
              Export Package
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
