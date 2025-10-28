'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ProgramFormData {
  programName: string;
  qualificationLevel: string;
  qualificationType: string;
  totalCredits: number;
  industrySector: string;
}

interface ProgramCreateFormProps {
  onSuccess?: (programId: string) => void;
  onCancel?: () => void;
}

const QUALIFICATION_LEVELS = [
  'Certificate I',
  'Certificate II',
  'Certificate III',
  'Certificate IV',
  'Diploma',
  'Advanced Diploma',
  'Graduate Certificate',
  'Graduate Diploma',
  'Bachelor Degree',
  'Master Degree',
];

const QUALIFICATION_TYPES = [
  'Vocational Education and Training (VET)',
  'Higher Education',
  'Professional Certification',
  'Micro-credential',
  'Short Course',
];

const INDUSTRY_SECTORS = [
  'Business and Management',
  'Information Technology',
  'Healthcare',
  'Education and Training',
  'Engineering',
  'Hospitality and Tourism',
  'Construction',
  'Finance and Accounting',
  'Marketing and Communications',
  'Human Resources',
  'Legal Services',
  'Creative Industries',
  'Agriculture',
  'Manufacturing',
  'Retail',
  'Other',
];

export function ProgramCreateForm({ onSuccess, onCancel }: ProgramCreateFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<ProgramFormData>({
    programName: '',
    qualificationLevel: '',
    qualificationType: '',
    totalCredits: 120,
    industrySector: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof ProgramFormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof ProgramFormData, string>> = {};

    if (!formData.programName.trim()) {
      newErrors.programName = 'Program name is required';
    } else if (formData.programName.length < 3) {
      newErrors.programName = 'Program name must be at least 3 characters';
    } else if (formData.programName.length > 255) {
      newErrors.programName = 'Program name must not exceed 255 characters';
    }

    if (!formData.qualificationLevel) {
      newErrors.qualificationLevel = 'Qualification level is required';
    }

    if (!formData.qualificationType) {
      newErrors.qualificationType = 'Qualification type is required';
    }

    if (!formData.totalCredits || formData.totalCredits <= 0) {
      newErrors.totalCredits = 'Total credits must be greater than 0';
    } else if (formData.totalCredits > 1000) {
      newErrors.totalCredits = 'Total credits must not exceed 1000';
    }

    if (!formData.industrySector) {
      newErrors.industrySector = 'Industry sector is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/programs/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          program_name: formData.programName,
          qualification_level: formData.qualificationLevel,
          qualification_type: formData.qualificationType,
          total_credits: formData.totalCredits,
          industry_sector: formData.industrySector,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: 'Failed to create program' } }));
        throw new Error(errorData.error?.message || 'Failed to create program');
      }

      const result = await response.json();
      const programId = result.data?.id || result.data?.programId;

      if (onSuccess) {
        onSuccess(programId);
      } else {
        router.push(`/admin/programs/${programId}`);
      }
    } catch (error: any) {
      console.error('Failed to create program:', error);
      setSubmitError(error.message || 'Failed to create program. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: keyof ProgramFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {submitError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{submitError}</p>
        </div>
      )}

      {/* Program Name */}
      <div>
        <label htmlFor="programName" className="block text-sm font-medium text-gray-700 mb-1">
          Program Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="programName"
          value={formData.programName}
          onChange={(e) => handleChange('programName', e.target.value)}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.programName ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="e.g., Certificate IV in Business Administration"
          disabled={isSubmitting}
        />
        {errors.programName && (
          <p className="mt-1 text-sm text-red-600">{errors.programName}</p>
        )}
      </div>

      {/* Qualification Level */}
      <div>
        <label htmlFor="qualificationLevel" className="block text-sm font-medium text-gray-700 mb-1">
          Qualification Level <span className="text-red-500">*</span>
        </label>
        <select
          id="qualificationLevel"
          value={formData.qualificationLevel}
          onChange={(e) => handleChange('qualificationLevel', e.target.value)}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.qualificationLevel ? 'border-red-500' : 'border-gray-300'
          }`}
          disabled={isSubmitting}
        >
          <option value="">Select qualification level</option>
          {QUALIFICATION_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
        {errors.qualificationLevel && (
          <p className="mt-1 text-sm text-red-600">{errors.qualificationLevel}</p>
        )}
      </div>

      {/* Qualification Type */}
      <div>
        <label htmlFor="qualificationType" className="block text-sm font-medium text-gray-700 mb-1">
          Qualification Type <span className="text-red-500">*</span>
        </label>
        <select
          id="qualificationType"
          value={formData.qualificationType}
          onChange={(e) => handleChange('qualificationType', e.target.value)}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.qualificationType ? 'border-red-500' : 'border-gray-300'
          }`}
          disabled={isSubmitting}
        >
          <option value="">Select qualification type</option>
          {QUALIFICATION_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        {errors.qualificationType && (
          <p className="mt-1 text-sm text-red-600">{errors.qualificationType}</p>
        )}
      </div>

      {/* Total Credits */}
      <div>
        <label htmlFor="totalCredits" className="block text-sm font-medium text-gray-700 mb-1">
          Total Credits <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          id="totalCredits"
          value={formData.totalCredits}
          onChange={(e) => handleChange('totalCredits', parseInt(e.target.value) || 0)}
          min="1"
          max="1000"
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.totalCredits ? 'border-red-500' : 'border-gray-300'
          }`}
          disabled={isSubmitting}
        />
        {errors.totalCredits && (
          <p className="mt-1 text-sm text-red-600">{errors.totalCredits}</p>
        )}
        <p className="mt-1 text-sm text-gray-500">Typically 120 hours for standard programs</p>
      </div>

      {/* Industry Sector */}
      <div>
        <label htmlFor="industrySector" className="block text-sm font-medium text-gray-700 mb-1">
          Industry Sector <span className="text-red-500">*</span>
        </label>
        <select
          id="industrySector"
          value={formData.industrySector}
          onChange={(e) => handleChange('industrySector', e.target.value)}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.industrySector ? 'border-red-500' : 'border-gray-300'
          }`}
          disabled={isSubmitting}
        >
          <option value="">Select industry sector</option>
          {INDUSTRY_SECTORS.map((sector) => (
            <option key={sector} value={sector}>
              {sector}
            </option>
          ))}
        </select>
        {errors.industrySector && (
          <p className="mt-1 text-sm text-red-600">{errors.industrySector}</p>
        )}
      </div>

      {/* Form Actions */}
      <div className="flex justify-end space-x-4 pt-4 border-t">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        >
          {isSubmitting ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Creating...
            </>
          ) : (
            'Create Program'
          )}
        </button>
      </div>
    </form>
  );
}
