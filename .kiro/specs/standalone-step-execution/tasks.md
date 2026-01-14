# Implementation Plan: Standalone Step Execution

## Overview

This implementation plan breaks down the standalone step execution feature into discrete coding tasks. The approach is incremental: backend API first, then frontend components, then integration and testing.

## Tasks

- [x] 1. Create Backend Standalone Service
  - [x] 1.1 Create standaloneService.ts with step generation methods
    - Create new service file at `packages/backend/src/services/standaloneService.ts`
    - Implement `generateStep(stepNumber, description)` method
    - Implement individual step generators (generateStep2 through generateStep10)
    - Reuse existing prompts from workflowService.ts
    - _Requirements: 4.1, 4.2, 8.1-8.9_

  - [x] 1.2 Write property test for step output structure validation
    - **Property 4: Step Output Structure Validation**
    - **Validates: Requirements 5.2, 8.1-8.9**

- [x] 2. Create Backend Standalone Routes
  - [x] 2.1 Create standaloneRoutes.ts with POST endpoint
    - Create new router at `packages/backend/src/routes/standaloneRoutes.ts`
    - Implement POST `/api/v3/standalone/step/:stepNumber` endpoint
    - Add input validation (step number 2-10, description >= 10 chars)
    - Return JSON response with step content
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 2.2 Register standalone routes in main app
    - Update `packages/backend/src/index.ts` or main router file
    - Mount standalone routes at `/api/v3/standalone`
    - _Requirements: 9.1_

  - [x] 2.3 Write property test for API request validation
    - **Property 7: API Request Validation**
    - **Validates: Requirements 9.5**

- [x] 3. Checkpoint - Backend API Complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Create Frontend Standalone Page
  - [x] 4.1 Create standalone page component
    - Create new page at `packages/frontend/src/app/standalone/page.tsx`
    - Implement page layout with step selector, input, and output sections
    - Add state management for selected step, description, output, loading, error
    - _Requirements: 2.1, 2.5_

  - [x] 4.2 Create StepSelector component
    - Create component at `packages/frontend/src/components/standalone/StepSelector.tsx`
    - Display grid of steps 2-10 with name, icon, time
    - Implement step selection with visual highlighting
    - Exclude Step 1 from display
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 4.3 Write property test for step metadata display
    - **Property 1: Step Metadata Display Consistency**
    - **Validates: Requirements 2.2, 3.5**

- [x] 5. Create Description Input Component
  - [x] 5.1 Create DescriptionInput component
    - Create component at `packages/frontend/src/components/standalone/DescriptionInput.tsx`
    - Implement multi-line textarea with placeholder
    - Display step description above input
    - Disable generate button when input invalid
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 5.2 Write property test for description validation
    - **Property 2: Description Input Validation**
    - **Validates: Requirements 3.4, 10.2**

- [x] 6. Create Output Display Component
  - [x] 6.1 Create StepOutputDisplay component
    - Create component at `packages/frontend/src/components/standalone/StepOutput.tsx`
    - Implement step-specific output rendering (tables, lists, structured content)
    - Add heading with step name
    - Add download button
    - _Requirements: 5.1, 5.2, 5.3, 6.1_

  - [x] 6.2 Implement Word document export
    - Create standalone Word export function
    - Include step name as title
    - Include user description as context
    - Format content appropriately
    - _Requirements: 6.2, 6.3, 6.4, 6.5_

  - [x] 6.3 Write property test for output display states
    - **Property 5: Output Display State Consistency**
    - **Validates: Requirements 3.2, 3.3, 3.4**
    - **PBT Status: pass**

- [x] 7. Checkpoint - Frontend Components Complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Integrate Frontend with Backend
  - [x] 8.1 Create API client function for standalone execution
    - Add function to `packages/frontend/src/lib/standaloneApi.ts`
    - Implement POST request to standalone endpoint
    - Handle loading, success, and error states
    - _Requirements: 4.1, 4.3, 4.5_

  - [x] 8.2 Wire up page with API calls
    - Connect generate button to API call
    - Display loading spinner during generation
    - Display output on success
    - Display error messages on failure
    - _Requirements: 4.3, 5.1, 10.1, 10.3, 10.4_

  - [x] 8.3 Write property test for standalone execution independence
    - **Property 3: Standalone Execution Independence**
    - **Validates: Requirements 4.4, 9.3**

- [x] 9. Add Landing Page Navigation
  - [x] 9.1 Update landing page with standalone link
    - Add button/link to `/standalone` on landing page
    - Position alongside existing "Start New Curriculum" button
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 10. Implement Session Storage
  - [x] 10.1 Add session storage for output persistence
    - Store output in sessionStorage after generation
    - Clear on page refresh (default behavior)
    - Allow multiple step executions in session
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 10.2 Write property test for session-only storage
    - **Property 6: Session-Only Data Storage**
    - **Validates: Requirements 7.1, 7.2**

- [x] 11. Add Error Handling
  - [x] 11.1 Implement frontend error handling
    - Display appropriate error messages for each error type
    - Enable retry after errors
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 11.2 Implement backend error handling
    - Return appropriate HTTP status codes
    - Return user-friendly error messages
    - _Requirements: 10.1, 10.2, 10.3_

- [x] 12. Final Checkpoint - Feature Complete
  - All tests pass
  - End-to-end flow works correctly
  - All 9 steps (2-10) can be executed individually

## Notes

- All tasks including property-based tests are required
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Existing workflow prompts are reused without modification
