# 📊 MongoDB Local Data Viewing Guide

## ✅ **FULL AI GENERATION NOW ENABLED!**

The system is now using **real OpenAI API calls** to generate full curriculum content instead of test data.

---

## 🔍 **How to View Your Data in Local MongoDB**

### **Option 1: Using MongoDB Shell (mongosh) - Command Line**

#### **1. Connect to MongoDB:**

```bash
mongosh curriculum_db
```

#### **2. View All Collections:**

```javascript
show collections
```

Expected output:

```
courseprompts
curriculumprojects
preliminarycurriculumpackages
resourcecostevaluations
fullcurriculumpackages
curriculumreviews
```

#### **3. View All Prompts:**

```javascript
db.courseprompts.find().pretty();
```

#### **4. View All Projects:**

```javascript
db.curriculumprojects.find().pretty();
```

#### **5. View Preliminary Curriculum Packages (The Generated Content):**

```javascript
db.preliminarycurriculumpackages.find().pretty();
```

#### **6. Count Documents:**

```javascript
db.preliminarycurriculumpackages.countDocuments();
```

#### **7. View Specific Fields Only:**

```javascript
// View only program titles and aims
db.preliminarycurriculumpackages
  .find(
    {},
    {
      'programOverview.programTitle': 1,
      'programOverview.aim': 1,
      createdAt: 1,
    }
  )
  .pretty();
```

#### **8. View Latest Package:**

```javascript
db.preliminarycurriculumpackages.find().sort({ createdAt: -1 }).limit(1).pretty();
```

#### **9. View Specific Component (e.g., Learning Outcomes):**

```javascript
db.preliminarycurriculumpackages
  .find(
    {},
    {
      learningOutcomes: 1,
      'programOverview.programTitle': 1,
    }
  )
  .pretty();
```

#### **10. Find Package by Project ID:**

```javascript
// Replace with your actual project ID
db.preliminarycurriculumpackages.findOne({
  projectId: ObjectId('690264ae9f5a67cd60c93026'),
});
```

#### **11. View Glossary Terms:**

```javascript
db.preliminarycurriculumpackages
  .find(
    {},
    {
      glossary: 1,
      'programOverview.programTitle': 1,
    }
  )
  .pretty();
```

#### **12. View Assessments (MCQs and Case Questions):**

```javascript
db.preliminarycurriculumpackages
  .find(
    {},
    {
      'assessments.mcqs': 1,
      'assessments.caseQuestions': 1,
      'programOverview.programTitle': 1,
    }
  )
  .pretty();
```

#### **13. Exit MongoDB Shell:**

```javascript
exit;
```

---

### **Option 2: Using MongoDB Compass (GUI) - Visual Interface**

#### **1. Install MongoDB Compass (if not already installed):**

```bash
brew install --cask mongodb-compass
```

#### **2. Open MongoDB Compass**

#### **3. Connect Using This Connection String:**

```
mongodb://localhost:27017/curriculum_db
```

#### **4. Navigate:**

- Left sidebar → Select `curriculum_db` database
- Click on `preliminarycurriculumpackages` collection
- Browse documents visually with collapsible JSON

#### **5. Use the GUI to:**

- ✅ View documents in a tree structure
- ✅ Search and filter
- ✅ Export data to JSON/CSV
- ✅ View indexes
- ✅ Run aggregation pipelines

---

### **Option 3: Using a Node.js Script (Quick Data Check)**

I've created a verification script for you. Run it with:

```bash
cd /Users/viditkbhatnagar/codes/CurriculumGenerator/packages/backend
node verify-preliminary-packages.js
```

This script shows:

- ✅ All packages with their titles
- ✅ Component completion status
- ✅ Field counts and statistics
- ✅ Recent packages

---

## 📁 **Collection Schema Reference**

### **`courseprompts`** - Pre-seeded course templates

- `courseCode`, `courseTitle`, `domain`, `level`
- `learningObjectives`, `prerequisites`
- `basePromptTemplate`

### **`curriculumprojects`** - Projects tracking workflow progress

