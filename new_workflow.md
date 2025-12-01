# AI-Integrated Curriculum Generator

## Complete Workflow for Vocational Education Programs

**Version:** 2.2 Final (Updated with Contact Hours Guidance)  
**Date:** November 2025  
**Status:** Production-Ready with Academic Standards Integration

---

## Executive Overview

This document outlines the complete process for creating accreditation-ready vocational education programs using our AI-Integrated Curriculum Generator. The system guides Subject Matter Experts (SMEs) through 9 structured steps to produce comprehensive, high-quality curriculum materials in approximately 2-3 hours.

### Key Benefits

✓ **Efficiency:** Reduces curriculum development time from weeks to hours  
✓ **Quality:** Built-in quality checks ensure compliance with OFQUAL, HLC, Bologna standards and AGI Academic Standards  
✓ **Consistency:** Standardized approach across all programs using AGI Guidelines  
✓ **Accreditation-Ready:** Outputs meet regulatory requirements for immediate submission  
✓ **Expert-Guided:** AI assists while SME retains full creative control and approval authority

### Process Summary

| Phase                        | Deliverable                                                           | Time Required |
| ---------------------------- | --------------------------------------------------------------------- | ------------- |
| 1. Program Foundation        | Program overview with aims, delivery structure, and credit framework  | 15-20 minutes |
| 2. Competency Framework      | Industry-aligned Knowledge, Skills, Attitudes (KSA) with benchmarking | 10-15 minutes |
| 3. Program Learning Outcomes | 4-8 PLOs using Bloom's taxonomy                                       | 15-20 minutes |
| 4. Course Structure          | 6-8 modules with Module Learning Outcomes                             | 25-30 minutes |
| 5. Topic-Level Sources       | Validated academic sources with APA citations (AGI Standards applied) | 10 minutes    |
| 6. Reading Lists             | Core and Supplementary materials organized                            | 8 minutes     |
| 7. Auto-Gradable Assessments | MCQ banks and exam blueprint                                          | 15-20 minutes |
| 8. Case Studies              | Realistic scenarios with assessment hooks                             | 10-15 minutes |
| 9. Glossary                  | Comprehensive terminology reference (automatic)                       | 5 minutes     |

**Total Investment:** 2-3 hours of SME time  
**Final Output:** Complete, accreditation-ready curriculum package

---

## Knowledge Base Integration

The system leverages our comprehensive knowledge base organized into specialized folders:

**Subject Books** - Core academic textbooks and reference materials across all disciplines

**Competency-Framework** - Industry-standard frameworks from professional bodies (SHRM, PMI, ASCM, CIPD) and institutional models

**Accreditations** - Standards, compliance checklists, and templates from OFQUAL, HLC, WASC, Bologna authorities

**Curriculum-Design** - Best practice templates, syllabi, assessment rubrics, instructional design guidelines

**UK-Diploma-Programs** - Accredited UK diploma specifications for benchmarking

**Standards** - Quality assurance protocols, accessibility requirements (WCAG 2.1 AA), ethical guidelines, AGI Academic Standards

**typeOfOutputs** - Template library for program specifications, assessment handbooks, module syllabi, accreditation packages

---

## STEP 1: Program Foundation

### Purpose

Establish the foundational elements of your program by capturing essential information about target learners, industry needs, program structure, and high-level aims. **This step creates context only - it does NOT generate Program Learning Outcomes (those come in Step 3).**

### What You Provide (15 Questions)

**Program Identity & Description**

- Program title (5-100 characters)
- Comprehensive program description (50-500 words)
- Academic level: Certificate, Micro-credential, or Diploma

**Credit Structure & Contact Hours Framework**

### Understanding Credits vs. Contact Hours

**IMPORTANT: Credits represent TOTAL student workload, not just contact hours.**

All credit systems (ECTS, UK Credits, US Semester Credits) measure the total time students spend learning, which includes:

- **Contact hours** (lectures, seminars, tutorials, lab sessions)
- **Independent study** (reading, research, assignments)
- **Assessment preparation** (study time, project work, exam prep)

**International Standards:**

- **ECTS** (Bologna Process): 1 ECTS = 25-30 hours total workload (contact hours % not specified)
- **UK Credits** (QAA): 1 UK credit = 10 hours total workload (contact hours % not specified)
- **US Semester Credits**: 1 credit = 15 contact hours + 30 independent study hours = 45 total hours (33% contact / 67% independent - **defined ratio by US Department of Education**)

**Default Contact Hours Policy:**

- For UK Credits and ECTS: 30% contact hours (default when not specified by accreditation body)
- For US Semester Credits: 33% contact hours (defined standard, not a default)

**Contact Hours Proportion:**
The percentage of contact hours varies by:

- Country and accrediting body requirements
- Program level (undergraduate vs. postgraduate)
- Delivery mode (in-person, online, hybrid)
- Discipline (practical vs. theoretical)

**Typical Contact Hours Ranges:**

- **In-Person Programs:** 30-50% contact hours
- **Hybrid/Blended:** 20-40% contact hours
- **Online Facilitated:** 15-30% contact hours
- **Online Self-Study:** 10-20% contact hours (synchronous sessions)

### Default Contact Hours Policy (IMPORTANT FOR CURRICULUM GENERATOR)

**The system determines contact hours using this priority hierarchy:**

**1. Knowledge Base Check (Highest Priority)**  
The system first checks its internal knowledge base for:

- Accreditation-specific rules (OFQUAL, HLC, WASC, Bologna Process requirements)
- Credit-value mappings with defined contact hour ratios
- Country-specific regulations

**2. SME Specification (Second Priority)**  
If not found in knowledge base, the system checks if the SME has explicitly specified contact hour requirements in the delivery structure notes.

**3. Default Application (Final Fallback)**  
If contact hours are NOT defined in the knowledge base AND NOT explicitly specified by the SME, the curriculum generator will **automatically default to 30% contact hours**.

This reflects broadly accepted international norms and maintains compliance across most accreditation frameworks.

---

### Contact Hours by Credit System

**ECTS (Europe):**

- 1 ECTS = 25–30 total learning hours
- ECTS does not mandate a fixed contact-hour percentage
- **System applies: 30% contact / 70% independent study** (default)
- Example: 60 ECTS = 1,500 total hours → 450 contact hours + 1,050 independent/assessment

**UK Credits:**

- 1 UK credit = 10 total learning hours
- The UK framework does not define how many hours must be contact hours
- **System applies: 30% contact / 70% independent study** (default)
- Example: 120 UK credits = 1,200 total hours → 360 contact hours + 840 independent/assessment

**US Semester Credits (DEFINED RATIO - NOT DEFAULT):**

- 1 US credit = 15 contact hours + 30 hours independent study/exam prep = 45 total hours
- This equals a **defined 33% contact / 67% independent study ratio**
- **System uses the defined ratio (33%), NOT the 30% default**
- Example: 30 US credits = 1,350 total hours → **446 contact hours** (33%) + 904 independent/assessment

**Non-Credit (Direct Hours):**

- **System applies: 30% contact / 70% independent study** (default)
- Example: 150 total hours = 45 contact hours + 105 independent/assessment

---

**Override Option:**  
If your institution has specific requirements different from the knowledge base or defaults, you can specify custom contact hour percentages in the delivery structure notes. The system will recalculate throughout all steps.

---

### Credit Framework Selection

Choose ONE of the following credit frameworks:

**Option 1: UK Credits**

- Is this credit-awarding? **Yes**
- UK Credits: [Enter value, e.g., 120]
- **Total hours calculated automatically:** Credits × 10 = Total hours
- **Contact hours (default 30%):** Total hours × 0.30
- Example: 120 UK credits = 1,200 total hours (360 contact, 840 independent/assessment)

**Option 2: ECTS Credits (Bologna Process)**

