# Step 7 Assessment Generator - Test Guide

## 🎯 Pre-Test Checklist

### Backend Services Running

```bash
cd packages/backend
npm run dev
```

**Expected**: Server running on `http://localhost:5001` (or configured port)

### Frontend Running

```bash
cd packages/frontend
npm run dev
```

**Expected**: Frontend running on `http://localhost:3000`

### Environment Variables Set

- ✅ `OPENAI_API_KEY` - Must be valid and have quota
- ✅ `MONGODB_URI` - Database connection
- ✅ `JWT_SECRET` - Authentication

---

## 🧪 Test Scenarios

### Test 1: Basic Formative + Summative (Happy Path)

**Objective**: Generate a complete assessment package with default settings

**Steps**:

1. Navigate to a workflow at Step 7
2. Use these settings:
   - Assessment Structure: **Both Formative & Summative**
   - Assessment Balance: **Blended Mix**
   - Formative per Module: **2**
   - Formative Types: **Short quizzes**, **MCQ knowledge checks**
   - Summative Format: **Mixed format**
   - Weightages: Formative **30%**, Summative **70%**
3. Click **"Generate Assessment Package"**

**Expected Results**:

- ✅ Generation starts (progress bar appears)
- ✅ Progress updates every 3-4 minutes
- ✅ Total time: 15-25 minutes for 6 modules
- ✅ Success message appears
- ✅ Stats show:
  - Formative count: 12 (2 per module × 6 modules)
  - Summative count: 1
  - Sample questions: ~55 total (30 MCQ + 10 SJT + 5 cases + 5 essays + 5 practical)
  - LMS formats: 3 (Canvas, Moodle, Blackboard)
  - Validation: All green checkmarks

**API Logs to Check**:

```
[Step 7] Starting comprehensive assessment generation
[Step 7] Generating Formative Assessments (1/4)
[Step 7] Module 1/6 formatives complete
...
[Step 7] Generating Summative Assessments (2/4)
[Step 7] Summative assessments complete
[Step 7] Generating Sample Questions (3/4)
[Step 7] Generated mcq samples
...
[Step 7] Generating LMS Packages (4/4)
[Step 7] Complete
```

---

### Test 2: Formative Only (Quick Test)

**Objective**: Test formative-only generation (faster)

**Steps**:

1. Navigate to Step 7
2. Use these settings:
   - Assessment Structure: **Formative Only**
   - Formative per Module: **1**
   - Formative Types: **Short quizzes**
3. Click **"Generate Assessment Package"**

**Expected Results**:

- ✅ Faster generation: 5-10 minutes for 6 modules
- ✅ Formative count: 6 (1 per module)
- ✅ Summative count: 0
- ✅ Sample questions still generated: ~55
- ✅ Weightages show: Formative 100%, Summative 0%

---

### Test 3: Summative Only with Certification Style

**Objective**: Test summative with SHRM certification influence

**Steps**:

1. Navigate to Step 7
2. Click **"Advanced Options"** tab
3. Use these settings:
   - Assessment Structure: **Summative Only**
   - Summative Format: **Mixed format**
   - Certification Styles: Select **SHRM** and **PMI**
   - Higher-Order PLO Policy: **Yes**
   - Enable all real-world toggles
4. Click **"Generate Assessment Package"**

**Expected Results**:

- ✅ Formative count: 0
- ✅ Summative count: 1
- ✅ Summative components reference HR/PM scenarios
- ✅ Weightages show: Formative 0%, Summative 100%
- ✅ Marking model includes detailed criteria

---

### Test 4: Custom User-Defined Summative

**Objective**: Test user-defined summative format

**Steps**:

1. Navigate to Step 7
2. Use these settings:
   - Assessment Structure: **Summative Only**
   - Summative Format: **User Defined**
   - User Defined Description: "Capstone project with portfolio submission, presentation, and peer review component"
3. Click **"Generate Assessment Package"**

**Expected Results**:

- ✅ Summative overview reflects custom format
- ✅ Components align with description (project, presentation, portfolio)

---

### Test 5: Regeneration Test

**Objective**: Test regeneration with different settings

**Steps**:

1. Complete Test 1 (generates data)
2. Click **"Regenerate"** button
3. Change to:
   - Formative per Module: **3** (was 2)
   - Summative Format: **Case study analysis** (was mixed)
4. Click **"Generate Assessment Package"**

**Expected Results**:

- ✅ Old data replaced
- ✅ New formative count: 18 (3 per module)
- ✅ Summative format changes to case study
- ✅ No duplicate questions from previous run

---

### Test 6: Approval & Workflow Progression

**Objective**: Test approval and advancing to Step 8

**Steps**:

1. Complete Test 1 (generates valid data)
2. Verify validation report shows all green
3. Click **"Approve & Continue"** button

**Expected Results**:

- ✅ Approval confirmation
- ✅ Advances to Step 8
- ✅ Step 7 shows "Approved" badge on return
- ✅ Database `step7.approvedAt` timestamp set

---

### Test 7: Validation Failure (Missing PLO Coverage)

**Objective**: Test validation when PLOs aren't fully covered

**Setup**: This is harder to trigger with the new system, but if OpenAI fails to cover a PLO:

**Steps**:

1. Generate assessments
2. Check if any PLO is missing from validation

**Expected Results**:

- ✅ Validation shows red ✗ for "All PLOs Covered"
- ✅ "Approve" button is disabled
- ✅ Tooltip explains: "All PLOs must be covered before approval"
- ✅ Can regenerate to try again

---

### Test 8: Timeout Resilience

**Objective**: Test that chunked generation avoids timeouts

**Steps**:

1. Use a workflow with 8 modules (larger than typical)
2. Generate with:
   - Formative per Module: **3**
   - All sample types enabled
3. Monitor generation time

**Expected Results**:

- ✅ No timeout errors (backend or frontend)
- ✅ Each chunk completes in < 5 minutes
- ✅ Total time: 30-40 minutes
- ✅ Progress bar updates throughout
- ✅ All assessments generate successfully

---

### Test 9: OpenAI Error Handling

**Objective**: Test error handling when OpenAI fails

**Setup**: This requires either:

- Temporarily invalid API key, OR
- Exceeding rate limits, OR
- Injecting a failure in code

**Steps**:

1. Trigger OpenAI error (e.g., rate limit)
2. Observe behavior

**Expected Results**:

- ✅ Error message displayed
- ✅ Partial results preserved (e.g., 3/6 modules completed)
- ✅ Can retry generation
- ✅ Logs show detailed error

---

## 🔍 What to Monitor

### Backend Logs

Watch for:

- `[Step 7] Starting comprehensive assessment generation`
- `[Step 7] Module X/Y formatives complete`
- `[Step 7] Summative assessments complete`
- `[Step 7] Generated [type] samples`
- `[Step 7] Complete`

### OpenAI API Logs

Watch for:

- Token usage per call (should be 16-20K, not 32K+)
- Response times (should be 30-180 seconds per call)
- No 502 errors
- No AbortError timeouts

### Database Checks

After generation, check MongoDB:

```javascript
db.curriculumworkflows.findOne({ _id: ObjectId('...') }).step7;
```

**Expected structure**:

```json
{
  "userPreferences": { ... },
  "formativeAssessments": [ ... ],
  "summativeAssessments": [ ... ],
  "sampleQuestions": {
    "mcq": [ ... ],
    "sjt": [ ... ],
    "caseQuestions": [ ... ],
    "essayPrompts": [ ... ],
    "practicalTasks": [ ... ]
  },
  "lmsPackages": { ... },
  "validation": { ... },
  "generatedAt": ISODate("...")
}
```

---

## ❌ Common Issues & Solutions

### Issue: Frontend shows old MCQ-only form

**Solution**:

```bash
# Clear build cache
rm -rf packages/frontend/.next
cd packages/frontend
npm run build
npm run dev
```

