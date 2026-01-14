# Requirements Document

## Introduction

This document specifies the requirements for a standalone step execution feature that allows users to directly execute individual curriculum generation steps (2-10) without going through the full sequential workflow. Users can access a dedicated page, select any step, provide a description input, and receive AI-generated output for that specific step. The feature operates independently of the existing workflow system, requires no authentication, and provides temporary session-based results with Word document download capability.

## Glossary

- **Standalone_Step_Executor**: The system component that processes individual step requests independently without workflow context
- **Step_Selector**: The UI component displaying all available steps (2-10) for user selection
- **Description_Input**: A text area where users provide context/requirements for the selected step
- **Step_Output**: The AI-generated result displayed on the page and available for download
- **Landing_Page**: The existing home page at `/` that will include a link to the standalone feature
- **Standalone_Page**: The new dedicated page at `/standalone` for executing individual steps
- **Word_Export_Service**: The existing service that generates Word documents from curriculum content

## Requirements

### Requirement 1: Landing Page Navigation

**User Story:** As a user, I want to access the standalone step execution feature from the landing page, so that I can quickly generate individual curriculum components without starting a full workflow.

#### Acceptance Criteria

1. WHEN a user visits the landing page, THE Landing_Page SHALL display a clearly visible button/link to access the standalone step execution feature
2. WHEN a user clicks the standalone feature link, THE System SHALL navigate to the `/standalone` route
3. THE Landing_Page SHALL position the standalone feature link prominently alongside the existing "Start New Curriculum" button

### Requirement 2: Standalone Page Layout

**User Story:** As a user, I want to see all available steps on the standalone page, so that I can choose which curriculum component to generate.

#### Acceptance Criteria

1. WHEN a user visits the standalone page, THE Standalone_Page SHALL display a grid/list of all available steps (2-10)
2. THE Standalone_Page SHALL display each step with its name, icon, and estimated time from the existing WORKFLOW_STEPS configuration
3. THE Standalone_Page SHALL exclude Step 1 (Program Foundation) as it requires full workflow context
4. WHEN a user selects a step, THE Standalone_Page SHALL highlight the selected step visually
5. THE Standalone_Page SHALL be accessible without authentication

### Requirement 3: Step Selection and Description Input

**User Story:** As a user, I want to provide a description for my selected step, so that the AI can generate relevant content based on my requirements.

#### Acceptance Criteria

1. WHEN a user selects a step, THE System SHALL display a description input area for that step
2. THE Description_Input SHALL include a placeholder text explaining what information to provide for the selected step
3. THE Description_Input SHALL allow multi-line text entry with a minimum height of 4 rows
4. WHEN a user has not entered any description, THE System SHALL disable the generate button
5. THE System SHALL display the step's existing description from STEP_DESCRIPTIONS above the input area

### Requirement 4: Step Execution

**User Story:** As a user, I want to execute my selected step with my description, so that I can receive AI-generated curriculum content.

#### Acceptance Criteria

1. WHEN a user clicks the generate button with valid input, THE Standalone_Step_Executor SHALL send the description to the OpenAI API using the existing step prompts
2. THE Standalone_Step_Executor SHALL use the same prompts as the existing workflow steps without modification
3. WHILE the step is executing, THE System SHALL display a loading spinner with "Generating..." text
4. THE System SHALL NOT require any previous step data or workflow context for execution
5. IF an error occurs during generation, THEN THE System SHALL display a user-friendly error message

### Requirement 5: Output Display

**User Story:** As a user, I want to see the generated output on the same page, so that I can review the results immediately.

#### Acceptance Criteria

1. WHEN generation completes successfully, THE System SHALL display the output below the input section
2. THE Step_Output SHALL be formatted appropriately based on the step type (tables, lists, structured content)
3. THE Step_Output SHALL include a clear heading indicating which step generated the content
4. THE System SHALL preserve the output on the page until the user navigates away or generates new content

### Requirement 6: Word Document Download

**User Story:** As a user, I want to download the generated output as a Word document, so that I can save and use the content offline.

#### Acceptance Criteria

1. WHEN output is displayed, THE System SHALL show a "Download as Word" button
2. WHEN a user clicks the download button, THE Word_Export_Service SHALL generate a .docx file containing the output
3. THE Word document SHALL include the step name as the document title
4. THE Word document SHALL include the user's description as context
5. THE Word document SHALL format the output content appropriately (headings, tables, lists)

### Requirement 7: Session-Based Storage

**User Story:** As a user, I want my generated content to persist during my session, so that I can review it without re-generating.

#### Acceptance Criteria

1. THE System SHALL store generated outputs in browser session storage only
2. THE System SHALL NOT persist any data to the database
3. WHEN a user refreshes the page, THE System SHALL clear any previously generated output
4. THE System SHALL allow users to generate multiple different steps in one session

### Requirement 8: Step-Specific Prompts

**User Story:** As a user, I want each step to use its specialized AI prompt, so that I receive properly formatted output for that step type.

#### Acceptance Criteria

1. WHEN executing Step 2 (KSC Framework), THE Standalone_Step_Executor SHALL generate Knowledge, Skills, and Competencies items
2. WHEN executing Step 3 (PLOs), THE Standalone_Step_Executor SHALL generate Program Learning Outcomes with Bloom's taxonomy levels
3. WHEN executing Step 4 (Course Framework), THE Standalone_Step_Executor SHALL generate modules with MLOs
4. WHEN executing Step 5 (Topic Sources), THE Standalone_Step_Executor SHALL generate AGI-compliant academic sources
5. WHEN executing Step 6 (Reading Lists), THE Standalone_Step_Executor SHALL generate core and supplementary reading lists
6. WHEN executing Step 7 (Assessments), THE Standalone_Step_Executor SHALL generate MCQ-based auto-gradable assessments
7. WHEN executing Step 8 (Case Studies), THE Standalone_Step_Executor SHALL generate case study scenarios
8. WHEN executing Step 9 (Glossary), THE Standalone_Step_Executor SHALL generate glossary terms and definitions
9. WHEN executing Step 10 (Lesson Plans), THE Standalone_Step_Executor SHALL generate lesson plans

### Requirement 9: Backend API Endpoint

**User Story:** As a developer, I want a dedicated API endpoint for standalone step execution, so that the frontend can request step generation without workflow dependencies.

#### Acceptance Criteria

1. THE System SHALL expose a POST endpoint at `/api/v3/standalone/step/:stepNumber`
2. THE endpoint SHALL accept a JSON body with `description` field
3. THE endpoint SHALL NOT require authentication
4. THE endpoint SHALL return the generated content in JSON format
5. IF the step number is invalid (not 2-10), THEN THE System SHALL return a 400 error

### Requirement 10: Error Handling

**User Story:** As a user, I want clear feedback when something goes wrong, so that I can understand and resolve issues.

#### Acceptance Criteria

1. IF the OpenAI API fails, THEN THE System SHALL display "Generation failed. Please try again."
2. IF the description is too short (less than 10 characters), THEN THE System SHALL display "Please provide more details in your description."
3. IF the network request times out, THEN THE System SHALL display "Request timed out. Please try again."
4. THE System SHALL allow users to retry generation after an error