- Is this credit-awarding? **Yes**
- ECTS Credits: [Enter value, e.g., 60]
- **Total hours calculated automatically:** Credits × 25 to 30 (system uses 25 as standard)
- **Contact hours (default 30%):** Total hours × 0.30
- Example: 60 ECTS = 1,500 total hours (450 contact, 1,050 independent/assessment)

**Option 3: US Semester Credits / Credit Hours (DEFINED RATIO)**

- Is this credit-awarding? **Yes**
- US Semester Credits: [Enter value, e.g., 30]
- **Total hours calculated automatically:** Credits × 45 = Total hours
- **Contact hours (DEFINED at 33%):** Credits × 15 = Contact hours (1 credit = 15 contact hours by US Department of Education standard)
- **Independent/assessment hours (67%):** Credits × 30
- Example: 30 US credits = 1,350 total hours (**446 contact hours [33%]**, 904 independent/assessment [67%])
- **Note:** US credits use a defined 33% contact ratio, NOT the 30% default

**Option 4: Non-Credit (Direct Hours Entry)**

- Is this credit-awarding? **No**
- Total program hours: [Enter value, 20-500 hours]
- **Contact hours (default 30%):** Total hours × 0.30
- Example: 150 total hours = 45 contact hours, 105 independent/assessment

### Credit Equivalencies Reference

For programs seeking international recognition, the system provides automatic equivalencies:

| UK Credits | ECTS Credits | US Semester Credits | Total Hours (Approx) | Contact Hours                         | Independent/Assessment                      |
| ---------- | ------------ | ------------------- | -------------------- | ------------------------------------- | ------------------------------------------- |
| 30         | 15           | 7.5                 | 300-375              | 90-113 (30%)                          | 210-262 (70%)                               |
| 60         | 30           | 15                  | 600-750              | 180-225 (30%)                         | 420-525 (70%)                               |
| 120        | 60           | 30                  | 1,200-1,500          | 360-450 (30% UK/ECTS) or 446 (33% US) | 840-1,050 (70% UK/ECTS) or 904 (67% US)     |
| 180        | 90           | 45                  | 1,800-2,250          | 540-675 (30% UK/ECTS) or 669 (33% US) | 1,260-1,575 (70% UK/ECTS) or 1,356 (67% US) |

**Note:** UK and ECTS use 30% default contact hours. US Semester Credits use a defined 33% contact ratio (15 contact hours per credit by US Department of Education standard).

### Optional: Specify Custom Contact Hours Requirement

If your institution/accrediting body has specific requirements different from 30%:

**Contact Hours Requirement:** [e.g., "40% per institutional policy" or "25% for postgraduate online programs"]

This will override the 30% default for your program.

---

**Target Learner Profile**

- Age range (e.g., "25-45 years")
- Educational background (minimum 10 characters)
- Industry sector (minimum 5 characters)
- Experience level: **Beginner** (0-2 years) | **Professional** (3-7 years) | **Expert** (8+ years)

**Program Delivery (Required)**

- **Delivery Mode**: Choose one:
  - Online Self-Study
  - Online Facilitated
  - Hybrid/Blended
  - In-Person
- **Delivery Structure**: Short description (1-3 sentences) of how the program will be delivered, including approximate balance of contact vs. independent learning if different from 30% default

**Labour Market Rationale**

- Program purpose (50-300 words explaining why this program exists)
- Job titles this prepares learners for (minimum 2 titles)
- Detailed job descriptions showing workplace tasks (100-1000 words)

**REMOVED: Comparable/Benchmark Programs**
_Note: Benchmark programs have been moved to Step 2 where they are actually used for competency analysis. This reduces redundancy and confusion._

### Quality Check Process

The system calculates a **completeness score (0-100%)**:

- **100%:** All required fields + detailed descriptions + multiple job examples
- **70-99%:** All required present, some brief descriptions
- **<70%:** Vague or missing information

If score <70%, you receive **prioritized clarifying questions**:

**Critical (Must Answer)** - Required fields blocking progress  
_Example: "Required field 'job_titles' is blank. Please provide at least 2 job titles (e.g., HR Manager, Talent Specialist)."_

**Important (Strongly Recommended)** - Improves quality significantly  
_Example: "You mentioned 'professionals' as learners. Are these entry-level (0-2 years), mid-level (3-7 years), or senior (8+ years)?"_

**Enhancement (Optional)** - Adds value but not essential  
_Example: "Consider providing more detail about the typical workplace challenges these job roles face (optional but helpful)."_

### What the System Generates

**Program Overview Document** containing:

**Executive Summary (400-700 words)**  
Professional overview in formal institutional language suitable for prospectus and accreditation

**Program Aims (3-5 strategic intentions)**  
High-level goals that frame the program's purpose

_Examples:_

- "To develop strategic thinking in workforce planning"
- "To build ethical leadership capabilities in healthcare management"
- "To foster data-driven decision-making in business analytics"

**Target Learner Profile**  
Detailed description of demographics, background, career aspirations

**Career Pathways**  
Job roles and progression opportunities this program enables

**Program Structure Overview**  
Brief description of anticipated module count and duration

**Delivery Approach**  
Summary of how the program will be delivered based on your delivery mode and structure

**Credit Framework & Workload Summary**

The system generates a comprehensive breakdown showing:

**Primary Credit System:**

- [Selected system: UK / ECTS / US / Non-credit]
- Credits awarded: [value]
- Total student workload: [calculated hours]

**International Equivalencies:**

- UK Credits = [value] (Total hours: [calculated])
- ECTS = [value] (Total hours: [calculated])
- US Semester Credits = [value] (Total hours: [calculated])

**Workload Distribution:**

- Total program hours: [value]
- Contact hours (30% default or custom): [calculated]
- Independent study & assessment: [calculated]
- Breakdown aligned with [delivery mode] and institutional requirements

_Note: Credit frameworks follow international standards (ECTS under Bologna Process, UK QAA guidelines, US Department of Education requirements) for total workload calculation. The proportion of contact hours vs. independent study varies by institution policy, program level, and delivery mode. Unless otherwise specified, this program uses a 30% contact hours allocation, which is internationally recognized as safe and compliant with most accreditation frameworks._

**Entry Requirements**  
Prerequisites based on target learner profile

### IMPORTANT: What's NOT in Step 1

❌ **Program Learning Outcomes (PLOs)** - These are generated in Step 3  
❌ **Competency lists** - These are generated in Step 2  
❌ **Benchmark programs** - These are now ONLY in Step 2  
❌ **Module structure** - This is generated in Step 4  
❌ **Specific assessments** - These are generated in Step 7

**Step 1 focuses exclusively on program context, aims, delivery approach, and credit framework with workload distribution.**

### Validation Before Step 2

System enforces these requirements before unlocking Step 2:

- ✓ Program title present
- ✓ Program description meets minimum length (not generic)
- ✓ Academic level set
- ✓ **Credit structure set (UK, ECTS, US, or Hours) with calculated total hours**
- ✓ **Contact hours calculated (30% default or custom specified)**
- ✓ Target learner fields complete (sector + experience level)
- ✓ Program purpose/rationale present
- ✓ At least one job role with tasks described
- ✓ Delivery mode selected from allowed values
- ✓ Delivery structure description non-empty

### Your Review Options

1. **Approve** - Lock content and proceed to Step 2
2. **Refine** - Request changes via chat (e.g., "Adjust contact hours to 40% per institutional policy" or "Add more emphasis on ethical considerations")
3. **Reject** - Return to inputs to revise

**Safeguard:** Minimum 2-minute review time required

---

## STEP 2: Competency & Knowledge Framework (KSA)

### Purpose

Create a comprehensive framework of **Knowledge, Skills, and Attitudes (KSA)** by analyzing similar programs and industry standards, ensuring your curriculum reflects current professional requirements. **This is now the ONLY step where you provide benchmark programs.**

### Understanding KSA

**Knowledge (K)** - What learners need to understand  
_Example: "Understand workforce planning principles and forecasting methodologies"_

