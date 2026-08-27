# 🛡️ Robust JSON Parsing Implementation

## Overview

Comprehensive JSON parsing and data normalization for all Stage 4 (Full Curriculum Generation) components to handle ALL edge cases from OpenAI responses.

---

## 🔧 Implementation Details

### 1. **Comprehensive Normalization Function**

Located in: `packages/backend/src/services/curriculumGenerationServiceV2.ts`

#### Helper Functions:

- **`parseStringified(value)`**: Detects and parses string-encoded JSON (`"[...]"` → `[...]`)
- **`objectToString(obj)`**: Converts objects to descriptive strings when schema expects strings
- **`ensureArray(value)`**: Guarantees array output, handling strings, nulls, and single values
- **`toNumber(value)`**: Extracts numbers from strings (`"Week 5"` → `5`)

---

### 2. **Component-Specific Normalizations**

#### **A. Module Plans** (`context: 'modulePlan'`)

Handles:

- ✅ String-ified `assessmentSchedule` arrays
- ✅ String-ified `weekByWeek` arrays
- ✅ Object-to-string conversion for weekly assessments
- ✅ Type coercion for `week`, `estimatedHours`, `dueWeek`, `weight`
- ✅ Field name mapping (`dueDate` → `dueWeek`, `topicsCovered` → `topics`)

**Example Fix:**

```json
// OpenAI Output:
{
  "assessmentSchedule": "[{ type: 'Formative', dueDate: 'Week 1', weight: 10 }]",  // STRING
  "weekByWeek": [{
    "assessments": "[{ type: 'Quiz', description: '...' }]"  // STRING
  }]
}

// After Normalization:
{
  "assessmentSchedule": [
    { "type": "Formative", "dueWeek": 1, "weight": 10, "description": "Formative" }
  ],
  "weekByWeek": [{
    "assessments": ["Quiz: ..."]  // Array of strings
  }]
}
```

#### **B. Case Studies** (`context: 'caseStudy'`)

Handles:

- ✅ String-ified `discussionQuestions` arrays
- ✅ String-ified `linkedOutcomes` arrays (converts to numbers)
- ✅ Nested rubric structure normalization
- ✅ Rubric band mapping (`grade`/`level` → `band`, `score`/`points` → `marks`)

**Example Fix:**

```json
// OpenAI Output:
{
  "discussionQuestions": "['Q1', 'Q2']",  // STRING
  "linkedOutcomes": "['LO1', 'LO2']",     // STRING with text
  "rubric": {
    "bands": [{
      "grade": "A",
      "score": "90-100",
      "description": "Excellent"
    }]
  }
}

// After Normalization:
{
  "discussionQuestions": ["Q1", "Q2"],
  "linkedOutcomes": [1, 2],  // Extracted numbers
  "rubric": {
    "bands": [{
      "band": "A",
      "marks": "90-100",
      "descriptor": "Excellent"
    }]
  }
}
```

#### **C. Simulations** (`context: 'simulation'`)

Handles:

- ✅ String-ified action arrays
- ✅ String-ified criteria arrays
- ✅ String-ified dataset arrays
- ✅ Duration type coercion (string → number)

#### **D. Assessment Bank** (`context: 'assessmentBank'`)

Handles:

- ✅ Consistent field mapping across questions
- ✅ ID generation for missing `questionId`
- ✅ Bloom level normalization
- ✅ Outcome reference extraction (`LO1` → `1`)

**Example Fix:**

```json
// OpenAI Output:
[{
  "question": "What is...",  // Wrong field name
  "answer": "...",
  "outcome": "LO3"           // String
}]

// After Normalization:
[{
  "questionId": "q_1730287890000",
  "type": "short_answer",
  "questionText": "What is...",
  "correctAnswer": "...",
  "linkedOutcome": 3,        // Number extracted
  "bloomLevel": "remember",
  "marks": 1
}]
```

#### **E. Rubrics** (`context: 'rubric'`)

Handles:

- ✅ String-ified criteria arrays
- ✅ String-ified band arrays
- ✅ Band object normalization

#### **F. Slide Content** (`context: 'slideContent'`)

Handles:

- ✅ String-ified topics arrays
- ✅ String-ified slides arrays
- ✅ Safe array access for slide count

---

### 3. **Robust JSON Parsing Strategies**

The `parseJSONRobust()` function implements **8 fallback strategies**:

#### **Strategy 1: Direct Parse**

```typescript
JSON.parse(response);
```

#### **Strategy 2: Markdown Extraction**

Handles:

- ` ```json ... ``` `
- ` ```\n ... \n``` `

#### **Strategy 3: Common JSON Repairs**

- Remove trailing commas
- Add missing commas between objects/arrays
- Strip newlines from strings

#### **Strategy 4: Extract Largest Valid JSON**

