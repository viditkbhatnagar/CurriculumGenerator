# Curriculum Generation System - Complete Documentation

## For Manager Review & Prompt Refinement

---

## 📋 EXECUTIVE OVERVIEW

This document provides a complete breakdown of how our Curriculum Generator system works. The system automatically creates comprehensive, AGI-compliant curricula through multiple stages.

### **The Complete Curriculum Generation Journey**

Our system operates in **5 main stages**:

1. **Stage 1: Project Setup** - User inputs basic program information
2. **Stage 2: AI Research** - AI generates 14 core curriculum components (THIS DOCUMENT)
3. **Stage 3: Resource Evaluation** - Manager reviews generated content and refines prompts
4. **Stage 4: Full Curriculum Generation** - AI creates detailed teaching materials
5. **Stage 5: Final Review & Export** - SMEs approve and export final curriculum

---

## 🎯 STAGE 2: AI RESEARCH SERVICE

### **The 14 Core Components That Build Your Curriculum**

This is where the AI system generates the foundation of your curriculum. Each of the 14 components takes specific information about your program and generates structured, professional content.

**Important Note:** For your manager review, focus on whether the **Simplified Prompts** below accurately capture what you want generated. If the outputs don't match expectations, the prompts may need refinement.

---

## COMPONENT 1: PROGRAM OVERVIEW

**Purpose:** Creates the high-level summary of your entire program

| Aspect             | Details                                                                                                           |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| **Component Name** | Tab 1: Program Overview                                                                                           |
| **What It Does**   | Creates a professional summary that introduces the program, explains its purpose, and describes why it's valuable |
| **Output Format**  | Structured document with multiple sections                                                                        |

### **EXACT PROMPT FROM CODE:**

```
Generate a Program Overview for [PROGRAM_TITLE] - a [TOTAL_HOURS]-hour [LEVEL] course in [DOMAIN].

Include:
- Program title
- Aim (2-3 sentences)
- Qualification type: [QUALIFICATION_TYPE or 'Certification Preparation']
- Industry need (3-4 evidence-based bullet points with recent statistics/trends)
- Target audience: [TARGET_AUDIENCE or 'professionals seeking certification']
- Entry requirements
- Duration: 120 hours self-study
- Career outcomes (3-6 specific job roles)
- Benchmarking vs 2-3 comparable certifications (table format)
- 15 ECTS justification

Return as JSON with fields: programTitle, aim, qualificationType, industryNeed (array), targetAudience, entryRequirements, duration, careerOutcomes (array), benchmarking (array of objects), ectsJustification.
```

### **SIMPLIFIED VERSION FOR REVIEW:**

"Create a compelling program overview that includes:

- What the program is and what it aims to teach
- Why the industry needs this program (with current statistics)
- Who should take this program
- What they'll be able to do after completing it
- How it compares to similar programs
- Why this program is worth 120 hours of study time"

### **WHAT GETS GENERATED:**

- Program title and 2-3 sentence description
- 3-4 bullet points showing why this program matters (backed by industry data)
- List of 3-6 specific job titles students can pursue
- Comparison table showing how your program differs from competitors
- Explanation of study time and credit value

---

## COMPONENT 2: COMPETENCY FRAMEWORK

**Purpose:** Breaks down the knowledge areas and skills students will develop

| Aspect             | Details                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| **Component Name** | Tab 2: Competency & Knowledge Framework                                                                                   |
| **What It Does**   | Identifies the major knowledge areas covered in the program and lists the specific skills students will gain in each area |
| **Output Format**  | Structured list of domains with skills and workplace applications                                                         |

### **EXACT PROMPT FROM CODE:**

```
Generate a Competency Framework for [PROGRAM_TITLE] in [DOMAIN].

Identify [6 or more] knowledge domains. For each domain include:
- Domain name
- 3-5 core skills
- 2-3 workplace applications
- 2-3 credible sources (≤5 years, indicate if academic or industry, with APA 7 citations)

Return as JSON: { knowledgeDomains: [{ domain, coreSkills[], workplaceApplications[], sources[{ citation, type, url, publicationDate }] }] }
```

### **SIMPLIFIED VERSION FOR REVIEW:**

"Identify the main knowledge areas students will study (typically 6-8 areas), and for each one list:

- The 3-5 key skills they'll learn
- How they'll use those skills in real work situations
- Where this knowledge comes from (references from recent books, articles, or industry standards)"

### **WHAT GETS GENERATED:**

- 6-8 major knowledge domains (e.g., "Project Management Fundamentals," "Risk Assessment")
- 3-5 skills listed under each domain
- Real-world examples of how each skill is used in jobs
- 2-3 credible sources cited for each domain

---

## COMPONENT 3: LEARNING OUTCOMES & ASSESSMENT CRITERIA

**Purpose:** Defines what students should be able to do by the end of the program

| Aspect             | Details                                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------------------- |
| **Component Name** | Tab 3: Learning Outcomes & Assessment Criteria                                                             |
| **What It Does**   | Creates specific, measurable statements about what students will achieve, plus the ways to measure success |
| **Output Format**  | Numbered list of outcomes with assessment methods                                                          |

### **EXACT PROMPT FROM CODE:**