**Skills (S)** - What learners need to be able to do  
_Example: "Apply demand forecasting models using Excel to project staffing needs"_

**Attitudes (A)** - Professional behaviors and values  
_Example: "Demonstrate ethical decision-making in workforce planning scenarios"_

### What You Can Provide (All Optional)

**Industry/Professional Frameworks**  
Specify standards from professional bodies:

- SHRM (HR / People Management)
- PMI (Project Management)
- SFIA (IT Skills)
- CIPD (People Development)
- ASCM (Supply Chain)
- Sector-specific competency standards

**Institutional Frameworks**  
Upload your organization's:

- Graduate attributes
- Competency models
- Capability frameworks
- Internal standards

**Benchmark Programs (MOVED HERE FROM STEP 1)**  
**This is now the ONLY place to specify benchmark programs:**

- Named qualifications you want to compare against
- Competitor programs
- Aspirational model programs
- Provide: Program name, institution, URL (if available)

_If you provide none of these, the system proceeds automatically using public benchmarks from our knowledge base._

### How It Works

**Research Phase**  
Searches in priority order:

1. **Your provided benchmark programs** (if any) - **Primary source**
2. Your provided frameworks (if any)
3. Competency-Framework folder in knowledge base
4. UK-Diploma-Programs folder
5. OFQUAL Register (UK)
6. HLC and WASC databases (US)
7. Professional body websites (SHRM, PMI, ASCM, CIPD)
8. Recent accredited program descriptions

**Analysis Phase**  
From top 5 similar programs:

- Extracts explicit and implicit competencies
- Classifies into Knowledge, Skills, Attitudes
- Removes duplicates
- Labels as **Essential** (≥50% of benchmarks + maps to job tasks) or **Desirable** (<50% of benchmarks or enhancement)

### What You Receive

**10-30 competency items** organized as:

**Knowledge Items (30-40% of total)**

- K1: Understand workforce planning principles... (Essential)
- K2: Know employment law compliance requirements... (Essential)
- K3: Comprehend global talent management trends... (Desirable)

**Skills Items (40-50% of total)**

- S1: Apply demand forecasting models to organizational data (Essential)
- S2: Use HRIS systems to analyze workforce metrics (Essential)
- S3: Conduct scenario planning and risk assessment (Desirable)

**Attitudes Items (10-30% of total)**

- A1: Demonstrate ethical decision-making in workforce contexts (Essential)
- A2: Exhibit cultural sensitivity in diverse workplaces (Essential)
- A3: Value continuous professional development (Desirable)

Each item includes:

- Clear statement (≤50 words)
- Brief description
- Source (which benchmark)
- Importance level

**Benchmarking Report** showing:

- Which programs analyzed (including your specified benchmarks)
- Accreditation status
- Publication year
- Key findings and how they influenced the framework

### Your Actions

- **Edit** items - Modify wording or change importance
- **Add** custom items - Insert domain-specific competencies
- **Remove** items - Delete irrelevant ones
- **Reorder** - Arrange by priority

**Safeguards:**

- Minimum 10 Essential items required
- Proper distribution (K=30-40%, S=40-50%, A=10-30%)

### Validation Before Step 3

✓ Total items: 10-30  
✓ At least one item in each category (K, S, A)  
✓ Combined minimum: 3 knowledge + 3 skills  
✓ All items have statement, description, importance  
✓ Unique IDs (no duplicate K1, S1, etc.)  
✓ At least 70% of Essential items connect to job tasks from Step 1

---

## STEP 3: Program Learning Outcomes (PLOs)

### Purpose

**Transform your competency framework into 4-8 precise, measurable Program Learning Outcomes using Bloom's taxonomy.** This is the ONLY step that creates PLOs.

### What You Select (4 Decisions)

**1. Bloom's Taxonomy Levels (Choose ≥2)**

Select cognitive levels your program emphasizes:

- **Remember/Understand** - Foundational knowledge
- **Apply** - Using knowledge practically
- **Analyze** - Breaking down complex problems
- **Evaluate** - Making informed judgments
- **Create** - Producing original work

_System requires: At least 1 lower level (Understand/Apply) + 1 higher level (Analyze/Evaluate/Create)_

**2. Priority Competencies**

Select Essential competencies from Step 2 that PLOs must address  
_Requirement: ≥70% coverage of Essential KSAs_

**3. Outcome Emphasis**

Choose primary focus:

- **Technical/Applied** - Skills and procedures
- **Professional/Behavioral** - Soft skills and conduct
- **Broad/Strategic** - Systems thinking and leadership
- **Mixed** - Combination approach

**4. Number of Outcomes**

Choose between 4-8 PLOs (most programs use 6)

### Optional Advanced Controls

- **Context Constraints** - Industry context, tools, limits
- **Verbs to Prefer** - Bloom-appropriate verbs to favor
- **Verbs to Avoid** - Vague verbs like "know", "understand"
- **Stakeholder Priorities** - Employer/client expectations
- **Exclusions** - Things outcomes must not commit to (specific brands, proprietary methods)

### What the System Generates

**4-8 Program Learning Outcomes** following structure:

**[Bloom's Verb] + [Specific Task] + [Real-World Context]**

**Certificate Examples:**

- "Apply regression analysis to sales data to forecast quarterly revenue targets"
- "Evaluate workforce planning strategies using industry benchmarks to recommend staffing solutions"

**Diploma Examples:**

- "Design comprehensive talent management systems that align organizational strategy with workforce capabilities"
- "Critique organizational change initiatives using evidence-based frameworks to identify improvement opportunities"

### Each PLO Includes

- **Cognitive Level** - Bloom's taxonomy placement
- **Competency Links** - Which Step 2 KSAs it addresses
- **Assessment Alignment** - How it will be measured
- **Job Task Mapping** - Connection to workplace requirements

### Coverage Report

Visual summary showing:

- How many competencies each PLO covers
- Overall percentage of Essential competencies addressed
- Distribution across Bloom's levels
- Verification that outcomes are measurable and unique

### Validation Before Step 4

✓ Count equals target (4-8 total)  
✓ Each uses [Verb + Task + Context] structure  
✓ Each ≤25 words  
✓ Each links to ≥1 Essential competency (K or S)  
✓ Collectively cover ≥70% of Essential competencies  
✓ Cover main job-task themes from Step 1  
✓ Bloom levels match your selections  
✓ No single Bloom level >50% (unless only one selected)  
✓ No duplicates or trivial rephrasing  
✓ Professional UK English, measurable

### Your Review

System presents outcomes with:

- Color-coded Bloom's levels
- Competency mapping visualization
- Side-by-side comparison with job descriptions

Request refinements like:

- "Make PLO 3 more technical and specific"
- "Add emphasis on ethical considerations to PLO 5"
- "Ensure PLO 2 clearly includes data analysis skills"

---

## STEP 4: Course Framework & Module Learning Outcomes

### Purpose

Organize your program into **6-8 modules** with clear sequencing, precise hours allocation, and specific Module Learning Outcomes (MLOs) that build toward your Program Learning Outcomes.

### System Recommendations

**Module Count: 6-8 modules (default)**

The system proposes 6-8 modules for most programs using the 15-hour guideline:

- 90-hour program → 6 modules (15 hours each)
- 120-hour program → 8 modules (15 hours each)
- 180-hour program → 8 modules (average 22.5 hours each with consolidation)

**Important:** The system defaults to 6-8 modules, NOT a strict hours÷15 formula. If your total hours would suggest >8 modules, the system consolidates to 8 modules and clearly indicates this.

**For Each Module:**

- Suggested title based on content themes
- Recommended hours (distributed proportionally)
- **Contact hours allocation** (based on Step 1 percentage, default 30%)
- Preliminary sequence (foundation → application → synthesis)
- Learning progression notes

### Module Hours Breakdown

Each module shows:

- **Total module hours** (portion of program total)
- **Contact hours** (30% default or custom from Step 1)
- **Independent study & assessment hours** (remaining 70% or custom)

**Example Module 3:**

- Total module hours: 15 hours
- Contact hours: 4.5 hours (30%)
- Independent study/assessment: 10.5 hours (70%)

### Your Customization

Full flexibility to adjust:

- **Rename** modules to match institutional terminology
- **Merge or Split** modules (while staying in 6-8 range)
- **Reorder** sequence for pedagogical flow
- **Adjust Hours** - **CRITICAL: Total must exactly equal program hours (no tolerance)**
- **Set Prerequisites** - Indicate module dependencies

**Hours Integrity Rule:** Σ module hours MUST = program hours (exact match)  
_No ±2 hour tolerance. System blocks approval if mismatch exists._

**Contact Hours Maintained:** Module contact hours automatically recalculated if you adjust module hours, maintaining the Step 1 percentage.

### Module Learning Outcomes (MLOs)

For each module, you provide:

- Which Bloom's levels to emphasize
- Which competencies to address
- Desired outcome count (typically 2-4 per module)
- Any specific context or constraints

System generates MLOs that:

- Are more specific than PLOs
- Build toward one or more PLOs
- Follow [Verb + Task + Context] structure
- Reflect appropriate cognitive progression

### Progressive Complexity (Enforced)

**Early Modules (1-2):**

- ≥60% of MLOs at Understand/Apply levels
- Foundational knowledge and basic skills
- Build confidence and terminology

**Middle Modules (3-5):**

- Balanced mix emphasizing Apply/Analyze
- Integration into practical application
- Increasing complexity

**Later Modules (6-8):**

- ≥30% of MLOs at Analyze/Evaluate/Create
- Synthesis across modules
- Complex problem-solving and original work

_System warns if patterns violated, may require acknowledgment or adjustment._

### Module Outline Preview

**Module 3: Workforce Demand Forecasting (15 hours)**  
_Total: 15 hours | Contact: 4.5 hours (30%) | Independent: 10.5 hours (70%)_  
_Prerequisites: Module 1, Module 2_

**Module Learning Outcomes:**

- M3-LO1: Apply quantitative forecasting methods to organizational data to project 12-month staffing requirements (Apply → PLO1, PLO2)
- M3-LO2: Analyze workforce supply trends using statistical tools to identify potential talent shortages (Analyze → PLO2)
- M3-LO3: Evaluate forecasting model accuracy to select appropriate methods for different organizational contexts (Evaluate → PLO3)

**Indicative Contact Activities (4.5 hours):**

- Lecture: Forecasting methodologies overview (1.5 hours)
- Workshop: Hands-on forecasting tool practice (2 hours)
- Tutorial: Individual guidance on data analysis (1 hour)

**Independent Study & Assessment (10.5 hours):**

- Reading: Core and supplementary materials (5 hours)
- Practice: Apply forecasting to sample datasets (3 hours)
- Assessment preparation: Quiz preparation and case study analysis (2.5 hours)

### Validation Before Step 5

✓ **Hours integrity:** Σ module hours = program hours (exact)  
✓ **Contact hours maintained:** Module contact hours sum to program contact hours  
✓ **PLO coverage:** All PLOs map to ≥1 MLO  
✓ **Cognitive progression:** Early/middle/late patterns respected  
✓ **MLO quality:** Each module has ≥1 MLO, all properly structured  
✓ **Prerequisites valid:** No circular dependencies (M5→M7, M7→M5)

### Delivery Mode Consistency

System respects your Step 1 delivery mode:

- **Online Self-Study** - Asynchronous/self-paced activity bias, typically 10-20% synchronous contact
- **In-Person** - Traditional classroom-based, typically 30-50% contact hours
- **Hybrid/Blended** - Mix of synchronous/asynchronous, typically 20-40% contact
- **Online Facilitated** - Includes facilitation touchpoints, typically 15-30% synchronous contact

No module contradicts overall delivery mode from Step 1.

---

## STEP 5: Topic-Level Sources (APA 7th Edition) - WITH AGI ACADEMIC STANDARDS

### Purpose

Identify, validate, and tag high-quality academic and professional sources for each module, ensuring learners access current, credible, appropriately leveled materials. **This step now enforces AGI Academic Standards as the authoritative rule set.**

### AGI Academic Standards Applied (Override Generic Rules)

**CRITICAL: AGI Academic Standards take precedence over generic workflow rules. All sources must meet these strict requirements:**

### Source Quality Requirements (AGI Standards)

**Must Be From:**

- ✓ Peer-reviewed academic journals
- ✓ Published academic textbooks
- ✓ Open-access academic repositories
- ✓ Industry-respected professional body publications (SHRM, PMI, ASCM, CIPD, etc.)

**Cannot Be From:**

- ✗ Personal blogs or opinion pieces
- ✗ Non-reviewed websites (Wikipedia, Investopedia, MBA websites, Medium, etc.)
- ✗ Marketing or promotional materials
- ✗ AI-generated or synthesized summaries (ChatGPT, Quillbot, etc.)
- ✗ Slides, forum posts, or course notes without formal citation
- ✗ Unverifiable sources

**System automatically rejects sources from prohibited categories.**

### Recency Rules (AGI Standards)

**Standard Requirement:**

- Sources must be published within the **past 5 years** from current date

**Exception (Foundational/Classic Works):**

- Sources >5 years allowed ONLY if:
  - Explicitly identified as foundational theory or classic work
  - Properly justified with academic rationale
  - Paired with at least one recent source (<5 years) on the same topic showing current relevance
  - Flagged as "seminal: true" with written justification

### Minimum Source Requirements (AGI Standards)

**Per Topic:**

- Minimum **2-3 verified sources** per topic
- At least **one academic source** (peer-reviewed journal or textbook)
- At least **one applied/industry source** for balance
- Each source must directly support the learning objective or skill in that topic

**Per Module:**

- Minimum **2 recent sources** (<5 years) required
- At least **50% of sources must be peer-reviewed** or from recognized academic/professional bodies

### Complete Citation Requirements (AGI Standards)

**Every source must include:**

- Author(s) - Full name(s)
- Year - Publication year
- Title - Complete title
- Publisher/Source - Journal name, publisher, or repository
- DOI or URL - Verifiable link
- **All citations in APA 7th edition format**

**Validation:**

- ≥95% APA accuracy required
- All citations must be verifiable and traceable
- Internal validation log maintained cross-referencing each topic with its source(s)

### Purchase and Accessibility (AGI Standards Enhanced)

**System automatically rejects:**

- Paywalled materials without institutional license
- Unverifiable sources
- Broken or inaccessible links (for Core materials)

**Source Status Classifications:**

**✓ Verified & Accessible** - AGI Purchased Library OR lawful open access  
**⚠ Requires Admin Approval** - Institutional subscription needed  
**✗ Rejected** - Paywalled without license, unverifiable, or from prohibited source type  
**🔒 Flagged for Review** - Potential access issue identified

### Source Search Priority (AGI Standards Applied)

1. **AGI Purchased Library** (Subject Books folder) - Pre-verified, immediate access
2. **Open Access Academic Repositories** - Peer-reviewed, freely available (DOAJ, PubMed, arXiv for appropriate fields)
3. **Professional Body Publications** - SHRM, PMI, ASCM, CIPD official resources
4. **Institutional Subscriptions** - Journal databases with verified access (requires admin approval)

**System will NOT search or recommend:**

- General web search results
- Non-academic websites
- Unverified sources
- AI-generated content repositories

### What You Receive (Per Module)

**Source List with Complete Information:**

For each source:

**Bibliographic Information (APA 7th)**

- Complete citation
- Publication year
- Edition (if applicable)
- DOI/URL verified

**AGI Standards Compliance Badges:**

- ✓ **Peer-Reviewed** - From academic journal
- ✓ **Academic Text** - Published textbook
- ✓ **Professional Body** - SHRM, PMI, etc.
- ✓ **Recent (<5 years)** - Meets recency requirement
- ⚠ **Seminal (>5 years)** - Foundational work with justification + recent pairing
- ✓ **Verified Access** - Available in AGI Library or open access
- ✓ **APA Validated** - Citation format verified

**Mapping Details**

- Which Module Learning Outcomes supported
- Relevant topics covered
- Complexity level relative to target learners
- Academic vs. Applied classification

**Quality Indicators**

- Peer-review status confirmed
- Author credentials verified
- Publication authority level assessed
- Impact factor (for journals, if available)

### Validation Before Step 6 (AGI Standards Enforced)

**STRICT REQUIREMENTS - System blocks approval if ANY fail:**

✓ **AGI Source Quality:** All sources from approved categories only (peer-reviewed, academic texts, professional bodies, open access)  
✓ **Automatic Rejection:** No sources from prohibited categories (blogs, Wikipedia, Investopedia, MBA sites, Medium, AI-generated, slides, forums, unverified)  
✓ **Recency Compliance:** All sources ≤5 years OR justified as seminal + paired with recent  
✓ **Minimum Sources:** Each topic has 2-3 verified sources  
✓ **Academic + Applied Balance:** Each topic has ≥1 academic + ≥1 applied/industry source  
✓ **Peer-Review Ratio:** ≥50% of module sources are peer-reviewed or recognized professional bodies  
✓ **Complete Citations:** All sources have author, year, title, publisher, DOI/URL  
✓ **APA Accuracy:** ≥95% of citations validate correctly to APA 7th edition  
✓ **Verified Access:** All Core sources are accessible (AGI Library or open access)  
✓ **No Paywalled (unlicensed):** No sources require separate purchase without institutional access  
✓ **Every MLO Supported:** Each MLO has ≥1 source  
✓ **Traceability:** Internal validation log complete for all sources

**Admin Override Required:**
If AGI Standards cannot be met (e.g., niche field with limited recent peer-reviewed sources), SME must:

1. Provide explicit written justification
2. Obtain admin-level approval
3. Document exception in audit log

**The system will NOT allow approval without meeting AGI Standards or documented admin override.**

### Your Review Options

**Limited to AGI-Compliant Sources:**

- **Accept Recommendations** - Approve AGI-verified source list
- **Suggest AGI-Compliant Alternatives** - Nominate sources meeting AGI Standards (system will verify)
- **Request Seminal Work Exception** - Provide justification for >5 year sources with required recent pairing
- **Flag Access Issues** - Report accessibility problems with verified sources

**You CANNOT:**

- Add sources from prohibited categories (system auto-rejects)
- Skip peer-review ratio requirements
- Ignore recency rules without justification + admin approval

### Example Output Format

**Module 2 Sources (AGI Standards Compliant):**

📘 **Smith, J., & Brown, A. (2024).** _Workforce Analytics: Modern Methods_ (2nd ed.). Academic Press. https://doi.org/10.xxxx/xxxxx  
[✓ Peer-Reviewed | ✓ Recent | ✓ Academic Text | ✓ Verified Access | ✓ APA Validated]  
Supports: M2-LO1, M2-LO2 | Type: Academic | Complexity: Intermediate  
Estimated reading time: 3.5 hours (within module's 10.5 independent study hours)

📙 **Professional HR Society. (2023).** _Strategic Workforce Planning Guide_ (3rd ed.). SHRM Foundation.  
[✓ Professional Body | ✓ Recent | ✓ Verified Access | ✓ APA Validated]  
Supports: M2-LO1, M2-LO3 | Type: Applied/Industry | Complexity: Intermediate  
Estimated reading time: 2 hours

📗 **Johnson, K. (2019).** _Fundamentals of HR Forecasting_. Oxford University Press.  
[⚠ Seminal (>5 years) | ✓ Academic Text | ✓ Verified Access | ✓ APA Validated]  
_Justification: Foundational text for workforce forecasting frameworks_  
_Paired with: Smith & Brown (2024) for current application_  
Supports: M2-LO1 | Type: Academic | Complexity: Introductory  
Estimated reading time: 1.5 hours

**Module 2 Summary:**

- Total sources: 8
- Peer-reviewed/Professional: 6 (75% ✓)
- Recent (<5 years): 7 (88% ✓)
- Seminal (justified + paired): 1 (13% ✓)
- Academic sources: 4 ✓
- Applied/Industry sources: 4 ✓
- Total estimated reading: 8 hours (within module's 10.5 independent study allocation)
- All AGI Standards: ✓ COMPLIANT

---

## STEP 6: Indicative & Additional Reading Lists

### Purpose

Transform AGI-validated sources into structured reading lists with Core (Indicative) and Supplementary (Additional) classifications, effort estimates, and scheduling.

### Reading Classification

**Core (Indicative) Reading: 3-6 per module**

- Essential for meeting MLOs
- Required for assessment preparation
- Foundation of module content
- **Must meet all AGI Academic Standards**

**Supplementary (Additional) Reading: 4-8 per module**

- Deepen understanding of specific topics
- Alternative perspectives
- Support diverse learning preferences
- Extension for advanced learners
- **Must meet all AGI Academic Standards**

**Classification Logic:**  
High MLO alignment + recent publication + AGI-verified + accessible = Core  
Specific interests + broader context + AGI-verified = Supplementary

### AGI Standards Maintained

**All sources in reading lists:**

- Already validated against AGI Academic Standards in Step 5
- Meet peer-review and recency requirements
- Have complete APA 7th citations
- Are accessible (AGI Library or open access)
- Come from approved source categories only

**No prohibited sources can appear in reading lists** (system automatically excludes)

### Effort Estimation

**Calculation:**

- Average reading speed: 200 words/minute
- Complexity factors: Introductory (×1.0), Intermediate (×1.2), Advanced (×1.5)

**Example:**

- 15-page journal article (4,500 words), intermediate = 27 minutes
- 250-page textbook chapter (10,000 words), advanced = 75 minutes

**Alignment with Module Independent Study Hours:**
Total reading time per module should not exceed the independent study allocation (typically 70% of module hours, or custom from Step 1).

### Difficulty Leveling

**Introductory** - Target experience level, minimal jargon, foundational concepts  
**Intermediate** - Assumes foundation, uses terminology, detailed analysis  
**Advanced** - Assumes expertise, complex concepts, cutting-edge research

### Study Scheduling

**Self-Paced:** "Week 1-2 of module" (flexible)  
**Cohort:** Specific dates aligned to calendar  
**Strategic Placement:** Core distributed, Supplementary at decision points

### Cross-Module References

If source supports multiple modules:

- Listed in full in first module
- Referenced in later: "See Module 2, Reading 3: Smith & Brown (2024)"

### Validation Before Step 7

✓ Each module has 3-6 Core + 4-8 Supplementary  
✓ All Core map to ≥1 MLO  
✓ All sources are AGI Standards compliant  
✓ Mix of academic and applied sources maintained  
✓ **Total reading time per module ≤ independent study hours allocation**  
✓ All sources accessible with verified links

### Example Output

**Module 4 Reading List:**

**Module 4: Advanced Analytics (Total: 15 hours | Contact: 4.5 hours | Independent Study: 10.5 hours)**

**CORE READING (Required) - AGI Standards Verified**

📘 **Week 1: Johnson, M. (2023).** _Forecasting Fundamentals_ (Chapters 2-3). Academic Publishers.  
[✓ Academic Text | ✓ Recent | ✓ Verified Access | ✓ APA Validated]  
Estimated: 45 min | Introductory | Supports: M4-LO1, M4-LO2 | Assessment relevance: High

📘 **Week 2: Chen, L., et al. (2024).** "Predictive analytics in HR." _Journal of Workforce Planning_, 15(2), 45-67. https://doi.org/10.xxxx/xxxxx  
[✓ Peer-Reviewed | ✓ Recent | ✓ Verified Access | ✓ APA Validated]  
Estimated: 30 min | Intermediate | Supports: M4-LO1, M4-LO3 | Assessment relevance: High

**SUPPLEMENTARY READING (Recommended) - AGI Standards Verified**

📙 **Optional: Davis, R. (2023).** _Advanced Forecasting Techniques_. Professional Press.  
[✓ Professional Body | ✓ Recent | ✓ Verified Access | ✓ APA Validated]  
Estimated: 60 min | Advanced | For learners wanting deeper quantitative skills

**Module 4 Reading Summary:**

- Core reading time: 2.5 hours
- Supplementary reading time: 3 hours
- Total reading time: 5.5 hours (52% of 10.5-hour independent study allocation)
- Remaining independent study time: 5 hours for practice activities, assessment prep

---

## STEP 7: Auto-Gradable Assessments (MCQ-First)

### Purpose

Create comprehensive, **auto-gradable only** assessment materials including MCQ question banks, module quizzes, and final exam blueprint. **No manual grading required.**

### Assessment Structure You Define

**Global Settings (Required):**

- Final exam weight (%, typically 30-50%)
- Each module quiz weight (%, must sum to 100% with final)
- Pass mark (%, typically 50-70%)
- Questions per module quiz (typically 15-25)
- Questions for final exam (typically 50-80)
- Bank multiplier (default: 3×)
- Randomization: Shuffle items and options? (Y/N)

**Bank Multiplier Explained:**  
20-question quiz → Generate 60 questions (3× multiplier)  
Enables: Different versions, question rotation, resits, quality monitoring

**Global Settings (Optional):**

- Enable Cloze (fill-in-blank) items? (Y/N) + count per module
- Time limits, open/closed book, calculator permitted

**Per-Module Settings (Required):**

- Coverage target: Which MLOs to assess (multi-select)
- Bloom's emphasis: Pick 1-2 bands (e.g., Apply + Analyze)

**Per-Module Settings (Optional):**

- Context constraints, prefer/avoid terms

### What the System Generates

**Assessment Blueprint (Generated First)**

- Overall weights (validated to sum 100%)
- Pass mark
- Per-module quiz plan
- Final exam plan
- Randomization settings
- Enabled formats (MCQ, optional Cloze)

**Assessment Banks (Generated Second)**

**Multiple-Choice Questions (MCQs)**

Each includes:

**Clear Stem** - Focused on single concept, precisely worded

**One Correct Answer** - The key demonstrating competency

**3-4 Plausible Distractors** - Represent common misconceptions

**Comprehensive Rationales (50-100 words)**

- Why correct answer is correct
- Why each distractor is plausible but incorrect
- Common errors addressed

**Metadata Tags**

- Which MLO assessed
- Bloom's taxonomy level
- Difficulty estimate
- Topic/content area

**Sample MCQ:**

**Q: Manufacturing firm, 250 employees, 20% annual turnover, plans 15% growth. How many external hires needed?**

A) 38  
B) 50  
C) 88  
D) 103

