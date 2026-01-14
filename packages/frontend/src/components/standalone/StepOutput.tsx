'use client';

import { Download, Copy, Check, AlertCircle, Loader2, RefreshCw, BookOpen, Clock, Star, GraduationCap } from 'lucide-react';
import { useState } from 'react';

// Output display states per requirements 3.2, 3.3, 3.4
export type OutputState = 'idle' | 'loading' | 'success' | 'error';

export interface StepOutputData {
  stepNumber: number;
  stepName: string;
  content: any;
  generatedAt: string;
}

export interface StepOutputProps {
  state: OutputState;
  output: StepOutputData | null;
  error: string | null;
  onRetry?: () => void;
  onDownload?: () => void;
}

// Helper to format reading time
const formatReadingTime = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

// Helper to get complexity badge color - updated for teal palette
const getComplexityColor = (level: string): string => {
  switch (level?.toLowerCase()) {
    case 'introductory':
    case 'beginner':
      return 'bg-sage-100 text-sage-700 border-sage-200';
    case 'intermediate':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'advanced':
      return 'bg-rose-100 text-rose-700 border-rose-200';
    default:
      return 'bg-teal-100 text-teal-700 border-teal-200';
  }
};

// Helper to get importance badge color
const getImportanceColor = (importance: string): string => {
  return importance?.toLowerCase() === 'essential' 
    ? 'bg-teal-100 text-teal-700 border-teal-200'
    : 'bg-teal-50 text-teal-600 border-teal-200';
};

// Render KSC Framework (Step 2)
const renderKSCFramework = (content: any) => {
  const { knowledgeItems = [], skillItems = [], competencyItems = [] } = content;
  
  const renderKSCItem = (item: any, type: string, color: string) => (
    <div key={item.id} className={`bg-white rounded-lg p-4 border-l-4 ${color} hover:shadow-teal-sm transition-colors border border-teal-100`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs font-mono text-teal-500">{item.id}</span>
        <span className={`px-2 py-0.5 text-xs rounded-full border ${getImportanceColor(item.importance)}`}>
          {item.importance || 'Essential'}
        </span>
      </div>
      <h4 className="text-teal-800 font-medium mb-2">{item.statement}</h4>
      <p className="text-teal-600 text-sm leading-relaxed">{item.description}</p>
      {item.source && (
        <p className="text-teal-500 text-xs mt-2 italic">Source: {item.source}</p>
      )}
    </div>
  );

  return (
    <div className="space-y-8">
      {knowledgeItems.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold text-teal-600 mb-4">📚 Knowledge Items ({knowledgeItems.length})</h3>
          <p className="text-teal-500 text-sm mb-4">Theoretical understanding - what learners need to UNDERSTAND</p>
          <div className="grid gap-4">{knowledgeItems.map((item: any) => renderKSCItem(item, 'knowledge', 'border-teal-500'))}</div>
        </section>
      )}
      {skillItems.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold text-sage-600 mb-4">🛠️ Skill Items ({skillItems.length})</h3>
          <p className="text-teal-500 text-sm mb-4">Practical abilities - what learners need to be able to DO</p>
          <div className="grid gap-4">{skillItems.map((item: any) => renderKSCItem(item, 'skill', 'border-sage-500'))}</div>
        </section>
      )}
      {competencyItems.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold text-mint-600 mb-4">🎯 Competency Items ({competencyItems.length})</h3>
          <p className="text-teal-500 text-sm mb-4">Professional behaviors - how learners need to BEHAVE</p>
          <div className="grid gap-4">{competencyItems.map((item: any) => renderKSCItem(item, 'competency', 'border-mint-500'))}</div>
        </section>
      )}
    </div>
  );
};