```
Generate 5-8 Learning Outcomes for [PROGRAM_TITLE].

Use structure: Verb + Object + Context
Approved verbs: apply, analyse, evaluate, design, recommend, construct, implement, justify

For each outcome:
- Outcome statement (measurable)
- 2-4 Assessment Criteria (observable, active verbs)
- Type: knowledge, skill, or competency
- Bloom's taxonomy level
- Map to competency domains: [DOMAINS_LIST]
- Map to modules (will be defined in next step, use module codes like MOD101, MOD102, etc.)

Return as JSON array: [{ outcomeNumber, outcome, assessmentCriteria[], type, bloomLevel, mappedDomains[], mappedModules[] }]
```

### **SIMPLIFIED VERSION FOR REVIEW:**

"Write 5-8 statements that describe what students should be able to DO after completing the program. Each statement should:

- Start with an action word (apply, analyse, design, evaluate, etc.)
- Be specific enough to test/measure
- Include real-world context
- Also list 2-4 specific ways you'd know if they achieved it"

### **WHAT GETS GENERATED:**

- 5-8 numbered learning outcome statements (e.g., "Apply project management techniques to develop realistic timelines for complex assignments")
- For each outcome: 2-4 measurable criteria (e.g., "Student creates a project plan with realistic milestones")
- Classification of each outcome (knowledge vs skill vs competency)
- Difficulty level based on Bloom's taxonomy
- Which knowledge domains and modules support each outcome

---

## COMPONENT 4: COURSE FRAMEWORK

**Purpose:** Organizes the program into modules with structured lesson plans

| Aspect             | Details                                                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| **Component Name** | Tab 4: Course Framework                                                                                                 |
| **What It Does**   | Creates the structure of the program - how many modules, how many hours each, what topics covered, how assessments work |
| **Output Format**  | Detailed module specifications with week-by-week breakdown                                                              |

### **EXACT PROMPT FROM CODE:**

```
Generate a Course Framework for [PROGRAM_TITLE] - 120 hours total, 6-8 modules.

For each module:
- Module code (format: [FORMAT] e.g., MOD101, MOD102)
- Title
- Aim (1 sentence)
- Hours (distribute 120 hours across modules, mark as core or elective)
- Objectives (3-6, align to the [OUTCOME_COUNT] learning outcomes)
- Key topics (bulleted)
- Indicative content
- Assessment types
- Assessment policy (weightings, pass threshold, reassessment)
- Self-study guidance (reading, practice, assessment hours breakdown)

Also include mapping table showing which modules map to which learning outcomes and competency domains.

Return as JSON: { modules: [{moduleCode, title, aim, hours, classification, objectives[], keyTopics[], indicativeContent[], assessmentTypes[], assessmentPolicy{}, selfStudyGuidance{}}], mappingTable: [{moduleCode, learningOutcomes[], competencyDomains[]}] }
```

### **SIMPLIFIED VERSION FOR REVIEW:**

"Create a structured plan for the 120-hour program with 6-8 modules. For each module:

- Give it a code (like MOD101) and descriptive title
- Write a one-sentence description of what the module is about
- Allocate hours (add up to 120 total)
- List the main topics covered
- Describe what assessments students will do (quizzes, projects, exams)
- Explain how much time students should spend on reading vs practice vs testing
- Show which learning outcomes this module teaches"

### **WHAT GETS GENERATED:**

- 6-8 modules with codes, titles, and descriptions
- Hour allocation for each module (totaling 120 hours)
- 3-6 learning objectives per module
- Key topics list for each module
- Assessment breakdown showing types and weightings
- Self-study guidance (e.g., "5 hours reading, 10 hours practice, 2 hours assessment")
- Mapping table showing which modules teach which outcomes

---

## COMPONENT 5: TOPIC-LEVEL SOURCES

**Purpose:** Identifies credible sources for each specific topic

| Aspect             | Details                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| **Component Name** | Tab 5: Topic-Level Sources                                                                        |
| **What It Does**   | For each major topic, finds 2-3 credible academic or industry sources that students can reference |
| **Output Format**  | Topic list with associated sources and citations                                                  |

### **EXACT PROMPT FROM CODE:**

```
Generate Topic-Level Sources for [PROGRAM_TITLE].

For each of these topics: [TOPICS_LIST from modules]

Provide 2-3 verified sources (≥1 academic, ≥1 industry):
- Full APA 7 citation
- URL or DOI
- Mark link as accessible (assume true)
- Verification date (today)
- One-sentence explanation linking to topic and learning outcome

Return as JSON array: [{ topic, moduleCode, sources[{ citation, type, url, doi, linkAccessible, verificationDate, explanation, linkedOutcome }] }]
```

### **SIMPLIFIED VERSION FOR REVIEW:**

"For each topic in the course modules (up to 10 main topics), find:

- At least one academic source (research papers, textbooks, scholarly articles)
- At least one industry source (professional guides, standards, white papers)
- For each source: full citation, web link, and brief explanation of how it relates to the topic"

### **WHAT GETS GENERATED:**

- List of main course topics (extracted from modules)
- For each topic: 2-3 source citations (academic journals, industry reports, textbooks)
- Complete source information (author, year, URL, whether link works)
- One-sentence explanation of why each source is relevant

---

## COMPONENT 6: READING LIST

**Purpose:** Compiles essential and supplementary readings for the program

| Aspect             | Details                                                                                                               |
| ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| **Component Name** | Tab 6: Reading List                                                                                                   |
| **What It Does**   | Creates two lists - essential readings that support learning outcomes, and additional readings for deeper exploration |
| **Output Format**  | Organized bibliography with reading time estimates                                                                    |