**Correct: C) 88**

**Rationale:** Turnover: 250 × 0.20 = 50 replacements. Growth: 250 × 0.15 = 38 new positions. Total: 50 + 38 = 88. Option A (growth only). Option B (turnover only). Option D (incorrect percentage addition).

**Optional: Cloze (Fill-in-Blank) Items**

For vocabulary/terminology-focused content:

- Key terms removed from contextual sentences
- Accepted synonyms defined
- Case-insensitive matching
- Useful for technical fields

### Final Examination Blueprint

**Proportional Representation:**  
Draws from each module in proportion to hours:

- 20-hour module (30% of program) → 30% of final exam questions

**No Overlap:** Final uses questions NOT in module quizzes

**Outcome Coverage:** All PLOs assessed

**Bloom's Distribution:** Matches desired cognitive emphasis

### Validation Before Step 8

✓ Weights sum to exactly 100%  
✓ Every selected MLO has ≥1 assessment item  
✓ Bloom distribution matches emphasis (±10% tolerance)  
✓ All items have complete rationales  
✓ **All items are auto-gradable (MCQ or Cloze only, no essays)**  
✓ No duplicate questions  
✓ Final exam pulls proportionally, no quiz overlap

### Deliverable Package

1. **Question Banks** (3× multiplier)
   - Module 1: 60 MCQs (delivers 20-question quizzes)
   - Module 2: 60 MCQs
   - [All modules...]

