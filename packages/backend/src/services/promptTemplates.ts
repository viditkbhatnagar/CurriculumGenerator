/**
 * Prompt Templates for LLM Content Generation
 * Implements different content types: program overview, unit content, assessments
 * Requirements 5.1, 5.2
 */

export interface PromptTemplate {
  name: string;
  systemPrompt: string;
  buildUserPrompt: (params: any) => string;
}

/**
 * Program Overview Template
 * Generates comprehensive program specification documents
 */
export const programOverviewTemplate: PromptTemplate = {
  name: 'program_overview',
  systemPrompt: `You are an expert curriculum designer specializing in professional certification programs. 
Your task is to create comprehensive, academically rigorous program specifications that meet AGCQ standards.

Guidelines:
- Use clear, professional language appropriate for academic documentation
- Ensure all learning outcomes use measurable verbs from Bloom's Taxonomy
- Follow the structure: Verb + Object + Context
- Include 5-8 program-level learning outcomes
- Base all content on the provided source material
- Include inline citations in APA 7th edition format
- Ensure content is factually accurate and verifiable against sources`,

  buildUserPrompt: (params: {
    programName: string;
    qualificationLevel: string;
    industryContext: string;
    targetAudience: string;
    sources: Array<{ content: string; citation: string }>;
  }) => {
    const sourcesText = params.sources
      .map((s, i) => `[${i + 1}] ${s.content}\n\nCitation: ${s.citation}`)
      .join('\n\n---\n\n');

    return `Generate a comprehensive Program Specification document for the following program:

Program Name: ${params.programName}
Qualification Level: ${params.qualificationLevel}
Industry Context: ${params.industryContext}
Target Audience: ${params.targetAudience}

Use the following verified sources to inform your content:

${sourcesText}

Generate a document with the following sections:

1. Introduction (2-3 paragraphs)
   - Overview of the program
   - Relevance to industry needs
   - Key benefits for learners

2. Course Overview
   - Program structure and duration
   - Delivery methods
   - Assessment approach

3. Needs Analysis
   - Industry demand and trends
   - Skills gap analysis
   - Career opportunities

4. Knowledge-Skills-Competencies Matrix
   - Core knowledge areas
   - Essential skills
   - Professional competencies

5. Target Audience
   - Ideal learner profile
   - Prerequisites and entry requirements
   - Career stage considerations

6. Career Outcomes
   - Job roles and titles
   - Career progression pathways
   - Industry recognition

Include inline citations using [1], [2], etc. format throughout the document.
Ensure all claims are supported by the provided sources.`;
  },
};

/**
 * Unit Content Template
 * Generates detailed unit specifications for modules
 */
export const unitContentTemplate: PromptTemplate = {
  name: 'unit_content',
  systemPrompt: `You are an expert instructional designer creating detailed unit specifications for professional training programs.
Your content must be pedagogically sound, industry-relevant, and aligned with learning outcomes.

Guidelines:
- Create 6-8 learning outcomes per unit using Bloom's Taxonomy verbs
- Ensure outcomes are measurable and assessable
- Provide detailed indicative content that covers the topic comprehensively
- Suggest appropriate teaching strategies and learning activities
- Align assessment methods with learning outcomes
- Include practical examples and real-world applications
- Base all content on provided source material with citations`,

  buildUserPrompt: (params: {
    unitTitle: string;
    unitCode: string;
    moduleContext: string;
    hours: number;
    learningOutcomes: string[];
    sources: Array<{ content: string; citation: string }>;
  }) => {
    const sourcesText = params.sources
      .map((s, i) => `[${i + 1}] ${s.content}\n\nCitation: ${s.citation}`)
      .join('\n\n---\n\n');

    const outcomesText = params.learningOutcomes
      .map((lo, i) => `${i + 1}. ${lo}`)
      .join('\n');

    return `Generate a detailed Unit Specification for:

Unit Code: ${params.unitCode}
Unit Title: ${params.unitTitle}
Module Context: ${params.moduleContext}
Allocated Hours: ${params.hours}

Existing Learning Outcomes:
${outcomesText}

Use the following verified sources:

${sourcesText}

Generate a document with:

1. Unit Overview Table
   - Unit code, title, hours
   - Core/Elective status
   - Prerequisites

2. Learning Outcomes with Assessment Criteria
   - For each outcome, provide 2-3 specific assessment criteria
   - Ensure criteria are measurable and observable

3. Indicative Content (detailed)
   - Key concepts and theories
   - Practical applications
   - Industry examples
   - Current trends and developments

4. Teaching Strategies
   - Recommended instructional methods
   - Learning activities
   - Resources and materials

5. Assessment Methods
   - Formative assessment approaches
   - Summative assessment tasks
   - Alignment with learning outcomes

6. Reading List
   - Essential readings (3-5 sources)
   - Recommended readings (3-5 sources)
   - Online resources

Include inline citations throughout using [1], [2], etc. format.`;
  },
};

/**
 * Assessment Template
 * Generates assessment questions and rubrics
 */
