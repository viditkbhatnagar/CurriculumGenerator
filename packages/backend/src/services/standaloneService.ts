/**
 * Standalone Step Execution Service - COMPREHENSIVE HUMAN-READABLE VERSION
 *
 * This service generates detailed, human-readable curriculum content
 * for individual steps (2-10) with maximum detail and professional quality.
 *
 * FEATURES:
 * - Human-readable output (not JSON) - easy for laypeople to understand
 * - Multiple API calls per step to avoid timeouts and maximize output
 * - 10+ pages for steps 3, 4, 7, 8, 9, 10
 * - 5-7 pages for steps 2, 5, 6
 *
 * COST IS NOT A CONCERN - Maximum tokens and detail are prioritized.
 */

import { openaiService } from './openaiService';
import { loggingService } from './loggingService';

// ============================================================================
// CONFIGURATION
// ============================================================================

// Using gpt-4o for best content generation with 16K output tokens
const MODEL = 'gpt-4o';
const MAX_TOKENS = 16000; // Maximum output per call
const TIMEOUT = 600000; // 10 minutes per call (split into multiple smaller calls)

// ============================================================================
// TYPES
// ============================================================================

export interface StandaloneStepResult {
  stepNumber: number;
  stepName: string;
  content: string; // Human-readable text, not JSON
  generatedAt: string;
  sections?: string[]; // Optional array of section contents
}

// Legacy interfaces for backward compatibility (if needed)
export interface KSCContent {
  knowledgeItems: any[];
  skillItems: any[];
  competencyItems: any[];
  totalItems: number;
}

export interface PLOContent {
  outcomes: any[];
  bloomDistribution: Record<string, number>;
}

export interface CourseFrameworkContent {
  modules: any[];
  totalHours: number;
}

export interface SourcesContent {
  sources: any[];
  byModule: Record<string, any[]>;
}

export interface ReadingListContent {
  coreReadings: any[];
  supplementaryReadings: any[];
  byModule: Record<string, any[]>;
}

export interface AssessmentContent {
  formativeAssessments: any[];
  summativeAssessments: any[];
  questionBank: any[];
}

export interface CaseStudyContent {
  caseStudies: any[];
}

export interface GlossaryContent {
  terms: any[];
  totalTerms: number;
}

export interface LessonPlanContent {
  lessonPlans: any[];
}

// Step metadata with expected page counts
export const STEP_METADATA: Record<number, { name: string; description: string; targetPages: string }> = {
  2: { name: 'Competency Framework (KSC)', description: 'Generate Knowledge, Skills, and Competencies (KSC) framework', targetPages: '5-7 pages' },
  3: { name: 'Program Learning Outcomes', description: "Create measurable Program Learning Outcomes using Bloom's Taxonomy", targetPages: '10+ pages' },
  4: { name: 'Course Framework & MLOs', description: 'Structure modules, topics, and Module Learning Outcomes', targetPages: '10+ pages' },
  5: { name: 'Topic-Level Sources', description: 'Assign AGI-compliant academic sources to topics', targetPages: '5-7 pages' },
  6: { name: 'Reading Lists', description: 'Create core and supplementary reading lists per module', targetPages: '5-7 pages' },
  7: { name: 'Auto-Gradable Assessments', description: 'Generate comprehensive assessments, quizzes, and question banks', targetPages: '10+ pages' },
  8: { name: 'Case Studies', description: 'Create detailed engagement hooks and case study scenarios', targetPages: '10+ pages' },
  9: { name: 'Glossary', description: 'Auto-generate comprehensive glossary of key terms', targetPages: '10+ pages' },
  10: { name: 'Lesson Plans & PPT', description: 'Generate detailed lesson plans and PowerPoint content', targetPages: '10+ pages' },
};

// ============================================================================
// STANDALONE SERVICE CLASS
// ============================================================================

class StandaloneService {
  
  /**
   * Generate content using streaming for a single API call.
   * Each call is limited to avoid timeouts.
   */
  private async generateSection(userPrompt: string, systemPrompt: string): Promise<string> {
    let fullContent = '';
    
    await openaiService.generateContentStream(
      userPrompt,
      systemPrompt,
      (chunk) => {
        if (!chunk.done && chunk.content) {
          fullContent += chunk.content;
        }
      },
      { model: MODEL, maxTokens: MAX_TOKENS, timeout: TIMEOUT }
    );
    
    return fullContent;
  }

  /**
   * Common system prompt for human-readable educational content.
   */
  private getBaseSystemPrompt(): string {
    return `You are a world-class curriculum developer and educational content specialist with 25+ years of experience creating professional training materials for Fortune 500 companies, leading universities, and international organizations.

CRITICAL OUTPUT REQUIREMENTS:
1. Generate HUMAN-READABLE content - NOT JSON or code
2. Use clear headings, subheadings, and bullet points
3. Write in professional but accessible language that laypeople can understand
4. Be EXHAUSTIVE and COMPREHENSIVE - generate the MAXIMUM amount of detail
5. Use proper formatting with numbered lists, bullet points, and clear sections
6. Each section should be substantive with detailed explanations
7. Include practical examples and real-world applications
8. Use UK English spelling throughout

FORMAT YOUR OUTPUT WITH:
- Clear section headers (use markdown ## and ### for hierarchy)
- Numbered lists for sequential items
- Bullet points for features/characteristics
- Bold text for key terms
- Detailed paragraphs explaining each concept
- Tables where appropriate for structured information`;
  }

  /**
   * Main entry point for generating a step.
   */
  async generateStep(stepNumber: number, description: string): Promise<StandaloneStepResult> {
    if (stepNumber < 2 || stepNumber > 10) {
      throw new Error('Step number must be between 2 and 10');
    }
    if (!description || description.trim().length < 10) {
      throw new Error('Description must be at least 10 characters');
    }

    loggingService.info('Standalone step generation started', { 
      stepNumber, 
      descriptionLength: description.length,
      targetPages: STEP_METADATA[stepNumber].targetPages
    });

    let content: string;
    
    switch (stepNumber) {
      case 2: content = await this.generateStep2(description); break;
      case 3: content = await this.generateStep3(description); break;
      case 4: content = await this.generateStep4(description); break;
      case 5: content = await this.generateStep5(description); break;
      case 6: content = await this.generateStep6(description); break;
      case 7: content = await this.generateStep7(description); break;
      case 8: content = await this.generateStep8(description); break;
      case 9: content = await this.generateStep9(description); break;
      case 10: content = await this.generateStep10(description); break;
      default: throw new Error(`Step ${stepNumber} is not supported`);
    }

    loggingService.info('Standalone step generation completed', { 
      stepNumber,
      contentLength: content.length,
      estimatedPages: Math.ceil(content.length / 3000) // ~3000 chars per page
    });

    return {
      stepNumber,
      stepName: STEP_METADATA[stepNumber].name,
      content,
      generatedAt: new Date().toISOString()
    };
  }

  // ============================================================================
  // STEP 2: COMPETENCY FRAMEWORK (KSC) - 5-7 pages (3 API calls)
  // ============================================================================

