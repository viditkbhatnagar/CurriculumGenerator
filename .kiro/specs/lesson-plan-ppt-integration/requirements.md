# Requirements Document

## Introduction

This document specifies the requirements for integrating Step 10 (Lesson Plan Generation) into the existing 9-step curriculum generation workflow and improving the PPT Generation (Step 11) to align with the provided specification documents. The curriculum generator will be extended from 9 steps to 10 steps, with lesson plans becoming an integral part of the final curriculum package. Additionally, the PPT generation will be enhanced to follow the Step 11 specification, generating comprehensive slide decks based on the lesson plans.

## Glossary

- **Lesson Plan**: A detailed, time-bound instructional blueprint for a single teaching session (60-180 minutes) within a module
- **MLO (Module Learning Outcome)**: Specific learning outcomes defined at the module level
- **PLO (Program Learning Outcome)**: High-level learning outcomes defined at the program level
- **Case Study**: Practical scenarios created in Step 8 for teaching and assessment purposes
- **Formative Assessment**: Ongoing assessments used to monitor student learning during instruction
- **Contact Hours**: Hours spent in direct instruction with an instructor
- **Independent Hours**: Hours spent in self-directed study
- **Bloom's Taxonomy**: A hierarchical classification of cognitive learning levels (Remember, Understand, Apply, Analyze, Evaluate, Create)
- **AGI Compliance**: Adherence to Academic Governance and Integrity standards
- **PPT Deck**: PowerPoint presentation slides generated for each lesson
- **Delivery Mode**: The method of instruction (online self-study, online facilitated, hybrid/blended, in-person)

## Requirements

### Requirement 1

**User Story:** As a curriculum developer, I want the system to generate detailed lesson plans for each module using context from all previous 9 steps, so that instructors have structured teaching blueprints aligned with learning outcomes.

#### Acceptance Criteria

1. WHEN Step 9 (Glossary) is completed THEN the system SHALL enable the user to proceed to Step 10 (Lesson Plan Generation)
2. WHEN the user initiates Step 10 THEN the system SHALL use context from all previous 9 steps (Program Foundation, KSC Framework, PLOs, Course Framework, Sources, Reading Lists, Assessments, Case Studies, Glossary)
3. WHEN generating lesson plans THEN the system SHALL divide module contact hours into lesson blocks of 60-180 minutes each
4. WHEN generating lesson plans THEN the system SHALL ensure the sum of all lesson durations equals the module's total contact hours
5. WHEN generating lesson plans THEN the system SHALL align each lesson with 1-2 Module Learning Outcomes (MLOs)
6. WHEN generating lesson plans THEN the system SHALL reflect Bloom's taxonomy level progression defined in Step 4 (foundational concepts in early lessons, complex applications in later lessons)

### Requirement 2

**User Story:** As a curriculum developer, I want each lesson plan to include comprehensive instructional details, so that instructors can effectively deliver the content.

#### Acceptance Criteria

1. WHEN a lesson plan is generated THEN the system SHALL include lesson objectives derived from the selected MLOs
2. WHEN a lesson plan is generated THEN the system SHALL include a sequenced activity timeline with specific timings for each activity
3. WHEN a lesson plan is generated THEN the system SHALL specify teaching methods appropriate for the delivery mode (lecture, discussion, demonstration, practice, role-play, case analysis)
4. WHEN a lesson plan is generated THEN the system SHALL list required materials including reading references from Steps 5-6 and case files from Step 8
5. WHEN a lesson plan is generated THEN the system SHALL include instructor notes with pedagogical guidance, pacing suggestions, and adaptation options
6. WHEN a lesson plan is generated THEN the system SHALL include independent study assignments with Core/Supplementary reading placement and estimated effort

### Requirement 3

**User Story:** As a curriculum developer, I want case studies from Step 8 to be automatically integrated into appropriate lesson plans, so that practical learning activities are properly sequenced.

#### Acceptance Criteria

1. WHEN a case study has module and MLO mappings THEN the system SHALL place the case study in the lesson whose primary MLO alignment matches the case's MLO support
2. WHEN placing case studies THEN the system SHALL consider difficulty progression (foundational cases in earlier lessons, complex cases in later lessons)
3. WHEN a case study is marked as role-play suitable THEN the system SHALL generate character briefs, decision prompts, and structured debrief questions
4. WHEN a case study supports multiple modules THEN the system SHALL include the full activity in the first appearance and reference it as continuation in subsequent appearances
5. WHEN embedding a case study in a lesson THEN the system SHALL include activity type, duration, learning purpose, instructor instructions, student output expectations, and assessment hooks

### Requirement 4

**User Story:** As a curriculum developer, I want formative assessments from Step 7 to be integrated into lesson plans, so that instructors can monitor student learning during instruction.

#### Acceptance Criteria

1. WHEN generating lesson plans THEN the system SHALL include formative checks derived from Step 7 assessment items
2. WHEN including formative assessments THEN the system SHALL align them with the lesson's MLOs
3. WHEN including formative assessments THEN the system SHALL specify the assessment type and expected duration

### Requirement 5

**User Story:** As a curriculum developer, I want the lesson plan output to follow a standardized template, so that all lesson plans are consistent and comprehensive.

#### Acceptance Criteria