2. **Final Exam Pool** (separate bank)
   - 240 MCQs (delivers 80-question final)
   - Organized by module and outcome

3. **Blueprint Document**
   - Weight distribution table
   - Question count per outcome
   - Bloom's level distribution
   - Difficulty balance
   - Module coverage map

4. **LMS Configuration File**
   - Randomization settings
   - Time limits
   - Passing criteria
   - Feedback settings

### IMPORTANT: Case Studies in Step 8

Complex case-based scenarios handled separately in Step 8. Those provide **learning materials and assessment hooks only**, NOT auto-graded questions.

---

## STEP 8: Case Studies (Practice, Discussion, or Assessment-Ready)

### Purpose

Generate realistic, industry-relevant scenarios with optional data assets, **assessment hooks** (key facts, misconceptions, decision points), and clear metadata. **This step does NOT generate assessment questions.**

### Three Case Types

**Practice Cases**

- Ungraded learning activities
- Build confidence, allow trial and error
- Include suggested approaches and solutions

**Discussion Cases**

- Forum prompts for collaborative learning
- Graded on participation (not correctness)
- Encourage perspective-sharing

**Assessment-Ready Cases**

- Structured scenarios for assessment contexts
- Include **hooks** for future question development
- Can support essay questions, presentations, projects
- **CRITICAL: Provides hooks only, NOT auto-graded questions**

### IMPORTANT CLARIFICATION

**Assessment-Ready Cases provide HOOKS:**

- **Key Facts** - Atomic statements for future MCQ creation
- **Misconceptions** - Common errors for distractor creation
- **Decision Points** - Judgment moments for scenario questions
- **Terminology** - Domain terms with definitions for glossary

**If you need case-based MCQs:**

- (a) Use hooks to manually write questions, OR
- (b) Request future enhancement "Step 7B: Case-Based Question Generator"

### Two-Stage Process

**Stage 1: Proposals**  
For each selected module, system generates 1-3 case options:

- Title
- 2-3 sentence abstract
- Mapping summary

You select which to develop fully.

**Stage 2: Full Development**  
Only approved proposals become full scenarios (400-800 words)

### What You Specify Per Case

- **Target Modules** - Which module(s) to support
- **Industry Context** - Sector or organization type
- **Difficulty Level** - Entry, Intermediate, Advanced
- **MLO Coverage** - Specific outcomes to address
- **Realism** - Authentic challenges, relevant data
- **Data Assets (Optional)** - CSV/Excel schema (you populate or use tool for synthetic data)

### Case Development Features

**Scenario Content (400-800 words):**

- Organizational context
- Background information
- Challenge description
- Data presentation

**Data Assets:**

- System generates schema (columns, types, sample row)
- You populate actual data or request synthetic generation

**Brand Names:**

- Default: Fictitious (e.g., "TechCorp")
- Real brands: Requires written permission or public domain confirmation

**Ethics Enforcement:**

- No PII
- Anonymize figures
- Respect GDPR/privacy

### Assessment Hooks (If Enabled)

For Assessment-Ready cases, system generates:

**Key Facts (10-15 atomic statements)**  
_Example: "Organization has 20% annual turnover affecting 50 positions"_

**Common Misconceptions (5-8 typical errors)**  
_Example: "Students often confuse turnover rate with retention rate"_

**Decision Points (3-5 judgment moments)**  
_Example: "Should organization prioritize internal promotion or external hiring?"_

**Technical Terminology**  
Key terms with definitions (feed into Step 9 Glossary)

### Validation Before Step 9

✓ Each case maps to ≥1 module + ≥1 MLO  
✓ Size: 400-800 words (excluding data assets)  
✓ Ethics: No PII, brands anonymized unless permitted  
✓ **Hooks (if enabled): Counts met, align to MLO/KSA**  
✓ **Separation: No assessment questions in Step 8 (only hooks)**

