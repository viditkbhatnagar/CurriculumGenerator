'use client';

/**
 * Project Dashboard Page
 * Displays 5-stage workflow progress and provides quick actions for each stage
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Circle,
  Clock,
  MessageSquare,
  DollarSign,
  FileText,
  Rocket,
  AlertCircle,
} from 'lucide-react';

interface Project {
  _id: string;
  promptId: {
    promptTitle: string;
    domain: string;
    level: string;
  };
  projectName: string;
  courseCode: string;
  status: string;
  currentStage: number;
  stageProgress: {
    stage1?: { completedAt: Date };
    stage2?: {
      startedAt?: Date;
      completedAt?: Date;
      preliminaryPackageId?: string;
      chatMessageCount?: number;
      refinementCount?: number;
    };
    stage3?: {
      startedAt?: Date;
      completedAt?: Date;
      costEvaluationId?: string;
      totalCost?: number;
      approved?: boolean;
    };
    stage4?: {
      startedAt?: Date;
      completedAt?: Date;
      fullCurriculumId?: string;
      materialsGenerated?: {
        modulePlans: number;
        caseStudies: number;
        simulations: number;
        mcqSets: number;
        slideDecks: number;
      };
    };
    stage5?: {
      startedAt?: Date;
      completedAt?: Date;
      reviewId?: string;
      approvedAt?: Date;
      publishedAt?: Date;
    };
  };
  createdAt: string;
  updatedAt: string;
}

const stages = [
  {
    number: 1,
    name: 'Prompt Selection',
    description: 'AGI-compliant course template selected',
    icon: CheckCircle2,
    color: 'blue',
  },
  {
    number: 2,
    name: 'AI Research & SME Review',
    description: 'Generate preliminary curriculum package',
    icon: MessageSquare,
    color: 'purple',
  },
  {
    number: 3,
    name: 'Resource Cost Evaluation',
    description: 'Analyze paid resources and alternatives',
    icon: DollarSign,
    color: 'green',
  },
  {
    number: 4,
    name: 'Curriculum Generation',
    description: 'Generate full curriculum package',
    icon: FileText,
    color: 'orange',
  },
  {
    number: 5,
    name: 'Final Review & Launch',
    description: 'SME approval and LMS publication',
    icon: Rocket,
    color: 'pink',
  },
];

export default function ProjectDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProject();

    // Setup WebSocket for real-time updates
    // TODO: Implement WebSocket connection
  }, [projectId]);

  const fetchProject = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`http://localhost:4000/api/v2/projects/${projectId}`);

      if (response.ok) {
        const data = await response.json();
        setProject(data.data);
      } else {
        console.error('Failed to load project:', response.status);
        setError('Failed to load project');
      }
    } catch (err) {
      setError('Error loading project');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStageStatus = (stageNumber: number): 'completed' | 'current' | 'pending' => {
    if (!project) return 'pending';

    if (stageNumber < project.currentStage) return 'completed';
    if (stageNumber === project.currentStage) return 'current';
    return 'pending';
  };

  const handleStageAction = async (stageNumber: number) => {
    if (!project) {
      console.log('No project loaded');
      return;
    }

    console.log('handleStageAction called for stage:', stageNumber);

    switch (stageNumber) {
      case 1:
        // Stage 1 complete, go to Stage 2
        console.log('Stage 1 clicked, redirecting to stage 2');
        handleStageAction(2);
        break;

      case 2:
        // Start AI Research or navigate to chat
        console.log('Stage 2 handler, checking if preliminary package exists');
        console.log('Project stage progress:', project.stageProgress);

        // Just navigate to research page directly
        console.log('Navigating to research page:', `/projects/${projectId}/research`);
        router.push(`/projects/${projectId}/research`);
        break;

      case 3:
        // Navigate to cost evaluation or start it
        if (project.stageProgress.stage3?.costEvaluationId) {
          router.push(`/projects/${projectId}/cost`);
        } else {
          // Auto-start cost evaluation
          try {
            await fetch(`/api/v2/projects/${projectId}/cost/evaluate`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${localStorage.getItem('token')}`,
              },
            });
            fetchProject(); // Refresh
          } catch (error) {
            console.error('Error starting cost evaluation:', error);
          }
        }
        break;

      case 4:
        // Start generation or view results
        if (project.stageProgress.stage4?.fullCurriculumId) {
          router.push(`/projects/${projectId}/curriculum`);
        } else {
          // Start generation
          try {
            await fetch(`/api/v2/projects/${projectId}/generate`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${localStorage.getItem('token')}`,
              },
            });
            fetchProject(); // Refresh
          } catch (error) {
            console.error('Error starting generation:', error);
          }
        }
        break;

      case 5:
        // Navigate to review or start it
        if (project.stageProgress.stage5?.reviewId) {
          router.push(`/projects/${projectId}/review`);
        } else {
          // Start review
          try {
            const response = await fetch(`/api/v2/projects/${projectId}/review/start`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${localStorage.getItem('token')}`,
              },
            });
            if (response.ok) {
              const data = await response.json();
              router.push(`/projects/${projectId}/review`);
            }
          } catch (error) {
            console.error('Error starting review:', error);
          }
        }
        break;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading project...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error || 'Project not found'}</p>
          <button
            onClick={() => router.push('/prompts')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Back to Prompts
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{project.projectName}</h1>
              <p className="mt-2 text-sm text-gray-600">
                {project.promptId.promptTitle} • {project.promptId.domain}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">Stage {project.currentStage}/5</div>
              <div className="text-sm text-gray-600 capitalize">
                {project.status.replace('_', ' ')}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Timeline */}
        <div className="bg-white rounded-lg shadow p-8 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Workflow Progress</h2>

          <div className="relative">
            {/* Progress Line */}
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200"></div>

            {/* Stages */}
            <div className="space-y-8">
              {stages.map((stage) => {
                const status = getStageStatus(stage.number);
                const Icon = stage.icon;
                const stageData =
                  project.stageProgress[
                    `stage${stage.number}` as keyof typeof project.stageProgress
                  ];

                return (
                  <div key={stage.number} className="relative flex items-start">
                    {/* Icon */}
                    <div
                      className={`
                      relative z-10 flex items-center justify-center w-16 h-16 rounded-full border-4 border-white
                      ${status === 'completed' ? `bg-${stage.color}-500 text-white` : ''}
                      ${status === 'current' ? `bg-${stage.color}-100 text-${stage.color}-600 border-${stage.color}-500` : ''}
                      ${status === 'pending' ? 'bg-gray-100 text-gray-400' : ''}
                    `}
                    >
                      {status === 'completed' ? (
                        <CheckCircle2 className="w-8 h-8" />
                      ) : status === 'current' ? (
                        <Icon className="w-8 h-8" />
                      ) : (
                        <Circle className="w-8 h-8" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="ml-6 flex-1">
                      <div className="bg-gray-50 rounded-lg p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900">{stage.name}</h3>
                            <p className="text-sm text-gray-600 mt-1">{stage.description}</p>

                            {/* Stage-specific details */}
                            {stageData && (
                              <div className="mt-4 space-y-2 text-sm text-gray-700">
                                {stage.number === 2 && project.stageProgress.stage2 && (
                                  <>
                                    <div>
                                      <Clock className="w-4 h-4 inline mr-2" />
                                      {project.stageProgress.stage2.chatMessageCount || 0} chat
                                      messages
                                    </div>
                                    <div>
                                      {project.stageProgress.stage2.refinementCount || 0}{' '}
                                      refinements
                                    </div>
                                  </>
                                )}

                                {stage.number === 3 && project.stageProgress.stage3 && (
                                  <div>
                                    <DollarSign className="w-4 h-4 inline mr-2" />
                                    Total Cost: $
                                    {project.stageProgress.stage3.totalCost?.toFixed(2) || '0.00'}
                                  </div>
                                )}

                                {stage.number === 4 &&
                                  project.stageProgress.stage4?.materialsGenerated && (
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        Module Plans:{' '}
                                        {
                                          project.stageProgress.stage4.materialsGenerated
                                            .modulePlans
                                        }
                                      </div>
                                      <div>
                                        Case Studies:{' '}
                                        {
                                          project.stageProgress.stage4.materialsGenerated
                                            .caseStudies
                                        }
                                      </div>
                                      <div>
                                        Simulations:{' '}
                                        {
                                          project.stageProgress.stage4.materialsGenerated
                                            .simulations
                                        }
                                      </div>
                                      <div>
                                        MCQ Sets:{' '}
                                        {project.stageProgress.stage4.materialsGenerated.mcqSets}
                                      </div>
                                    </div>
                                  )}

                                {stage.number === 5 &&
                                  project.stageProgress.stage5?.publishedAt && (
                                    <div className="text-green-600 font-medium">
                                      ✓ Published on{' '}
                                      {new Date(
                                        project.stageProgress.stage5.publishedAt
                                      ).toLocaleDateString()}
                                    </div>
                                  )}
                              </div>
                            )}
                          </div>

                          {/* Action Button */}
                          {status !== 'pending' && (
                            <button
                              onClick={() => handleStageAction(stage.number)}
                              className={`
                                ml-4 px-4 py-2 rounded-md text-sm font-medium transition-colors
                                ${
                                  status === 'current'
                                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }
                              `}
                            >
                              {status === 'completed' ? 'View' : 'Continue'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Project Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 uppercase mb-2">Created</h3>
            <p className="text-lg font-semibold text-gray-900">
              {new Date(project.createdAt).toLocaleDateString()}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 uppercase mb-2">Last Updated</h3>
            <p className="text-lg font-semibold text-gray-900">
              {new Date(project.updatedAt).toLocaleDateString()}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 uppercase mb-2">Course Code</h3>
            <p className="text-lg font-semibold text-gray-900">{project.courseCode || 'N/A'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