// Render PLOs (Step 3)
const renderPLOs = (content: any) => {
  const { outcomes = [], bloomDistribution = {} } = content;
  
  const bloomColors: Record<string, string> = {
    remember: 'bg-teal-100 text-teal-700',
    understand: 'bg-teal-200/60 text-teal-700',
    apply: 'bg-sage-100 text-sage-700',
    analyze: 'bg-amber-100 text-amber-700',
    evaluate: 'bg-orange-100 text-orange-700',
    create: 'bg-rose-100 text-rose-700',
  };

  return (
    <div className="space-y-8">
      <section>
        <h3 className="text-lg font-semibold text-teal-600 mb-4 flex items-center gap-2">
          <GraduationCap className="w-5 h-5" />
          Program Learning Outcomes ({outcomes.length})
        </h3>
        <div className="space-y-4">
          {outcomes.map((plo: any, index: number) => (
            <div key={plo.id || index} className="bg-white rounded-lg p-4 border border-teal-200/50 shadow-teal-sm">
              <div className="flex items-start gap-3">
                <span className="px-3 py-1 bg-teal-100 text-teal-700 rounded-lg font-bold text-sm shrink-0">
                  {plo.code || `PLO${index + 1}`}
                </span>
                <div className="flex-1">
                  <p className="text-teal-800 font-medium leading-relaxed">{plo.statement}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${bloomColors[plo.bloomLevel?.toLowerCase()] || bloomColors.apply}`}>
                      {plo.bloomLevel || 'Apply'} - {plo.verb}
                    </span>
                    {plo.measurable && <span className="text-sage-600 text-xs">✓ Measurable</span>}
                    {plo.assessable && <span className="text-teal-600 text-xs">✓ Assessable</span>}
                  </div>
                  {plo.assessmentAlignment && (
                    <p className="text-teal-600 text-sm mt-2">Assessment: {plo.assessmentAlignment}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
      {Object.keys(bloomDistribution).length > 0 && (
        <section>
          <h4 className="text-md font-semibold text-teal-700 mb-3">Bloom's Taxonomy Distribution</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(bloomDistribution).map(([level, count]) => (
              <span key={level} className={`px-3 py-1 rounded-full text-sm ${bloomColors[level] || 'bg-teal-100 text-teal-700'}`}>
                {level}: {count as number}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

// Render Course Framework (Step 4)
const renderCourseFramework = (content: any) => {
  const { modules = [], totalHours = 0 } = content;
  
  return (
    <div className="space-y-6">
      <div className="bg-teal-100 rounded-lg p-4 border border-teal-300">
        <p className="text-teal-700 font-semibold">Total Program Hours: {totalHours} hours</p>
        <p className="text-teal-600 text-sm">{modules.length} modules</p>
      </div>
      {modules.map((module: any, index: number) => (
        <div key={module.id || index} className="bg-white rounded-lg p-5 border border-teal-200/50 shadow-teal-sm">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <span className="text-xs font-mono text-teal-500">{module.moduleCode}</span>
              <h4 className="text-lg font-semibold text-teal-800">{module.title}</h4>
            </div>
            <span className="px-3 py-1 bg-teal-100 text-teal-700 rounded-lg text-sm shrink-0">
              {module.totalHours}h total
            </span>
          </div>
          <p className="text-teal-600 mb-4">{module.description}</p>
          <div className="flex gap-4 text-sm text-teal-500 mb-4">
            <span>Contact: {module.contactHours}h</span>
            <span>Independent: {module.independentHours}h</span>
          </div>
          {module.mlos?.length > 0 && (
            <div className="mt-4">
              <h5 className="text-sm font-semibold text-teal-700 mb-2">Module Learning Outcomes:</h5>
              <ul className="space-y-2">
                {module.mlos.map((mlo: any, mloIndex: number) => (
                  <li key={mlo.id || mloIndex} className="flex items-start gap-2 text-sm">
                    <span className="text-teal-500 shrink-0">•</span>
                    <span className="text-teal-700">{mlo.statement}</span>
                    <span className="text-teal-500 text-xs shrink-0">({mlo.bloomLevel})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {module.topics?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {module.topics.map((topic: string, topicIndex: number) => (
                <span key={topicIndex} className="px-2 py-1 bg-teal-50 text-teal-600 rounded text-xs border border-teal-200">
                  {topic}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// Render Sources (Step 5)
const renderSources = (content: any) => {
  const { sources = [] } = content;
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-teal-600 mb-4">📖 Academic Sources ({sources.length})</h3>
      {sources.map((source: any, index: number) => (
        <div key={source.id || index} className="bg-white rounded-lg p-4 border border-teal-200/50 shadow-teal-sm">
          <p className="text-teal-800 leading-relaxed">{source.apaCitation || source.citation}</p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="px-2 py-1 bg-teal-100 text-teal-700 text-xs rounded">{source.sourceType || 'Academic'}</span>
            <span className="text-teal-500 text-xs">{source.year}</span>
            {source.isRecent && <span className="text-sage-600 text-xs">✓ Recent</span>}
            {source.doi && <span className="text-teal-500 text-xs">DOI: {source.doi}</span>}
          </div>
        </div>
      ))}
    </div>
  );
};

// Render Assessments (Step 7)
const renderAssessments = (content: any) => {
  const { formativeAssessments = [], summativeAssessments = [], questionBank = [] } = content;
  return (
    <div className="space-y-8">
      {formativeAssessments.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold text-sage-600 mb-4">📝 Formative Assessments ({formativeAssessments.length})</h3>
          <div className="space-y-3">
            {formativeAssessments.map((assessment: any, index: number) => (
              <div key={assessment.id || index} className="bg-white rounded-lg p-4 border-l-4 border-sage-500 border border-teal-100">
                <h4 className="text-teal-800 font-medium">{assessment.title}</h4>
                <p className="text-teal-600 text-sm mt-1">{assessment.description}</p>
                <span className="text-sage-600 text-xs mt-2 inline-block">{assessment.type}</span>
              </div>
            ))}
          </div>
        </section>
      )}
      {summativeAssessments.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold text-amber-600 mb-4">🎯 Summative Assessments ({summativeAssessments.length})</h3>
          <div className="space-y-3">
            {summativeAssessments.map((assessment: any, index: number) => (
              <div key={assessment.id || index} className="bg-white rounded-lg p-4 border-l-4 border-amber-500 border border-teal-100">
                <h4 className="text-teal-800 font-medium">{assessment.title}</h4>
                <p className="text-teal-600 text-sm mt-1">{assessment.description}</p>
                <span className="text-amber-600 text-xs mt-2 inline-block">{assessment.type}</span>
              </div>
            ))}
          </div>
        </section>
      )}
      {questionBank.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold text-teal-600 mb-4">❓ Question Bank ({questionBank.length} questions)</h3>
          <div className="space-y-4">
            {questionBank.map((q: any, index: number) => (
              <div key={q.id || index} className="bg-white rounded-lg p-4 border border-teal-200/50 shadow-teal-sm">
                <p className="text-teal-800 font-medium mb-3">Q{index + 1}: {q.stem}</p>
                <div className="space-y-2 ml-4">
                  {q.options?.map((opt: any) => (
                    <div key={opt.label} className={`flex items-start gap-2 p-2 rounded ${opt.isCorrect ? 'bg-sage-50 border border-sage-200' : ''}`}>
                      <span className="font-mono text-teal-500">{opt.label}.</span>
                      <span className={opt.isCorrect ? 'text-sage-700' : 'text-teal-700'}>{opt.text}</span>
                      {opt.isCorrect && <span className="text-sage-600 text-xs ml-auto">✓ Correct</span>}
                    </div>
                  ))}
                </div>
                {q.rationale && <p className="text-teal-600 text-sm mt-3 italic">💡 {q.rationale}</p>}
                <div className="flex gap-2 mt-2">
                  <span className="text-xs px-2 py-1 bg-teal-100 rounded text-teal-700">{q.bloomLevel}</span>
                  <span className="text-xs px-2 py-1 bg-teal-100 rounded text-teal-700">{q.difficulty}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

// Render Case Studies (Step 8)
const renderCaseStudies = (content: any) => {
  const { caseStudies = [] } = content;
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-teal-600 mb-4">📋 Case Studies ({caseStudies.length})</h3>
      {caseStudies.map((cs: any, index: number) => (
        <div key={cs.id || index} className="bg-white rounded-lg p-5 border border-teal-200/50 shadow-teal-sm">
          <h4 className="text-xl font-semibold text-teal-800 mb-2">{cs.title}</h4>
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="px-2 py-1 bg-teal-100 text-teal-700 text-xs rounded">{cs.industryContext}</span>
            <span className="px-2 py-1 bg-sage-100 text-sage-700 text-xs rounded">{cs.organizationName}</span>
            <span className={`px-2 py-1 text-xs rounded ${getComplexityColor(cs.difficultyLevel)}`}>{cs.difficultyLevel}</span>
          </div>
          <div className="bg-teal-50 rounded-lg p-4 border border-teal-100">
            <p className="text-teal-700 leading-relaxed whitespace-pre-wrap">{cs.scenario}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

// Render Glossary (Step 9)
const renderGlossary = (content: any) => {
  const { terms = [] } = content;
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-teal-600 mb-4">📚 Glossary ({terms.length} terms)</h3>
      <div className="grid gap-4">
        {terms.map((term: any, index: number) => (
          <div key={term.id || index} className="bg-white rounded-lg p-4 border border-teal-200/50 shadow-teal-sm">
            <h4 className="text-lg font-semibold text-teal-600">{term.term}</h4>
            <p className="text-teal-700 mt-2">{term.definition}</p>
            {term.exampleSentence && <p className="text-teal-600 text-sm mt-2 italic">Example: "{term.exampleSentence}"</p>}
            {term.relatedTerms?.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="text-teal-500 text-xs">Related:</span>
                {term.relatedTerms.map((rt: string, rtIndex: number) => (
                  <span key={rtIndex} className="px-2 py-0.5 bg-teal-100 text-teal-600 rounded text-xs">{rt}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Render Lesson Plans (Step 10)
const renderLessonPlans = (content: any) => {
  const { lessonPlans = [] } = content;
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-teal-600 mb-4">📅 Lesson Plans ({lessonPlans.length})</h3>
      {lessonPlans.map((lp: any, index: number) => (
        <div key={lp.id || index} className="bg-white rounded-lg p-5 border border-teal-200/50 shadow-teal-sm">
          <div className="flex items-start justify-between gap-4 mb-4">
            <h4 className="text-lg font-semibold text-teal-800">{lp.title}</h4>
            <span className="px-3 py-1 bg-teal-100 text-teal-700 rounded-lg text-sm shrink-0">{lp.duration} min</span>
          </div>
          {lp.objectives?.length > 0 && (
            <div className="mb-4">
              <h5 className="text-sm font-semibold text-teal-700 mb-2">🎯 Learning Objectives:</h5>
              <ul className="space-y-1">{lp.objectives.map((obj: string, i: number) => <li key={i} className="text-teal-600 text-sm flex items-start gap-2"><span className="text-teal-500">•</span>{obj}</li>)}</ul>
            </div>
          )}
          {lp.activities?.length > 0 && (
            <div className="mb-4">
              <h5 className="text-sm font-semibold text-teal-700 mb-2">📝 Activities:</h5>
              <ul className="space-y-1">{lp.activities.map((act: string, i: number) => <li key={i} className="text-teal-600 text-sm flex items-start gap-2"><span className="text-sage-500">•</span>{act}</li>)}</ul>
            </div>
          )}
          {lp.materials?.length > 0 && (
            <div className="mb-4">
              <h5 className="text-sm font-semibold text-teal-700 mb-2">📦 Materials:</h5>
              <div className="flex flex-wrap gap-2">{lp.materials.map((mat: string, i: number) => <span key={i} className="px-2 py-1 bg-teal-100 text-teal-600 rounded text-xs">{mat}</span>)}</div>
            </div>
          )}
          {lp.assessment && <p className="text-teal-600 text-sm"><span className="text-amber-600 font-medium">Assessment:</span> {lp.assessment}</p>}
        </div>
      ))}
    </div>
  );
};

// Reading Lists renderer (Step 6)
const renderReadingLists = (content: any) => {
  const { coreReadings = [], supplementaryReadings = [] } = content;
  
  return (
    <div className="space-y-8">
      {coreReadings.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold text-teal-600 mb-4 flex items-center gap-2">
            <Star className="w-5 h-5" />
            Core Readings ({coreReadings.length})
          </h3>
          <p className="text-teal-500 text-sm mb-4">Essential readings that form the foundation of the curriculum.</p>
          <div className="space-y-4">
            {coreReadings.map((reading: any, index: number) => (
              <div key={reading.id || index} className="bg-white rounded-lg p-4 border border-teal-200/50 hover:border-teal-300 transition-colors shadow-teal-sm">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-teal-100 rounded-lg shrink-0">
                    <BookOpen className="w-5 h-5 text-teal-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-teal-800 font-medium leading-relaxed">{reading.citation}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <span className={`px-2 py-1 text-xs rounded-full border ${getComplexityColor(reading.complexityLevel)}`}>{reading.complexityLevel || 'Intermediate'}</span>
                      <span className="flex items-center gap-1 text-teal-500 text-xs"><Clock className="w-3 h-3" />{formatReadingTime(reading.estimatedMinutes || 60)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      {supplementaryReadings.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold text-sage-600 mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Supplementary Readings ({supplementaryReadings.length})
          </h3>
          <p className="text-teal-500 text-sm mb-4">Additional resources for deeper understanding and extended learning.</p>
          <div className="space-y-3">
            {supplementaryReadings.map((reading: any, index: number) => (
              <div key={reading.id || index} className="bg-teal-50/50 rounded-lg p-4 border border-teal-200/30 hover:border-sage-300 transition-colors">
                <p className="text-teal-700 leading-relaxed">{reading.citation}</p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className={`px-2 py-1 text-xs rounded-full border ${getComplexityColor(reading.complexityLevel)}`}>{reading.complexityLevel || 'Intermediate'}</span>
                  <span className="flex items-center gap-1 text-teal-500 text-xs"><Clock className="w-3 h-3" />{formatReadingTime(reading.estimatedMinutes || 45)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

// Main content renderer based on step number
const renderStepContent = (stepNumber: number, content: any) => {
  switch (stepNumber) {
    case 2: return renderKSCFramework(content);
    case 3: return renderPLOs(content);
    case 4: return renderCourseFramework(content);
    case 5: return renderSources(content);
    case 6: return renderReadingLists(content);
    case 7: return renderAssessments(content);
    case 8: return renderCaseStudies(content);
    case 9: return renderGlossary(content);
    case 10: return renderLessonPlans(content);
    default:
      return (
        <pre className="text-teal-700 text-sm whitespace-pre-wrap font-mono">
          {typeof content === 'string' ? content : JSON.stringify(content, null, 2)}
        </pre>
      );
  }
};

export function StepOutput({ state, output, error, onRetry, onDownload }: StepOutputProps) {
  const [copied, setCopied] = useState(false);

  // Handle copy to clipboard
  const handleCopy = async () => {
    if (!output?.content) return;
    
    try {
      const text = typeof output.content === 'string' 
        ? output.content 
        : JSON.stringify(output.content, null, 2);
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Idle state - nothing to display
  if (state === 'idle') {
    return null;
  }

  // Loading state - Requirement 3.3
  if (state === 'loading') {
    return (
      <div 
        className="bg-white rounded-xl border border-teal-200/50 p-4 sm:p-6 shadow-teal-sm"
        role="status"
        aria-live="polite"
      >
        <div className="flex flex-col items-center justify-center py-8 sm:py-12">
          <Loader2 className="w-10 h-10 sm:w-12 sm:h-12 text-teal-500 animate-spin mb-4" aria-hidden="true" />
          <h3 className="text-base sm:text-lg font-medium text-teal-800 mb-2">Generating Content...</h3>
          <p className="text-teal-600 text-xs sm:text-sm text-center max-w-md px-4">
            This may take a moment. The AI is processing your request.
          </p>
          <span className="sr-only">Please wait while content is being generated</span>
        </div>
      </div>
    );
  }

  // Error state - Requirement 3.4
  if (state === 'error') {
    return (
      <div 
        className="bg-rose-50 border border-rose-200 rounded-xl p-4 sm:p-6"
        role="alert"
        aria-live="assertive"
      >
        <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
          <div className="p-2 bg-rose-100 rounded-lg shrink-0">
            <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-rose-500" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h3 className="text-base sm:text-lg font-medium text-rose-600 mb-1">Generation Failed</h3>
            <p className="text-rose-500 text-xs sm:text-sm mb-4">
              {error || 'An unexpected error occurred. Please try again.'}
            </p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="px-4 py-2 bg-rose-100 hover:bg-rose-200 text-rose-600 rounded-lg transition-colors text-sm font-medium flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:ring-offset-2"
                aria-label="Retry generation"
              >
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
                Try Again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Success state - Requirement 3.2
  if (state === 'success' && output) {
    return (
      <div className="bg-white rounded-xl border border-teal-200/50 p-4 sm:p-6 shadow-teal-sm">
        {/* Header with actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-6">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-teal-800">
              Generated Output: {output.stepName}
            </h2>
            <p className="text-xs text-teal-500 mt-1">
              <time dateTime={output.generatedAt}>
                Generated at: {new Date(output.generatedAt).toLocaleString()}
              </time>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Copy button */}
            <button
              onClick={handleCopy}
              className="p-2 bg-teal-100 hover:bg-teal-200 text-teal-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2"
              title={copied ? 'Copied!' : 'Copy to clipboard'}
              aria-label={copied ? 'Content copied to clipboard' : 'Copy content to clipboard'}
            >
              {copied ? (
                <Check className="w-4 h-4 text-sage-600" aria-hidden="true" />
              ) : (
                <Copy className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
            {/* Download button - Requirement 6.1 */}
            {onDownload && (
              <button
                onClick={onDownload}
                className="px-3 sm:px-4 py-2 bg-gradient-to-r from-teal-400 to-sage-400 hover:from-teal-300 hover:to-sage-300 text-white rounded-lg transition-colors text-sm flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 shadow-teal-md"
                aria-label="Download content as Word document"
              >
                <Download className="w-4 h-4" aria-hidden="true" />
                <span className="hidden sm:inline">Download as Word</span>
                <span className="sm:hidden">Download</span>
              </button>
            )}
          </div>
        </div>

        {/* Content display - Human readable format */}
        <div 
          className="overflow-auto max-h-[600px] sm:max-h-[700px]"
          role="region"
          aria-label="Generated content"
          tabIndex={0}
        >
          {renderStepContent(output.stepNumber, output.content)}
        </div>
        
        {/* Accessibility announcement for copy */}
        {copied && (
          <div className="sr-only" role="status" aria-live="polite">
            Content copied to clipboard
          </div>
        )}
      </div>
    );
  }

  return null;
}

// Export state type for external use
export { type OutputState as StepOutputState };