### Example Deliverable

**Module 5 Case: Workforce Planning at MidCoast Manufacturing**

**Context:** MidCoast Manufacturing, 250-employee automotive parts supplier, faces 18% annual machinist turnover...

**Challenge:** As new HR Manager, develop 12-month workforce plan addressing turnover and 20% planned expansion...

**Data Provided:** Employee demographics, exit interviews, production forecasts, budget constraints

**Learning Application:** Addresses M5-LO1 (demand forecasting) and M5-LO2 (supply analysis). Learners apply forecasting models, analyze patterns, recommend solutions.

**Usage:** Introduce after Module 5 core readings, 90 min individual + 30 min group discussion

**Assessment Hooks (Sample):**

- Key Fact: "Current turnover rate is 18% annually"
- Misconception: "Students may calculate only replacement needs, ignoring growth"
- Decision Point: "Should hiring focus on experienced machinists or train entry-level?"

---

## STEP 9: Glossary (Auto-Generated, No SME Input)

### Purpose

Automatically create comprehensive terminology reference by identifying and defining all key terms used throughout curriculum. **This step runs automatically - no SME input required.**

### Automatic Process

**No SME Questions** - Runs automatically after Steps 1-8 complete

**Comprehensive Harvesting** from:

- Competency framework (Step 2)
- All PLOs and MLOs (Steps 3-4)
- Assessment items and rationales (Step 7)
- Reading list titles and abstracts (Steps 5-6)
- Case studies and hooks (Step 8)
- Program description and rationale (Step 1)

### Term Selection Priority

**Must Include:**

- Every term in graded assessments
- All Essential competencies
- Technical terminology in learning outcomes

**Should Include:**

- Terms in reading titles
- Case study terminology
- Important concepts from Supplementary readings

**May Exclude:**

- Common English words used generically
- General terms unless field-specific ("analysis" excluded; "SWOT analysis" included)

### Definition Quality

Each entry includes:

**Main Definition (20-40 words)**  
Clear explanation in plain language (Grade 10-12 reading level), UK English

**Example Sentence (Optional, 20 words)**  
Demonstrates authentic usage

**Technical Note (Optional)**  
Additional detail for advanced learners

**Cross-References**  
Links to related, broader/narrower terms, synonyms

**Module Mapping**  
Shows which module(s) use this term

### Example Entry

**Workforce Planning**  
_Definition:_ Systematic process of analyzing current workforce capabilities, forecasting future staffing needs based on organizational strategy, and developing action plans to align talent supply with demand.

_Example:_ "Effective workforce planning enables organizations to anticipate skill shortages before they impact operations."

_Related terms:_ Human Resource Planning, Demand Forecasting, Succession Planning  
_Used in:_ Modules 1, 2, 3, 5, 7

### Acronym Handling

- Full expansion on first mention
- Cross-referencing both ways
- Example: **HR** → See Human Resources

### Three Deliverable Formats

**1. Alphabetical Master Glossary**  
Complete A-Z with full definitions (PDF, searchable digital)

**2. Module-Linked Keyword Lists**  
Terms grouped by module for contextual learning

**3. Accessibility Metadata**  
Reading level analysis, screen reader optimization, pronunciation guides

### Export Options

**For Learners:**

- PDF download (booklet format)
- LMS-integrated search tool
- Mobile-friendly web version

**For Technical Integration:**

- Structured data for LMS import
- Spreadsheet format for editing
- Tagged format for custom applications

### Validation Before Final Package

✓ 100% of assessment terms included  
✓ All definitions 20-40 words  
✓ No circular definitions  
✓ All cross-references valid  
✓ UK English spelling consistent  
✓ Every term maps to ≥1 module or outcome  
✓ No duplicate entries (canonical with synonyms)

### Typical Glossary Size

- Certificate programs: 30-50 terms
- Diploma programs: 50-80 terms
- Varies by technical complexity

---

## Final Deliverables Package

Upon completing all 9 steps and final approval:

### Core Documentation

1. **Program Specification Document** - Overview, aims, outcomes, credit mapping (UK/ECTS/US) with contact hours breakdown, accreditation checklist
2. **Course Framework Document** - Module structure, sequencing, hours (total, contact, independent), comprehensive MLO mapping
3. **Module Syllabi (6-8 documents)** - Individual syllabi with outcomes, topics, hours breakdown, AGI-verified readings, assessments, schedules
4. **Assessment Handbook** - Question banks, exam blueprint, marking criteria, QA protocols
5. **Reading Lists Compilation** - AGI Standards-compliant bibliography with APA citations, effort estimates aligned to independent study hours, verified access
6. **Case Study Library** - All scenarios with usage notes and learning hooks
7. **Glossary of Terms** - Comprehensive reference in multiple formats

### Supporting Materials

8. **Accreditation Submission Checklist** - Regulatory requirements confirmed with document references
9. **Implementation Guide** - Teaching strategies, resource requirements (contact hours, independent activities), staff expertise, technology/tools
10. **Quality Assurance Report** - Validation performed at each step (competency coverage, outcome alignment, assessment mapping, AGI Standards compliance verification, workload distribution verification)

### Technical Exports

11. **LMS Import Files** - Ready-to-upload packages (Moodle, Canvas, Blackboard, others) with contact hours metadata
12. **Data Files** - Structured exports (PDF, Word, Excel, CSV) for institutional systems

---

## Quality Assurance Throughout

### Validation at Every Step

**Input Validation** - Required information present and properly formatted

**Content Quality Checks** - Meets AGI Standards for language clarity, academic level, accessibility, learning science, source quality

**Alignment Verification** - Job tasks → Competencies → Outcomes → Assessments connections confirmed

**Workload Distribution Verification** - Contact hours and independent study allocations appropriate for delivery mode and level

**Regulatory Compliance** - OFQUAL (UK), HLC/WASC (US), Bologna Process (EU), WCAG 2.1 AA accessibility

**AGI Academic Standards Enforcement** - Step 5 sources meet all academic integrity requirements

### Your Control

At each step:

- **Review Everything** - All content presented for approval
- **Request Changes** - Interactive refinement (including contact hours adjustments if institutional policy differs from 30%)
- **Add Expertise** - Insert custom content
- **Final Say** - Nothing final until you approve

**Exception:** AGI Academic Standards in Step 5 require admin override for any deviations

### System Safeguards

- **Minimum Review Times** - Prevents rushed approvals
- **Consistency Checks** - Alerts to inconsistencies including workload distribution
- **Revision Tracking** - Version history maintained
- **Rollback Capability** - Return to previous steps (with downstream re-validation)
- **AGI Standards Enforcement** - Automatic rejection of non-compliant sources

---

## Success Metrics and Monitoring

### Performance Indicators

**Efficiency Metrics**

- Average time per step (targeting provided estimates)
- First-time approval rates (targeting 60%+)
- Completion rate (targeting 95%+ reach Step 9)

**Quality Metrics**

- Validation pass rates (targeting 85%+ first attempt)
- Competency coverage (targeting 85%+ Essential addressed)
- **AGI Standards compliance (targeting 100% in Step 5)**
- Source quality (targeting 95%+ APA, 100% from approved categories)
- Workload distribution accuracy (targeting 100% alignment with declared contact hours %)

**User Satisfaction**

- SME satisfaction scores (targeting 4.2/5.0+)
- Time saved vs. manual (targeting 80%+)
- Repeat usage (targeting 70%+ create multiple programs)

**Regulatory Success**

- Accreditation approval rate (targeting 90%+)
- Time to accreditation (benchmark vs. manual)

---

## Support and Resources

### During Development

**Technical Support** - System issues, login, technical questions: support@agi.edu

**Content Support** - Curriculum design, pedagogical guidance, contact hours queries: id-team@agi.edu

**Standards Clarification** - AGI Guidelines & Academic Standards interpretation: qa@agi.edu