  private async generateStep2(description: string): Promise<string> {
    loggingService.info('Step 2: Generating KSC Framework in 3 parts');

    const systemPrompt = this.getBaseSystemPrompt() + `

You are creating a COMPETENCY FRAMEWORK with Knowledge, Skills, and Competencies (KSC).
This framework should be aligned with professional standards like SHRM, CIPD, SFIA, and PMI.
Generate comprehensive, industry-grade content suitable for professional certification programs.`;

    // Part 1: Knowledge Items
    const knowledgePrompt = `Create a COMPREHENSIVE KNOWLEDGE FRAMEWORK for:

${description}

Generate 15-20 detailed KNOWLEDGE items. For each knowledge area, provide:

## KNOWLEDGE FRAMEWORK

For each knowledge item include:
1. **Knowledge Area Title** - Clear, descriptive name
2. **Description** (150-200 words) - What this knowledge encompasses
3. **Key Concepts** - 5-8 fundamental concepts within this area
4. **Theoretical Foundations** - Key theories, models, and frameworks
5. **Industry Applications** - How this knowledge is applied in practice
6. **Importance Level** - Essential/Highly Desirable/Desirable with justification
7. **Related Professional Standards** - Links to SHRM, CIPD, PMI, etc.
8. **Assessment Methods** - How to verify this knowledge

Be exhaustive and detailed. Each knowledge item should be a substantial paragraph with practical examples.`;

    // Part 2: Skills Items
    const skillsPrompt = `Create a COMPREHENSIVE SKILLS FRAMEWORK for:

${description}

Generate 20-25 detailed SKILL items. For each skill, provide:

## SKILLS FRAMEWORK

For each skill include:
1. **Skill Title** - Clear, action-oriented name
2. **Description** (150-200 words) - What this skill involves and looks like in practice
3. **Observable Behaviours** - 5-7 specific behaviours demonstrating this skill
4. **Proficiency Levels**:
   - Novice (0-6 months): What they can do at this level
   - Competent (6-18 months): Growing capabilities
   - Proficient (18-36 months): Independent application
   - Expert (3+ years): Mastery and leadership
5. **Tools & Technologies** - Specific tools, software, methods used
6. **Development Activities** - How to develop this skill
7. **Performance Metrics** - How to measure skill proficiency
8. **Common Challenges** - Typical difficulties and how to overcome them

Be exhaustive and provide practical, real-world examples for each skill.`;

    // Part 3: Competencies
    const competenciesPrompt = `Create a COMPREHENSIVE COMPETENCY FRAMEWORK for:

${description}

Generate 12-15 detailed COMPETENCY items. For each competency, provide:

## COMPETENCY FRAMEWORK

For each competency include:
1. **Competency Title** - Clear, behavioural name
2. **Description** (150-200 words) - What this competency means in practice
3. **Behavioural Indicators** - 8-10 observable behaviours at different levels
4. **Performance Levels**:
   - Level 1 - Developing: Behaviours and support needed
   - Level 2 - Applying: Independent demonstration
   - Level 3 - Leading: Modelling for others
   - Level 4 - Shaping: Strategic influence
   - Level 5 - Mastering: Thought leadership
5. **Situational Contexts** - When this competency is demonstrated
6. **Organisational Impact** - Business value and outcomes
7. **Development Pathway** - How to progress through levels
8. **Assessment Rubric** - Criteria for evaluating each level

## FRAMEWORK SUMMARY
At the end, provide:
- Total Knowledge Areas: X
- Total Skills: X
- Total Competencies: X
- Key Themes Across Framework
- Alignment with Professional Standards
- Recommendations for Implementation`;

    // Execute all three calls
    const [knowledgeContent, skillsContent, competenciesContent] = await Promise.all([
      this.generateSection(knowledgePrompt, systemPrompt),
      this.generateSection(skillsPrompt, systemPrompt),
      this.generateSection(competenciesPrompt, systemPrompt)
    ]);

    // Combine all sections
    const fullContent = `# COMPETENCY FRAMEWORK (KSC)
## Generated for: ${description}
## Generated on: ${new Date().toISOString()}

---

${knowledgeContent}

---

${skillsContent}

---

${competenciesContent}`;

    return fullContent;
  }

  // ============================================================================
  // STEP 3: PROGRAM LEARNING OUTCOMES - 10+ pages (3 API calls)
  // ============================================================================

  private async generateStep3(description: string): Promise<string> {
    loggingService.info('Step 3: Generating PLOs in 3 parts');

    const systemPrompt = this.getBaseSystemPrompt() + `

You are creating PROGRAM LEARNING OUTCOMES (PLOs) aligned with Bloom's Taxonomy.
These outcomes must be measurable, specific, and aligned with professional accreditation standards.
Follow QAA Quality Code, European Qualifications Framework, and professional body requirements.`;

    // Part 1: Foundation & Understanding PLOs (Remember, Understand levels)
    const foundationPrompt = `Create COMPREHENSIVE PROGRAM LEARNING OUTCOMES for:

${description}

## PART 1: FOUNDATION LEARNING OUTCOMES

Generate 6-8 detailed PLOs at the REMEMBER and UNDERSTAND levels of Bloom's Taxonomy.

For each PLO provide:

1. **PLO Code and Title** (e.g., PLO1: Understanding Core Principles)

2. **Outcome Statement** (30-50 words)
   - Begin with action verb from Bloom's Taxonomy
   - Specify the knowledge or understanding required
   - Include context and conditions
   - Indicate proficiency level expected

3. **Extended Description** (200-300 words)
   - Full explanation of what this outcome means
   - Why this outcome matters for graduates
   - How it connects to professional practice
   - Industry and employer expectations

4. **Bloom's Taxonomy Analysis**
   - Cognitive Level: Remember or Understand
   - Action Verb Used: (e.g., Define, Explain, Describe)
   - Cognitive Processes Involved
   - Justification for this level

5. **Assessment Strategy** (150-200 words)
   - Primary assessment method with description
   - Alternative assessment methods
   - Assessment timing
   - Rubric criteria overview

6. **Competency Mapping**
   - 4-6 professional competencies this develops
   - Professional body alignment (CIPD, CMI, PMI, etc.)
   - Career pathway relevance

7. **Performance Criteria**
   - Pass level descriptors
   - Merit level descriptors
   - Distinction level descriptors

8. **Learning Activities**
   - 4-6 specific activities to develop this outcome
   - Estimated time allocation
   - Resources required`;

    // Part 2: Application PLOs (Apply, Analyze levels)
    const applicationPrompt = `Create COMPREHENSIVE PROGRAM LEARNING OUTCOMES for:

${description}

## PART 2: APPLICATION LEARNING OUTCOMES

Generate 8-10 detailed PLOs at the APPLY and ANALYZE levels of Bloom's Taxonomy.

For each PLO provide the SAME detailed structure:

1. **PLO Code and Title**
2. **Outcome Statement** (30-50 words with action verbs like: Apply, Implement, Analyse, Examine, Compare)
3. **Extended Description** (200-300 words)
4. **Bloom's Taxonomy Analysis** (Apply or Analyse level)
5. **Assessment Strategy** (150-200 words)
6. **Competency Mapping**
7. **Performance Criteria** (Pass/Merit/Distinction)
8. **Learning Activities**
9. **Industry Alignment** - Specific workplace applications
10. **Graduate Attributes** - Employability skills developed

These PLOs should focus on PRACTICAL APPLICATION and ANALYTICAL CAPABILITIES.
Include real-world scenarios and case study connections.`;

    // Part 3: Higher-Order PLOs (Evaluate, Create levels) + Summary
    const higherOrderPrompt = `Create COMPREHENSIVE PROGRAM LEARNING OUTCOMES for:

${description}

## PART 3: HIGHER-ORDER LEARNING OUTCOMES

Generate 6-8 detailed PLOs at the EVALUATE and CREATE levels of Bloom's Taxonomy.

For each PLO provide the SAME detailed structure:

1. **PLO Code and Title**
2. **Outcome Statement** (30-50 words with action verbs like: Evaluate, Critique, Design, Develop, Create)
3. **Extended Description** (200-300 words)
4. **Bloom's Taxonomy Analysis** (Evaluate or Create level)
5. **Assessment Strategy** (150-200 words)
6. **Competency Mapping**
7. **Performance Criteria** (Pass/Merit/Distinction)
8. **Learning Activities**
9. **Industry Alignment**
10. **Graduate Attributes**

These PLOs should focus on CRITICAL EVALUATION and CREATIVE/INNOVATIVE CAPABILITIES.

---

## PROGRAM LEARNING OUTCOMES SUMMARY

At the end, provide:

### Bloom's Taxonomy Distribution
- Remember: X PLOs (X%)
- Understand: X PLOs (X%)
- Apply: X PLOs (X%)
- Analyse: X PLOs (X%)
- Evaluate: X PLOs (X%)
- Create: X PLOs (X%)

### Program Coherence
- How PLOs build progressively through the program
- Integration points where PLOs are assessed together
- Capstone alignment

### Accreditation Mapping
- QAA Quality Code alignment
- Professional body requirements addressed
- EQF/FHEQ level alignment

### Assessment Overview
- Summary of assessment methods across all PLOs
- Balance of formative and summative assessment`;

    // Execute all three calls
    const [foundationContent, applicationContent, higherOrderContent] = await Promise.all([
      this.generateSection(foundationPrompt, systemPrompt),
      this.generateSection(applicationPrompt, systemPrompt),
      this.generateSection(higherOrderPrompt, systemPrompt)
    ]);

    // Combine all sections
    const fullContent = `# PROGRAM LEARNING OUTCOMES (PLOs)
## Generated for: ${description}
## Generated on: ${new Date().toISOString()}

---

${foundationContent}

---

${applicationContent}

---

${higherOrderContent}`;

    return fullContent;
  }

