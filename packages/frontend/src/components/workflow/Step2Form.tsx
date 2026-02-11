'use client';

import { useState, useEffect, useRef } from 'react';
import { useSubmitStep2, useApproveStep2 } from '@/hooks/useWorkflow';
import { useStepStatus } from '@/hooks/useStepStatus';
import { useGeneration, GenerationProgressBar } from '@/contexts/GenerationContext';
import { api } from '@/lib/api';
import { CurriculumWorkflow, KSCItem, BenchmarkProgram, KSCImportance } from '@/types/workflow';

// Custom framework upload type
interface UploadedFramework {
  id: string;
  name: string;
  fileName: string;
  uploadedAt: string;
}

interface Props {
  workflow: CurriculumWorkflow;
  onComplete: () => void;
  onRefresh: () => void;
  onOpenCanvas?: (target: any) => void;
}

// Industry/Professional Frameworks options
const INDUSTRY_FRAMEWORKS = [
  { value: 'SHRM', label: 'SHRM (HR / People Management)' },
  { value: 'PMI', label: 'PMI (Project Management)' },
  { value: 'SFIA', label: 'SFIA (IT Skills)' },
  { value: 'CIPD', label: 'CIPD (People Development)' },
  { value: 'ASCM', label: 'ASCM (Supply Chain)' },
  { value: 'CFA', label: 'CFA (Finance)' },
  { value: 'ACCA', label: 'ACCA (Accounting)' },
  { value: 'ISO', label: 'ISO Standards' },
];

// Knowledge Base Sources (from workflow document pg 7)
const KNOWLEDGE_BASE_SOURCES = [
  {
    id: 'benchmark_programs',
    label: 'Your provided benchmark programs',
    description: 'Primary source - programs you specify above',
    priority: 1,
    default: true,
  },
  {
    id: 'provided_frameworks',
    label: 'Your provided frameworks',
    description: 'Industry frameworks you select above',
    priority: 2,
    default: true,
  },
  {
    id: 'competency_framework_kb',
    label: 'Competency-Framework folder',
    description: 'Competency frameworks in knowledge base',
    priority: 3,
    default: true,
  },
  {
    id: 'uk_diploma_programs',
    label: 'UK-Diploma-Programs folder',
    description: 'UK accredited diploma specifications',
    priority: 4,
    default: true,
  },
  {
    id: 'ofqual_register',
    label: 'OFQUAL Register (UK)',
    description: 'UK qualifications register',
    priority: 5,
    default: true,
  },
  {
    id: 'hlc_wasc_databases',
    label: 'HLC and WASC databases (US)',
    description: 'US accreditation databases',
    priority: 6,
    default: true,
  },
  {
    id: 'professional_body_websites',
    label: 'Professional body websites',
    description: 'SHRM, PMI, ASCM, CIPD official resources',
    priority: 7,
    default: true,
  },
  {
    id: 'recent_accredited_programs',
    label: 'Recent accredited programs',
    description: 'Recently accredited program descriptions',
    priority: 8,
    default: true,
  },
];