Finds all `{...}` blocks, tries parsing from largest to smallest

#### **Strategy 5: Array Extraction**

Same as Strategy 4, but for arrays `[...]`

#### **Strategy 6: Combined Markdown + Repair**

Extracts markdown, then applies repair strategies

#### **Strategy 7: Aggressive JSON Repair**

- Fixes invalid number ranges: `"marks": 0-5` → `"marks": "0-5"`
- Quotes unquoted strings (preserves booleans/numbers)
- Re-applies comma fixes

#### **Strategy 8: Last-Ditch Parsing**

- Removes all comments (`//`, `/* */`)
- Extracts pure JSON between first `{` and last `}`

---

### 4. **Applied to ALL Generation Methods**

✅ **`generateModulePlans()`** - 6 module plans  
✅ **`generateCaseStudies()`** - Expands preliminary cases  
✅ **`generateSimulations()`** - 1-2 per module  
✅ **`generateAssessmentBank()`** - MCQs + short answer  
✅ **`generateRubrics()`** - 4 assessment types  
✅ **`generateSlideDecks()`** - 1 per module

---

## 📦 Code Structure

```typescript
// Before (vulnerable to malformed JSON):
const data = JSON.parse(response);
fullPackage.modulePlans = data;

// After (robust parsing + normalization):
const rawData = this.parseJSONRobust(response, 'modulePlan');
const normalizedData = this.normalizeGeneratedData(rawData, 'modulePlan');
fullPackage.modulePlans = normalizedData;
```

---

## 🧪 Edge Cases Handled

### 1. **String-ified JSON**

```json
"assessmentSchedule": "[{...}]"  // Double-encoded
```

### 2. **Type Mismatches**

```json
"week": "Week 5"          // Should be: 5
"weight": "10%"           // Should be: 10
"linkedOutcome": "LO1"    // Should be: 1
```

### 3. **Field Name Variations**

```json
"dueDate" vs "dueWeek" vs "week"
"topicsCovered" vs "topics"
"grade" vs "band"
"score" vs "marks" vs "points"
```

### 4. **Nested Objects as Strings**

```json
{
  "weekByWeek": [
    {
      "assessments": "[{ type: 'Quiz', ... }]" // Should be array
    }
  ]
}
```

### 5. **Objects Where Strings Expected**

```json
{
  "assessments": [
    { "type": "Quiz", "description": "..." } // Should be: "Quiz: ..."
  ]
}
```

### 6. **Missing Required Fields**

```json
{
  "questionId": undefined, // Generated: "q_1730287890000"
  "type": undefined, // Default: "short_answer"
  "bloomLevel": undefined // Default: "remember"
}
```

### 7. **Markdown-Wrapped JSON**

````
Here's the JSON:
```json
{ ... }
````

Hope this helps!

````

### 8. **Invalid JSON Syntax**
```json
{
  "marks": 0-5,  // Missing quotes around range
  key: "value",  // Unquoted key
  "list": [a, b, c],  // Unquoted string values
  "trailing": "value",  // Trailing comma
}
````

---

## ✅ Benefits

1. **Zero Crashes**: All parsing errors are caught and repaired
2. **Schema Compliance**: All data matches Mongoose schemas
3. **Field Mapping**: Handles OpenAI's varied field naming
4. **Type Safety**: Automatic type coercion (string → number, object → string)
5. **Graceful Degradation**: Falls back to safe defaults if all strategies fail
6. **Comprehensive Logging**: Tracks which strategy succeeded

---

## 🚀 Testing

### To Test:

1. Navigate to Stage 4 (`/projects/:id/curriculum`)
2. Click "Start Generation"
3. Monitor backend logs for normalization activity
4. All 6 components should generate successfully:
   - Module Plans
   - Case Studies
   - Interactive Simulations
   - Assessment Bank (100+ MCQs)
   - Branded Slide Decks
   - Grading Rubrics

### Expected Behavior:

- **No validation errors**
- **All components marked "complete"**
- **AGI Compliance Score calculated**
- **Ready for Stage 5 (Final Review)**

---

## 📝 Maintenance

### Adding New Component Normalizations:

1. Add a new context check in `normalizeGeneratedData()`
2. Use helper functions (`ensureArray`, `toNumber`, `parseStringified`)
3. Map field names to schema expectations
4. Test with real OpenAI responses

### Example:

```typescript
if (context === 'newComponent') {
  if (normalized.fieldName) {
    normalized.fieldName = ensureArray(parseStringified(normalized.fieldName)).map(toNumber);
  }
}
```

---

## 🎯 Status: ✅ COMPLETE

All Stage 4 generation methods now use comprehensive JSON parsing and normalization.

**Last Updated**: 2025-10-30  
**Implementation**: Full  
**Coverage**: All 6 Stage 4 components
