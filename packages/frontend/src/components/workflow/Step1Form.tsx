'use client';

import { useState, useEffect } from 'react';
import { useSubmitStep1, useApproveStep1 } from '@/hooks/useWorkflow';
import {
  CurriculumWorkflow,
  Step1FormData,
  AcademicLevel,
  CreditSystem,
  DeliveryMode,
} from '@/types/workflow';

interface Props {
  workflow: CurriculumWorkflow;
  onComplete: () => void;
  onRefresh: () => void;
}

const ACADEMIC_LEVELS: { value: AcademicLevel; label: string; description: string }[] = [
  {
    value: 'certificate',
    label: 'Certificate',
    description: 'Short-form credential (30-60 credits)',
  },
  {
    value: 'micro-credential',
    label: 'Micro-Credential',
    description: 'Focused skill (10-30 credits)',
  },
  { value: 'diploma', label: 'Diploma', description: 'Comprehensive program (60-120 credits)' },
];

const CREDIT_SYSTEMS: {
  value: CreditSystem;
  label: string;
  hoursPerCredit: number;
  contactPercent: number;
}[] = [
  { value: 'uk', label: 'UK Credits', hoursPerCredit: 10, contactPercent: 25 },
  { value: 'ects', label: 'ECTS (European)', hoursPerCredit: 25, contactPercent: 33 },
  { value: 'us_semester', label: 'US Semester Hours', hoursPerCredit: 45, contactPercent: 33 },
];

const DELIVERY_MODES: { value: DeliveryMode; label: string }[] = [
  { value: 'online', label: 'Fully Online' },
  { value: 'blended', label: 'Blended (Online + In-Person)' },
  { value: 'on-campus', label: 'On-Campus' },
];