### **EXACT PROMPT FROM CODE:**

```
Generate Indicative & Additional Reading Lists for [PROGRAM_TITLE].

Indicative readings (required): 5-8 items
Additional readings (supplementary): 5-8 items

For each:
- Full APA 7 citation
- Type: book, guide, report, or website
- Synopsis (1-2 sentences)
- Estimated reading time
- URL if available

Return as JSON: { indicative: [{ citation, type, synopsis, estimatedReadingTime, url }], additional: [...] }
```

### **SIMPLIFIED VERSION FOR REVIEW:**

"Create two reading lists:

1. Essential readings (5-8 items) - Books, articles, or guides students MUST read
2. Additional readings (5-8 items) - Optional resources for deeper learning

For each item include:

- Full citation (author, title, year)
- Type of resource (book, article, website guide)
- What it's about (1-2 sentences)
- How long it takes to read
- Web link (if available)"

### **WHAT GETS GENERATED:**

- 5-8 essential readings with full citations and brief descriptions
- 5-8 additional readings with same information
- Estimated reading time for each (e.g., "45 minutes," "2 hours")
- Resource type classification
- Working URLs where available

---

## COMPONENT 7: ASSESSMENTS & MAPPING

**Purpose:** Creates test questions, case study problems, and marking guides

| Aspect             | Details                                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------------------------- |
| **Component Name** | Tab 7: Assessments & Mapping                                                                                |
| **What It Does**   | Generates multiple-choice questions, real-world case study questions, expected answers, and marking rubrics |
| **Output Format**  | Question bank with answers, rubrics, and outcome mappings                                                   |

### **EXACT PROMPT FROM CODE:**

```
Generate Assessments for [PROGRAM_TITLE] - [MODULE_COUNT] modules.

For each module generate:
1. 5-10 MCQs:
   - Stem (question)
   - 4 options (A, B, C, D)
   - Correct answer
   - Rationale (1-2 sentences with source)
   - Link to learning outcome number
   - Link to assessment criterion
   - Bloom's level (application, analysis, or evaluation)

2. 1-2 Case Questions:
   - Prompt (150-300 words, realistic scenario)
   - Expected response outline
   - Marking rubric (bands with marks and descriptors)
   - Linked outcomes and criteria

Return as JSON: { mcqs: [{moduleCode, questionNumber, stem, options{A,B,C,D}, correctAnswer, rationale, linkedOutcome, linkedCriterion, bloomLevel}], caseQuestions: [{moduleCode, caseNumber, prompt, expectedResponse, markingRubric[], linkedOutcomes[], linkedCriteria[]}] }
```

### **SIMPLIFIED VERSION FOR REVIEW:**

"Create two types of assessment questions for each module:

1. Multiple Choice Questions (5-10 per module):
   - Write the question
   - Provide 4 answer options (A, B, C, D)
   - Indicate the correct answer
   - Explain why it's correct (with a source)
   - Difficulty level
   - Which learning outcome it tests

2. Case Study Questions (1-2 per module):
   - Describe a realistic business/professional scenario (150-300 words)
   - Explain what a good answer should include
   - Create a marking scale (e.g., Excellent/Good/Satisfactory/Poor) with points
   - Which learning outcomes it tests"

### **WHAT GETS GENERATED:**

- 5-10 multiple-choice questions per module with 4 options each
- Correct answer key with explanation
- Case study scenarios (150-300 words) describing realistic situations
- Expected answer outlines
- Marking rubrics with bands (Excellent, Good, Satisfactory, Needs Improvement) and point allocations
- Links between each question and learning outcomes being tested

---

## COMPONENT 8: GLOSSARY

**Purpose:** Defines all key terms used in the program

| Aspect             | Details                                                                                |
| ------------------ | -------------------------------------------------------------------------------------- |
| **Component Name** | Tab 8: Glossary                                                                        |
| **What It Does**   | Creates a comprehensive dictionary of specialized terms with definitions and citations |
| **Output Format**  | Alphabetical list with citations                                                       |

### **EXACT PROMPT FROM CODE:**

```
Generate a Glossary of 30-50 key terms for [PROGRAM_TITLE].

For each term:
- Term name
- Definition (≤30 words)
- APA 7 citation (credible source)

Return as JSON array: [{ term, definition, citation }]
```

### **SIMPLIFIED VERSION FOR REVIEW:**

"Create a glossary of 30-50 specialized terms used throughout the program. For each term:

- The term name
- A clear definition in 30 words or less
- Where that definition comes from (book/article citation)"

### **WHAT GETS GENERATED:**

- 30-50 key terms relevant to the program subject
- Clear, concise definitions (max 30 words)
- Credible source citations for each definition

---

## COMPONENT 9: CASE STUDIES

**Purpose:** Provides realistic business scenarios for learning application

| Aspect             | Details                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------- |
| **Component Name** | Tab 9: Case Studies                                                                       |
| **What It Does**   | Creates 2-3 detailed case studies based on real or realistic organizations and situations |
| **Output Format**  | Narrative case studies with learning points                                               |

### **EXACT PROMPT FROM CODE:**

```
Generate 2-3 Case Studies for [PROGRAM_TITLE].

For each case:
- Title
- Organisation (real or anonymised)
- Description (150-300 words)
- 2-3 learning takeaways
- APA 7 citation with URL
- Year (≤5 years old)
- Module code it relates to

Return as JSON array: [{ caseNumber, title, organisation, description, learningTakeaways[], citation, url, year, moduleCode }]
```