**Accreditation Assistance** - Regulatory submission support, credit framework guidance: accreditation@agi.edu

### Training Available

- 60-minute orientation session
- Step-by-step walkthrough documentation
- Practice program development opportunity
- One-on-one support for first complete program
- **AGI Academic Standards training** for source validation
- **Credit frameworks and contact hours training** for international programs

---

## Frequently Asked Questions

**Q: How long does the entire process take?**  
A: 2-3 hours spread over 1-2 days. Save progress and return anytime.

**Q: How do credits and contact hours work?**  
A: Credits represent total student workload (contact + independent + assessment time). The system determines contact hours by: (1) checking its knowledge base for accreditation-specific rules first, (2) checking if you specified custom requirements, (3) defaulting to 30% for UK/ECTS or using the defined 33% ratio for US credits. See Step 1 for detailed breakdown.

**Q: Can I adjust the contact hours percentage?**  
A: Yes! The system first checks its knowledge base for accreditation rules. If your institution requires something different from what's in the knowledge base or the defaults (30% for UK/ECTS, 33% for US), specify this in Step 1's delivery structure notes. The system will recalculate throughout.

**Q: What are the AGI Academic Standards and why are they strict?**  
A: AGI Academic Standards ensure all curriculum materials meet rigorous academic integrity requirements. They prevent use of unreliable sources (Wikipedia, blogs, AI-generated content) and ensure all materials are peer-reviewed, verifiable, and current. This protects learners and maintains institutional credibility.

**Q: What if I can't find sources meeting AGI Standards for my niche field?**  
A: The system will flag this in Step 5. You'll need to provide written justification and obtain admin-level approval. Document why AGI Standards cannot be met and what compensating quality measures you've taken.

**Q: Why were benchmark programs moved from Step 1 to Step 2?**  
A: To reduce redundancy and confusion. Benchmark programs are only used in Step 2 for competency analysis, so that's now the only place to specify them.

**Q: Can I use US college credits instead of UK or ECTS?**  
A: Yes! Version 2.2 supports US Semester Credits/Credit Hours alongside UK and ECTS options, with automatic workload calculations.

**Q: Can I develop multiple programs simultaneously?**  
A: Yes, each saved independently. Work on several in parallel.

**Q: What if I need changes after completing all steps?**  
A: Return to any step and revise. System flags which downstream steps need re-validation.

**Q: Do I need technical skills?**  
A: No. If you can use email and word processing, you can use this system.

**Q: What happens to my program data?**  
A: Securely stored in institutional database. You maintain full ownership, export anytime.

**Q: Is the system accessible?**  
A: Yes. Meets WCAG 2.1 AA: screen reader support, keyboard navigation, adjustable text.

**Q: What accreditation standards supported?**  
A: OFQUAL (UK), HLC and WASC (US), Bologna Process (EU), ISO/IEC 17024, EQF mappings included. Contact hours documentation meets all major accreditation requirements.

---

## Outstanding Items

### Step 11 Clarification Needed

**From Stakeholder Notes:**  
"Step 11 from Rejin's Excel - This is the only component not yet reflected in the updated workflow. Before we implement it, we need clarity on whether Step 11 adds required output that isn't already produced in Steps 1–9."

**Status:** Awaiting clarification on what Step 11 contains and whether it's truly additional or already covered in the current 9-step workflow.

**Action Required:** Review original documentation to determine if Step 11:

- Adds new required outputs not in Steps 1-9
- Duplicates existing step outputs
- Can be integrated into existing steps
- Should be removed as redundant

---

## Appendix A: Bloom's Taxonomy Quick Reference

| Level          | Definition                        | Example Verbs                                     | Program Type Emphasis                |
| -------------- | --------------------------------- | ------------------------------------------------- | ------------------------------------ |
| **Remember**   | Recall facts and concepts         | Define, List, Identify, Label, Name               | Certificate: 5-10%                   |
| **Understand** | Explain ideas or concepts         | Describe, Explain, Summarize, Interpret, Classify | Certificate: 20-30%, Diploma: 10-15% |
| **Apply**      | Use information in new situations | Apply, Demonstrate, Use, Implement, Solve         | Certificate: 30-40%, Diploma: 20-30% |
| **Analyze**    | Draw connections among ideas      | Analyze, Differentiate, Compare, Examine, Test    | Certificate: 20-25%, Diploma: 25-30% |
| **Evaluate**   | Justify a stand or decision       | Evaluate, Critique, Judge, Assess, Defend         | Certificate: 5-10%, Diploma: 20-25%  |
| **Create**     | Produce new or original work      | Design, Develop, Create, Construct, Formulate     | Diploma: 15-25%                      |

---

## Appendix B: AGI Academic Standards Summary

**Source Quality (Must Be):**

- Peer-reviewed journals
- Academic textbooks
- Open-access academic repositories
- Respected professional body publications

**Source Quality (Cannot Be):**

- Blogs, Wikipedia, Investopedia, MBA sites, Medium
- AI-generated content
- Marketing materials
- Slides, forums, unverified websites

**Recency:** ≤5 years (exceptions for seminal works with justification + recent pairing)

**Minimum:** 2-3 verified sources per topic; ≥1 academic + ≥1 applied/industry

**Citations:** APA 7th edition, complete (author, year, title, publisher, DOI/URL)

**Access:** Verified accessible (AGI Library or open access), no paywalled without license

**Peer-Review:** ≥50% of sources per module must be peer-reviewed or professional bodies

---

## Appendix C: Credit Systems & Contact Hours Reference

### Credit Equivalencies Table

| Credit System | Credits | Total Workload (Hours) | Contact Hours     | Independent Study |
| ------------- | ------- | ---------------------- | ----------------- | ----------------- |
| UK Credits    | 30      | 300                    | 90 (30% default)  | 210 (70%)         |
| UK Credits    | 60      | 600                    | 180 (30% default) | 420 (70%)         |
| UK Credits    | 120     | 1,200                  | 360 (30% default) | 840 (70%)         |
| ECTS          | 15      | 375                    | 113 (30% default) | 262 (70%)         |
| ECTS          | 30      | 750                    | 225 (30% default) | 525 (70%)         |
| ECTS          | 60      | 1,500                  | 450 (30% default) | 1,050 (70%)       |
| US Semester   | 15      | 675                    | 223 (33% defined) | 452 (67%)         |
| US Semester   | 30      | 1,350                  | 446 (33% defined) | 904 (67%)         |
| US Semester   | 45      | 2,025                  | 669 (33% defined) | 1,356 (67%)       |

**Note:** UK and ECTS use 30% default. US Semester Credits use a defined 33% ratio (15 contact hours per credit).

### Contact Hours by Delivery Mode (Typical Ranges)

| Delivery Mode      | Contact Hours % | Example: 120 UK Credits (1,200 hours) |
| ------------------ | --------------- | ------------------------------------- |
| In-Person          | 30-50%          | 360-600 contact hours                 |
| Hybrid/Blended     | 20-40%          | 240-480 contact hours                 |
| Online Facilitated | 15-30%          | 180-360 contact hours                 |
| Online Self-Study  | 10-20%          | 120-240 contact hours                 |

### Bologna Process & Country Variations

**ECTS Standard:** 1 ECTS = 25-30 hours total workload (system uses 25 as standard calculation)

**Contact Hours by Country (Approximate):**

- **UK:** 20-30% (more independent study at postgrad)
- **Germany:** 25-30%
- **Nordic Countries:** 30-40%
- **Southern Europe:** 40-50% (more lecture-heavy)

**Note:** Even within Bologna Process signatory countries, contact hour proportions vary by institution policy, program level, and delivery mode. The 30% default provides a safe, internationally accepted standard when specific requirements are not mandated.

---

**Document End**

© American Global Institute | November 2025  
AI-Integrated Curriculum Generator Workflow v2.2 Final (With Contact Hours Guidance)

For questions or clarifications, contact: curriculum@agi.edu