export const assessmentTemplate: PromptTemplate = {
  name: 'assessment',
  systemPrompt: `You are an expert assessment designer creating high-quality evaluation materials for professional certification programs.
Your assessments must be valid, reliable, and aligned with learning outcomes.

Guidelines:
- Create questions that test understanding, application, and analysis (Bloom's levels 2-4)
- Ensure multiple-choice questions have one clearly correct answer and plausible distractors
- Case studies should present realistic workplace scenarios
- Rubrics must have clear criteria and performance levels
- All assessments must align with specific learning outcomes
- Base scenarios and content on provided source material`,

  buildUserPrompt: (params: {
    moduleTitle: string;
    learningOutcomes: Array<{ id: string; text: string }>;
    assessmentType: 'mcq' | 'case_study' | 'rubric';
    quantity?: number;
    sources: Array<{ content: string; citation: string }>;
  }) => {
    const sourcesText = params.sources
      .map((s, i) => `[${i + 1}] ${s.content}\n\nCitation: ${s.citation}`)
      .join('\n\n---\n\n');

    const outcomesText = params.learningOutcomes
      .map(lo => `${lo.id}: ${lo.text}`)
      .join('\n');

    if (params.assessmentType === 'mcq') {
      return `Generate ${params.quantity || 5} multiple-choice questions for:

Module: ${params.moduleTitle}

Learning Outcomes:
${outcomesText}

Use these sources for content:
${sourcesText}

For each question, provide:
1. Question text (clear and unambiguous)
2. Four options (A, B, C, D)
3. Correct answer
4. Explanation of why the answer is correct
5. Learning outcome ID it assesses
6. Difficulty level (Easy/Medium/Hard)
7. Source citation

Ensure questions test understanding and application, not just recall.`;
    }

    if (params.assessmentType === 'case_study') {
      return `Generate a realistic case study assessment for:

Module: ${params.moduleTitle}

Learning Outcomes:
${outcomesText}

Use these sources for realistic context:
${sourcesText}

Provide:
1. Case Study Scenario (200-300 words)
   - Realistic workplace situation
   - Relevant context and background
   - Clear problem or challenge

2. Questions (3-5 questions)
   - Each question should assess specific learning outcomes
   - Mix of analysis, evaluation, and application questions
   - Clear expectations for responses

3. Marking Scheme
   - Points allocation for each question
   - Key points expected in answers
   - Criteria for different grade levels

4. Model Answers
   - Comprehensive example responses
   - Key concepts that should be addressed

Include source citations for industry context and best practices.`;
    }

    // Rubric type
    return `Generate an assessment rubric for:

Module: ${params.moduleTitle}

Learning Outcomes:
${outcomesText}

Use these sources to inform criteria:
${sourcesText}

Create a rubric with:
1. Assessment Criteria (4-6 criteria aligned with learning outcomes)
2. Performance Levels (Excellent, Good, Satisfactory, Needs Improvement)
3. Descriptors for each level
4. Point values or grade equivalents

Ensure criteria are:
- Observable and measurable
- Clearly differentiated across levels
- Aligned with learning outcomes
- Based on industry standards from sources`;
  },
};

/**
 * Skill Mapping Template
 * Generates skill book entries with practical activities and KPIs
 */
export const skillMappingTemplate: PromptTemplate = {
  name: 'skill_mapping',
  systemPrompt: `You are an expert in competency-based education and workplace skill development.
Your task is to create detailed skill mappings that connect theoretical learning to practical application.

Guidelines:
- Skills must be specific, observable, and measurable
- Activities should be realistic workplace tasks
- KPIs must have numeric thresholds or clear completion criteria
- Link skills to relevant learning outcomes
- Include assessment criteria that can be objectively evaluated
- Base workplace applications on industry standards from sources`,

  buildUserPrompt: (params: {
    competencyDomain: string;
    skills: string[];
    learningOutcomes: Array<{ id: string; text: string }>;
    sources: Array<{ content: string; citation: string }>;
  }) => {
    const sourcesText = params.sources
      .map((s, i) => `[${i + 1}] ${s.content}\n\nCitation: ${s.citation}`)
      .join('\n\n---\n\n');

    const skillsText = params.skills.map((s, i) => `${i + 1}. ${s}`).join('\n');
    const outcomesText = params.learningOutcomes
      .map(lo => `${lo.id}: ${lo.text}`)
      .join('\n');

    return `Generate detailed skill mappings for:

Competency Domain: ${params.competencyDomain}

Skills to map:
${skillsText}

Learning Outcomes:
${outcomesText}

Use these sources for industry context:
${sourcesText}

For each skill, provide:

1. Skill Name and Description
2. Practical Activities (2-3 activities)
   - Activity name
   - Detailed description
   - Duration in hours
   - Resources required
   - Assessment type

3. Measurable KPIs (2-3 KPIs)
   - KPI name
   - Measurement method
   - Target threshold (numeric or completion criteria)
   - Frequency of measurement

4. Linked Learning Outcomes (at least 2)
   - Reference outcome IDs
   - Explain the connection

5. Assessment Criteria (3-4 criteria)
   - Observable behaviors or outputs
   - Performance standards

6. Workplace Applications
   - Real-world scenarios where skill is applied
   - Industry examples from sources

Return as JSON array with this structure:
{
  "skillMappings": [
    {
      "skillName": "string",
      "description": "string",
      "domain": "string",
      "activities": [...],
      "kpis": [...],
      "linkedOutcomes": [...],
      "assessmentCriteria": [...],
      "workplaceApplications": "string"
    }
  ]
}`;
  },
};