### **SIMPLIFIED VERSION FOR REVIEW:**

"Create 2-3 real-world (or realistic) case studies that show how the program topics apply in practice. For each case:

- Give it a title
- Name the organization (real company or anonymized)
- Describe the situation in detail (150-300 words)
- List 2-3 lessons students should learn from this case
- Cite where this case came from (with web link)
- Indicate which module this case relates to"

### **WHAT GETS GENERATED:**

- 2-3 detailed case studies (150-300 words each)
- Real or realistic organization names
- 2-3 key learning points per case
- Full citations with URLs
- Links to relevant modules
- Publication date (ensuring recent, credible sources)

---

## COMPONENT 10: DELIVERY & DIGITAL TOOLS

**Purpose:** Specifies the technology and delivery method for the program

| Aspect             | Details                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| **Component Name** | Tab 10: Delivery & Digital Tools                                                                                    |
| **What It Does**   | Lists the digital tools, learning management systems features, and technical requirements for delivering the course |
| **Output Format**  | Structured specification of tools and features                                                                      |

### **EXACT PROMPT FROM CODE:**

```
Generate Delivery & Digital Tools specification for [PROGRAM_TITLE].

Include:
- Delivery mode (self-study)
- Interactive elements (simulations, quizzes, peer review, etc.)
- Required LMS features (SCORM/xAPI, progress tracking, timed assessments, etc.)
- Recommended digital tools
- Minimum technical requirements

Return as JSON: { deliveryMode, interactiveElements[], lmsFeatures[], digitalTools[], technicalRequirements[] }
```

### **SIMPLIFIED VERSION FOR REVIEW:**

"Specify how the program will be delivered:

- How students will access it (online self-study)
- What interactive activities it will include (quizzes, simulations, discussions, etc.)
- What learning platform features are needed (progress tracking, timed tests, etc.)
- What software/tools students or instructors should use
- What computer/internet requirements students need"

### **WHAT GETS GENERATED:**

- Delivery format (e.g., "Self-study online course")
- List of interactive elements (simulations, quizzes, peer reviews, discussions)
- Required LMS features (SCORM compliance, progress tracking, timed assessments)
- Recommended tools (Zoom, Google Drive, specialized software, etc.)
- Technical requirements (browser type, internet speed, device type)

---

## COMPONENT 11: REFERENCES

**Purpose:** Compiles all citations used throughout the curriculum

| Aspect             | Details                                                                    |
| ------------------ | -------------------------------------------------------------------------- |
| **Component Name** | Tab 11: References                                                         |
| **What It Does**   | Creates a complete bibliography of all sources cited across all components |
| **Output Format**  | Alphabetical list in APA 7 format                                          |

### **EXACT PROMPT FROM CODE:**

```
Compile a complete References list in APA 7 format from all sources cited in the preliminary curriculum package.

Extract all citations from:
- Competency Framework sources
- Topic-Level Sources
- Reading Lists
- Assessments
- Glossary
- Case Studies

Return as a single string with each reference on a new line, alphabetically sorted.
```

### **SIMPLIFIED VERSION FOR REVIEW:**

"Compile one complete reference list of all sources mentioned throughout the curriculum (from competencies, readings, assessments, case studies, etc.). Format each in APA 7 style and sort alphabetically."

### **WHAT GETS GENERATED:**

- Complete bibliography (30-80 sources typical)
- All sources in APA 7 format
- Alphabetically sorted
- De-duplicated (each source appears once)
- Single document format

---

## COMPONENT 12: SUBMISSION METADATA

**Purpose:** Documents details about the curriculum submission

| Aspect             | Details                                                        |
| ------------------ | -------------------------------------------------------------- |
| **Component Name** | Tab 12: Submission Metadata                                    |
| **What It Does**   | Records administrative information and compliance verification |
| **Output Format**  | Structured metadata document                                   |

### **EXACT PROMPT FROM CODE:**

```
Generate Submission Metadata for [PROGRAM_TITLE].

Include:
- Author name: "[SME Name to be filled]"
- Professional credentials: "[To be filled by SME]"
- Organisation: "[Optional]"
- Submission date: today's date
- Conflict of interest: "None declared"
- QA checklist (all items checked):
  * All topics have 2-3 sources with ≥1 academic and ≥1 industry
  * Total hours = 120 and modules = 6-8
  * Learning outcomes measurable (verb+object+context)
  * Assessments mapped to outcomes and criteria
  * Glossary entries 30-50 with citations
  * File naming convention followed
- QA verification summary
- AGI compliant: true

Return as JSON: { authorName, professionalCredentials, organisation, submissionDate, conflictOfInterest, qaChecklist{}, qaVerificationSummary, agiCompliant }
```

### **SIMPLIFIED VERSION FOR REVIEW:**

"Create a checklist confirming that the curriculum meets all standards:

- Author information (will be filled in by Subject Matter Expert)
- Confirmation that all topics have credible sources
- Confirmation of hour and module counts
- Verification that all learning outcomes are properly measured
- Confirmation that assessments match learning outcomes
- Overall compliance confirmation"

### **WHAT GETS GENERATED:**

- Submission date and author fields (to be completed by SME)
- QA checklist with all items marked complete
- Verification summary
- AGI compliance confirmation
- Conflict of interest statement

