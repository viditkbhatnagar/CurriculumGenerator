# Sample Program Creation Guide

Since you're on the admin dashboard, here's how to create and generate curriculum:

## Quick Test Without Excel:

### Using Browser Console (Fastest Way):

1. **Press F12** on the admin dashboard
2. **Go to Console tab**
3. **Paste this code** to create a test program:

```javascript
// Create a test program with all required data
fetch('http://localhost:4000/api/programs', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    program_name: 'Business Intelligence Certificate',
    qualification_level: 'Level 5',
    qualification_type: 'Certificate',
    total_credits: 120,
    industry_sector: 'Business Intelligence'
  })
})
.then(r => r.json())
.then(data => {
  console.log('Program Created:', data);
  console.log('Program ID:', data._id);
  
  // Now trigger curriculum generation
  return fetch(`http://localhost:4000/api/curriculum/generate/${data._id}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'}
  });
})
.then(r => r.json())
.then(result => {
  console.log('Generation Started:', result);
  console.log('Job ID:', result.jobId);
  alert('Curriculum generation started! Check console for job ID');
})
.catch(err => console.error('Error:', err));
```

4. **Check the console** for the Program ID and Job ID
5. **Refresh the Programs page** to see your new program

---

## Check Generation Status:

After creating a program and triggering generation, monitor progress:

```javascript
// Replace JOB_ID with the actual job ID from above
const jobId = 'PASTE_JOB_ID_HERE';

fetch(`http://localhost:4000/api/curriculum/status/${jobId}`)
  .then(r => r.json())
  .then(data => console.log('Status:', data))
  .catch(err => console.error('Error:', err));
```

---

## What Happens During Generation:

1. **Validate (5%)** - Validates program data
2. **Retrieve (15%)** - Retrieves knowledge base context
3. **Generate Program Spec (30%)** - Creates program specification
4. **Generate Unit Specs (50%)** - Creates unit specifications
5. **Generate Assessments (65%)** - Creates MCQs and assessments
6. **Generate Skill Book (75%)** - Creates skill mappings
7. **Quality Assurance (85%)** - Runs QA checks
8. **Benchmarking (95%)** - Compares with competitors
9. **Complete (100%)** - Done!

---

## API Endpoints You Can Use:

### Create Program:
```
POST http://localhost:4000/api/programs
Body: {
  "program_name": "Your Program Name",
  "qualification_level": "Bachelor/Master/Certificate",
  "qualification_type": "Degree/Certificate",
  "total_credits": 120,
  "industry_sector": "Technology/Business/etc"
}
```

### List Programs:
```
GET http://localhost:4000/api/programs
```

### Get Program Details:
```
GET http://localhost:4000/api/programs/:id
```

### Generate Curriculum:
```
POST http://localhost:4000/api/curriculum/generate/:programId
```

### Check Generation Status:
```
GET http://localhost:4000/api/curriculum/status/:jobId
```

### Get Generated Curriculum:
```
GET http://localhost:4000/api/curriculum/:programId
```

---

## Need OpenAI API Key?

**Important:** Curriculum generation requires OpenAI API key!

1. Get key from: https://platform.openai.com/api-keys
2. Add to `packages/backend/.env`:
   ```
   OPENAI_API_KEY=sk-your-key-here
   ```
3. Restart backend: `npm run dev`

---

## Testing the Complete Flow:

1. ✅ Create program (using console code above)
2. ✅ Trigger generation 
3. ✅ Monitor status
4. ✅ View results in dashboard

The frontend should automatically update when programs are created!

