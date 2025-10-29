# Old 8-Stage Workflow - Deprecated

**Date:** October 29, 2025  
**Status:** ⚠️ DEPRECATED - Use New 5-Stage Workflow Instead

---

## ⚠️ Deprecation Notice

The original 8-stage curriculum generation workflow has been **fully replaced** by the new 5-stage AI-integrated workflow.

### Old Workflow (Deprecated)

1. Program Definition
2. Competency Mapping
3. Module Design
4. Content Creation
5. Assessment Design
6. Excel Upload & Processing
7. Simulation Engine Integration
8. Review & Publish

### New Workflow (Active)

1. **Prompt Selection** - Choose AGI-compliant template
2. **AI Research & SME Review** - Generate 14-component preliminary package
3. **Resource Cost Evaluation** - Analyze paid resources & alternatives
4. **Curriculum Generation** - Create full curriculum package
5. **Final Review & Launch** - SME approval & LMS publication

---

## Migration Path

### For Existing Projects

**Old projects will continue to function** using the deprecated `/api/curriculum/*` endpoints, but:

- No new features will be added to old workflow
- Bug fixes will be provided for critical issues only
- Full support ends: December 31, 2025

### Starting New Projects

**All new projects MUST use the new workflow:**

- API Base: `/api/v2/*`
- UI: Navigate to `/prompts` to start
- Documentation: See `NEW_WORKFLOW_IMPLEMENTATION_STATUS.md`

---

## Deprecated Files & Routes

### Backend (Marked for Removal)

The following files are deprecated but retained for backward compatibility:

#### Routes

- ❌ `/api/curriculum/generate` → Use `/api/v2/projects/:id/generate`
- ❌ `/api/curriculum/modules` → Replaced by `/api/v2/research/:packageId/`
- ❌ `/api/curriculum/assessments` → Now part of Stage 4 generation
- ❌ `/api/curriculum/export` → Integrated into Stage 5 publication

#### Services (Legacy)

- `curriculumService.ts` (old version) → Use `curriculumGenerationServiceV2.ts`
- `excelUploadService.ts` → Replaced by AI research in Stage 2

#### Models (Old Schema)

Old models remain for existing project compatibility:

- `OldCurriculumProject` (if exists)
- `ModuleDesign` (old)
- `AssessmentBank` (old structure)

**Note:** New projects use the 6 new models (CoursePrompt, CurriculumProject, etc.)

---

## What Changed?

### Key Improvements

1. **AI Integration**
   - Old: Manual content creation
   - New: OpenAI GPT-4 generates all content

2. **AGI Compliance**
   - Old: Manual verification
   - New: Built-in AGI template with 14 components

3. **Real-Time Collaboration**
   - Old: Batch processing
   - New: Chat-based SME interaction with WebSocket

4. **Cost Management**
   - Old: No cost tracking
   - New: Automated resource extraction and alternative suggestions

5. **Workflow Stages**
   - Old: 8 stages (many manual steps)
   - New: 5 streamlined stages (AI-assisted)

---

## Technical Details

### Database Migration

Old collections remain intact:

```
# Old (still exists)
- curriculums (old schema)
- modules
- assessments

# New (added)
- course_prompts
- curriculum_projects
- preliminary_curriculum_packages
- resource_cost_evaluations
- full_curriculum_packages
- curriculum_reviews
```

### API Versioning

```
# Old API (Deprecated)
GET /api/curriculum/*

# New API (Active)
GET /api/v2/*
```

---

## Support & Questions

- **New Workflow Documentation:** `NEW_WORKFLOW_IMPLEMENTATION_STATUS.md`
- **Migration Help:** Contact development team
- **Bug Reports:** Mark as "Legacy Workflow" in issue title

---

## Timeline

- **October 29, 2025:** New workflow launched
- **November 1, 2025:** Old workflow marked deprecated
- **December 31, 2025:** Old workflow endpoints disabled
- **January 31, 2026:** Old workflow code removed from codebase

---

## For Developers

### Do NOT Add Features to Old Workflow

Only critical bug fixes are allowed. All new features go to new workflow.

### Removing Old Code (Planned)

The following will be removed in Q1 2026:

- `packages/backend/src/routes/curriculum.ts` (old)
- `packages/frontend/src/app/curriculum/*` (old pages)
- Legacy service files
- Old database migration scripts

### Testing Old Workflow

If you need to test old projects:

```bash
# Access old endpoints (still functional)
curl http://localhost:4000/api/curriculum/...

# Frontend: old pages still render for backward compatibility
```

---

**Use the new workflow for all new projects!**  
See `NEW_WORKFLOW_IMPLEMENTATION_STATUS.md` for setup instructions.
