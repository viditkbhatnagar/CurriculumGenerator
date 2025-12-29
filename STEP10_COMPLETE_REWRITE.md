# Step 10: Complete Rewrite Plan

## New Approach: Simple & Manual

### User Flow

1. User sees list of all modules
2. Module 1 has "Generate Now" button (enabled)
3. Modules 2-7 are locked
4. User clicks "Generate Now" on Module 1
5. Button becomes "Generating..." (disabled)
6. Message: "Generating in background. Click 'Refresh' to check progress."
7. User waits 2-5 minutes
8. User clicks "Refresh" button
9. Module 1 shows complete with lessons and PPTs
10. Module 2 unlocks with "Generate Now" button
11. Repeat for each module

### No Auto-Refresh

- No polling intervals
- No automatic state updates
- User manually clicks "Refresh" when ready
- Simple and predictable

### Backend Changes

1. Generate PPT immediately after each lesson
2. Save PPT reference with lesson progress
3. Ensure only one module generates at a time

### Frontend Changes

1. Remove all polling logic
2. Simple button states: Generate Now / Generating / Complete
3. Manual "Refresh" button
4. Clear progress messages

## Implementation Steps

### Step 1: Backend - Generate PPTs Per Lesson

Modify `lessonPlanService.ts` to generate PPT after each lesson

### Step 2: Frontend - Simplify State Management

Remove polling, keep simple button states

### Step 3: Add Manual Refresh Button

Big, obvious "Refresh to Check Progress" button

### Step 4: Test

- Generate Module 1
- Wait
- Click Refresh
- Verify lessons AND PPTs appear
- Module 2 unlocks
- Repeat

## Benefits

- No polling = No bugs
- User control = Clear UX
- Sequential = No conflicts
- PPTs per lesson = Always saved
