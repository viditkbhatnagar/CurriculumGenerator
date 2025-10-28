# Complete Curriculum Generator App Testing Guide

## 🎯 Overview

This guide will help you test the complete curriculum generator application, including:
- Backend API (Node.js + MongoDB)
- Frontend UI (Next.js + React)
- End-to-end curriculum generation workflow

## 📋 Prerequisites

Before testing, ensure:
- ✅ MongoDB Atlas is connected
- ✅ Backend server is running
- ✅ Environment variables are configured

## 🚀 Step 1: Start the Backend

```bash
# Terminal 1 - Start backend server
cd packages/backend
npm run dev
```

**Expected output:**
```
MongoDB connected successfully
Server started successfully
port: 4000
apiUrl: http://localhost:4000
```

**Verify backend is running:**
- Open http://localhost:4000/health in browser
- Should see: `"database": {"status": "healthy"}`

## 🎨 Step 2: Start the Frontend

```bash
# Terminal 2 - Start frontend
cd packages/frontend
npm run dev
```

**Expected output:**
```
- ready started server on 0.0.0.0:3000
- Local: http://localhost:3000
```

**Open the app:**
- Navigate to http://localhost:3000 in your browser

## 🧪 Step 3: Test Complete Workflow

### A. User Authentication (If Configured)

1. **Login/Register**
   - If Auth0 is configured, you'll see a login page
   - Create an account or login
   - You should be redirected to the dashboard

2. **Without Auth (Development)**
   - If auth is not configured, you'll go directly to the app
   - You may need to create a test user via API first

### B. Upload Program Specification

1. **Navigate to Upload Page**
   - Look for "Upload Program" or "New Program" button
   - Click to access the upload interface

2. **Prepare Test Excel File**
   - The app expects an Excel file with program specifications
   - Should include: Program details, Modules, Learning Outcomes

3. **Upload File**
   - Click "Choose File" or drag-and-drop
   - Select your Excel file
   - Click "Upload" or "Submit"

4. **Verify Upload**
   - Should see success message
   - Program should appear in programs list
   - Check MongoDB Atlas → `programs` collection

### C. Generate Curriculum

1. **Select Program**
   - Go to Programs list
   - Click on the uploaded program

2. **Start Generation**
   - Click "Generate Curriculum" button
   - This triggers the AI-powered generation process

3. **Monitor Progress**
   - Should see progress bar or status updates
   - Generation may take 2-10 minutes depending on complexity
   - Progress updates via WebSocket connection

4. **View Results**
   - Once complete, curriculum should be displayed
   - Should include:
     - Program overview
     - Module details
     - Learning outcomes
     - Assessment questions
     - Skill mappings

### D. Review and Edit

1. **Review Generated Content**
   - Check each module
   - Verify learning outcomes
   - Review assessment questions

2. **Make Edits (if supported)**
   - Edit module descriptions
   - Adjust learning outcomes
   - Modify assessments

3. **Save Changes**
   - Click "Save" or "Update"
   - Changes should persist in MongoDB

### E. Export Curriculum

1. **Export Options**
   - Look for "Export" or "Download" button
   - Choose format: PDF, Word, Excel, SCORM

2. **Download**
   - Click export button
   - File should download to your computer

3. **Verify Export**
   - Open downloaded file
   - Verify all content is included
   - Check formatting

## 🔍 Step 4: Verify Data in MongoDB

1. **Go to MongoDB Atlas Dashboard**
   - https://cloud.mongodb.com

2. **Browse Collections**
   - Click "Browse Collections"
   - Select `curriculum_db` database

3. **Check Collections:**

   **programs**
   - Should see uploaded programs
   - Check fields: programName, qualificationLevel, status

   **modules**
   - Should see modules for each program
   - Check fields: moduleCode, moduleTitle, hours

   **learningoutcomes**
   - Should see learning outcomes for each module
   - Check fields: outcomeText, bloomLevel

   **assessments**
   - Should see generated assessment questions
   - Check fields: questionType, questionText, difficulty

   **generationjobs**
   - Should see job records
   - Check status: completed, failed, processing

   **users**
   - Should see user records
   - Check fields: email, role

   **auditlogs**
   - Should see activity logs
   - Check fields: action, userId, timestamp

## 🧪 Step 5: API Testing (Advanced)

### Test Individual Endpoints

```bash
# 1. Create a test user
curl -X POST http://localhost:4000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "role": "administrator",
    "authProviderId": "test-123"
  }'

# 2. List programs
curl http://localhost:4000/api/programs

# 3. Get specific program
curl http://localhost:4000/api/programs/{PROGRAM_ID}

# 4. Check generation job status
curl http://localhost:4000/api/curriculum/status/{JOB_ID}

# 5. Search knowledge base
curl -X POST http://localhost:4000/api/knowledge-base/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "learning outcomes",
    "limit": 5
  }'
```

### Use the Test Page

