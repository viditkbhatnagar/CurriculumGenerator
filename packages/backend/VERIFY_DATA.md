# How to Verify Data in MongoDB

This guide shows you multiple ways to verify data in the `preliminarycurriculumpackages` collection.

## Method 1: Using mongosh (MongoDB Shell) - Quick Check

### If MongoDB Atlas (Cloud)

```bash
# Connect to your Atlas cluster (you'll need your connection string)
mongosh "mongodb+srv://username:password@cluster0.c8ul7to.mongodb.net/curriculum_db?retryWrites=true&w=majority"

# Once connected, run:
use curriculum_db
db.preliminarycurriculumpackages.find().pretty()

# Or to see just the count:
db.preliminarycurriculumpackages.countDocuments()

# Or to see a formatted sample (first 5 documents):
db.preliminarycurriculumpackages.find().limit(5).pretty()

# Or to find by projectId:
db.preliminarycurriculumpackages.findOne({ projectId: ObjectId("YOUR_PROJECT_ID") })
```

### If Local MongoDB

```bash
# Connect to local MongoDB
mongosh mongodb://localhost:27017

# Switch to database
use curriculum_db

# Query the collection
db.preliminarycurriculumpackages.find().pretty()
```

### One-liner Command (if you have the connection string)

```bash
mongosh "YOUR_CONNECTION_STRING" --eval "db.preliminarycurriculumpackages.find().pretty()"
```

**Example with actual connection string:**

```bash
mongosh "mongodb+srv://viditkbhatnagar:NzRz8cXmmeFHKcm2@cluster0.c8ul7to.mongodb.net/curriculum_db?retryWrites=true&w=majority" --eval "db.preliminarycurriculumpackages.find().pretty()"
```

## Method 2: Using the Verification Script (Recommended)

We've created a comprehensive Node.js script that provides detailed information:

### Basic Usage

```bash
cd packages/backend
node verify-preliminary-packages.js
```

### View Specific Project

```bash
node verify-preliminary-packages.js --project-id="YOUR_PROJECT_ID"
```

### Limit Results

```bash
node verify-preliminary-packages.js --limit=5
```

### What the Script Shows:

- ✅ Total document count
- ✅ Sample documents with full details
- ✅ Collection statistics (by status, AGI compliance)
- ✅ List of available fields
- ✅ Which AGI components are present in documents

## Method 3: Using Existing Scripts

### Check Data Script

```bash
cd packages/backend
node check-data.js
```

This script checks for a specific project ID (hardcoded in the script).

## Method 4: Using MongoDB Compass (GUI)

1. Download MongoDB Compass: https://www.mongodb.com/try/download/compass
2. Connect using your connection string:
   ```
   mongodb+srv://username:password@cluster0.c8ul7to.mongodb.net/curriculum_db
   ```
3. Navigate to `curriculum_db` → `preliminarycurriculumpackages`
4. Browse documents visually

## Method 5: Using the Backend API

If your backend is running, you can use the API endpoint:

```bash
# Get preliminary package for a project
curl http://localhost:4000/api/new-workflow/projects/PROJECT_ID/preliminary-package \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Quick Verification Commands

### Count Documents

```bash
mongosh "YOUR_CONNECTION_STRING" --eval "db.preliminarycurriculumpackages.countDocuments()"
```

### View Collection Structure

```bash
mongosh "YOUR_CONNECTION_STRING" --eval "db.preliminarycurriculumpackages.findOne()"
```

### Check if Collection Exists

```bash
mongosh "YOUR_CONNECTION_STRING" --eval "db.getCollectionNames()"
```

### Get Collection Stats

```bash
mongosh "YOUR_CONNECTION_STRING" --eval "db.preliminarycurriculumpackages.stats()"
```

## Troubleshooting

### Issue: mongosh not found

**Solution:** Install MongoDB Shell:

```bash
# macOS
brew install mongosh

# Or download from: https://www.mongodb.com/try/download/shell
```

### Issue: Connection timeout

**Solution:**

- Check if your IP is whitelisted in MongoDB Atlas (Network Access)
- Verify your connection string is correct
- Check if your cluster is paused (resume it in Atlas)

### Issue: Authentication failed

**Solution:**

- Verify username and password in connection string
- URL-encode special characters in password:
  - `@` → `%40`
  - `:` → `%3A`
  - `/` → `%2F`
  - `?` → `%3F`

### Issue: Collection not found

**Solution:**

- Verify database name is correct (`curriculum_db`)
- Check collection name is correct (`preliminarycurriculumpackages` - all lowercase, no underscores)
- Collections are created automatically when first document is inserted

## Environment Variables

Make sure your `.env` file has:

```bash
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/curriculum_db?retryWrites=true&w=majority
```

The verification script will use this automatically.

## Collection Information

**Collection Name:** `preliminarycurriculumpackages`  
**Database:** `curriculum_db`  
**Model:** `PreliminaryCurriculumPackage` (Mongoose)

**Key Fields:**

- `_id` - MongoDB ObjectId
- `projectId` - Reference to CurriculumProject
- `status` - Package status
- `programOverview` - AGI component
- `learningOutcomes` - AGI component
- `moduleSpecifications` - AGI component
- `assessmentStrategy` - AGI component
- `teachingMethods` - AGI component
- `resourceRequirements` - AGI component
- `qualityAssurance` - AGI component
- `implementationTimeline` - AGI component
- `riskAssessment` - AGI component
- `stakeholderEngagement` - AGI component
- `monitoringEvaluation` - AGI component
- `sustainabilityPlan` - AGI component
- `references` - AGI component
- `outcomeWritingGuide` - AGI component
- `submissionMetadata` - Submission information
- `createdAt` - Creation timestamp
- `updatedAt` - Update timestamp

## Next Steps

After verifying the data:

1. ✅ Check document structure matches expected schema
2. ✅ Verify AGI components are present
3. ✅ Confirm data integrity
4. ✅ Review status values
