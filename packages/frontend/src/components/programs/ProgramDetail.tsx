'use client';

import { useProgram } from '@/hooks/usePrograms';

export function ProgramDetail({ programId }: { programId: string }) {
  const { data: program, isLoading, error } = useProgram(programId);

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
        <p className="text-red-800">Error loading program: {error.message}</p>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-500">Program not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Program Information
        </h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Program Name</dt>
            <dd className="mt-1 text-sm text-gray-900">{program.program_name}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Qualification Level</dt>
            <dd className="mt-1 text-sm text-gray-900">{program.qualification_level}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Qualification Type</dt>
            <dd className="mt-1 text-sm text-gray-900">{program.qualification_type}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Total Credits</dt>
            <dd className="mt-1 text-sm text-gray-900">{program.total_credits}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Industry Sector</dt>
            <dd className="mt-1 text-sm text-gray-900">{program.industry_sector}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Status</dt>
            <dd className="mt-1 text-sm text-gray-900">{program.status}</dd>
          </div>
        </dl>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Modules</h2>
        {program.modules && program.modules.length > 0 ? (
          <div className="space-y-4">
            {program.modules.map((module) => (
              <div key={module.id} className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900">
                  {module.module_code}: {module.module_title}
                </h3>
                <p className="text-sm text-gray-600 mt-2">{module.module_aim}</p>
                <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                  <span>{module.hours} hours</span>
                  <span>•</span>
                  <span>{module.core_elective}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No modules found</p>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Learning Outcomes</h2>
        {program.learning_outcomes && program.learning_outcomes.length > 0 ? (
          <ul className="space-y-2">
            {program.learning_outcomes.map((outcome, index) => (
              <li key={outcome.id} className="flex">
                <span className="font-medium text-gray-900 mr-2">{index + 1}.</span>
                <span className="text-gray-700">{outcome.outcome_text}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">No learning outcomes found</p>
        )}
      </div>
    </div>
  );
}