### Issue: TypeScript errors in frontend

**Solution**:

```bash
cd packages/frontend
npm run type-check
# Fix any reported type mismatches
```

### Issue: API returns 500 error

**Check**:

1. Backend logs for error details
2. OpenAI API key is valid
3. MongoDB connection is active
4. `assessmentGeneratorService.ts` is imported correctly

### Issue: Generation takes too long (>30 min)

**Check**:

1. Number of modules (8+ is slow)
2. Formative per module (3+ per module is slow)
3. OpenAI response times in logs
4. Network latency to OpenAI

### Issue: Zero-value data (e.g., alignedPLOs: [])

**Check**:

1. OpenAI response format in logs
2. JSON parsing errors in backend logs
3. Prompt clarity in `assessmentGeneratorService.ts`

### Issue: "All PLOs must be covered" validation fails

**Solutions**:

1. Click "Regenerate" to retry
2. Check which PLOs are missing in validation report
3. Verify PLOs exist in Step 3
4. Check OpenAI isn't skipping any PLOs in prompts

---

## ✅ Success Criteria

### Functional Requirements

- ✅ All 9 test scenarios pass
- ✅ No timeout errors
- ✅ No data corruption
- ✅ All assessments have valid data (no zeros/nulls)
- ✅ Validation works correctly
- ✅ Approval and workflow progression work

### Performance Requirements

- ✅ Formative generation: < 3 min per module
- ✅ Summative generation: < 5 min
- ✅ Sample questions: < 15 min total
- ✅ Total time for 6 modules: < 25 min

### Quality Requirements

- ✅ Formative assessments are distinct and varied
- ✅ Summative components cover all PLOs
- ✅ Sample questions are high-quality (not repetitive)
- ✅ All assessments align to learning outcomes
- ✅ Marking criteria are clear and measurable

---

## 📊 Test Results Template

```markdown
## Test Run: [Date/Time]

**Environment**:

- Backend: ✅ Running / ❌ Down
- Frontend: ✅ Running / ❌ Down
- OpenAI API: ✅ Valid / ❌ Invalid

**Test Results**:

- Test 1 (Basic): ✅ Pass / ❌ Fail - [Notes]
- Test 2 (Formative Only): ✅ Pass / ❌ Fail - [Notes]
- Test 3 (Certification): ✅ Pass / ❌ Fail - [Notes]
- Test 4 (Custom): ✅ Pass / ❌ Fail - [Notes]
- Test 5 (Regeneration): ✅ Pass / ❌ Fail - [Notes]
- Test 6 (Approval): ✅ Pass / ❌ Fail - [Notes]
- Test 7 (Validation): ✅ Pass / ❌ Fail - [Notes]
- Test 8 (Timeout): ✅ Pass / ❌ Fail - [Notes]
- Test 9 (Error Handling): ✅ Pass / ❌ Fail - [Notes]

**Performance**:

- Avg time per module: [X] minutes
- Total time for 6 modules: [X] minutes
- OpenAI API calls: [X] total
- Token usage: [X] total

**Issues Found**:

1. [Issue description] - [Severity: High/Medium/Low]
2. ...

**Overall Result**: ✅ PASS / ❌ FAIL
```

---

## 🚀 Quick Start Test

**Minimal test to verify integration works**:

1. Start backend & frontend
2. Navigate to Step 7 in any workflow
3. Click "Generate Assessment Package" (use all defaults)
4. Wait 15-20 minutes
5. Verify stats show non-zero counts
6. Click "Approve & Continue"
7. ✅ If you reach Step 8, integration is successful!

---

## 📝 Next Steps After Testing

1. **Document any issues** in GitHub issues
2. **Tune prompts** if quality isn't meeting expectations
3. **Optimize timeouts** if consistently taking too long
4. **Add more sample types** if needed (e.g., oral exams, simulations)
5. **Implement export** functionality (Word/Excel/LMS)
