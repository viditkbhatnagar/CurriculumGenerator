'use client';

interface FollowUpQuestionsProps {
  questions: string[];
  onQuestionClick: (question: string) => void;
}

export function FollowUpQuestions({ questions, onQuestionClick }: FollowUpQuestionsProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">Follow-up Questions</h3>
      <div className="flex flex-wrap gap-2">
        {questions.map((question, index) => (
          <button
            key={index}
            onClick={() => onQuestionClick(question)}
            className="text-sm bg-white border border-blue-300 text-blue-700 hover:bg-blue-50 rounded-full px-4 py-2 transition-colors"
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
}