  // ============================================================================
  // STEP 4: COURSE FRAMEWORK & MLOs - 10+ pages (4 API calls)
  // ============================================================================

  private async generateStep4(description: string): Promise<string> {
    loggingService.info('Step 4: Generating Course Framework in 4 parts');

    const systemPrompt = this.getBaseSystemPrompt() + `

You are designing a COMPREHENSIVE COURSE/PROGRAM FRAMEWORK with modules, topics, and learning outcomes.
Follow curriculum design best practices including Understanding by Design (UbD), constructive alignment,
and competency-based education principles. Align with UK credit frameworks and professional standards.`;

    // Part 1: Program Overview & First 4 Modules
    const part1Prompt = `Design a COMPREHENSIVE COURSE FRAMEWORK for:

${description}

## PART 1: PROGRAM OVERVIEW & CORE MODULES (1-4)

### PROGRAM OVERVIEW
Provide:
- Program Title and Qualification Level (e.g., Level 7 Masters)
- Total Credits (UK credits) and Total Hours
- Program Duration (full-time and part-time options)
- Delivery Mode (face-to-face, blended, online)
- Target Audience
- Entry Requirements
- Program Aims (200-300 words)
- Graduate Outcomes

### MODULES 1-4 (Core Foundation Modules)

For each module, provide:

1. **Module Title and Code** (e.g., MOD101: Foundations of...)
2. **Credit Value and Level**
3. **Total Hours** (contact hours + independent study breakdown)
4. **Module Description** (200-300 words)
   - Purpose and rationale
   - Key themes and content
   - How it fits in the program structure
   - Industry relevance

5. **Module Learning Outcomes (MLOs)** - 6-8 per module
   - Full statement with Bloom's verb
   - Bloom's level
   - Assessment method
   - Success criteria

6. **Topics and Content** - 8-12 topics per module
   For each topic:
   - Topic title
   - Description (50-75 words)
   - Subtopics (4-6)
   - Key concepts and theories
   - Hours allocated

7. **Assessment Strategy**
   - Formative assessments (2-3)
   - Summative assessments (2-3) with:
     * Type and format
     * Word count/duration
     * Weighting percentage
     * MLOs assessed

8. **Essential Readings** (5-8 per module)
9. **Prerequisites and Co-requisites**`;

    // Part 2: Modules 5-8
    const part2Prompt = `Continue designing the COURSE FRAMEWORK for:

${description}

## PART 2: DEVELOPMENT MODULES (5-8)

Generate MODULES 5-8 with the SAME detailed structure:

1. **Module Title and Code**
2. **Credit Value and Level**
3. **Total Hours** (contact + independent study)
4. **Module Description** (200-300 words)
5. **Module Learning Outcomes (MLOs)** - 6-8 per module with full details
6. **Topics and Content** - 8-12 topics per module with subtopics
7. **Assessment Strategy** - formative and summative
8. **Essential Readings**
9. **Prerequisites**

These modules should BUILD on the foundation modules (1-4) and introduce more advanced concepts.
Show clear progression and scaffolding of learning.`;

    // Part 3: Modules 9-12
    const part3Prompt = `Continue designing the COURSE FRAMEWORK for:

${description}

## PART 3: SPECIALISATION & INTEGRATION MODULES (9-12)

Generate MODULES 9-12 with the SAME detailed structure:

1. **Module Title and Code**
2. **Credit Value and Level**
3. **Total Hours**
4. **Module Description** (200-300 words)
5. **Module Learning Outcomes (MLOs)** - 6-8 per module
6. **Topics and Content** - 8-12 topics per module
7. **Assessment Strategy**
8. **Essential Readings**
9. **Prerequisites**

These modules should represent ADVANCED and SPECIALISED content.
Include capstone/dissertation module if appropriate.`;

    // Part 4: Program Summary & Teaching Strategy
    const part4Prompt = `Complete the COURSE FRAMEWORK for:

${description}

## PART 4: PROGRAM SUMMARY & IMPLEMENTATION

### PROGRAM STRUCTURE SUMMARY
- Total Modules: X
- Core Modules: X
- Elective Modules: X
- Total Credits: X
- Total Hours: X
- Total Contact Hours: X
- Total Independent Study Hours: X

### MODULE PROGRESSION MAP
Visual/text representation of how modules connect and build on each other.
Show prerequisites and recommended pathways.

### TEACHING AND LEARNING STRATEGY (300-400 words)
- Pedagogical approach
- Learning methods used across program
- Technology integration
- Industry engagement
- Inclusive practices

### ASSESSMENT STRATEGY OVERVIEW (300-400 words)
- Philosophy of assessment
- Balance of assessment types
- Formative vs summative balance
- Authentic assessment elements
- Feedback mechanisms

### QUALITY ASSURANCE
- Internal review processes
- External examiner involvement
- Student feedback mechanisms
- Annual monitoring

### PROFESSIONAL BODY ALIGNMENT
- Which professional bodies/standards this program aligns with
- Accreditation status or pathway
- Professional registration opportunities for graduates

### RESOURCE REQUIREMENTS
- Staffing requirements
- Technology requirements
- Library and learning resources
- Physical space requirements`;

    // Execute all four calls
    const [part1, part2, part3, part4] = await Promise.all([
      this.generateSection(part1Prompt, systemPrompt),
      this.generateSection(part2Prompt, systemPrompt),
      this.generateSection(part3Prompt, systemPrompt),
      this.generateSection(part4Prompt, systemPrompt)
    ]);

    // Combine all sections
    const fullContent = `# COURSE FRAMEWORK & MODULE LEARNING OUTCOMES
## Generated for: ${description}
## Generated on: ${new Date().toISOString()}

---

${part1}

---

${part2}

---

${part3}

---

${part4}`;

    return fullContent;
  }

  // ============================================================================
  // STEP 5: TOPIC-LEVEL SOURCES - 5-7 pages (2 API calls)
  // ============================================================================

