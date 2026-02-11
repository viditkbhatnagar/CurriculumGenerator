'use client';

import { useState, useEffect, useRef } from 'react';
import { useSubmitStep1, useApproveStep1 } from '@/hooks/useWorkflow';
import { useStepStatus } from '@/hooks/useStepStatus';
import { useGeneration, GenerationProgressBar } from '@/contexts/GenerationContext';
import {
  CurriculumWorkflow,
  Step1FormData,
  AcademicLevel,
  CreditSystem,
  DeliveryMode,
  ExperienceLevel,
  JobRole,
  ACADEMIC_LEVELS,
  CREDIT_SYSTEMS,
  DELIVERY_MODES,
  EXPERIENCE_LEVELS,
  calculateCreditEquivalencies,
  calculateContactHours,
} from '@/types/workflow';

interface Props {
  workflow: CurriculumWorkflow;
  onComplete: () => void;
  onRefresh: () => void;
  onOpenCanvas?: (target: any) => void;
}

// Empty job role template
const EMPTY_JOB_ROLE: JobRole = {
  title: '',
  description: '',
  tasks: [''],
};

export default function Step1Form({ workflow, onComplete, onRefresh }: Props) {
  const submitStep1 = useSubmitStep1();
  const approveStep1 = useApproveStep1();

  const { startGeneration, completeGeneration, failGeneration, isGenerating } = useGeneration();

  // Background job polling for Step 1
  const {
    status: stepStatus,
    startPolling,
    isPolling,
    isGenerationActive: isQueueActive,
  } = useStepStatus(workflow._id, 1, {
    pollInterval: 10000,
    autoStart: true,
    onComplete: () => {
      completeGeneration(workflow._id, 1);
      onRefresh();
    },
    onFailed: (err) => {
      failGeneration(workflow._id, 1, err);
      setError(err);
    },
  });

  const isCurrentlyGenerating =
    isGenerating(workflow._id, 1) || submitStep1.isPending || isPolling || isQueueActive;

  // Track if form has been initialized to prevent resets
  const isInitialized = useRef(false);
  const lastWorkflowId = useRef<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<Step1FormData>({
    // Program Identity
    programTitle: '',
    programDescription: '',
    academicLevel: 'certificate',

    // Credit Framework
    isCreditAwarding: true,
    creditSystem: 'uk',
    credits: 60,
    totalHours: 120,
    customContactPercent: undefined,

    // Target Learner Profile (structured)
    targetLearnerAgeRange: '',
    targetLearnerEducationalBackground: '',
    targetLearnerIndustrySector: '',
    targetLearnerExperienceLevel: 'professional',

    // Delivery
    deliveryMode: 'hybrid_blended',
    deliveryDescription: '',

    // Labour Market
    programPurpose: '',
    jobRoles: [{ ...EMPTY_JOB_ROLE }, { ...EMPTY_JOB_ROLE }],
  });

  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showCustomContactHours, setShowCustomContactHours] = useState(false);

  // Calculated values
  const [calculations, setCalculations] = useState({
    totalHours: 0,
    contactHours: 0,
    independentHours: 0,
    contactPercent: 30,
    equivalencies: {
      ukCredits: 0,
      ectsCredits: 0,
      usSemesterCredits: 0,
      totalHours: 0,
    },
  });

  // Initialize form with existing data - only on initial load or workflow change
  useEffect(() => {
    // Only initialize if:
    // 1. Form hasn't been initialized yet, OR
    // 2. Workflow ID has changed (user switched to different workflow)
    const workflowId = workflow._id;
    const shouldInitialize = !isInitialized.current || lastWorkflowId.current !== workflowId;

    if (shouldInitialize && workflow.step1) {
      const step1 = workflow.step1;
      const targetLearner = step1.targetLearner;
      const delivery = step1.delivery;
      const creditFramework = step1.creditFramework;

      setFormData({
        programTitle: step1.programTitle || '',
        programDescription: step1.programDescription || '',
        academicLevel: step1.academicLevel || 'certificate',

        isCreditAwarding: creditFramework?.isCreditAwarding ?? true,
        creditSystem: creditFramework?.creditSystem || creditFramework?.system || 'uk',
        credits: creditFramework?.credits || 60,
        totalHours: creditFramework?.totalHours || 120,
        customContactPercent: creditFramework?.customContactPercent,

        targetLearnerAgeRange:
          typeof targetLearner === 'object' ? targetLearner?.ageRange || '' : '',
        targetLearnerEducationalBackground:
          typeof targetLearner === 'object' ? targetLearner?.educationalBackground || '' : '',
        targetLearnerIndustrySector:
          typeof targetLearner === 'object' ? targetLearner?.industrySector || '' : '',
        targetLearnerExperienceLevel:
          typeof targetLearner === 'object'
            ? targetLearner?.experienceLevel || 'professional'
            : 'professional',

        deliveryMode:
          typeof delivery === 'object' ? delivery?.mode || 'hybrid_blended' : 'hybrid_blended',
        deliveryDescription: typeof delivery === 'object' ? delivery?.description || '' : '',

        programPurpose: step1.programPurpose || '',
        jobRoles:
          step1.jobRoles && step1.jobRoles.length > 0
            ? step1.jobRoles.map((role: any) =>
                typeof role === 'string'
                  ? { title: role, description: '', tasks: [''] }
                  : {
                      title: role.title || '',
                      description: role.description || '',
                      tasks: role.tasks || [''],
                    }
              )
            : [{ ...EMPTY_JOB_ROLE }, { ...EMPTY_JOB_ROLE }],
      });

      if (creditFramework?.customContactPercent) {
        setShowCustomContactHours(true);
      }

      isInitialized.current = true;
      lastWorkflowId.current = workflowId;
    } else if (shouldInitialize && !workflow.step1) {
      // New workflow with no step1 data yet - mark as initialized
      isInitialized.current = true;
      lastWorkflowId.current = workflowId;
    }
  }, [workflow._id, workflow.step1]);

  // Calculate hours when credits/system changes
  useEffect(() => {
    let totalHours: number;

    if (formData.isCreditAwarding && formData.creditSystem !== 'non_credit') {
      const systemConfig = CREDIT_SYSTEMS.find((s) => s.value === formData.creditSystem);
      totalHours = (formData.credits || 60) * (systemConfig?.hoursPerCredit || 10);
    } else {
      totalHours = formData.totalHours || 120;
    }

    const { contactHours, independentHours, contactPercent } = calculateContactHours(
      totalHours,
      formData.creditSystem,
      formData.customContactPercent
    );

    const equivalencies = calculateCreditEquivalencies(
      formData.creditSystem,
      formData.credits || 0,
      totalHours
    );

    setCalculations({
      totalHours,
      contactHours,
      independentHours,
      contactPercent,
      equivalencies,
    });
  }, [
    formData.isCreditAwarding,
    formData.creditSystem,
    formData.credits,
    formData.totalHours,
    formData.customContactPercent,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setValidationErrors([]);

    // Filter out empty job roles and tasks
    const cleanedJobRoles = formData.jobRoles
      .filter((role) => role.title.trim())
      .map((role) => ({
        ...role,
        tasks: role.tasks.filter((task) => task.trim()),
      }));

    try {
      startGeneration(workflow._id, 1);
      const response = await submitStep1.mutateAsync({
        id: workflow._id,
        data: {
          ...formData,
          jobRoles: cleanedJobRoles,
          totalHours: calculations.totalHours,
        },
      });
      if ((response as any)?.data?.jobId) {
        startPolling();
      } else {
        completeGeneration(workflow._id, 1);
        onRefresh();
      }
    } catch (err: any) {
      console.error('Failed to submit Step 1:', err);
      failGeneration(workflow._id, 1, err.message || 'Failed to save draft');
      setError(err.message || 'Failed to save draft');
    }
  };

  const handleApprove = async () => {
    setError(null);
    setValidationErrors([]);

    // Client-side validation
    const errors: string[] = [];
    const filledJobRoles = formData.jobRoles.filter((r) => r.title.trim());

    if (!formData.programTitle || formData.programTitle.length < 5) {
      errors.push('Program title must be at least 5 characters');
    }
    if (!formData.programDescription || formData.programDescription.length < 50) {
      errors.push('Program description must be at least 50 characters');
    }
    if (
      !formData.targetLearnerEducationalBackground ||
      formData.targetLearnerEducationalBackground.length < 10
    ) {
      errors.push('Educational background must be at least 10 characters');
    }
    if (!formData.targetLearnerIndustrySector || formData.targetLearnerIndustrySector.length < 5) {
      errors.push('Industry sector must be at least 5 characters');
    }
    if (!formData.deliveryDescription || formData.deliveryDescription.length < 10) {
      errors.push('Delivery structure description must be at least 10 characters');
    }
    if (!formData.programPurpose || formData.programPurpose.length < 50) {
      errors.push('Program purpose must be at least 50 characters');
    }
    if (filledJobRoles.length < 2) {
      errors.push('At least 2 job roles are required');
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      setError('Cannot approve Step 1. Please fix the following:');
      return;
    }

    try {
      const cleanedJobRoles = formData.jobRoles
        .filter((role) => role.title.trim())
        .map((role) => ({
          ...role,
          tasks: role.tasks.filter((task) => task.trim()),
        }));

      await submitStep1.mutateAsync({
        id: workflow._id,
        data: {
          ...formData,
          jobRoles: cleanedJobRoles,
          totalHours: calculations.totalHours,
        },
      });

      await approveStep1.mutateAsync(workflow._id);
      onComplete();
    } catch (err: any) {
      console.error('Failed to approve Step 1:', err);
      setError(err?.message || 'Failed to approve Step 1');
      if (err?.details && Array.isArray(err.details)) {
        setValidationErrors(err.details);
      }
    }
  };

  // Job role management
  const addJobRole = () => {
    setFormData((prev) => ({
      ...prev,
      jobRoles: [...prev.jobRoles, { ...EMPTY_JOB_ROLE }],
    }));
  };

  const updateJobRole = (index: number, field: keyof JobRole, value: any) => {
    setFormData((prev) => ({
      ...prev,
      jobRoles: prev.jobRoles.map((role, i) => (i === index ? { ...role, [field]: value } : role)),
    }));
  };

  const removeJobRole = (index: number) => {
    if (formData.jobRoles.length > 2) {
      setFormData((prev) => ({
        ...prev,
        jobRoles: prev.jobRoles.filter((_, i) => i !== index),
      }));
    }
  };

  const addTask = (roleIndex: number) => {
    setFormData((prev) => ({
      ...prev,
      jobRoles: prev.jobRoles.map((role, i) =>
        i === roleIndex ? { ...role, tasks: [...role.tasks, ''] } : role
      ),
    }));
  };

  const updateTask = (roleIndex: number, taskIndex: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      jobRoles: prev.jobRoles.map((role, i) =>
        i === roleIndex
          ? { ...role, tasks: role.tasks.map((task, j) => (j === taskIndex ? value : task)) }
          : role
      ),
    }));
  };

  const removeTask = (roleIndex: number, taskIndex: number) => {
    setFormData((prev) => ({
      ...prev,
      jobRoles: prev.jobRoles.map((role, i) =>
        i === roleIndex && role.tasks.length > 1
          ? { ...role, tasks: role.tasks.filter((_, j) => j !== taskIndex) }
          : role
      ),
    }));
  };

  const isComplete = workflow.step1?.completenessScore && workflow.step1.completenessScore >= 70;
  const isApproved = !!workflow.step1?.approvedAt;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {isCurrentlyGenerating && (
        <div className="mb-6 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <div>
              <h3 className="text-lg font-semibold text-teal-800">
                Generating Program Foundation...
              </h3>
              <p className="text-sm text-teal-600">
                This may take 30 seconds. You can navigate away and come back.
              </p>
            </div>
          </div>
          <GenerationProgressBar
            workflowId={workflow._id}
            step={1}
            queueStatus={stepStatus?.status}
          />
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* ============================================================ */}
        {/* SECTION 1: PROGRAM IDENTITY & DESCRIPTION */}
        {/* ============================================================ */}
        <section className="space-y-6">
          <h2 className="text-lg font-semibold text-cyan-400 border-b border-teal-200 pb-2">
            Program Identity & Description
          </h2>

          {/* Program Title */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">
              Program Title <span className="text-red-400">*</span>
              <span className="text-teal-500 font-normal ml-2">(5-100 characters)</span>
            </label>
            <input
              type="text"
              value={formData.programTitle}
              onChange={(e) => setFormData((prev) => ({ ...prev, programTitle: e.target.value }))}
              placeholder="e.g., Professional Diploma in Project Management"
              className="w-full px-4 py-3 bg-white border border-teal-200 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-cyan-500"
              required
              minLength={5}
              maxLength={100}
            />
          </div>

          {/* Program Description */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">
              Program Description <span className="text-red-400">*</span>
              <span className="text-teal-500 font-normal ml-2">(50-500 words)</span>
            </label>
            <textarea
              value={formData.programDescription}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, programDescription: e.target.value }))
              }
              placeholder="Provide a comprehensive description of the program's scope, focus areas, and what learners will gain..."
              rows={5}
              className="w-full px-4 py-3 bg-white border border-teal-200 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-teal-500 resize-none"
              required
            />
            <p className="text-xs text-teal-500 mt-1">
              {formData.programDescription.split(/\s+/).filter(Boolean).length} words (minimum 50)
            </p>
          </div>

          {/* Academic Level */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">
              Academic Level <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              {ACADEMIC_LEVELS.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, academicLevel: level.value }))}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    formData.academicLevel === level.value
                      ? 'bg-cyan-500/20 border-cyan-500 text-teal-800'
                      : 'bg-teal-50 border-teal-200 text-teal-600 hover:border-teal-300'
                  }`}
                >
                  <p className="font-medium">{level.label}</p>
                  <p className="text-xs mt-1 opacity-70">{level.description}</p>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* SECTION 2: CREDIT STRUCTURE & CONTACT HOURS */}
        {/* ============================================================ */}
        <section className="space-y-6">
          <h2 className="text-lg font-semibold text-cyan-400 border-b border-teal-200 pb-2">
            Credit Structure & Contact Hours
          </h2>

          {/* Is Credit Awarding? */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">
              Is this program credit-awarding? <span className="text-red-400">*</span>
            </label>
            <p className="text-sm text-cyan-400 mb-3 bg-cyan-500/10 px-3 py-2 rounded-lg border border-cyan-500/20">
              💡 If your program is benchmarked to a specific credit value, select "Yes."
            </p>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() =>
                  setFormData((prev) => ({ ...prev, isCreditAwarding: true, creditSystem: 'uk' }))
                }
                className={`flex-1 p-4 rounded-lg border text-center transition-all ${
                  formData.isCreditAwarding
                    ? 'bg-emerald-500/20 border-emerald-500 text-teal-800'
                    : 'bg-teal-50 border-teal-200 text-teal-600 hover:border-teal-300'
                }`}
              >
                <p className="font-medium">Yes</p>
                <p className="text-xs mt-1 opacity-70">Select credit framework (UK, ECTS, US)</p>
              </button>
              <button
                type="button"
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    isCreditAwarding: false,
                    creditSystem: 'non_credit',
                  }))
                }
                className={`flex-1 p-4 rounded-lg border text-center transition-all ${
                  !formData.isCreditAwarding
                    ? 'bg-amber-500/20 border-amber-500 text-teal-800'
                    : 'bg-teal-50 border-teal-200 text-teal-600 hover:border-teal-300'
                }`}
              >
                <p className="font-medium">No</p>
                <p className="text-xs mt-1 opacity-70">Enter direct hours (20-500)</p>
              </button>
            </div>
          </div>

          {/* Credit-Awarding Options */}
          {formData.isCreditAwarding ? (
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-teal-700 mb-2">
                  Credit Framework <span className="text-red-400">*</span>
                </label>
                <select
                  value={formData.creditSystem}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      creditSystem: e.target.value as CreditSystem,
                    }))
                  }
                  className="w-full px-4 py-3 bg-white border border-teal-200 rounded-lg text-teal-800 focus:outline-none focus:border-teal-500"
                >
                  {CREDIT_SYSTEMS.filter((s) => s.value !== 'non_credit').map((system) => (
                    <option key={system.value} value={system.value}>
                      {system.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-teal-500 mt-1">
                  {CREDIT_SYSTEMS.find((s) => s.value === formData.creditSystem)?.description}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-teal-700 mb-2">
                  Total Credits <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  value={formData.credits}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, credits: parseInt(e.target.value) || 60 }))
                  }
                  min={10}
                  max={360}
                  className="w-full px-4 py-3 bg-white border border-teal-200 rounded-lg text-teal-800 focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>
          ) : (
            /* Non-Credit: Direct Hours Entry */
            <div>
              <label className="block text-sm font-medium text-teal-700 mb-2">
                Total Program Hours <span className="text-red-400">*</span>
                <span className="text-teal-500 font-normal ml-2">(20-500 hours)</span>
              </label>
              <input
                type="number"
                value={formData.totalHours}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, totalHours: parseInt(e.target.value) || 120 }))
                }
                min={20}
                max={500}
                className="w-full px-4 py-3 bg-white border border-teal-200 rounded-lg text-teal-800 focus:outline-none focus:border-teal-500"
              />
            </div>
          )}

          {/* Custom Contact Hours Override */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showCustomContactHours}
                onChange={(e) => {
                  setShowCustomContactHours(e.target.checked);
                  if (!e.target.checked) {
                    setFormData((prev) => ({ ...prev, customContactPercent: undefined }));
                  }
                }}
                className="w-4 h-4 rounded border-teal-300 bg-white text-cyan-500 focus:ring-cyan-500"
              />
              <span className="text-sm text-teal-700">
                Override default contact hours percentage
              </span>
            </label>
            {showCustomContactHours && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-teal-700 mb-2">
                  Custom Contact Hours %
                </label>
                <input
                  type="number"
                  value={formData.customContactPercent || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      customContactPercent: parseInt(e.target.value) || undefined,
                    }))
                  }
                  min={10}
                  max={60}
                  placeholder={`Default: ${calculations.contactPercent}%`}
                  className="w-32 px-4 py-2 bg-white border border-teal-200 rounded-lg text-teal-800 focus:outline-none focus:border-teal-500"
                />
              </div>
            )}
          </div>

          {/* Calculated Hours Display */}
          <div className="bg-white border border-teal-200 rounded-xl p-5 border border-teal-200">
            <h4 className="text-sm font-medium text-teal-700 mb-4">Workload Distribution</h4>
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-cyan-400">{calculations.totalHours}</p>
                <p className="text-xs text-teal-500 mt-1">Total Hours</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-emerald-400">
                  {calculations.contactHours}
                  <span className="text-sm font-normal text-teal-500 ml-1">
                    ({calculations.contactPercent}%)
                  </span>
                </p>
                <p className="text-xs text-teal-500 mt-1">Contact Hours</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-amber-400">{calculations.independentHours}</p>
                <p className="text-xs text-teal-500 mt-1">Independent/Assessment</p>
              </div>
            </div>

            {/* International Equivalencies */}
            <div className="mt-5 pt-4 border-t border-teal-200">
              <h5 className="text-xs font-medium text-teal-600 mb-3">
                International Equivalencies
              </h5>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-teal-50 rounded-lg p-3">
                  <p className="text-lg font-semibold text-teal-800">
                    {calculations.equivalencies.ukCredits}
                  </p>
                  <p className="text-xs text-teal-500">UK Credits</p>
                </div>
                <div className="bg-teal-50 rounded-lg p-3">
                  <p className="text-lg font-semibold text-teal-800">
                    {calculations.equivalencies.ectsCredits}
                  </p>
                  <p className="text-xs text-teal-500">ECTS</p>
                </div>
                <div className="bg-teal-50 rounded-lg p-3">
                  <p className="text-lg font-semibold text-teal-800">
                    {calculations.equivalencies.usSemesterCredits}
                  </p>
                  <p className="text-xs text-teal-500">US Semester</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* SECTION 3: TARGET LEARNER PROFILE */}
        {/* ============================================================ */}
        <section className="space-y-6">
          <h2 className="text-lg font-semibold text-cyan-400 border-b border-teal-200 pb-2">
            Target Learner Profile
          </h2>

          <div className="grid grid-cols-2 gap-6">
            {/* Age Range */}
            <div>
              <label className="block text-sm font-medium text-teal-700 mb-2">Age Range</label>
              <input
                type="text"
                value={formData.targetLearnerAgeRange}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, targetLearnerAgeRange: e.target.value }))
                }
                placeholder="e.g., 25-45 years"
                className="w-full px-4 py-3 bg-white border border-teal-200 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-teal-500"
              />
            </div>

            {/* Experience Level */}
            <div>
              <label className="block text-sm font-medium text-teal-700 mb-2">
                Experience Level <span className="text-red-400">*</span>
              </label>
              <select
                value={formData.targetLearnerExperienceLevel}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    targetLearnerExperienceLevel: e.target.value as ExperienceLevel,
                  }))
                }
                className="w-full px-4 py-3 bg-white border border-teal-200 rounded-lg text-teal-800 focus:outline-none focus:border-teal-500"
              >
                {EXPERIENCE_LEVELS.map((level) => (
                  <option key={level.value} value={level.value}>
                    {level.label} ({level.years})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Educational Background */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">
              Educational Background <span className="text-red-400">*</span>
              <span className="text-teal-500 font-normal ml-2">(minimum 10 characters)</span>
            </label>
            <textarea
              value={formData.targetLearnerEducationalBackground}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  targetLearnerEducationalBackground: e.target.value,
                }))
              }
              placeholder="Describe the typical educational background of your target learners..."
              rows={2}
              className="w-full px-4 py-3 bg-white border border-teal-200 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-teal-500 resize-none"
              required
            />
          </div>

          {/* Industry Sector */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">
              Industry Sector <span className="text-red-400">*</span>
              <span className="text-teal-500 font-normal ml-2">(minimum 5 characters)</span>
            </label>
            <input
              type="text"
              value={formData.targetLearnerIndustrySector}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, targetLearnerIndustrySector: e.target.value }))
              }
              placeholder="e.g., Healthcare, Finance, Technology, Manufacturing"
              className="w-full px-4 py-3 bg-white border border-teal-200 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-teal-500"
              required
            />
          </div>
        </section>

        {/* ============================================================ */}
        {/* SECTION 4: PROGRAM DELIVERY */}
        {/* ============================================================ */}
        <section className="space-y-6">
          <h2 className="text-lg font-semibold text-cyan-400 border-b border-teal-200 pb-2">
            Program Delivery
          </h2>

          {/* Delivery Mode */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">
              Delivery Mode <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {DELIVERY_MODES.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, deliveryMode: mode.value }))}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    formData.deliveryMode === mode.value
                      ? 'bg-cyan-500/20 border-cyan-500 text-teal-800'
                      : 'bg-teal-50 border-teal-200 text-teal-600 hover:border-teal-300'
                  }`}
                >
                  <p className="font-medium">{mode.label}</p>
                  <p className="text-xs mt-1 opacity-70">
                    Typical contact: {mode.typicalContactPercent}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Delivery Structure Description */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">
              Delivery Structure <span className="text-red-400">*</span>
              <span className="text-teal-500 font-normal ml-2">(1-3 sentences)</span>
            </label>
            <textarea
              value={formData.deliveryDescription}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, deliveryDescription: e.target.value }))
              }
              placeholder="Describe how the program will be delivered, including the balance of contact vs. independent learning..."
              rows={3}
              className="w-full px-4 py-3 bg-white border border-teal-200 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-teal-500 resize-none"
              required
            />
          </div>
        </section>

        {/* ============================================================ */}
        {/* SECTION 5: LABOUR MARKET RATIONALE */}
        {/* ============================================================ */}
        <section className="space-y-6">
          <h2 className="text-lg font-semibold text-cyan-400 border-b border-teal-200 pb-2">
            Labour Market Rationale
          </h2>

          {/* Program Purpose */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">
              Program Purpose <span className="text-red-400">*</span>
              <span className="text-teal-500 font-normal ml-2">(50-300 words)</span>
            </label>
            <textarea
              value={formData.programPurpose}
              onChange={(e) => setFormData((prev) => ({ ...prev, programPurpose: e.target.value }))}
              placeholder="Explain why this program exists, what gap it fills, and its value proposition..."
              rows={4}
              className="w-full px-4 py-3 bg-white border border-teal-200 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-teal-500 resize-none"
              required
            />
            <p className="text-xs text-teal-500 mt-1">
              {formData.programPurpose.split(/\s+/).filter(Boolean).length} words (50-300 required)
            </p>
          </div>

          {/* Job Roles */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-3">
              Target Job Roles <span className="text-red-400">*</span>
              <span className="text-teal-500 font-normal ml-2">
                (minimum 2 roles with descriptions)
              </span>
            </label>

            <div className="space-y-6">
              {formData.jobRoles.map((role, roleIndex) => (
                <div
                  key={roleIndex}
                  className="bg-teal-50/50 border border-teal-200 rounded-lg p-5 space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <h4 className="text-sm font-medium text-teal-700">Job Role {roleIndex + 1}</h4>
                    {formData.jobRoles.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeJobRole(roleIndex)}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  {/* Job Title */}
                  <div>
                    <label className="block text-xs text-teal-600 mb-1">Job Title</label>
                    <input
                      type="text"
                      value={role.title}
                      onChange={(e) => updateJobRole(roleIndex, 'title', e.target.value)}
                      placeholder="e.g., Project Manager"
                      className="w-full px-4 py-2 bg-teal-50 border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  {/* Job Description */}
                  <div>
                    <label className="block text-xs text-teal-600 mb-1">
                      Job Description (100-1000 words)
                    </label>
                    <textarea
                      value={role.description}
                      onChange={(e) => updateJobRole(roleIndex, 'description', e.target.value)}
                      placeholder="Describe the role, responsibilities, and typical workplace context..."
                      rows={3}
                      className="w-full px-4 py-2 bg-teal-50 border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-teal-500 resize-none"
                    />
                  </div>

                  {/* Workplace Tasks */}
                  <div>
                    <label className="block text-xs text-teal-600 mb-2">Workplace Tasks</label>
                    <div className="space-y-2">
                      {role.tasks.map((task, taskIndex) => (
                        <div key={taskIndex} className="flex gap-2">
                          <input
                            type="text"
                            value={task}
                            onChange={(e) => updateTask(roleIndex, taskIndex, e.target.value)}
                            placeholder={`Task ${taskIndex + 1}`}
                            className="flex-1 px-3 py-2 bg-teal-50 border border-teal-300 rounded-lg text-teal-800 text-sm placeholder-teal-400 focus:outline-none focus:border-teal-500"
                          />
                          {role.tasks.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeTask(roleIndex, taskIndex)}
                              className="p-2 text-teal-500 hover:text-red-400"
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
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => addTask(roleIndex)}
                      className="mt-2 text-xs text-cyan-400 hover:text-cyan-300"
                    >
                      + Add task
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addJobRole}
              className="mt-4 px-4 py-2 border border-dashed border-teal-300 rounded-lg text-teal-600 hover:border-cyan-500 hover:text-cyan-400 transition-colors w-full"
            >
              + Add another job role
            </button>
          </div>
        </section>

        {/* ============================================================ */}
        {/* ERROR DISPLAY */}
        {/* ============================================================ */}
        {(error || validationErrors.length > 0) && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            {error && <p className="text-red-400 font-medium mb-2">{error}</p>}
            {validationErrors.length > 0 && (
              <ul className="text-sm text-red-300 list-disc list-inside space-y-1">
                {validationErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* ACTION BUTTONS */}
        {/* ============================================================ */}
        <div className="flex items-center justify-between pt-6 border-t border-teal-200">
          <div>
            {workflow.step1?.completenessScore !== undefined && (
              <div className="flex items-center gap-3">
                <div className="w-40 h-2 bg-teal-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      workflow.step1.completenessScore >= 70 ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${workflow.step1.completenessScore}%` }}
                  />
                </div>
                <span className="text-sm text-teal-600">
                  {workflow.step1.completenessScore}% complete
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitStep1.isPending}
              className="px-6 py-2.5 bg-teal-100 hover:bg-teal-300 text-teal-800 rounded-lg transition-colors disabled:opacity-50"
            >
              {submitStep1.isPending ? 'Saving...' : 'Save Draft'}
            </button>
            {isComplete && !isApproved && (
              <button
                type="button"
                onClick={handleApprove}
                disabled={approveStep1.isPending}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-teal-800 font-medium rounded-lg transition-all disabled:opacity-50"
              >
                {approveStep1.isPending ? 'Approving...' : 'Approve & Continue →'}
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
      </form>
    </div>
  );
}
