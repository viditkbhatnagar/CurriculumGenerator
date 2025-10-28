'use client';

interface ScenarioDisplayProps {
  context: string;
  currentSituation: string;
  learningObjectives: string[];
}

export function ScenarioDisplay({
  context,
  currentSituation,
  learningObjectives,
}: ScenarioDisplayProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Context</h3>
        <p className="text-gray-900">{context}</p>
      </div>

      <div className="border-t border-gray-200 pt-4">
        <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">
          Current Situation
        </h3>
        <p className="text-gray-900 text-lg">{currentSituation}</p>
      </div>

      {learningObjectives.length > 0 && (
        <div className="border-t border-gray-200 pt-4">
          <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">
            Learning Objectives
          </h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
            {learningObjectives.map((objective, index) => (
              <li key={index}>{objective}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