- `promptId`, `smeId`, `courseCode`
- `status`: `'research'`, `'costEval'`, `'generation'`, `'review'`, `'published'`
- `currentStage`: 1-5
- `stageProgress`: Details for each stage

### **`preliminarycurriculumpackages`** - The 14-component AGI package

- `programOverview`: Title, aim, duration, benchmarking
- `competencyFramework`: Knowledge domains, skills
- `learningOutcomes`: Measurable outcomes with assessment criteria
- `courseFramework`: Modules, hours, objectives
- `topicSources`: Academic and industry sources
- `readingList`: Books, guides, reports
- `assessments`: MCQs and case questions
- `glossary`: Key terms with definitions
- `caseStudies`: Real-world examples
- `deliveryTools`: LMS features, digital tools
- `references`: APA 7 citations
- `submissionMetadata`: Author, date, compliance
- `outcomeWritingGuide`: Templates, examples, approved verbs
- `comparativeBenchmarking`: Competitor certifications

---

## 🔥 **Quick Tips**

### **Delete All Packages (Fresh Start):**

```bash
mongosh curriculum_db --eval "db.preliminarycurriculumpackages.deleteMany({})"
```

### **Delete All Projects:**

```bash
mongosh curriculum_db --eval "db.curriculumprojects.deleteMany({})"
```

### **View Database Stats:**

```javascript
db.stats();
```

### **View Collection Stats:**

```javascript
db.preliminarycurriculumpackages.stats();
```

### **Create Backup:**

```bash
mongodump --db curriculum_db --out ~/mongodb_backups/curriculum_$(date +%Y%m%d)
```

### **Restore from Backup:**

```bash
mongorestore --db curriculum_db ~/mongodb_backups/curriculum_20251029/curriculum_db
```

---

## 🤖 **Testing Full AI Generation**

Now that full AI is enabled:

1. **Delete old test packages:**

   ```bash
   mongosh curriculum_db --eval "db.preliminarycurriculumpackages.deleteMany({})"
   ```

2. **Create a new project from the UI:**
   - Go to: http://localhost:3000
   - "Start Generating Now"
   - Select CHRP → "Use This Template"
   - Click "Continue"

3. **Watch the terminal logs for:**

   ```
   🤖 FULL AI MODE: Generating all 14 components with real AI content
   🎯 Generating Tab 1: Program Overview
   🎯 Generating Tab 2: Competency & Knowledge Framework
   ...
   ✅ All 14 components generated with full AI content
   ```

4. **This will take 5-10 minutes** (14 OpenAI API calls)

5. **View the generated content:**
   ```bash
   mongosh curriculum_db --eval "db.preliminarycurriculumpackages.find().sort({createdAt: -1}).limit(1).pretty()"
   ```

---

## 📊 **Expected Data Structure After Full Generation**

Each preliminary package will have:

- ✅ **Detailed program overview** with industry needs, career outcomes
- ✅ **5-8 knowledge domains** with core skills and sources
- ✅ **5-8 measurable learning outcomes** with assessment criteria
- ✅ **6-8 module frameworks** totaling 120 hours
- ✅ **2-3 sources per topic** (academic + industry)
- ✅ **Curated reading list** with synopses
- ✅ **5-10 MCQs per module** with rationales
- ✅ **30-50 glossary terms** with citations
- ✅ **2-3 case studies** with learning takeaways
- ✅ **Digital tool recommendations**
- ✅ **Complete APA 7 references**
- ✅ **Outcome writing guide** with examples
- ✅ **Comparative benchmarking** against 2-3 competitors

---

## 🎯 **What's Next?**

After verifying the generated data in MongoDB:

1. **Stage 3: Resource Cost Evaluation** - Parse packages for paid resources
2. **Stage 4: Full Package Generation** - Create PPTs, simulations, MCQ banks
3. **Stage 5: Final Review & Publication** - SME approval and LMS integration

---

**Need help?** Run this anytime:

```bash
mongosh curriculum_db --eval "show collections"
```