---

## COMPONENT 13: OUTCOME WRITING GUIDE

**Purpose:** Provides instructions for writing effective learning outcomes

| Aspect             | Details                                                                         |
| ------------------ | ------------------------------------------------------------------------------- |
| **Component Name** | Tab 13: Outcome Writing Guide                                                   |
| **What It Does**   | Creates a guide with examples showing how to write measurable learning outcomes |
| **Output Format**  | Instructional document with examples                                            |

### **EXACT PROMPT FROM CODE:**

```
Generate an Outcome Writing Guide for [PROGRAM_TITLE].

Provide:
1. An introduction (2-3 sentences) explaining how to write effective learning outcomes using the Verb + Object + Context structure
2. At least 5 examples, each with:
   - verb: A Bloom's taxonomy verb (apply, analyse, evaluate, design, recommend, construct, implement, justify)
   - example: A complete learning outcome following Verb + Object + Context (e.g., "Analyze financial statements to identify business performance trends in multinational corporations")

Return as JSON:
{
  "introduction": "string",
  "examples": [
    { "verb": "apply", "example": "Apply statistical methods to..." },
    { "verb": "analyse", "example": "Analyse market data to..." },
    ...
  ]
}
```

### **SIMPLIFIED VERSION FOR REVIEW:**

"Create a helpful guide that shows SMEs how to write good learning outcomes. Include:

- A brief explanation of the formula: Action Verb + What They'll Do + Real-World Context
- At least 5 examples of well-written outcomes
- Show different action verbs (apply, analyze, design, evaluate, etc.)
- For each example, show the full outcome statement"

### **WHAT GETS GENERATED:**

- Brief introduction to outcome writing
- 5+ examples of properly structured outcomes
- Examples of good action verbs (apply, analyse, evaluate, design, recommend, construct, implement, justify)
- Each example shows the complete structure: verb + object + context

---

## COMPONENT 14: COMPARATIVE BENCHMARKING

**Purpose:** Compares your program to competitor certifications

| Aspect             | Details                                                                     |
| ------------------ | --------------------------------------------------------------------------- |
| **Component Name** | Tab 14: Comparative Benchmarking                                            |
| **What It Does**   | Identifies 2-3 similar programs and explains what makes your program unique |
| **Output Format**  | Comparison summary                                                          |

### **EXACT PROMPT FROM CODE:**

```
Generate Comparative Benchmarking for [PROGRAM_TITLE] in [DOMAIN].

Compare with 2-3 competitor certifications:
- Certification name
- Issuing body
- Level
- Key comparison points (what makes our program different/better)

Return as JSON array: [{ competitorCert, issuer, level, comparisonNotes }]
```

### **SIMPLIFIED VERSION FOR REVIEW:**

"Identify 2-3 similar programs or certifications that compete with yours, and for each one explain:

- The certification name
- Who issues it
- What level of qualification it is
- How your program is different or better"

### **WHAT GETS GENERATED:**

- 2-3 competing programs/certifications identified
- Issuing organization for each
- Qualification level
- Comparison notes showing unique advantages
- Positioning information

---

## 📊 COMPONENT SUMMARY TABLE

| #   | Component            | Purpose                            | Generates                                  | Placeholders                       |
| --- | -------------------- | ---------------------------------- | ------------------------------------------ | ---------------------------------- |
| 1   | Program Overview     | High-level program summary         | Title, aims, career outcomes, benchmarking | [PROGRAM_TITLE], [LEVEL], [DOMAIN] |
| 2   | Competency Framework | Knowledge areas & skills           | 6-8 domains with skills & sources          | [DOMAIN] count varies              |
| 3   | Learning Outcomes    | What students will do              | 5-8 measurable outcomes                    | [OUTCOME_COUNT]                    |
| 4   | Course Framework     | Module structure & hours           | 6-8 modules with 120 hours total           | Module codes pattern               |
| 5   | Topic Sources        | Source citations per topic         | 2-3 sources per main topic                 | [TOPICS_LIST]                      |
| 6   | Reading List         | Essential & supplementary readings | 5-8 + 5-8 items with times                 | Program specifics                  |
| 7   | Assessments          | MCQs, case studies, rubrics        | Questions + marking schemes                | Module count                       |
| 8   | Glossary             | Key term definitions               | 30-50 terms with citations                 | Domain-specific                    |
| 9   | Case Studies         | Real-world scenarios               | 2-3 detailed cases with takeaways          | Organization examples              |
| 10  | Delivery Tools       | Technical requirements             | Platform & tool specifications             | Delivery mode                      |
| 11  | References           | Complete bibliography              | Compiled citation list (APA 7)             | Auto-compiled                      |
| 12  | Metadata             | Compliance documentation           | Checklist & verification                   | SME to complete                    |
| 13  | Outcome Guide        | Example learning outcomes          | Instructional examples                     | Program domain                     |
| 14  | Benchmarking         | Competitor analysis                | Comparison with 2-3 similar programs       | Competitors in field               |

---

---

# 🚀 STAGE 4: CURRICULUM GENERATION SERVICE

## **Full Curriculum Package Generation & Workflows**

After the AI Research phase generates the 14 core components, **Stage 4** takes those components and creates complete, detailed teaching materials.

---

## STAGE 4 WORKFLOW OVERVIEW