/**
 * Quality Check Template
 * Generates quality assurance feedback
 */
export const qualityCheckTemplate: PromptTemplate = {
  name: 'quality_check',
  systemPrompt: `You are a quality assurance expert for academic curriculum design.
Your role is to evaluate curriculum content against AGCQ standards and provide constructive feedback.

Guidelines:
- Check learning outcomes use Bloom's Taxonomy verbs
- Verify outcomes follow Verb + Object + Context structure
- Ensure sources are current (within 5 years) or marked as foundational
- Check APA 7th edition citation format
- Verify content is factually accurate and well-supported
- Provide specific, actionable recommendations`,

  buildUserPrompt: (params: {
    contentType: string;
    content: string;
    standards: string[];
  }) => {
    const standardsText = params.standards.map((s, i) => `${i + 1}. ${s}`).join('\n');

    return `Evaluate the following ${params.contentType} against AGCQ standards:

Content:
${params.content}

Standards to check:
${standardsText}

Provide:
1. Compliance Issues (if any)
   - Issue description
   - Severity (error/warning)
   - Location in content
   - Specific recommendation

2. Strengths
   - What is done well
   - Areas that exceed standards

3. Overall Quality Score (0-100)
   - Justify the score

4. Recommendations
   - Prioritized list of improvements
   - Specific actions to take

Return as JSON:
{
  "overallScore": number,
  "complianceIssues": [...],
  "strengths": [...],
  "recommendations": [...]
}`;
  },
};

/**
 * Simple templates for program specification sections
 */
const createSectionTemplate = (sectionName: string, sectionDescription: string): PromptTemplate => ({
  name: `program_spec_${sectionName}`,
  systemPrompt: `You are an expert curriculum designer creating professional program documentation.
Write clear, comprehensive content that meets academic standards and is based on provided sources.`,
  buildUserPrompt: (params: any) => {
    const sourcesText = params.sources
      ?.map((s: any, i: number) => `[${i + 1}] ${s.content}\n\nCitation: ${s.citation}`)
      .join('\n\n---\n\n') || 'No specific sources provided.';

    return `Generate the ${sectionDescription} section for a program specification document.

Program Name: ${params.programName}
Qualification Level: ${params.qualificationLevel}
Industry Sector: ${params.industrySector}

Use the following sources:
${sourcesText}

Write a comprehensive ${sectionDescription} section (300-500 words) that:
- Is professionally written and academically rigorous
- Includes relevant industry context
- References the provided sources with inline citations [1], [2], etc.
- Is specific to this program and industry sector

Return only the section content, not the heading.`;
  },
});

/**
 * Get template by name
 */
export function getTemplate(name: string): PromptTemplate | undefined {
  const templates: Record<string, PromptTemplate> = {
    program_overview: programOverviewTemplate,
    unit_content: unitContentTemplate,
    assessment: assessmentTemplate,
    skill_mapping: skillMappingTemplate,
    quality_check: qualityCheckTemplate,
    // Program specification section templates
    program_spec_introduction: createSectionTemplate('introduction', 'Introduction'),
    program_spec_course_overview: createSectionTemplate('course_overview', 'Course Overview'),
    program_spec_needs_analysis: createSectionTemplate('needs_analysis', 'Needs Analysis'),
    program_spec_ksc_matrix: createSectionTemplate('ksc_matrix', 'Knowledge-Skills-Competencies Matrix'),
    program_spec_comparative_analysis: createSectionTemplate('comparative_analysis', 'Comparative Analysis'),
    program_spec_target_audience: createSectionTemplate('target_audience', 'Target Audience'),
    program_spec_entry_requirements: createSectionTemplate('entry_requirements', 'Entry Requirements'),
    program_spec_career_outcomes: createSectionTemplate('career_outcomes', 'Career Outcomes'),
    // Unit specification templates
    unit_overview: createSectionTemplate('unit_overview', 'Unit Overview'),
    indicative_content: createSectionTemplate('indicative_content', 'Indicative Content'),
    // Assessment templates
    mcq_generation: assessmentTemplate,
    case_study_generation: assessmentTemplate,
    // Context retrieval (simple passthrough)
    context_retrieval: {
      name: 'context_retrieval',
      systemPrompt: 'You are retrieving context from a knowledge base.',
      buildUserPrompt: (params: any) => params.query,
    },
  };

  return templates[name];
}

/**
 * List all available templates
 */
export function listTemplates(): string[] {
  return [
    'program_overview',
    'unit_content',
    'assessment',
    'skill_mapping',
    'quality_check',
  ];
}