  private async generateStep5(description: string): Promise<string> {
    loggingService.info('Step 5: Generating Academic Sources in 2 parts');

    const systemPrompt = this.getBaseSystemPrompt() + `

You are an expert academic librarian and research specialist creating a comprehensive source list.
Use APA 7th Edition citation format. Include a mix of peer-reviewed journals, academic books,
industry reports, and professional publications. Focus on authoritative, current sources.`;

    // Part 1: Primary Academic Sources
    const primaryPrompt = `Create a COMPREHENSIVE ACADEMIC SOURCE LIST for:

${description}

## PART 1: PRIMARY ACADEMIC SOURCES

### PEER-REVIEWED JOURNAL ARTICLES (25-35 sources)

For each source provide:
1. **Full APA 7th Citation**
2. **Source Type**: Journal Article
3. **Relevance Description** (75-100 words) - Why this source is essential
4. **Key Concepts Covered** - 4-6 main concepts
5. **Methodology** (for empirical research) - Qualitative/Quantitative/Mixed
6. **Module Alignment** - Which modules this supports
7. **Topic Alignment** - Specific topics covered

Organise by thematic areas relevant to the program content.
Include seminal/classic works AND current research (2020-2025).

### ACADEMIC BOOKS (15-20 sources)

For each book provide:
1. **Full APA 7th Citation** (including ISBN)
2. **Source Type**: Textbook/Edited Collection/Monograph
3. **Relevance Description** (75-100 words)
4. **Key Chapters** - Most relevant chapters and what they cover
5. **Suitable For** - Which level of learner (introductory/intermediate/advanced)
6. **Module Alignment**`;

    // Part 2: Supplementary Sources & Resource Summary
    const supplementaryPrompt = `Continue creating the ACADEMIC SOURCE LIST for:

${description}

## PART 2: SUPPLEMENTARY & PROFESSIONAL SOURCES

### BOOK CHAPTERS FROM EDITED COLLECTIONS (8-12 sources)
For each:
1. Full APA 7th Citation
2. Relevance Description (50-75 words)
3. Key concepts covered
4. Module alignment

### INDUSTRY REPORTS & WHITE PAPERS (10-15 sources)
Include reports from:
- Professional bodies (CIPD, CMI, SHRM, etc.)
- Consulting firms (McKinsey, Deloitte, etc.)
- Government agencies
- Industry associations

For each:
1. Full citation
2. Source organisation
3. Relevance description
4. Key findings/data
5. Module alignment

### CONFERENCE PAPERS (5-8 sources)
Recent conference papers from major academic conferences.

### ONLINE RESOURCES & DATABASES
- Recommended databases for further research
- Professional body resource libraries
- Open access repositories
- Useful websites with credibility assessment

---

## SOURCE LIST SUMMARY

### By Source Type
- Journal Articles: X
- Academic Books: X
- Book Chapters: X
- Industry Reports: X
- Conference Papers: X
- Online Resources: X
- **Total Sources: X**

### By Theme/Topic Area
Breakdown of sources by major topic area

### By Module
Which sources support which modules

### Currency Analysis
- Sources 2020-2025: X%
- Sources 2015-2019: X%
- Classic/Seminal works: X%

### Recommendations for Students
- How to access these resources
- Recommended reading order
- Tips for academic reading`;

    // Execute both calls
    const [primaryContent, supplementaryContent] = await Promise.all([
      this.generateSection(primaryPrompt, systemPrompt),
      this.generateSection(supplementaryPrompt, systemPrompt)
    ]);

    // Combine all sections
    const fullContent = `# TOPIC-LEVEL ACADEMIC SOURCES
## Generated for: ${description}
## Generated on: ${new Date().toISOString()}

---

${primaryContent}

---

${supplementaryContent}`;

    return fullContent;
  }

  // ============================================================================
  // STEP 6: READING LISTS - 5-7 pages (2 API calls)
  // ============================================================================

  private async generateStep6(description: string): Promise<string> {
    loggingService.info('Step 6: Generating Reading Lists in 2 parts');

    const systemPrompt = this.getBaseSystemPrompt() + `

You are creating comprehensive READING LISTS for an academic program.
Organise readings by module and distinguish between essential and recommended readings.
Use APA 7th Edition citations. Include guidance for students on how to approach the readings.`;

    // Part 1: Core/Essential Readings
    const corePrompt = `Create COMPREHENSIVE READING LISTS for:

${description}

## PART 1: ESSENTIAL READINGS BY MODULE

For a program with 8-12 modules, provide ESSENTIAL readings for each module.

For each module:

### Module X: [Module Title]

**Reading List Introduction** (50-75 words)
Brief guidance on the key themes and how readings connect.

**Essential Readings** (6-10 per module)

For each reading:
1. **Full APA 7th Citation**
2. **Type**: Textbook Chapter/Journal Article/Report
3. **Focus Area**: What aspect of the module this covers
4. **Reading Guidance** (40-60 words): What to pay attention to, key sections
5. **Estimated Reading Time**: X hours
6. **Difficulty Level**: Introductory/Intermediate/Advanced
7. **Connection to Assessment**: How this reading helps with assignments

**Module Reading Strategy**
- Recommended order of readings
- How readings build on each other
- Pre-class vs post-class readings`;

    // Part 2: Recommended/Supplementary Readings
    const supplementaryPrompt = `Continue creating READING LISTS for:

${description}

## PART 2: RECOMMENDED READINGS BY MODULE

For the same 8-12 modules, provide SUPPLEMENTARY readings.

For each module:

### Module X: [Module Title]

**Recommended Readings** (8-12 per module)

For each reading:
1. **Full APA 7th Citation**
2. **Type**: Book/Article/Report/Online Resource
3. **Purpose**: Deepening knowledge/Alternative perspective/Practical application
4. **Brief Description** (30-50 words)
5. **Best For**: Who should prioritise this reading

**Further Exploration Resources**
- Podcasts relevant to module topics
- TED Talks or video lectures
- Professional body publications
- Blogs and thought leaders to follow

---

## READING LIST SUMMARY

### Total Readings by Type
- Essential Readings: X
- Recommended Readings: X
- Total: X

### By Format
- Books/Textbooks: X
- Journal Articles: X
- Reports: X
- Online Resources: X

### Study Time Estimate
Total estimated reading time for the program: X hours

### Accessibility
- Which readings are available online
- Library resources needed
- Open access alternatives

### Tips for Effective Academic Reading
1. Active reading strategies
2. Note-taking approaches
3. Critical reading techniques
4. Time management for readings
5. Using readings in assignments`;

    // Execute both calls
    const [coreContent, supplementaryContent] = await Promise.all([
      this.generateSection(corePrompt, systemPrompt),
      this.generateSection(supplementaryPrompt, systemPrompt)
    ]);

    // Combine all sections
    const fullContent = `# READING LISTS
## Generated for: ${description}
## Generated on: ${new Date().toISOString()}

---

${coreContent}

---

${supplementaryContent}`;

    return fullContent;
  }

  // ============================================================================
  // STEP 7: ASSESSMENTS - 10+ pages (5 API calls)
  // ============================================================================