// KSC Edit Modal Component
function KSCEditModal({
  item,
  type,
  onSave,
  onCancel,
  isSaving,
}: {
  item: KSCItem;
  type: 'knowledge' | 'skill' | 'competency';
  onSave: (updatedItem: KSCItem) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [statement, setStatement] = useState(item.statement);
  const [description, setDescription] = useState(item.description || '');
  const [importance, setImportance] = useState<KSCImportance>(
    (item.importance as KSCImportance) || 'essential'
  );

  const typeLabels = {
    knowledge: 'Knowledge',
    skill: 'Skill',
    competency: 'Competency',
  };

  const typeColors = {
    knowledge: 'text-cyan-400',
    skill: 'text-emerald-400',
    competency: 'text-amber-400',
  };

  const handleSave = () => {
    onSave({
      ...item,
      statement,
      description,
      importance,
    });
  };

  return (
    <div className="fixed inset-0 bg-teal-900/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl border border-teal-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-teal-200">
          <h3 className="text-lg font-semibold text-teal-800 flex items-center gap-2">
            Edit <span className={typeColors[type]}>{typeLabels[type]}</span> Item
          </h3>
        </div>

        <div className="p-6 space-y-5">
          {/* Statement/Title */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">
              Statement / Title
            </label>
            <textarea
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-teal-500 resize-none"
              placeholder="Enter the KSC statement..."
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">
              Description / Context
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-teal-500 resize-none"
              placeholder="Provide additional context or details..."
            />
          </div>

          {/* Importance */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">Importance Level</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setImportance('essential')}
                className={`flex-1 py-3 px-4 rounded-lg border transition-all ${
                  importance === 'essential'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                    : 'bg-white border-teal-300 text-teal-600 hover:border-teal-400'
                }`}
              >
                Essential
              </button>
              <button
                type="button"
                onClick={() => setImportance('desirable')}
                className={`flex-1 py-3 px-4 rounded-lg border transition-all ${
                  importance === 'desirable'
                    ? 'bg-teal-400/20 border-teal-400 text-teal-700'
                    : 'bg-white border-teal-300 text-teal-600 hover:border-teal-400'
                }`}
              >
                Desirable
              </button>
            </div>
          </div>

          {/* Source (read-only) */}
          {item.source && (
            <div>
              <label className="block text-sm font-medium text-teal-700 mb-2">Source</label>
              <p className="text-sm text-teal-500 bg-teal-50/50 px-4 py-3 rounded-lg">
                {item.source}
              </p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-teal-200 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="px-5 py-2.5 text-teal-600 hover:text-teal-600 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !statement.trim()}
            className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-teal-800 font-medium rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// KSC Item Card Component
function KSCCard({
  item,
  type,
  onEdit,
}: {
  item: KSCItem;
  type: 'knowledge' | 'skill' | 'competency';
  onEdit: (item: KSCItem) => void;
}) {
  const importanceColors: Record<KSCImportance, string> = {
    essential: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    desirable: 'bg-teal-400/20 text-teal-600 border-teal-400/30',
  };

  const typeColors = {
    knowledge: 'bg-cyan-500/20 text-cyan-400',
    skill: 'bg-emerald-500/20 text-emerald-400',
    competency: 'bg-amber-500/20 text-amber-400',
  };

  const typeLabels = {
    knowledge: 'K',
    skill: 'S',
    competency: 'C',
  };

  return (
    <div className="bg-white rounded-lg p-4 border border-teal-200 hover:border-teal-300 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-start gap-3">
          <span className={`text-xs px-2 py-1 rounded font-medium ${typeColors[type]}`}>
            {typeLabels[type]}
          </span>
          <p className="text-teal-800">{item.statement}</p>
        </div>
        <span
          className={`text-xs px-2 py-1 rounded-full border whitespace-nowrap ${importanceColors[item.importance as KSCImportance] || importanceColors.desirable}`}
        >
          {item.importance}
        </span>
      </div>
      {item.description && <p className="text-sm text-teal-600 ml-10 mb-2">{item.description}</p>}
      {item.source && <p className="text-xs text-teal-500 ml-10">Source: {item.source}</p>}
      <button
        onClick={() => onEdit(item)}
        className="mt-2 ml-10 text-xs text-cyan-400 hover:text-cyan-300"
      >
        Edit
      </button>
    </div>
  );
}

// Empty benchmark template
const EMPTY_BENCHMARK: BenchmarkProgram = {
  programName: '',
  institution: '',
  url: '',
};

export default function Step2Form({ workflow, onComplete, onRefresh }: Props) {
  const submitStep2 = useSubmitStep2();
  const approveStep2 = useApproveStep2();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { startGeneration, completeGeneration, failGeneration, isGenerating } = useGeneration();

  // Background job polling for Step 2
  const {
    status: stepStatus,
    startPolling,
    isPolling,
    isGenerationActive: isQueueActive,
  } = useStepStatus(workflow._id, 2, {
    pollInterval: 10000,
    autoStart: true,
    onComplete: () => {
      completeGeneration(workflow._id, 2);
      onRefresh();
    },
    onFailed: (err) => {
      failGeneration(workflow._id, 2, err);
      setError(err);
    },
  });

  // Form state for inputs
  const [benchmarks, setBenchmarks] = useState<BenchmarkProgram[]>([{ ...EMPTY_BENCHMARK }]);
  const [selectedFrameworks, setSelectedFrameworks] = useState<string[]>([]);
  const [institutionalFramework, setInstitutionalFramework] = useState('');
  const [selectedKBSources, setSelectedKBSources] = useState<string[]>(
    KNOWLEDGE_BASE_SOURCES.filter((s) => s.default).map((s) => s.id)
  );
  const [uploadedFrameworks, setUploadedFrameworks] = useState<UploadedFramework[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [editingItem, setEditingItem] = useState<KSCItem | null>(null);
  const [editingItemType, setEditingItemType] = useState<
    'knowledge' | 'skill' | 'competency' | null
  >(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle framework file upload (per-workflow only)
  const handleFrameworkUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setError(null);

    try {
      for (const file of Array.from(files)) {
        // Validate file type
        const validTypes = ['.pdf', '.docx', '.doc', '.txt'];
        const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        if (!validTypes.includes(fileExt)) {
          throw new Error(`Invalid file type: ${file.name}. Accepted: PDF, DOCX, DOC, TXT`);
        }

        // Create form data and upload
        const formData = new FormData();
        formData.append('file', file);
        formData.append('workflowId', workflow._id);
        formData.append('type', 'framework');

        const response = await api.post('/api/v3/workflow/upload-framework', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        const result = response.data;

        // Add to uploaded frameworks list
        setUploadedFrameworks((prev) => [
          ...prev,
          {
            id: result.data.id || `fw-${Date.now()}`,
            name: file.name.replace(/\.[^/.]+$/, ''),
            fileName: file.name,
            uploadedAt: new Date().toISOString(),
          },
        ]);
      }
    } catch (err: any) {
      console.error('Framework upload failed:', err);
      setError(err.message || 'Failed to upload framework');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeUploadedFramework = (id: string) => {
    setUploadedFrameworks((prev) => prev.filter((f) => f.id !== id));
  };

  // Initialize from existing data
  useEffect(() => {
    if (workflow.step2?.benchmarkPrograms && workflow.step2.benchmarkPrograms.length > 0) {
      // Handle both old string format and new object format
      const existingBenchmarks = workflow.step2.benchmarkPrograms.map((b: any) =>
        typeof b === 'string'
          ? { programName: b, institution: '', url: '' }
          : { programName: b.programName || '', institution: b.institution || '', url: b.url || '' }
      );
      setBenchmarks(existingBenchmarks.length > 0 ? existingBenchmarks : [{ ...EMPTY_BENCHMARK }]);
    }
    if (workflow.step2?.industryFrameworks) {
      setSelectedFrameworks(workflow.step2.industryFrameworks);
    }
    if (
      workflow.step2?.institutionalFrameworks &&
      workflow.step2.institutionalFrameworks.length > 0
    ) {
      setInstitutionalFramework(workflow.step2.institutionalFrameworks.join(', '));
    }
  }, [workflow.step2]);

  const isCurrentlyGenerating =
    isGenerating(workflow._id, 2) || submitStep2.isPending || isPolling || isQueueActive;

  // Check for completion when data appears
  useEffect(() => {
    if (
      workflow.step2 &&
      (workflow.step2.totalItems > 0 || (workflow.step2.knowledgeItems?.length || 0) > 0)
    ) {
      completeGeneration(workflow._id, 2);
    }
  }, [workflow.step2, workflow._id, completeGeneration]);

  const handleGenerate = async () => {
    setError(null);
    try {
      startGeneration(workflow._id, 2);
      const validBenchmarks = benchmarks.filter((b) => b.programName.trim());

      const response = await submitStep2.mutateAsync({
        id: workflow._id,
        data: {
          benchmarkPrograms: validBenchmarks,
          industryFrameworks: selectedFrameworks,
          institutionalFrameworks: institutionalFramework
            ? institutionalFramework
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
          knowledgeBaseSources: selectedKBSources,
          uploadedFrameworks: uploadedFrameworks.map((f) => ({
            id: f.id,
            name: f.name,
            fileName: f.fileName,
          })),
        },
      });
      if ((response as any)?.data?.jobId) {
        startPolling();
      } else {
        completeGeneration(workflow._id, 2);
        onRefresh();
      }
    } catch (err: any) {
      console.error('Failed to generate KSC:', err);
      failGeneration(workflow._id, 2, err.message || 'Failed to generate competency framework');
      setError(err.message || 'Failed to generate competency framework');
    }
  };

  const handleApprove = async () => {
    setError(null);
    try {
      await approveStep2.mutateAsync(workflow._id);
      onComplete();
    } catch (err: any) {
      console.error('Failed to approve Step 2:', err);
      setError(err.message || 'Failed to approve Step 2');
    }
  };

  // Handle editing a KSC item
  const handleEditItem = (item: KSCItem, type: 'knowledge' | 'skill' | 'competency') => {
    setEditingItem(item);
    setEditingItemType(type);
  };

  // Handle saving edited KSC item
  const handleSaveEdit = async (updatedItem: KSCItem) => {
    setIsSavingEdit(true);
    setError(null);

    console.log('Saving KSC item:', updatedItem);
    console.log('Workflow ID:', workflow._id);
    console.log('Item ID:', updatedItem.id);

    try {
      const response = await api.put(
        `/api/v3/workflow/${workflow._id}/step2/ksa/${updatedItem.id}`,
        {
          statement: updatedItem.statement,
          description: updatedItem.description,
          importance: updatedItem.importance,
        }
      );

      console.log('Save response:', response.data);

      // Close modal first
      setEditingItem(null);
      setEditingItemType(null);

      // Force refresh the workflow data
      console.log('Refreshing workflow data...');
      await onRefresh();
      console.log('Refresh complete');
    } catch (err: any) {
      console.error('Failed to save KSC item:', err);
      console.error('Error response:', err.response?.data);
      setError(err.response?.data?.error || err.message || 'Failed to save changes');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Handle canceling edit
  const handleCancelEdit = () => {
    setEditingItem(null);
    setEditingItemType(null);
  };

  // Benchmark management
  const addBenchmark = () => {
    setBenchmarks((prev) => [...prev, { ...EMPTY_BENCHMARK }]);
  };

  const updateBenchmark = (index: number, field: keyof BenchmarkProgram, value: string) => {
    setBenchmarks((prev) => prev.map((b, i) => (i === index ? { ...b, [field]: value } : b)));
  };

  const removeBenchmark = (index: number) => {
    if (benchmarks.length > 1) {
      setBenchmarks((prev) => prev.filter((_, i) => i !== index));
    }
  };

  // Framework toggle
  const toggleFramework = (framework: string) => {
    setSelectedFrameworks((prev) =>
      prev.includes(framework) ? prev.filter((f) => f !== framework) : [...prev, framework]
    );
  };

  // Check for existing data - handle both old and new field names
  const step2Data = workflow.step2;
  const hasStep2Data =
    step2Data &&
    (step2Data.totalItems > 0 ||
      (step2Data.knowledgeItems?.length || 0) +
        (step2Data.skillItems?.length || 0) +
        ((step2Data as any).competencyItems?.length ||
          (step2Data as any).attitudeItems?.length ||
          0) >
        0);
  const isApproved = !!step2Data?.approvedAt;

  // Get competency items (handle both old 'attitudeItems' and new 'competencyItems')
  const competencyItems =
    (step2Data as any)?.competencyItems || (step2Data as any)?.attitudeItems || [];

  // Calculate distribution percentages
  const totalItems =
    (step2Data?.knowledgeItems?.length || 0) +
    (step2Data?.skillItems?.length || 0) +
    competencyItems.length;
  const knowledgePercent =
    totalItems > 0 ? Math.round(((step2Data?.knowledgeItems?.length || 0) / totalItems) * 100) : 0;
  const skillPercent =
    totalItems > 0 ? Math.round(((step2Data?.skillItems?.length || 0) / totalItems) * 100) : 0;
  const competencyPercent =
    totalItems > 0 ? Math.round((competencyItems.length / totalItems) * 100) : 0;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {isCurrentlyGenerating && !hasStep2Data && (
        <div className="mb-6 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/30 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <div>
              <h3 className="text-lg font-semibold text-teal-800">Generating KSC Framework...</h3>
              <p className="text-sm text-teal-600">
                This may take a minute. You can navigate away and come back.
              </p>
            </div>
          </div>
          <GenerationProgressBar
            workflowId={workflow._id}
            step={2}
            queueStatus={stepStatus?.status}
          />
        </div>
      )}

      {!hasStep2Data && !isCurrentlyGenerating ? (
        // Generation Form
        <div className="space-y-8">
          {/* About This Step */}
          <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/30 rounded-xl p-5">
            <h3 className="text-blue-400 font-semibold mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              About Step 2: Competency Framework (KSC)
            </h3>
            <p className="text-sm text-teal-700 mb-3">
              The AI will analyze your program foundation and generate a comprehensive{' '}
              <strong className="text-cyan-400">Knowledge</strong>,{' '}
              <strong className="text-emerald-400">Skills</strong>, and{' '}
              <strong className="text-amber-400">Competencies</strong> (KSC) framework by
              researching similar programs and industry standards.
            </p>
            <div className="grid grid-cols-3 gap-4 text-center text-xs">
              <div className="bg-cyan-500/10 rounded-lg p-2">
                <p className="text-cyan-400 font-semibold">Knowledge (K)</p>
                <p className="text-teal-600">30-40% of items</p>
                <p className="text-teal-500 mt-1">What learners understand</p>
              </div>
              <div className="bg-emerald-500/10 rounded-lg p-2">
                <p className="text-emerald-400 font-semibold">Skills (S)</p>
                <p className="text-teal-600">40-50% of items</p>
                <p className="text-teal-500 mt-1">What learners can do</p>
              </div>
              <div className="bg-amber-500/10 rounded-lg p-2">
                <p className="text-amber-400 font-semibold">Competencies (C)</p>
                <p className="text-teal-600">10-30% of items</p>
                <p className="text-teal-500 mt-1">Professional behaviors</p>
              </div>
            </div>
          </div>

          {/* Benchmark Programs Section */}
          <section className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-cyan-400 border-b border-teal-200 pb-2 mb-4">
                Benchmark Programs
              </h3>
              <p className="text-sm text-teal-600 mb-4">
                Provide similar programs you want the AI to analyze for competencies. These are the
                primary source for generating your KSC framework.
              </p>
            </div>

            {benchmarks.map((benchmark, index) => (
              <div
                key={index}
                className="bg-teal-50/50 border border-teal-200 rounded-lg p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-teal-600">Benchmark {index + 1}</span>
                  {benchmarks.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeBenchmark(index)}
                      className="text-sm text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-teal-500 mb-1">Program Name</label>
                    <input
                      type="text"
                      value={benchmark.programName}
                      onChange={(e) => updateBenchmark(index, 'programName', e.target.value)}
                      placeholder="e.g., MSc Project Management"
                      className="w-full px-3 py-2 bg-teal-50 border border-teal-300 rounded-lg text-teal-800 text-sm placeholder-teal-400 focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-teal-500 mb-1">Institution</label>
                    <input
                      type="text"
                      value={benchmark.institution}
                      onChange={(e) => updateBenchmark(index, 'institution', e.target.value)}
                      placeholder="e.g., University of Manchester"
                      className="w-full px-3 py-2 bg-teal-50 border border-teal-300 rounded-lg text-teal-800 text-sm placeholder-teal-400 focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-teal-500 mb-1">URL (optional)</label>
                  <input
                    type="url"
                    value={benchmark.url}
                    onChange={(e) => updateBenchmark(index, 'url', e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 bg-teal-50 border border-teal-300 rounded-lg text-teal-800 text-sm placeholder-teal-400 focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addBenchmark}
              className="w-full py-2 border border-dashed border-teal-300 rounded-lg text-teal-600 hover:border-cyan-500 hover:text-cyan-400 transition-colors"
            >
              + Add Another Benchmark Program
            </button>
          </section>

          {/* Industry Frameworks Section */}
          <section className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-cyan-400 border-b border-teal-200 pb-2 mb-4">
                Industry/Professional Frameworks (Optional)
              </h3>
              <p className="text-sm text-teal-600 mb-4">
                Select professional body standards to include in the analysis.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {INDUSTRY_FRAMEWORKS.map((framework) => (
                <button
                  key={framework.value}
                  type="button"
                  onClick={() => toggleFramework(framework.value)}
                  className={`p-3 rounded-lg border text-left text-sm transition-all ${
                    selectedFrameworks.includes(framework.value)
                      ? 'bg-cyan-500/20 border-cyan-500 text-teal-800'
                      : 'bg-teal-50 border-teal-200 text-teal-600 hover:border-teal-300'
                  }`}
                >
                  {framework.label}
                </button>
              ))}
            </div>

            {/* Custom Framework Upload */}
            <div className="mt-4 pt-4 border-t border-teal-200">
              <p className="text-sm text-teal-600 mb-3">
                Have a framework not listed above? Upload it for this workflow:
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc,.txt"
                multiple
                onChange={handleFrameworkUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="px-4 py-2 border border-dashed border-teal-300 rounded-lg text-teal-600 hover:border-cyan-500 hover:text-cyan-400 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isUploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                      />
                    </svg>
                    Upload Framework (PDF, DOCX, TXT)
                  </>
                )}
              </button>

              {/* Uploaded Frameworks List */}
              {uploadedFrameworks.length > 0 && (
                <div className="mt-3 space-y-2">
                  {uploadedFrameworks.map((framework) => (
                    <div
                      key={framework.id}
                      className="flex items-center justify-between p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4 text-emerald-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        <span className="text-sm text-emerald-300">{framework.name}</span>
                        <span className="text-xs text-teal-500">({framework.fileName})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeUploadedFramework(framework.id)}
                        className="text-red-400 hover:text-red-300 p-1"
                      >
                        <svg
                          className="w-4 h-4"
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
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Institutional Frameworks Section */}
          <section className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-cyan-400 border-b border-teal-200 pb-2 mb-4">
                Institutional Frameworks (Optional)
              </h3>
              <p className="text-sm text-teal-600 mb-4">
                Add your organization's graduate attributes, competency models, or capability
                frameworks.
              </p>
            </div>

            <textarea
              value={institutionalFramework}
              onChange={(e) => setInstitutionalFramework(e.target.value)}
              placeholder="Enter institutional frameworks, separated by commas (e.g., Graduate Attributes Framework, Digital Skills Matrix)"
              rows={3}
              className="w-full px-4 py-3 bg-white border border-teal-200 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-teal-500 resize-none"
            />
          </section>

          {/* Knowledge Base Sources Section */}
          <section className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-cyan-400 border-b border-teal-200 pb-2 mb-4">
                Knowledge Base Sources
              </h3>
              <p className="text-sm text-teal-600 mb-4">
                Select which sources the AI will search when generating your competency framework.
                Sources are searched in priority order (1 = highest).
              </p>
            </div>

            <div className="space-y-2">
              {KNOWLEDGE_BASE_SOURCES.map((source) => {
                const isSelected = selectedKBSources.includes(source.id);
                return (
                  <button
                    key={source.id}
                    type="button"
                    onClick={() => {
                      setSelectedKBSources((prev) =>
                        isSelected ? prev.filter((id) => id !== source.id) : [...prev, source.id]
                      );
                    }}
                    className={`w-full p-3 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'bg-emerald-500/10 border-emerald-500/50 text-teal-800'
                        : 'bg-teal-50/30 border-teal-200 text-teal-600 hover:border-teal-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-5 h-5 rounded border flex items-center justify-center mt-0.5 ${
                          isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-teal-300'
                        }`}
                      >
                        {isSelected && (
                          <svg
                            className="w-3 h-3 text-teal-800"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-teal-500 bg-white px-1.5 py-0.5 rounded">
                            #{source.priority}
                          </span>
                          <span className="font-medium text-sm">{source.label}</span>
                        </div>
                        <p className="text-xs text-teal-500 mt-1">{source.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2 text-xs">
              <button
                type="button"
                onClick={() => setSelectedKBSources(KNOWLEDGE_BASE_SOURCES.map((s) => s.id))}
                className="px-3 py-1 text-cyan-400 hover:text-cyan-300"
              >
                Select All
              </button>
              <span className="text-teal-300">|</span>
              <button
                type="button"
                onClick={() => setSelectedKBSources([])}
                className="px-3 py-1 text-teal-600 hover:text-teal-700"
              >
                Deselect All
              </button>
            </div>
          </section>

          {/* Error Display */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={submitStep2.isPending}
            className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-teal-800 font-medium rounded-lg transition-all disabled:opacity-50"
          >
            {submitStep2.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating KSC Framework...
              </span>
            ) : (
              'Generate KSC Framework with AI'
            )}
          </button>

          <p className="text-xs text-teal-500 text-center">
            If you don't provide benchmarks, the AI will use public programs from the knowledge
            base.
          </p>
        </div>
      ) : (
        // Display Generated KSC
        <div className="space-y-6">
          {/* Stats Overview */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 border border-teal-200 text-center">
              <p className="text-3xl font-bold text-teal-800">{totalItems}</p>
              <p className="text-xs text-teal-500 mt-1">Total Items</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-teal-200 text-center">
              <p className="text-3xl font-bold text-cyan-400">
                {step2Data?.knowledgeItems?.length || 0}
              </p>
              <p className="text-xs text-teal-500 mt-1">
                Knowledge <span className="text-teal-300">({knowledgePercent}%)</span>
              </p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-teal-200 text-center">
              <p className="text-3xl font-bold text-emerald-400">
                {step2Data?.skillItems?.length || 0}
              </p>
              <p className="text-xs text-teal-500 mt-1">
                Skills <span className="text-teal-300">({skillPercent}%)</span>
              </p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-teal-200 text-center">
              <p className="text-3xl font-bold text-amber-400">{competencyItems.length}</p>
              <p className="text-xs text-teal-500 mt-1">
                Competencies <span className="text-teal-300">({competencyPercent}%)</span>
              </p>
            </div>
          </div>

          {/* Distribution Bar */}
          <div className="bg-white rounded-lg p-4 border border-teal-200">
            <p className="text-xs text-teal-600 mb-2">KSC Distribution</p>
            <div className="flex h-3 rounded-full overflow-hidden">
              <div
                className="bg-cyan-500"
                style={{ width: `${knowledgePercent}%` }}
                title={`Knowledge: ${knowledgePercent}%`}
              />
              <div
                className="bg-emerald-500"
                style={{ width: `${skillPercent}%` }}
                title={`Skills: ${skillPercent}%`}
              />
              <div
                className="bg-amber-500"
                style={{ width: `${competencyPercent}%` }}
                title={`Competencies: ${competencyPercent}%`}
              />
            </div>
            <div className="flex justify-between text-xs text-teal-500 mt-2">
              <span>K: 30-40%</span>
              <span>S: 40-50%</span>
              <span>C: 10-30%</span>
            </div>
          </div>

          {/* Knowledge Items */}
          <section>
            <h3 className="text-lg font-semibold text-teal-800 mb-4 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-cyan-400" />
              Knowledge (K)
              <span className="text-sm font-normal text-teal-500">
                — What learners need to understand
              </span>
            </h3>
            <div className="space-y-3">
              {step2Data?.knowledgeItems?.map((item: KSCItem) => (
                <KSCCard
                  key={item.id}
                  item={item}
                  type="knowledge"
                  onEdit={(item) => handleEditItem(item, 'knowledge')}
                />
              ))}
            </div>
          </section>

          {/* Skills Items */}
          <section>
            <h3 className="text-lg font-semibold text-teal-800 mb-4 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-400" />
              Skills (S)
              <span className="text-sm font-normal text-teal-500">
                — What learners need to be able to do
              </span>
            </h3>
            <div className="space-y-3">
              {step2Data?.skillItems?.map((item: KSCItem) => (
                <KSCCard
                  key={item.id}
                  item={item}
                  type="skill"
                  onEdit={(item) => handleEditItem(item, 'skill')}
                />
              ))}
            </div>
          </section>

          {/* Competency Items */}
          <section>
            <h3 className="text-lg font-semibold text-teal-800 mb-4 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-400" />
              Competencies (C)
              <span className="text-sm font-normal text-teal-500">
                — Professional behaviors and values
              </span>
            </h3>
            <div className="space-y-3">
              {competencyItems.map((item: KSCItem) => (
                <KSCCard
                  key={item.id}
                  item={item}
                  type="competency"
                  onEdit={(item) => handleEditItem(item, 'competency')}
                />
              ))}
            </div>
          </section>

          {/* Benchmarking Report */}
          {step2Data?.benchmarkingReport && (
            <section className="bg-teal-50/50 border border-teal-200 rounded-lg p-5">
              <h3 className="text-lg font-semibold text-teal-800 mb-3">Benchmarking Report</h3>
              {step2Data.benchmarkingReport.programsAnalyzed && (
                <div className="mb-3">
                  <p className="text-sm text-teal-600 mb-2">Programs Analyzed:</p>
                  <div className="flex flex-wrap gap-2">
                    {step2Data.benchmarkingReport.programsAnalyzed.map((p: any, i: number) => (
                      <span key={i} className="px-2 py-1 bg-white text-teal-700 rounded text-xs">
                        {typeof p === 'string' ? p : p.programName}
                        {typeof p === 'object' && p.institution && ` (${p.institution})`}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {step2Data.benchmarkingReport.keyFindings && (
                <div>
                  <p className="text-sm text-teal-600 mb-2">Key Findings:</p>
                  <ul className="list-disc list-inside text-sm text-teal-700 space-y-1">
                    {step2Data.benchmarkingReport.keyFindings.map((finding: string, i: number) => (
                      <li key={i}>{finding}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-6 border-t border-teal-200">
            <button
              onClick={handleGenerate}
              disabled={submitStep2.isPending}
              className="px-4 py-2 text-teal-600 hover:text-teal-600 transition-colors"
            >
              Regenerate
            </button>
            <div className="flex gap-3">
              {!isApproved && (
                <button
                  onClick={handleApprove}
                  disabled={approveStep2.isPending || totalItems < 10}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-teal-800 font-medium rounded-lg transition-all disabled:opacity-50"
                >
                  {approveStep2.isPending ? 'Approving...' : 'Approve & Continue →'}
                </button>
              )}
              {isApproved && (
                <span className="px-4 py-2.5 bg-emerald-500/20 text-emerald-400 rounded-lg flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Approved
                </span>
              )}
            </div>
          </div>

          {totalItems < 10 && !isApproved && (
            <p className="text-xs text-amber-400 text-center">
              Minimum 10 items required to approve. Currently: {totalItems}
            </p>
          )}
        </div>
      )}

      {/* Edit Modal */}
      {editingItem && editingItemType && (
        <KSCEditModal
          item={editingItem}
          type={editingItemType}
          onSave={handleSaveEdit}
          onCancel={handleCancelEdit}
          isSaving={isSavingEdit}
        />
      )}
    </div>
  );
}