1. WHEN generating a lesson plan THEN the system SHALL include metadata (module number/title, lesson number/title, lesson duration, linked MLOs and PLOs)
2. WHEN generating a lesson plan THEN the system SHALL include lesson objectives derived from selected MLOs
3. WHEN generating a lesson plan THEN the system SHALL include an activity sequence with timings for each activity type
4. WHEN generating a lesson plan THEN the system SHALL include a required materials section listing PPT deck reference, case files, and reading references
5. WHEN generating a lesson plan THEN the system SHALL include instructor notes with pedagogical guidance
6. WHEN generating a lesson plan THEN the system SHALL include an independent study assignment section

### Requirement 6

**User Story:** As a curriculum developer, I want the system to generate PPT decks for each lesson based on the lesson plans, so that instructors have ready-to-use visual teaching materials.

#### Acceptance Criteria

1. WHEN a lesson plan is generated THEN the system SHALL generate a corresponding PPT deck following the Step 11 specification
2. WHEN generating a PPT deck THEN the system SHALL include a title slide with module/lesson information and session duration
3. WHEN generating a PPT deck THEN the system SHALL include a learning objectives slide derived from MLO alignment
4. WHEN generating a PPT deck THEN the system SHALL include key concepts slides using MLO-based summaries, glossary definitions from Step 9, and reading-based insights
5. WHEN generating a PPT deck THEN the system SHALL include instructional content slides aligned with the activity flow from the lesson plan
6. WHEN generating a PPT deck THEN the system SHALL include case study slides with scenario overview, key facts, discussion prompts, and role-play instructions if applicable

### Requirement 7

**User Story:** As a curriculum developer, I want PPT decks to include assessment and summary components, so that instructors can evaluate learning and provide closure.

#### Acceptance Criteria

1. WHEN generating a PPT deck THEN the system SHALL include formative check slides with 1-3 MCQs and answer explanations from Step 7
2. WHEN generating a PPT deck THEN the system SHALL include a summary slide with key ideas recap and reflection prompts
3. WHEN generating a PPT deck THEN the system SHALL include an independent study slide listing required Core readings, optional Supplementary readings, and estimated study time
4. WHEN generating a PPT deck THEN the system SHALL include a reference slide with APA-formatted citations from all materials used

### Requirement 8

**User Story:** As a curriculum developer, I want PPT decks to adapt based on delivery mode, so that slides are optimized for different teaching contexts.

#### Acceptance Criteria

1. WHEN the delivery mode is in-person THEN the system SHALL generate slides with more diagrams, facilitation cues, reduced text density, and prioritized role-play/group-activity prompts
2. WHEN the delivery mode is online facilitated THEN the system SHALL generate slides with clearer step-by-step instructions, breakout room prompts, and polling/chat engagement elements
3. WHEN the delivery mode is online self-study THEN the system SHALL generate slides with additional explanatory text, embedded knowledge checks, and simplified case studies for solo analysis
4. WHEN the delivery mode is hybrid THEN the system SHALL generate slides with balanced text-to-visual ratio designed for both synchronous and asynchronous segments

### Requirement 9

**User Story:** As a curriculum developer, I want the system to validate PPT decks before export, so that all generated materials meet quality standards.

#### Acceptance Criteria

1. WHEN validating PPT decks THEN the system SHALL verify each lesson has a corresponding PPT deck
2. WHEN validating PPT decks THEN the system SHALL verify all MLOs appear in corresponding slide sequences
3. WHEN validating PPT decks THEN the system SHALL verify case studies appear only in designated lessons
4. WHEN validating PPT decks THEN the system SHALL verify citations match verified sources from Steps 5-6
5. WHEN validating PPT decks THEN the system SHALL verify slide count per deck remains within 15-35 slides
6. WHEN validating PPT decks THEN the system SHALL verify all glossary terms used are defined in Step 9

### Requirement 10

**User Story:** As a curriculum developer, I want the curriculum workflow to be updated to include Step 10, so that lesson plans are part of the standard curriculum generation process.

#### Acceptance Criteria

1. WHEN the workflow model is updated THEN the system SHALL include step10 field for storing lesson plan data
2. WHEN the workflow model is updated THEN the system SHALL update currentStep maximum from 9 to 10
3. WHEN the workflow model is updated THEN the system SHALL update status enum to include step10_pending and step10_complete
4. WHEN the workflow model is updated THEN the system SHALL update stepProgress array to include step 10

### Requirement 11

**User Story:** As a curriculum developer, I want the final curriculum document to include all 10 steps of data, so that the exported document is comprehensive.

#### Acceptance Criteria

1. WHEN exporting the curriculum document THEN the system SHALL include all 10 steps in sequential order (Program Foundation, KSC Framework, PLOs, Course Framework, Sources, Reading Lists, Assessments, Case Studies, Glossary, Lesson Plans)
2. WHEN exporting the curriculum document THEN the system SHALL include Step 10 (Lesson Plans) section after Step 9 (Glossary)
3. WHEN exporting the curriculum document THEN the system SHALL format lesson plans with module grouping, lesson details, activity sequences, and materials lists
4. WHEN exporting the curriculum document THEN the system SHALL include lesson plan validation summary
5. WHEN exporting the curriculum document THEN the system SHALL maintain consistent formatting across all 10 steps

### Requirement 12

**User Story:** As a curriculum developer, I want PPT decks to be exportable in multiple formats, so that they can be used across different platforms.

#### Acceptance Criteria

1. WHEN exporting PPT decks THEN the system SHALL provide PPTX format (editable)
2. WHEN exporting PPT decks THEN the system SHALL provide PDF format (read-only)
3. WHEN exporting PPT decks THEN the system SHALL provide PNG/JPEG slide images for LMS compatibility