  private async generateStep7(description: string): Promise<string> {
    loggingService.info('Step 7: Generating Comprehensive Assessments in 5 parts');

    const systemPrompt = this.getBaseSystemPrompt() + `

You are an expert in educational assessment and psychometrics creating comprehensive assessment materials.
Design assessments that are valid, reliable, and aligned with learning outcomes.
Include a mix of formative and summative assessments with detailed marking criteria.
All assessments should be practical, professionally relevant, and appropriately challenging.`;

    // Part 1: Formative Assessments
    const formativePrompt = `Create COMPREHENSIVE FORMATIVE ASSESSMENTS for:

${description}

## FORMATIVE ASSESSMENTS

Design 8-10 formative assessment activities that provide ongoing feedback and support learning.

For each formative assessment:

### Assessment X: [Title]

**1. Assessment Overview**
- **Title**: Clear, descriptive title
- **Type**: Quiz/Self-Check/Peer Review/Reflection/Practice Exercise/Discussion
- **Purpose** (100-150 words): What this assessment helps learners achieve
- **When Used**: Point in module/program
- **Duration**: Time allowed
- **Module Alignment**: Which module(s) this supports

**2. Learning Outcomes Assessed**
- List 3-5 specific learning outcomes this assesses
- Explain how the assessment measures each outcome

**3. Assessment Description** (150-200 words)
- Detailed description of what learners will do
- Instructions for learners
- Resources they can use
- Expected output/submission

**4. Sample Questions/Tasks**
Provide 5-8 example questions or tasks for this assessment.
For quizzes, include the correct answers and explanations.

**5. Feedback Strategy**
- How feedback will be provided
- Timing of feedback
- Who provides feedback (instructor/peer/automated)
- What feedback will cover

**6. Success Criteria**
- What good performance looks like
- Common mistakes to avoid
- How to improve

**7. Accommodations**
- Accessibility considerations
- Alternative formats available`;

    // Part 2: Summative Assessments
    const summativePrompt = `Create COMPREHENSIVE SUMMATIVE ASSESSMENTS for:

${description}

## SUMMATIVE ASSESSMENTS

Design 6-8 summative assessments that evaluate achievement of learning outcomes.

For each summative assessment:

### Assessment X: [Title]

**1. Assessment Overview**
- **Title**: Formal assessment title
- **Type**: Written Assignment/Examination/Presentation/Portfolio/Project/Report
- **Weighting**: Percentage of final grade
- **Word Count/Duration**: Specific requirements
- **Module Alignment**: Which module(s) this assesses
- **Submission Deadline**: Point in term/semester

**2. Assessment Brief** (200-300 words)
Complete assessment instructions as students would receive them:
- Task description
- Specific requirements
- Format requirements
- Submission instructions

**3. Learning Outcomes Assessed**
- List all learning outcomes assessed
- How each outcome is evaluated in this assessment

**4. Detailed Marking Criteria**
Create a comprehensive rubric with criteria and level descriptors:

| Criterion | Fail (0-39%) | Pass (40-49%) | Merit (50-59%) | Distinction (60-69%) | High Distinction (70%+) |
|-----------|--------------|---------------|----------------|---------------------|------------------------|
| [Criterion 1] | Description | Description | Description | Description | Description |
| [Criterion 2] | Description | Description | Description | Description | Description |
(Continue for 5-8 criteria)

**5. Weighting of Criteria**
- Criterion 1: X%
- Criterion 2: X%
(etc.)

**6. Exemplar/Model Answer Guidance**
What a high-quality submission would include (without giving away the answer).

**7. Common Pitfalls**
5-7 mistakes students commonly make and how to avoid them.

**8. Academic Integrity**
- How originality is checked
- What constitutes plagiarism for this assessment
- Acceptable collaboration`;

    // Part 3: Multiple Choice Questions (Part 1)
    const mcqPart1Prompt = `Create COMPREHENSIVE MCQ QUESTION BANK for:

${description}

## MULTIPLE CHOICE QUESTION BANK - PART 1

Create 20 detailed multiple choice questions covering FOUNDATIONAL KNOWLEDGE (Remember/Understand levels).

For each question:

### Question X

**Question Stem** (Clear question, 20-50 words)
[Present the question clearly. For scenario-based questions, include the scenario.]

**Options**
A) [Option text]
B) [Option text]
C) [Option text]
D) [Option text]

**Correct Answer**: [Letter]

**Detailed Explanation** (100-150 words)
- Why the correct answer is correct
- Why each incorrect option is wrong (distractor analysis)
- Common misconceptions this question addresses

**Question Metadata**
- Bloom's Level: Remember/Understand
- Difficulty: Easy/Medium
- Topic: Specific topic covered
- Module: Which module this belongs to
- Time Estimate: Seconds to complete
- Keywords: 4-6 keywords

---

Include a mix of:
- Direct knowledge recall questions
- Definition questions
- Concept explanation questions
- Scenario-based understanding questions`;

    // Part 4: Multiple Choice Questions (Part 2)
    const mcqPart2Prompt = `Create MORE MCQ QUESTIONS for:

${description}

## MULTIPLE CHOICE QUESTION BANK - PART 2

Create 20 detailed multiple choice questions covering APPLICATION & ANALYSIS (Apply/Analyse levels).

For each question, use the SAME detailed structure:

### Question X

**Question Stem** (Include realistic scenarios, 40-80 words for scenario-based)
[Present a workplace scenario or case that requires application of knowledge]

**Options**
A) [Option - should be plausible]
B) [Option - should be plausible]
C) [Option - should be plausible]
D) [Option - should be plausible]

**Correct Answer**: [Letter]

**Detailed Explanation** (100-150 words)
- Why the correct answer is correct in this scenario
- Why each distractor is incorrect
- What principle/concept this tests

**Question Metadata**
- Bloom's Level: Apply/Analyse
- Difficulty: Medium/Hard
- Topic: Specific topic
- Module: Which module
- Time Estimate: Seconds (typically 60-120 for these)
- Keywords: 4-6 keywords

---

Focus on:
- Real-world scenario application
- Case-based analysis
- Problem-solving situations
- Comparing/contrasting options
- Decision-making scenarios`;

    // Part 5: Short Answer & Essay Questions + Summary
    const essayPrompt = `Create SHORT ANSWER AND ESSAY QUESTIONS for:

${description}

## SHORT ANSWER QUESTIONS

Create 12-15 short answer questions requiring 150-300 word responses.

For each short answer question:

### Question X

**Question** (Clear, focused question)

**Model Answer** (200-300 words)
A comprehensive answer that would receive full marks.

**Marking Scheme**
- Key points required (bullet list)
- Marks allocation
- What distinguishes good from excellent answers

**Question Metadata**
- Bloom's Level: Apply/Analyse/Evaluate
- Topic: Specific topic
- Module: Which module
- Marks: Point value

---

## ESSAY QUESTIONS

Create 8-10 essay questions requiring 800-1500 word responses.

For each essay question:

### Question X

**Question** (Comprehensive question requiring extended analysis)

**Question Guidance**
- What the question is asking
- Key areas to address
- Theories/frameworks to apply

**Model Answer Outline**
- Key arguments to make
- Evidence/examples to include
- Structure recommendation

**Detailed Marking Rubric**
| Criterion | Description | Marks |
|-----------|-------------|-------|
| Understanding | ... | X |
| Analysis | ... | X |
| Application | ... | X |
| Critical Evaluation | ... | X |
| Communication | ... | X |

---

## ASSESSMENT SUMMARY

### Question Bank Statistics
- Multiple Choice Questions: X
- Short Answer Questions: X
- Essay Questions: X
- Total Questions: X

### Bloom's Taxonomy Coverage
- Remember: X questions
- Understand: X questions
- Apply: X questions
- Analyse: X questions
- Evaluate: X questions
- Create: X questions

### Difficulty Distribution
- Easy: X%
- Medium: X%
- Hard: X%

### Topic Coverage Matrix
Table showing which topics are covered by which questions.

### Recommendations for Assessment Use
- How to combine questions for exams
- Suggested exam structures
- Time allocations
- Accessibility considerations`;

    // Execute all five calls
    const [formative, summative, mcq1, mcq2, essay] = await Promise.all([
      this.generateSection(formativePrompt, systemPrompt),
      this.generateSection(summativePrompt, systemPrompt),
      this.generateSection(mcqPart1Prompt, systemPrompt),
      this.generateSection(mcqPart2Prompt, systemPrompt),
      this.generateSection(essayPrompt, systemPrompt)
    ]);

    // Combine all sections
    const fullContent = `# COMPREHENSIVE ASSESSMENT PACKAGE
## Generated for: ${description}
## Generated on: ${new Date().toISOString()}

This assessment package includes formative assessments, summative assessments, and a complete question bank with multiple choice, short answer, and essay questions.

---

${formative}

---

${summative}

---

${mcq1}

---

${mcq2}

---

${essay}`;

    return fullContent;
  }