| Phase                    | Purpose                                            | What's Generated                                       | Time      |
| ------------------------ | -------------------------------------------------- | ------------------------------------------------------ | --------- |
| **Module Plans**         | Detailed week-by-week lesson plans for each module | Weekly breakdowns, activities, assessments             | 10-15 min |
| **Case Studies**         | Expanded case studies with discussion questions    | Full scenarios, discussion Qs, marking rubrics         | 5-10 min  |
| **Simulations**          | Practical hands-on activities                      | Simulation instructions, datasets, evaluation criteria | 5-10 min  |
| **Assessment Bank**      | Question pools for testing                         | MCQ banks, short answer questions                      | 5-10 min  |
| **Rubrics**              | Detailed marking guides                            | Rubrics for 4 assessment types                         | 5 min     |
| **Slide Decks**          | Presentation materials                             | Branded slides with speaker notes                      | 10-15 min |
| **Sources Compilation**  | Complete reference library                         | All citations compiled in APA 7                        | 2-3 min   |
| **AGI Compliance Check** | Verification of standards                          | Compliance score & gap report                          | 2-3 min   |

---

## WORKFLOW 1: MODULE PLANS GENERATION

**What It Does:** Takes each module from the Course Framework and creates a detailed week-by-week lesson plan.

### **What's Generated:**

```
For each module, creates:
- Week-by-week breakdown (if 20-hour module = ~2 weeks, 40-hour = ~3 weeks, etc.)
- For EACH WEEK:
  * Topics to cover (from key topics list)
  * Learning activities (readings, exercises, discussions)
  * Formative assessments (quizzes, practice exercises)
  * Estimated hours breakdown
- Assessment schedule showing:
  * Assessment type (quiz, assignment, project)
  * Due date (relative: "Week 3")
  * Weight/percentage (40% = major assessment)
```

### **Example Output:**

```
Module: MOD101 - Project Management Fundamentals (20 hours)

Week 1:
- Topics: PM Overview, Key Processes, Historical Context
- Activities:
  * Read Chapter 1-2 of [Textbook] (3 hours)
  * Watch video: "PM in Practice" (1 hour)
  * Complete practice exercise: Plan a simple project (2 hours)
- Assessment: Formative quiz (30 min, ungraded)

Week 2:
- Topics: Scope Definition, Resource Planning
- Activities:
  * Case study analysis: [Real project example]
  * Group discussion: Common pitfalls
  * Hands-on: Create WBS for sample project
- Assessment: Graded assignment due (Week 2)

Assessment Schedule:
- Weekly quizzes: 10%
- Mid-module assignment: 30%
- Final project: 60%
```

---

## WORKFLOW 2: CASE STUDIES EXPANSION

**What It Does:** Expands the 2-3 basic case studies from Component 9 into full teaching cases.

### **What's Generated:**

```
For EACH case study:
- Full scenario description (500-800 words with realistic details)
- 5-7 discussion questions aligned to learning outcomes
- Marking rubric showing:
  * 4 performance levels (Excellent, Good, Satisfactory, Needs Improvement)
  * What each level looks like
  * Points for each level
- Expected learning outcomes for students
- All source citations (APA 7)
```

### **Example Output:**

```
Case Study: "Digital Transformation at Global Manufacturing Ltd"

Full Scenario (expanded to 600+ words):
[Detailed narrative about company facing digital challenges, competitors using AI/automation, resistance from employees, budget constraints...]

Discussion Questions:
1. What organizational change management strategies could help Global Manufacturing overcome resistance?
2. How would you prioritize the digital transformation initiatives given budget constraints?
3. What risks do you foresee, and how would you mitigate them?
4. Which learning outcome does this case address? → LO3: "Evaluate organizational change strategies"

Marking Rubric:
Excellent (90-100):
- Identifies 5+ change management strategies with clear rationale
- Addresses budget constraints creatively
- References relevant frameworks and sources

Good (75-89):
- Identifies 3-4 strategies with adequate reasoning
- Acknowledges budget constraints
- Uses some evidence

Satisfactory (60-74):
- Identifies 2-3 strategies
- Basic reasoning
- Limited evidence

Needs Improvement (<60):
- Identifies fewer than 2 strategies
- Weak reasoning
- No supporting evidence

Learning Outcomes Addressed:
- LO3: Evaluate organizational change strategies
- LO5: Apply cost-benefit analysis
```

---

## WORKFLOW 3: SIMULATIONS GENERATION

**What It Does:** Creates hands-on practical activities where students apply skills in realistic scenarios.

### **What's Generated:**

```
For EACH simulation:
- Title and clear learning objective
- Step-by-step instructions (what students will do)
- Dataset description (what data/tools they'll use)
- Realistic procedure to follow
- Evaluation criteria (what you're checking)
- Expected outputs (what a good result looks like)
- Source citations
```

### **Example Output:**

```
Simulation: "Budget Forecasting Exercise"

Objective: Apply forecasting techniques to real financial data

Instructions for Students:
1. Download the provided 3-year revenue data (Excel file)
2. Using statistical methods, forecast revenue for next 2 quarters
3. Create a presentation explaining your methodology
4. Present findings to simulated executive team

Dataset: Historical quarterly revenue data (2021-2024) for a mid-size tech company
- Revenue by product line
- Regional sales breakdown
- Seasonal patterns

Step-by-Step Procedure:
1. Clean and analyze the data (identify trends, seasonality, anomalies)
2. Select appropriate forecasting method (moving average, exponential smoothing, regression)
3. Calculate forecast with confidence intervals
4. Create visualizations
5. Prepare presentation

Evaluation Criteria:
- Appropriate method selection (20%)
- Accuracy of calculations (30%)
- Quality of visualizations (20%)
- Clarity of presentation (30%)

Expected Output:
- Spreadsheet showing calculations
- 2 visualizations (trend chart, forecast chart)
- 5-slide presentation with key findings
```

