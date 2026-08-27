# Step 10: Lesson-by-Lesson Generation Implementation Plan

## Current Behavior

- Generates all lessons for a module at once (module-by-module)
- Example: Module 1 has 8 lessons → generates all 8 lessons in one API call
- Takes 2-5 minutes per module

## Desired Behavior

- Generate one lesson at a time (lesson-by-lesson)
- Example: Module 1 has 8 lessons → 8 separate API calls, one per lesson
- Takes ~30-60 seconds per lesson

## Implementation Changes Required

### 1. Backend Changes

#### A. New Method: `processStep10NextLesson()`

Create a new method in `workflowService.ts` that:

- Finds the next lesson to generate (not the next module)
- Generates only that one lesson
- Saves it to the database
- Returns progress (lessons completed / total lessons)

#### B. Database Schema Update

The current schema stores:

```typescript
step10: {
  moduleLessonPlans: [
    {
      moduleId: string,
      lessons: LessonPlan[]  // All lessons for this module
    }
  ]
}
```

Need to track lesson-level progress:

```typescript
step10: {
  moduleLessonPlans: [
    {
      moduleId: string,
      lessons: LessonPlan[],
      lessonsGenerated: number,  // NEW: track how many lessons are complete
      totalLessons: number       // NEW: total lessons planned for this module
    }
  ],
  currentModuleIndex: number,    // NEW: which module we're working on
  currentLessonIndex: number     // NEW: which lesson within that module
}
```

#### C. Lesson Generation Logic

- First, determine how many lessons a module needs (based on contact hours)
- Generate lessons one at a time
- Each lesson includes:
  - Lesson objectives (from MLOs)
  - Activity sequence with timings
  - Teaching methods & materials
  - Formative checks
  - PPT deck for that lesson

### 2. Frontend Changes

#### A. Progress Display

Update Step10View to show:

```
Module 1: Foundations of Service Operations
├─ ✓ Lesson 1: Introduction to Service Operations (90 min)
├─ ✓ Lesson 2: Customer Experience Fundamentals (90 min)
├─ ⏳ Lesson 3: Service Quality Management (generating...)
├─ ⏸️ Lesson 4: Service Delivery Models (pending)
└─ ⏸️ Lesson 5: Technology in Service Operations (pending)

Module 2: Compliance and HACCP
├─ ⏸️ Lesson 1: Food Safety Regulations (pending)
└─ ⏸️ Lesson 2: HACCP Principles (pending)
```

#### B. Continue Button

- Show "Generate Next Lesson" button
- Display which lesson will be generated next
- Show estimated time (30-60 seconds)

### 3. API Changes

#### Current Endpoint

```
POST /api/v3/workflow/:id/step10
```

Generates next module (all lessons)

#### New Endpoint (Option 1 - Modify existing)

```
POST /api/v3/workflow/:id/step10
```

Generates next lesson (one at a time)

#### New Endpoint (Option 2 - Add new)

```
POST /api/v3/workflow/:id/step10/next-lesson
```

Generates next lesson specifically

## Implementation Steps

### Phase 1: Backend Foundation

1. ✅ Add lesson-level tracking to database schema
2. ✅ Create `processStep10NextLesson()` method
3. ✅ Update route to call new method
4. ✅ Add lesson-level progress calculation

### Phase 2: Frontend Updates

1. ✅ Update Step10View to show lesson-level progress
2. ✅ Add lesson tree/list UI component
3. ✅ Update "Continue" button text
4. ✅ Add lesson-level status indicators

### Phase 3: Testing & Refinement

1. Test with small curriculum (2 modules, 4 lessons each)
2. Verify progress tracking
3. Test error handling (what if lesson generation fails?)
4. Test resume functionality (can user continue after closing browser?)

## Estimated Effort

- Backend: 3-4 hours
- Frontend: 2-3 hours
- Testing: 1-2 hours
- **Total: 6-9 hours**

## Risks & Considerations

1. **Database migrations**: Existing workflows won't have the new fields
2. **Backward compatibility**: Need to handle workflows that used old module-by-module approach
3. **Error recovery**: If a lesson fails, how do we retry just that lesson?
4. **User experience**: More clicks required (could be seen as tedious)

## Alternative: Hybrid Approach

Keep module-by-module but show lesson-level progress:

- Generate all lessons for a module in background
- Update database after each lesson completes
- Show real-time progress as lessons complete
- User still clicks once per module, but sees lesson-by-lesson progress

This would be easier to implement and provide similar visibility without requiring multiple clicks.