  // ============================================================================
  // STEP 8: CASE STUDIES - 10+ pages (4 API calls)
  // ============================================================================

  private async generateStep8(description: string): Promise<string> {
    loggingService.info('Step 8: Generating Case Studies in 4 parts');

    const systemPrompt = this.getBaseSystemPrompt() + `

You are an expert in case-based learning creating comprehensive teaching case studies.
Design cases that are engaging, realistic, and pedagogically effective.
Include rich narratives, complex characters, and challenging decision points.
Follow Harvard Business School case writing conventions.`;

    // Part 1: Introductory Cases (2 detailed cases)
    const introPrompt = `Create COMPREHENSIVE CASE STUDIES for:

${description}

## INTRODUCTORY CASE STUDIES (2 Cases)

Create 2 DETAILED introductory-level case studies for new learners.

For each case study:

### Case Study X: [Compelling Title]

**1. Case Overview**
- **Title**: Engaging, descriptive title
- **Difficulty**: Introductory
- **Focus Area**: Primary topic/skill addressed
- **Recommended Timing**: When to use in program
- **Time Required**: Discussion time needed
- **Learning Outcomes**: 4-6 outcomes this case develops

**2. Case Narrative** (800-1200 words)
Write a compelling story that includes:
- **Setting**: Detailed description of organisation/context
- **Background**: History and current situation
- **Characters**: 3-5 key characters with roles, backgrounds, motivations
- **The Challenge**: Problem or decision facing the protagonist
- **Complicating Factors**: What makes this difficult
- **Data/Evidence**: Include relevant facts, figures, quotes
- **Decision Point**: Where the case ends (open-ended)

**3. Characters**
For each character (3-5 characters):
- Name and Role
- Background (75-100 words)
- Perspective on the issue
- Motivation
- Key quote from the character

**4. Timeline**
Key events leading to the current situation.

**5. Discussion Questions** (8-10 questions)
Organised by cognitive level:
- Opening questions (understand the situation)
- Analysis questions (examine the issues)
- Evaluation questions (judge options)
- Action questions (decide what to do)

For each question include:
- The question
- Purpose/what it develops
- Suggested time allocation
- Key points to draw out

**6. Teaching Note** (300-400 words)
- Case synopsis
- Intended learning
- How to facilitate discussion
- Key insights to surface
- Common student responses
- Closing strategy`;

    // Part 2: Intermediate Cases (2 detailed cases)
    const intermediatePrompt = `Continue creating CASE STUDIES for:

${description}

## INTERMEDIATE CASE STUDIES (2 Cases)

Create 2 DETAILED intermediate-level case studies with more complexity.

Use the SAME comprehensive structure:

### Case Study X: [Compelling Title]

**1. Case Overview**
(Difficulty: Intermediate, more complex scenarios)

**2. Case Narrative** (1000-1500 words)
More complex scenarios with:
- Multiple stakeholders with conflicting interests
- Incomplete or ambiguous information
- Time pressure or resource constraints
- Ethical dimensions
- Cross-functional considerations

**3. Characters** (4-6 characters)
Include more diverse perspectives and potential conflicts.

**4. Timeline**
More complex timeline with multiple developments.

**5. Data and Exhibits**
Include:
- Financial data (if relevant)
- Survey results or feedback
- Performance metrics
- Comparative data

**6. Discussion Questions** (10-12 questions)
More challenging questions requiring integration of multiple concepts.

**7. Teaching Note** (400-500 words)
Include:
- Analysis frameworks to apply
- Alternative approaches to facilitation
- How to handle controversial viewpoints
- Extension activities`;

    // Part 3: Advanced Cases (2 detailed cases)
    const advancedPrompt = `Continue creating CASE STUDIES for:

${description}

## ADVANCED CASE STUDIES (2 Cases)

Create 2 DETAILED advanced-level case studies for experienced learners.

### Case Study X: [Compelling Title]

**1. Case Overview**
(Difficulty: Advanced, complex real-world scenarios)

**2. Case Narrative** (1200-1800 words)
Highly complex scenarios featuring:
- Strategic-level decisions
- Multiple simultaneous challenges
- Significant uncertainty
- High stakes and consequences
- Industry or sector complexity
- Global or cross-cultural dimensions
- Evolving situations

**3. Characters** (5-8 characters)
Complex stakeholder map with:
- Internal and external stakeholders
- Different levels of power and influence
- Hidden agendas or competing priorities
- Board/governance dimensions

**4. Timeline**
Multi-year timeline with interconnected events.

**5. Data and Exhibits**
Comprehensive data including:
- Financial statements or projections
- Market research
- Strategic analysis
- Risk assessments
- Stakeholder mapping

**6. Discussion Questions** (12-15 questions)
Advanced questions requiring:
- Strategic analysis
- Synthesis of multiple frameworks
- Ethical reasoning
- Change leadership
- Stakeholder management

**7. Role Play Extension**
Instructions for turning this into a role-play or simulation.

**8. Teaching Note** (500-600 words)
Comprehensive facilitation guide.`;

    // Part 4: Mini Cases & Summary
    const miniCasesPrompt = `Complete the CASE STUDY PACKAGE for:

${description}

## MINI CASE STUDIES (6-8 Short Cases)

Create 6-8 mini cases (300-500 words each) for quick discussions or exercises.

For each mini case:

### Mini Case X: [Title]

**Scenario** (300-500 words)
A focused scenario presenting a specific challenge or decision.

**Key Question**
The central question for discussion.

**Discussion Points**
3-5 key points to explore.

**Suggested Time**: 15-20 minutes

---

## CASE STUDY ENGAGEMENT HOOKS

Create 10 brief engagement hooks (2-3 sentences each) that can open lessons or spark discussion.

### Hook 1: [Topic Area]
[Provocative statement, surprising fact, or challenging question]
**Purpose**: What this hook introduces
**Follow-up**: How to use it

(Continue for 10 hooks)

---

## CASE STUDY PACKAGE SUMMARY

### Cases by Difficulty
- Introductory: 2 cases
- Intermediate: 2 cases
- Advanced: 2 cases
- Mini Cases: X cases
- Total: X cases

### Cases by Topic Area
Mapping of cases to curriculum topics.

### Teaching Resources
- Total discussion questions: X
- Role play opportunities: X
- Engagement hooks: 10

### Implementation Recommendations
- How to sequence cases through the program
- Preparation requirements for students
- Facilitation skills needed
- Assessment integration options`;

    // Execute all four calls
    const [intro, intermediate, advanced, mini] = await Promise.all([
      this.generateSection(introPrompt, systemPrompt),
      this.generateSection(intermediatePrompt, systemPrompt),
      this.generateSection(advancedPrompt, systemPrompt),
      this.generateSection(miniCasesPrompt, systemPrompt)
    ]);

    // Combine all sections
    const fullContent = `# CASE STUDIES & ENGAGEMENT MATERIALS
## Generated for: ${description}
## Generated on: ${new Date().toISOString()}

This package includes comprehensive case studies at multiple difficulty levels, mini cases for quick discussions, and engagement hooks for lesson openings.

---

${intro}

---

${intermediate}

---

${advanced}

---

${mini}`;

    return fullContent;
  }