---

## WORKFLOW 4: ASSESSMENT BANK EXPANSION

**What It Does:** Expands the initial assessment questions into a comprehensive question pool organized by difficulty and learning outcome.

### **What's Generated:**

```
For each module:
- All multiple-choice questions with:
  * Question ID (MCQ_101_01)
  * Question text
  * 4 options (A, B, C, D)
  * Correct answer
  * Explanation
  * Difficulty level (Easy/Medium/Hard)
  * Learning outcome it tests
  * Bloom's level

- Organized by:
  * Module
  * Learning outcome
  * Difficulty
  * Bloom's level
```

### **Example Output:**

```
Assessment Bank Format:

Module: MOD101 (20 questions total)

Easy Level (LO1):
MCQ_101_01: "Which of the following is NOT a process group in project management?"
- A) Planning
- B) Monitoring & Controlling
- C) Closing
- D) Budgeting [CORRECT]
Explanation: Budgeting is part of Planning, not a separate process group...
Linked Outcome: LO1 "Understand core PM concepts"
Bloom's Level: Remember

Medium Level (LO2):
MCQ_101_05: "A project manager discovers the project is 2 weeks behind schedule..."
- A) Immediately crash the schedule
- B) Analyze root cause and options [CORRECT]
- C) Inform client of penalty
- D) Request more budget
Explanation: Good project management requires root cause analysis...
Linked Outcome: LO2 "Apply PM techniques"
Bloom's Level: Apply

Hard Level (LO3):
MCQ_101_12: "Comparing WATERFALL vs AGILE approaches for a new product..."
- A) Waterfall always costs less
- B) Agile provides more flexibility [CORRECT]
- C) Waterfall is faster
- D) Agile requires no planning
Explanation: Context-dependent choice, but Agile's iterative nature...
Linked Outcome: LO3 "Evaluate PM methodologies"
Bloom's Level: Evaluate
```

---

## WORKFLOW 5: RUBRICS GENERATION

**What It Does:** Creates standardized marking guides for different assessment types.

### **What's Generated:**

```
Creates rubrics for 4 common assessment types:
1. Case Study Analysis
2. Simulation Report
3. Essay
4. Project Work

Each rubric includes:
- 4-6 assessment criteria
- 4 performance levels for each criterion:
  * Excellent (90-100 points)
  * Good (75-89 points)
  * Satisfactory (60-74 points)
  * Needs Improvement (<60 points)
- Clear descriptors for each level
- Total points allocation
```

### **Example Output:**

```
RUBRIC: Case Study Analysis

Total Points: 100

Criterion 1: Problem Identification (20 points)
- Excellent (18-20): Identifies all key problems, underlying causes, and interconnections
- Good (15-17): Identifies main problems and some underlying causes
- Satisfactory (12-14): Identifies primary problem but misses interconnections
- Needs Improvement (<12): Identifies problem but lacks depth of analysis

Criterion 2: Application of Concepts (25 points)
- Excellent (23-25): Applies 5+ relevant frameworks with precision
- Good (19-22): Applies 3-4 frameworks correctly
- Satisfactory (15-18): Applies 2-3 frameworks with minor errors
- Needs Improvement (<15): Applies fewer frameworks or with significant errors

Criterion 3: Solution Development (25 points)
- Excellent (23-25): Proposes creative, feasible, well-justified solutions
- Good (19-22): Proposes 2-3 practical solutions with reasonable justification
- Satisfactory (15-18): Proposes basic solutions with limited justification
- Needs Improvement (<15): Solutions are impractical or poorly justified

Criterion 4: Supporting Evidence (20 points)
- Excellent (18-20): Uses 5+ credible, recent sources appropriately
- Good (15-17): Uses 3-4 credible sources
- Satisfactory (12-14): Uses 2-3 sources, some credibility issues
- Needs Improvement (<12): Few sources or weak credibility

Criterion 5: Communication (10 points)
- Excellent (9-10): Clear, professional, well-organized writing
- Good (8): Clear writing with minor issues
- Satisfactory (7): Adequate clarity with some organizational issues
- Needs Improvement (<7): Poor clarity or organization
```

---

## WORKFLOW 6: SLIDE DECKS GENERATION

**What It Does:** Creates presentation slide outlines for each module with speaker notes.

### **What's Generated:**

```
For EACH module:
- Slide-by-slide content outline:
  * Slide 1: Title slide
  * Slide 2: Learning objectives
  * Slides 3-N: Topic slides (one per key topic)
    - Title
    - 3-5 bullet points
    - Visual suggestion (image description)
  * Final slide: Summary & key takeaways

For each slide:
- Speaker notes
- Suggested visuals
- Transition notes
- Timing recommendation
```

### **Example Output:**