```bash
# Open the API test page
open packages/backend/test-api.html
```

## 📊 Step 6: Monitor Performance

### Check Metrics

1. **Health Endpoint**
   ```bash
   curl http://localhost:4000/health | jq
   ```

2. **Metrics Endpoint**
   ```bash
   curl http://localhost:4000/metrics | jq
   ```

### Monitor Logs

**Backend Logs:**
- Check Terminal 1 where backend is running
- Look for errors, warnings, or slow queries

**Frontend Logs:**
- Check Terminal 2 where frontend is running
- Open browser DevTools → Console tab

## 🐛 Troubleshooting

### Backend Issues

**Server won't start:**
```bash
# Check if port 4000 is in use
lsof -i :4000

# Kill process if needed
kill -9 <PID>

# Check MongoDB connection
node packages/backend/test-mongo-connection.js
```

**Database errors:**
```bash
# Verify MongoDB connection
curl http://localhost:4000/health

# Check collections exist
node packages/backend/verify-collections.js
```

### Frontend Issues

**Frontend won't start:**
```bash
# Check if port 3000 is in use
lsof -i :3000

# Clear Next.js cache
cd packages/frontend
rm -rf .next
npm run dev
```

**API connection errors:**
- Check backend is running on port 4000
- Verify CORS settings in backend
- Check browser console for errors

### Upload Issues

**File upload fails:**
- Check file format (should be .xlsx)
- Verify file size (max 50MB)
- Check upload directory exists
- Review backend logs for errors

**Parsing errors:**
- Verify Excel file structure
- Check required columns exist
- Ensure data types are correct

### Generation Issues

**Curriculum generation fails:**
- Check OpenAI API key is configured
- Verify sufficient API credits
- Check backend logs for errors
- Ensure knowledge base is populated

**Generation takes too long:**
- Normal for large programs (5-10 minutes)
- Check job queue status
- Monitor backend logs
- Verify Redis is running (if configured)

## 📝 Test Scenarios

### Scenario 1: Simple Program

1. Upload a small program (2-3 modules)
2. Generate curriculum
3. Review results
4. Export to PDF
5. Verify in MongoDB

### Scenario 2: Complex Program

1. Upload a large program (10+ modules)
2. Generate curriculum
3. Monitor progress
4. Review and edit
5. Export to multiple formats

### Scenario 3: Knowledge Base

1. Upload reference documents
2. Ingest into knowledge base
3. Test semantic search
4. Generate curriculum using RAG
5. Verify improved quality

### Scenario 4: Multi-User

1. Create multiple users
2. Each uploads different programs
3. Generate curricula simultaneously
4. Verify data isolation
5. Check audit logs

## 🎯 Success Criteria

Your app is working correctly if:

- ✅ Backend health check shows "healthy"
- ✅ Frontend loads without errors
- ✅ Can upload Excel files successfully
- ✅ Programs appear in database
- ✅ Curriculum generation completes
- ✅ Generated content is coherent and relevant
- ✅ Can export to various formats
- ✅ Data persists in MongoDB
- ✅ Audit logs are created
- ✅ No errors in console/logs

## 🔧 Development Tools

### Browser DevTools

**Console Tab:**
- View JavaScript errors
- Test API calls
- Debug React components

**Network Tab:**
- Monitor API requests
- Check response times
- Debug failed requests

**React DevTools:**
- Install React DevTools extension
- Inspect component state
- Debug React issues

### MongoDB Compass (Optional)

```bash
# Install MongoDB Compass
# Download from: https://www.mongodb.com/products/compass

# Connect using your MongoDB URI
mongodb+srv://username:password@cluster0.c8ul7to.mongodb.net/curriculum_db
```

### Postman/Insomnia (Optional)

- Import API endpoints
- Test with different payloads
- Save test collections
- Automate testing

## 📚 Additional Resources

- **API Documentation**: See `packages/backend/API_TESTING_GUIDE.md`
- **MongoDB Setup**: See `packages/backend/MONGODB_ATLAS_SETUP.md`
- **Architecture**: See `ARCHITECTURE.md`
- **Workflow**: See `WORKFLOW.md`

## 🎉 Next Steps

Once testing is complete:

1. **Deploy to Production**
   - Set up Render.com deployment
   - Configure production environment variables
   - Test in production environment

2. **Add More Features**
   - Implement remaining services
   - Add more export formats
   - Enhance UI/UX

3. **Optimize Performance**
   - Add Redis for caching
   - Optimize database queries
   - Implement CDN for assets

4. **Monitor in Production**
   - Set up Sentry for error tracking
   - Configure CloudWatch logging
   - Set up alerts

## 💡 Tips

- Test with realistic data
- Try edge cases (empty fields, special characters)
- Test on different browsers
- Test with slow network (DevTools → Network → Throttling)
- Keep MongoDB Atlas dashboard open to verify data
- Monitor backend logs during testing
- Take screenshots of issues for debugging

Happy Testing! 🚀