  // ============================================================================
  // STEP 9: GLOSSARY - 10+ pages (4 API calls)
  // ============================================================================

  private async generateStep9(description: string): Promise<string> {
    loggingService.info('Step 9: Generating Glossary in 4 parts');

    const systemPrompt = this.getBaseSystemPrompt() + `

You are a professional lexicographer creating a comprehensive educational glossary.
Write clear, accessible definitions that help learners understand key terminology.
Include practical examples and context for each term.`;

    // Part 1: Core Terms (A-G)
    const part1Prompt = `Create a COMPREHENSIVE GLOSSARY for:

${description}

## GLOSSARY PART 1: CORE TERMS (A-G)

Generate 40-50 key terms alphabetically from A to G.

For each term:

### [Term]

**Definition** (40-80 words)
Clear, accessible definition using simple language.

**Extended Explanation** (80-120 words)
Deeper explanation with context and significance.

**Example in Practice**
A practical example showing how this term is used in a real-world context.

**Related Terms**
3-5 related terms from the glossary.

**Common Misconceptions**
Any common misunderstandings about this term.

**Module Reference**
Which module(s) cover this term in detail.

---

Ensure definitions are:
- Written for learners new to the field
- Free of jargon (or explain jargon when necessary)
- Practical and applicable
- Accurate and current`;

    // Part 2: Core Terms (H-N)
    const part2Prompt = `Continue creating the GLOSSARY for:

${description}

## GLOSSARY PART 2: CORE TERMS (H-N)

Generate 40-50 key terms alphabetically from H to N.

Use the SAME detailed structure:

### [Term]

**Definition** (40-80 words)

**Extended Explanation** (80-120 words)

**Example in Practice**

**Related Terms**

**Common Misconceptions**

**Module Reference**`;

    // Part 3: Core Terms (O-Z)
    const part3Prompt = `Continue creating the GLOSSARY for:

${description}

## GLOSSARY PART 3: CORE TERMS (O-Z)

Generate 40-50 key terms alphabetically from O to Z.

Use the SAME detailed structure for each term.`;

    // Part 4: Acronyms, Specialised Terms & Index
    const part4Prompt = `Complete the GLOSSARY for:

${description}

## GLOSSARY PART 4: ACRONYMS & SPECIALISED TERMS

### ACRONYMS AND ABBREVIATIONS (30-40 entries)

For each acronym:

**[ACRONYM]** - [Full Form]

Definition and explanation of what this acronym means and how it's used.

Example: CIPD, SHRM, KPI, ROI, etc.

---

### SPECIALISED/TECHNICAL TERMS (20-30 entries)

More technical terms that require specialist knowledge.

For each:
- Term
- Definition
- When this term is used
- Level: Intermediate/Advanced

---

## GLOSSARY INDEX

### Terms by Module
Organised list of which terms are covered in which module.

### Terms by Topic Area
Grouped by thematic area.

### Terms by Difficulty
- Foundational terms (learn first)
- Intermediate terms
- Advanced terms

---

## GLOSSARY SUMMARY

- **Total Terms Defined**: X
- **Acronyms**: X
- **Specialised Terms**: X
- **Grand Total**: X

### How to Use This Glossary
- As a reference while studying
- For exam revision
- For professional communication
- For writing assignments

### Tips for Learning Terminology
1. Create flashcards
2. Use terms in sentences
3. Teach others
4. Connect to real examples
5. Review regularly`;

    // Execute all four calls
    const [part1, part2, part3, part4] = await Promise.all([
      this.generateSection(part1Prompt, systemPrompt),
      this.generateSection(part2Prompt, systemPrompt),
      this.generateSection(part3Prompt, systemPrompt),
      this.generateSection(part4Prompt, systemPrompt)
    ]);

    // Combine all sections
    const fullContent = `# COMPREHENSIVE GLOSSARY
## Generated for: ${description}
## Generated on: ${new Date().toISOString()}

This glossary provides clear definitions and explanations of key terms used throughout the curriculum.

---

${part1}

---

${part2}

---

${part3}

---

${part4}`;

    return fullContent;
  }

  // ============================================================================
  // STEP 10: LESSON PLANS - 10+ pages (5 API calls)
  // ============================================================================