```
Module: MOD101 - Project Management Fundamentals

Slide Deck Structure:

SLIDE 1: Title Slide
- Title: "Project Management Fundamentals"
- Subtitle: "[Program Name]"
- Visual: Professional business header image
- Speaker Notes: Welcome & agenda overview

SLIDE 2: Learning Objectives
- What you'll learn: LO1, LO2, LO3
- By end of module: you'll be able to...
- Visual: Icons for each objective
- Speaker Notes: (1 min) Outline the three main topics

SLIDE 3: What is Project Management?
Content:
- Traditional definition: "Temporary endeavor with defined goals"
- Modern view: Managing scope, time, quality, resources
- Why it matters: Delivers value, manages risk
- Real example: [Case study company]
Visual: Timeline showing traditional waterfall phases
Speaker Notes: (3 min) Define PM using industry examples. Reference [Source]

SLIDE 4: The Five Process Groups
Content:
- Initiating: Define project
- Planning: Create roadmap
- Executing: Perform work
- Monitoring & Controlling: Track progress
- Closing: Finalize & learn
Visual: Circular process diagram
Speaker Notes: (5 min) Walk through each process, give examples

[Continue for remaining slides...]

FINAL SLIDE: Summary & Next Steps
- Key takeaways: 3-4 main points
- Assessment: Quiz due Monday
- Module 2 preview: [Next topic]
- Visual: Summary infographic
- Speaker Notes: Recap and transition
```

---

## WORKFLOW 7: SOURCES COMPILATION

**What It Does:** Gathers all citations used throughout the curriculum into one master reference list.

### **What's Generated:**

```
Complete bibliography with:
- ALL sources from:
  * Competency Framework
  * Topic Sources
  * Reading Lists
  * Assessments
  * Glossary
  * Case Studies
  * Slide decks
  * Any other materials

- Formatted in APA 7
- Alphabetically sorted
- De-duplicated
- One master list
```

### **Example Output:**

```
COMPLETE REFERENCES

Bergman, S., & Johnson, L. (2023). Digital transformation in manufacturing:
  Challenges and opportunities. Journal of Business Technology, 45(3), 234-251.

Kotter, J. P. (2023). Leading change in organizations: A framework for success
  (4th ed.). Harvard Business Review Press.

Kumar, R., & Zhang, Y. (2023). Machine learning applications in supply chain
  management. International Journal of Operations Research, 28(4), 445-462.

[50+ more entries in alphabetical order...]
```

---

## WORKFLOW 8: AGI COMPLIANCE VALIDATION

**What It Does:** Automatically checks that the entire curriculum meets AGI standards.

### **What's Checked:**

```
Automated Verification:
✓ All materials have credible citations
✓ Sources are from last 5 years
✓ Mix of academic and industry sources
✓ Total hours = 120
✓ Modules = 6-8
✓ Learning outcomes are measurable
✓ Assessments mapped to outcomes
✓ Rubrics defined for all assessments
✓ Slide decks exist for all modules
✓ APA 7 formatting correct

Compliance Score: 85-100 = Excellent
                  70-84 = Good
                  50-69 = Needs Revision
                  <50 = Requires Major Rework
```

### **Example Output:**

```
AGI COMPLIANCE REPORT

Compliance Score: 94/100 ✓ EXCELLENT

Issues Found (1):
- WARNING: 1 slide deck missing speaker notes (minor)

Strengths:
✓ All 48 assessment questions mapped to outcomes
✓ 156 total sources in APA 7 format
✓ Case studies have detailed rubrics
✓ 7 simulations created with evaluation criteria
✓ Module plans complete for all 7 modules

Status: READY FOR SME REVIEW
Next Step: Send to Subject Matter Expert for final approval
```

---

---

# 🎓 KEY WORKFLOW DIAGRAM

```
STAGE 2: AI RESEARCH (14 Components Generated)
        ↓
    [Program Overview, Competencies, Learning Outcomes, Course Framework,
     Topic Sources, Reading List, Assessments, Glossary, Case Studies,
     Delivery Tools, References, Metadata, Outcome Guide, Benchmarking]
        ↓
STAGE 3: MANAGER REVIEW & REFINEMENT
        ↓
    [Review prompts, request changes if needed, approve or refine]
        ↓
STAGE 4: FULL CURRICULUM GENERATION
        ↓
    [Module Plans → Case Studies → Simulations → Assessment Bank →
     Rubrics → Slide Decks → Sources Compilation → AGI Compliance Check]
        ↓
STAGE 5: SME REVIEW & EXPORT
        ↓
    [Subject Matter Expert final review, approval, export to formats]
```

---

# 📝 NOTES FOR MANAGER REVIEW

When reviewing the 14 components:

1. **Check the Simplified Prompts** - Do they ask for what you want generated?
2. **Review Expected Outputs** - Are the descriptions of what gets generated clear?
3. **Identify Issues** - If outputs aren't right, likely the prompt needs refinement
4. **Placeholder Usage** - Confirm placeholders like [PROGRAM_TITLE], [DOMAIN] make sense
5. **Source Requirements** - Confirm the academic/industry source mix requirements are appropriate

**Common Refinement Areas:**

- Component specificity (too broad vs too narrow)
- Content depth (surface-level vs detailed)
- Example quality (real-world relevance)
- Citation currency (5 years = too old for your field?)
- Output format preferences

---

**Document Version:** 1.0
**Generated For:** Manager Review & Prompt Refinement
**Last Updated:** 2024
**Stage Focus:** Stage 2 (AI Research) + Stage 4 (Full Curriculum Generation)