export default function Step1Form({ workflow, onComplete, onRefresh }: Props) {
  const submitStep1 = useSubmitStep1();
  const approveStep1 = useApproveStep1();

  const [formData, setFormData] = useState<Step1FormData>({
    programTitle: '',
    programDescription: '',
    academicLevel: 'certificate',
    creditSystem: 'uk',
    credits: 60,
    targetLearner: '',
    deliveryMode: 'online',
    programPurpose: '',
    jobRoles: ['', ''],
  });

  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const [calculatedHours, setCalculatedHours] = useState({ total: 0, contact: 0, selfStudy: 0 });

  // Initialize form with existing data
  useEffect(() => {
    if (workflow.step1) {
      setFormData({
        programTitle: workflow.step1.programTitle || '',
        programDescription: workflow.step1.programDescription || '',
        academicLevel: workflow.step1.academicLevel || 'certificate',
        creditSystem: workflow.step1.creditFramework?.creditSystem || 'uk',
        credits: workflow.step1.creditFramework?.totalCredits || 60,
        targetLearner: workflow.step1.targetLearner || '',
        deliveryMode: workflow.step1.deliveryMode || 'online',
        deliveryDescription: workflow.step1.deliveryDescription,
        programPurpose: workflow.step1.programPurpose || '',
        jobRoles: workflow.step1.jobRoles?.length ? workflow.step1.jobRoles : ['', ''],
      });
    }
  }, [workflow.step1]);

  // Calculate hours when credits or system changes
  useEffect(() => {
    const system = CREDIT_SYSTEMS.find((s) => s.value === formData.creditSystem);
    if (system) {
      const total = formData.credits * system.hoursPerCredit;
      const contact = Math.round(total * (system.contactPercent / 100));
      setCalculatedHours({
        total,
        contact,
        selfStudy: total - contact,
      });
    }
  }, [formData.credits, formData.creditSystem]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setValidationErrors([]);

    // Filter out empty job roles
    const cleanedJobRoles = formData.jobRoles.filter((role) => role.trim());

    try {
      await submitStep1.mutateAsync({
        id: workflow._id,
        data: {
          ...formData,
          jobRoles: cleanedJobRoles,
          totalHours: calculatedHours.total,
        },
      });
      onRefresh();
    } catch (err: any) {
      console.error('Failed to submit Step 1:', err);
      setError(err.message || 'Failed to save draft');
    }
  };

  const handleApprove = async () => {
    setError(null);
    setValidationErrors([]);

    // Client-side validation before sending
    const errors: string[] = [];
    const filledJobRoles = formData.jobRoles.filter((r) => r.trim());

    if (!formData.programTitle || formData.programTitle.length < 5) {
      errors.push('Program title must be at least 5 characters');
    }
    if (!formData.programDescription || formData.programDescription.length < 50) {
      errors.push('Program description must be at least 50 characters');
    }
    if (!formData.targetLearner || formData.targetLearner.length < 20) {
      errors.push('Target learner description must be at least 20 characters');
    }
    if (!formData.programPurpose || formData.programPurpose.length < 20) {
      errors.push('Program purpose must be at least 20 characters');
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
      // First save the current form data
      await submitStep1.mutateAsync({
        id: workflow._id,
        data: {
          ...formData,
          jobRoles: filledJobRoles,
          totalHours: calculatedHours.total,
        },
      });

      // Then approve
      await approveStep1.mutateAsync(workflow._id);
      onComplete();
    } catch (err: any) {
      console.error('Failed to approve Step 1:', err);
      // Handle different error formats
      let errorMessage = 'Failed to approve Step 1';
      if (typeof err === 'string') {
        errorMessage = err;
      } else if (err?.message && typeof err.message === 'string') {
        errorMessage = err.message;
      } else if (err?.error && typeof err.error === 'string') {
        errorMessage = err.error;
      }
      setError(errorMessage);

      // Try to parse detailed errors from response
      if (err?.details && Array.isArray(err.details)) {
        setValidationErrors(err.details);
      }
    }
  };

  const addJobRole = () => {
    setFormData((prev) => ({
      ...prev,
      jobRoles: [...prev.jobRoles, ''],
    }));
  };

  const updateJobRole = (index: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      jobRoles: prev.jobRoles.map((role, i) => (i === index ? value : role)),
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

  const isComplete = workflow.step1?.completenessScore && workflow.step1.completenessScore >= 70;
  const isApproved = !!workflow.step1?.approvedAt;

  return (
    <div className="p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Program Title */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Program Title <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={formData.programTitle}
            onChange={(e) => setFormData((prev) => ({ ...prev, programTitle: e.target.value }))}
            placeholder="e.g., Professional Certificate in Data Science"
            className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            required
            minLength={5}
          />
        </div>

        {/* Program Description */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Program Description <span className="text-red-400">*</span>
          </label>
          <textarea
            value={formData.programDescription}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, programDescription: e.target.value }))
            }
            placeholder="Describe the program's scope, focus areas, and what learners will gain..."
            rows={4}
            className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 resize-none"
            required
            minLength={50}
          />
          <p className="text-xs text-slate-500 mt-1">
            {formData.programDescription.length}/50 minimum characters
          </p>
        </div>

        {/* Academic Level */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
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
                    ? 'bg-cyan-500/20 border-cyan-500 text-white'
                    : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                }`}
              >
                <p className="font-medium">{level.label}</p>
                <p className="text-xs mt-1 opacity-70">{level.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Credit System & Credits */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Credit System <span className="text-red-400">*</span>
            </label>
            <select
              value={formData.creditSystem}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, creditSystem: e.target.value as CreditSystem }))
              }
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
            >
              {CREDIT_SYSTEMS.map((system) => (
                <option key={system.value} value={system.value}>
                  {system.label} ({system.hoursPerCredit} hrs/credit)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Total Credits <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              value={formData.credits}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, credits: parseInt(e.target.value) || 0 }))
              }
              min={10}
              max={360}
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Calculated Hours Display */}
        <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
          <h4 className="text-sm font-medium text-slate-300 mb-3">Calculated Learning Hours</h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-2xl font-bold text-cyan-400">{calculatedHours.total}</p>
              <p className="text-xs text-slate-500">Total Hours</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-400">{calculatedHours.contact}</p>
              <p className="text-xs text-slate-500">Contact Hours</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-400">{calculatedHours.selfStudy}</p>
              <p className="text-xs text-slate-500">Self-Study Hours</p>
            </div>
          </div>
        </div>

        {/* Target Learner */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Target Learner Profile <span className="text-red-400">*</span>
          </label>
          <textarea
            value={formData.targetLearner}
            onChange={(e) => setFormData((prev) => ({ ...prev, targetLearner: e.target.value }))}
            placeholder="Describe your ideal learner: their background, experience level, and goals..."
            rows={3}
            className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
            required
          />
        </div>

        {/* Delivery Mode */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Delivery Mode <span className="text-red-400">*</span>
          </label>
          <div className="grid grid-cols-3 gap-3">
            {DELIVERY_MODES.map((mode) => (
              <button
                key={mode.value}
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, deliveryMode: mode.value }))}
                className={`p-3 rounded-lg border text-center transition-all ${
                  formData.deliveryMode === mode.value
                    ? 'bg-cyan-500/20 border-cyan-500 text-white'
                    : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        {/* Program Purpose */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Program Purpose <span className="text-red-400">*</span>
          </label>
          <textarea
            value={formData.programPurpose}
            onChange={(e) => setFormData((prev) => ({ ...prev, programPurpose: e.target.value }))}
            placeholder="What is the overarching purpose of this program? What gap does it fill?"
            rows={3}
            className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
            required
          />
        </div>

        {/* Job Roles */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Target Job Roles <span className="text-red-400">*</span>
            <span className="text-slate-500 font-normal ml-2">(minimum 2)</span>
          </label>
          <div className="space-y-2">
            {formData.jobRoles.map((role, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={role}
                  onChange={(e) => updateJobRole(index, e.target.value)}
                  placeholder={`e.g., ${index === 0 ? 'Data Scientist' : index === 1 ? 'Machine Learning Engineer' : 'Job Role'}`}
                  className="flex-1 px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
                {formData.jobRoles.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeJobRole(index)}
                    className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            onClick={addJobRole}
            className="mt-2 text-sm text-cyan-400 hover:text-cyan-300"
          >
            + Add another job role
          </button>
        </div>

        {/* Error Display */}
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

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-700">
          <div>
            {workflow.step1?.completenessScore !== undefined && (
              <div className="flex items-center gap-2">
                <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      workflow.step1.completenessScore >= 70 ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${workflow.step1.completenessScore}%` }}
                  />
                </div>
                <span className="text-sm text-slate-400">
                  {workflow.step1.completenessScore}% complete
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitStep1.isPending}
              className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {submitStep1.isPending ? 'Saving...' : 'Save Draft'}
            </button>
            {isComplete && !isApproved && (
              <button
                type="button"
                onClick={handleApprove}
                disabled={approveStep1.isPending}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-medium rounded-lg transition-all disabled:opacity-50"
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