  private async generateStep10(description: string): Promise<string> {
    loggingService.info('Step 10: Generating Lesson Plans in 5 parts');

    const systemPrompt = this.getBaseSystemPrompt() + `

You are an expert instructional designer creating comprehensive, facilitator-ready lesson plans.
Include detailed timing, scripts, activities, and materials lists.
Design for engagement, interactivity, and effective learning.
Plans should be usable by any qualified facilitator with minimal additional preparation.`;

    // Part 1: Lesson Plans 1-2 (Detailed Foundation Lessons)
    const lesson1Prompt = `Create COMPREHENSIVE LESSON PLANS for:

${description}

## LESSON PLANS 1-2: FOUNDATION LESSONS

Create 2 HIGHLY DETAILED lesson plans (90-120 minutes each).

For each lesson plan:

### Lesson X: [Engaging Title]

---

**LESSON OVERVIEW**

| Element | Details |
|---------|---------|
| **Title** | [Descriptive title] |
| **Duration** | 120 minutes |
| **Module** | Module X: [Title] |
| **Topics Covered** | [List topics] |
| **Session Type** | Workshop/Lecture/Seminar |
| **Delivery Mode** | Face-to-face/Online/Hybrid |
| **Materials Needed** | [Summary list] |

---

**LEARNING OBJECTIVES** (5-6 objectives)

By the end of this lesson, participants will be able to:
1. [Objective with Bloom's verb] - *Assessment method*
2. [Objective with Bloom's verb] - *Assessment method*
(Continue for 5-6 objectives)

---

**PRE-LESSON PREPARATION**

*For Facilitator:*
- [ ] Review facilitator notes and slide deck
- [ ] Prepare all handouts and materials
- [ ] Test technology and room setup
- [ ] Review participant backgrounds if available

*For Participants:*
- Pre-reading: [Specific reading with page numbers]
- Pre-work: [Any tasks to complete before session]
- Bring: [Any items participants should bring]

---

**MATERIALS CHECKLIST**

*Facilitator Materials:*
- [ ] Slide deck (X slides)
- [ ] Facilitator guide (this document)
- [ ] Timer/stopwatch
- [ ] Flipchart paper and markers
- [ ] Answer keys for activities

*Participant Materials:*
- [ ] Participant workbook
- [ ] Handout 1: [Title]
- [ ] Handout 2: [Title]
- [ ] Sticky notes
- [ ] Pens

*Technology:*
- [ ] Projector and screen
- [ ] Audio system
- [ ] Laptop with presentation software
- [ ] Internet access (if needed)
- [ ] Backup: USB drive with materials

---

**ROOM SETUP**

[Describe room arrangement: cabaret style, U-shape, etc.]
- Tables arranged for groups of 4-6
- Clear line of sight to screen
- Space for facilitator movement
- Flipcharts positioned at front and sides
- Materials pre-placed at tables

---

**DETAILED SESSION TIMELINE**

**Activity 1: Opening & Hook** (0:00-0:12) - 12 minutes

*Purpose:* Capture attention and establish relevance

*Facilitator Script:*
"Good morning/afternoon everyone! Welcome to [lesson title]. Let me start with a question: [provocative opening question related to topic]..."

*What to Do:*
1. Welcome participants warmly
2. Display opening slide with provocative question/scenario
3. Give participants 2 minutes to think individually
4. Pair discussion for 3 minutes
5. Take 2-3 responses from pairs
6. Bridge to lesson objectives

*Key Points to Make:*
- [Point 1]
- [Point 2]
- [Point 3]

*Transition:*
"The variety of your responses shows why this topic is so important. Today we're going to explore..."

---

**Activity 2: Direct Instruction** (0:12-0:35) - 23 minutes

*Purpose:* Introduce key concepts and frameworks

*Slides to Use:* Slides 3-15

*Facilitator Script:*
"Let's start by understanding the fundamental concept of..."

*Key Content to Cover:*
1. **Concept 1**: [Explanation - key points to make]
2. **Concept 2**: [Explanation - key points to make]
3. **Framework/Model**: [How to explain it - use visual]
4. **Real-world Example**: [Story or case to share]

*Embedded Checks for Understanding:*
- Slide 8: Polling question - "Which of these best describes...?"
- Slide 12: Turn and talk - "Explain to your partner..."

*Common Questions and Responses:*
Q: "[Anticipated question]"
A: "[Suggested response]"

*Transition:*
"Now that we understand the theory, let's apply it..."

---

**Activity 3: Guided Practice** (0:35-0:55) - 20 minutes

*Purpose:* Apply concepts with support

*Instructions for Participants:*
"Working in your table groups, you're going to analyse [scenario/case]. You have 15 minutes to..."

*Handout:* Distribute Handout 1

*What Participants Will Do:*
1. Read the scenario (3 minutes)
2. Discuss key issues (5 minutes)
3. Apply the framework (5 minutes)
4. Prepare 1-minute summary (2 minutes)

*Facilitator Role During Activity:*
- Circulate to all groups
- Listen for interesting points to share
- Provide hints if groups are stuck
- Keep time and give warnings

*Debrief Questions:*
- "What patterns did you notice?"
- "Where did you struggle to apply the framework?"
- "What would you do differently?"

---

(Continue with Activities 4-8 in the same detailed format)

---

**CLOSING & REFLECTION** (1:50-2:00) - 10 minutes

*Key Takeaways:*
Display slide with 3-4 key messages:
1. [Key message 1]
2. [Key message 2]
3. [Key message 3]

*Reflection Prompts:*
"Take 2 minutes to write in your workbook:
- One thing you'll apply immediately
- One question you still have"

*Preview Next Session:*
"Next time, we'll build on this by exploring..."

*Closing Script:*
"Thank you for your engagement today. Remember, the real learning happens when you apply these concepts in your own context. See you next time!"

---

**POST-LESSON**

*For Facilitator:*
- Send follow-up email with key resources
- Note any adjustments needed for next delivery
- Complete attendance and engagement notes

*For Participants:*
- Complete reflection worksheet
- Reading for next session
- Practice activity assignment`;

    // Part 2: Lesson Plans 3-4 (Application Lessons)
    const lesson2Prompt = `Continue creating LESSON PLANS for:

${description}

## LESSON PLANS 3-4: APPLICATION LESSONS

Create 2 more DETAILED lesson plans focused on PRACTICAL APPLICATION.

Use the SAME comprehensive structure but emphasise:
- More hands-on activities
- Case-based learning
- Group problem-solving
- Real-world application exercises
- Skill practice opportunities

Include full facilitator scripts, timing, materials, and debrief questions.`;

    // Part 3: Lesson Plans 5-6 (Advanced/Synthesis Lessons)
    const lesson3Prompt = `Continue creating LESSON PLANS for:

${description}

## LESSON PLANS 5-6: SYNTHESIS & ADVANCED LESSONS

Create 2 DETAILED lesson plans for ADVANCED content and SYNTHESIS.

Use the SAME comprehensive structure but emphasise:
- Integration of multiple concepts
- Critical evaluation activities
- Strategic thinking exercises
- Debate and discussion formats
- Complex case analysis
- Peer learning and teaching

Include challenging discussion questions and advanced facilitator notes.`;

    // Part 4: Workshop/Practical Session Plans
    const workshopPrompt = `Continue creating LESSON PLANS for:

${description}

## WORKSHOP & PRACTICAL SESSION PLANS (2 Sessions)

Create 2 DETAILED workshop/practical session plans.

These should be highly INTERACTIVE and HANDS-ON:

### Workshop X: [Title]

**Workshop Format**: [Simulation/Role-Play/Design Sprint/Hackathon/Skills Lab]

**Duration**: 180 minutes (with breaks)

**Group Size**: Optimal 16-24 participants

---

Include:
1. Detailed preparation requirements
2. Role/team assignments
3. Phase-by-phase breakdown with timing
4. Facilitator intervention points
5. Materials and props needed
6. Observation and assessment criteria
7. Extensive debrief guide
8. Follow-up activities

Make these highly experiential and memorable.`;

    // Part 5: Lesson Plan Templates & Summary
    const summaryPrompt = `Complete the LESSON PLAN PACKAGE for:

${description}

## LESSON PLAN RESOURCES

### QUICK LESSON PLAN TEMPLATE
A blank template facilitators can use to create additional lesson plans.

### ACTIVITY BANK
Collection of 15-20 ready-to-use activities including:
- Icebreakers (3-4)
- Energisers (3-4)
- Discussion techniques (4-5)
- Group activities (4-5)
- Reflection activities (3-4)

For each activity:
- Name and purpose
- Time required
- Instructions
- Materials needed
- Variations

### POWERPOINT SLIDE SUGGESTIONS
For each lesson, outline of recommended slides:
- Title slide
- Learning objectives
- Key content slides
- Activity instruction slides
- Discussion prompts
- Summary slides

### LESSON PLAN PACKAGE SUMMARY

**Total Lessons Created**: X
- Foundation Lessons: 2
- Application Lessons: 2
- Advanced Lessons: 2
- Workshops: 2

**Total Contact Hours**: X hours

**Materials Required Across All Lessons**:
- [Comprehensive list]

**Technology Requirements**:
- [Comprehensive list]

**Facilitator Preparation Time**:
- First delivery: X hours per lesson
- Subsequent deliveries: X hours per lesson

### FACILITATION TIPS

**Before the Session**:
1. Review all materials thoroughly
2. Practice key transitions
3. Anticipate questions
4. Check technology
5. Arrive early for setup

**During the Session**:
1. Start on time
2. Maintain energy
3. Watch time carefully
4. Circulate during activities
5. Be responsive to the room

**After the Session**:
1. Complete reflection notes
2. Send follow-up materials
3. Note improvements for next time`;

    // Execute all five calls
    const [lesson1, lesson2, lesson3, workshop, summary] = await Promise.all([
      this.generateSection(lesson1Prompt, systemPrompt),
      this.generateSection(lesson2Prompt, systemPrompt),
      this.generateSection(lesson3Prompt, systemPrompt),
      this.generateSection(workshopPrompt, systemPrompt),
      this.generateSection(summaryPrompt, systemPrompt)
    ]);

    // Combine all sections
    const fullContent = `# COMPREHENSIVE LESSON PLANS
## Generated for: ${description}
## Generated on: ${new Date().toISOString()}

This package includes detailed, facilitator-ready lesson plans covering the complete curriculum. Each plan includes timing, scripts, activities, materials, and facilitation guidance.

---

${lesson1}

---

${lesson2}

---

${lesson3}

---

${workshop}

---

${summary}`;

    return fullContent;
  }

  // ============================================================================
  // UTILITY: Parse JSON (legacy support - may not be needed now)
  // ============================================================================
  
  private parseJSON(response: string, stepName: string): any {
    try {
      // Try to parse as JSON first
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      // If not JSON, return as content string
      return { content: response };
    } catch (error) {
      loggingService.warn(`Failed to parse JSON for ${stepName}, returning as content`, { error });
      return { content: response };
    }
  }
}

// Export singleton instance
export const standaloneService = new StandaloneService();
