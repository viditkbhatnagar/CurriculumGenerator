# 🌐 Browser Testing Guide - Curriculum Generator

## ✅ Your Server is Running!

If you see this in your terminal:
```
Server started successfully
MongoDB connected successfully
Redis Client Connected
```

**Congratulations!** Your backend is working. Now let's test it in the browser.

---

## 🚀 Quick Start - Test Backend API in Browser

### Step 1: Open Your Browser

Open any web browser (Chrome, Firefox, Safari, Edge)

### Step 2: Test These URLs

**Health Check (Start Here):**
```
http://localhost:4000/health
```
✅ You should see JSON like:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-28T...",
  "services": {
    "database": "connected",
    "redis": "connected"
  }
}
```

**API Root:**
```
http://localhost:4000/api
```
✅ You should see:
```json
{
  "message": "Curriculum Generator API"
}
```

**Metrics:**
```
http://localhost:4000/metrics
```
✅ You should see various metrics data

**List Programs:**
```
http://localhost:4000/api/programs
```
✅ You should see an empty array `[]` or list of programs

---

## 🎨 Option 1: Use Browser-Based API Testing

### Using the Browser Console (Easiest!)

1. **Open any of the URLs above** (like http://localhost:4000/health)
2. **Press F12** (or Right-click → Inspect)
3. **Go to the "Console" tab**
4. **Paste these commands:**

#### Test GET Request:
```javascript
fetch('http://localhost:4000/api/programs')
  .then(res => res.json())
  .then(data => console.log('Programs:', data))
  .catch(err => console.error('Error:', err));
```

#### Test POST Request (Create Program):
```javascript
fetch('http://localhost:4000/api/programs', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    program_name: 'Test Program from Browser',
    qualification_level: 'Bachelor',
    qualification_type: 'Degree',
    total_credits: 120,
    industry_sector: 'Technology'
  })
})
  .then(res => res.json())
  .then(data => console.log('Created:', data))
  .catch(err => console.error('Error:', err));
```

#### Then list programs again:
```javascript
fetch('http://localhost:4000/api/programs')
  .then(res => res.json())
  .then(data => console.log('Programs:', data));
```

---

## 📋 Option 2: Use the Test HTML Page

Create a simple HTML page to test your API:

### Create `test-api.html` in your project root:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Curriculum Generator - API Test</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #2563eb;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 10px;
        }
        button {
            background: #2563eb;
            color: white;
            border: none;
            padding: 12px 24px;
            margin: 5px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
        }
        button:hover {
            background: #1d4ed8;
        }
        .success { background: #10b981; }
        .success:hover { background: #059669; }
        .warning { background: #f59e0b; }
        .warning:hover { background: #d97706; }
        #output {
            background: #1f2937;
            color: #10b981;
            padding: 20px;
            border-radius: 5px;
            margin-top: 20px;
            min-height: 200px;
            font-family: 'Courier New', monospace;
            font-size: 13px;
            overflow-x: auto;
            white-space: pre-wrap;
        }
        .button-group {
            margin: 20px 0;
            padding: 15px;
            background: #f9fafb;
            border-radius: 5px;
        }
        .status {
            display: inline-block;
            padding: 5px 10px;
            border-radius: 3px;
            font-size: 12px;
            margin-left: 10px;
        }
        .status-success { background: #d1fae5; color: #065f46; }
        .status-error { background: #fee2e2; color: #991b1b; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎓 Curriculum Generator - API Test Console</h1>
        
        <div class="button-group">
            <h3>🔍 Basic Tests</h3>
            <button onclick="testHealth()">Health Check</button>
            <button onclick="testAPI()">Test API Root</button>
            <button onclick="listPrograms()">List Programs</button>
            <button onclick="getMetrics()">Get Metrics</button>
        </div>

        <div class="button-group">
            <h3>📝 Program Operations</h3>
            <button class="success" onclick="createProgram()">Create Program</button>
            <button onclick="createMultiplePrograms()">Create 3 Programs</button>
        </div>

        <div class="button-group">
            <h3>🧪 Advanced Tests</h3>
            <button class="warning" onclick="testUpload()">Test File Upload Info</button>
            <button onclick="testKnowledgeBase()">Test Knowledge Base</button>
            <button onclick="runFullTest()">Run Full Test Suite</button>
        </div>

        <div class="button-group">
            <h3>🗑️ Cleanup</h3>
            <button style="background: #ef4444;" onclick="clearOutput()">Clear Output</button>
        </div>

        <h3>📤 Output:</h3>
        <div id="output">Ready to test! Click any button above to start...</div>
    </div>

    <script>
        const API_URL = 'http://localhost:4000';
        const output = document.getElementById('output');

        function log(message, type = 'info') {
            const timestamp = new Date().toLocaleTimeString();
            const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
            output.innerHTML += `\n[${timestamp}] ${prefix} ${message}`;
            output.scrollTop = output.scrollHeight;
        }

        function clearOutput() {
            output.innerHTML = 'Output cleared. Ready for new tests...';
        }

        async function testHealth() {
            log('Testing health endpoint...');
            try {
                const res = await fetch(`${API_URL}/health`);
                const data = await res.json();
                log('Health check successful!', 'success');
                log(JSON.stringify(data, null, 2));
            } catch (err) {
                log(`Health check failed: ${err.message}`, 'error');
            }
        }

        async function testAPI() {
            log('Testing API root...');
            try {
                const res = await fetch(`${API_URL}/api`);
                const data = await res.json();
                log('API root accessible!', 'success');
                log(JSON.stringify(data, null, 2));
            } catch (err) {
                log(`API test failed: ${err.message}`, 'error');
            }
        }

        async function listPrograms() {
            log('Fetching programs...');
            try {
                const res = await fetch(`${API_URL}/api/programs`);
                const data = await res.json();
                log(`Found ${data.length || 0} programs`, 'success');
                log(JSON.stringify(data, null, 2));
            } catch (err) {
                log(`Failed to list programs: ${err.message}`, 'error');
            }
        }

        async function getMetrics() {
            log('Fetching metrics...');
            try {
                const res = await fetch(`${API_URL}/metrics`);
                const data = await res.json();
                log('Metrics retrieved!', 'success');
                log(JSON.stringify(data, null, 2));
            } catch (err) {
                log(`Failed to get metrics: ${err.message}`, 'error');
            }
        }

        async function createProgram() {
            log('Creating a new program...');
            const programData = {
                program_name: `Test Program ${Date.now()}`,
                qualification_level: 'Bachelor',
                qualification_type: 'Degree',
                total_credits: 120,
                industry_sector: 'Technology'
            };

            try {
                const res = await fetch(`${API_URL}/api/programs`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(programData)
                });
                const data = await res.json();
                log('Program created successfully!', 'success');
                log(JSON.stringify(data, null, 2));
            } catch (err) {
                log(`Failed to create program: ${err.message}`, 'error');
            }
        }

        async function createMultiplePrograms() {
            log('Creating 3 programs...');
            const sectors = ['Technology', 'Business', 'Healthcare'];
            
            for (let i = 0; i < 3; i++) {
                const programData = {
                    program_name: `Test Program ${sectors[i]} ${Date.now() + i}`,
                    qualification_level: 'Bachelor',
                    qualification_type: 'Degree',
                    total_credits: 120,
                    industry_sector: sectors[i]
                };

                try {
                    const res = await fetch(`${API_URL}/api/programs`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(programData)
                    });
                    const data = await res.json();
                    log(`Program ${i + 1} created: ${sectors[i]}`, 'success');
                } catch (err) {
                    log(`Failed to create program ${i + 1}: ${err.message}`, 'error');
                }
            }
            log('Batch creation complete!', 'success');
        }

        async function testUpload() {
            log('File upload endpoint info:');
            log('To test file uploads, you need to:');
            log('1. Use Postman or curl');
            log('2. POST to: /api/programs/:id/upload-sme-data');
            log('3. Include Excel file in form-data');
            log('Example: See API_ENDPOINTS.md for details');
        }

        async function testKnowledgeBase() {
            log('Testing knowledge base search...');
            try {
                const res = await fetch(`${API_URL}/api/knowledge-base/sources`);
                const data = await res.json();
                log('Knowledge base accessible!', 'success');
                log(`Found ${data.length || 0} sources`);
            } catch (err) {
                log(`Knowledge base test failed: ${err.message}`, 'error');
            }
        }

        async function runFullTest() {
            log('========================================');
            log('Running full test suite...');
            log('========================================');
            
            await testHealth();
            await new Promise(r => setTimeout(r, 500));
            
            await testAPI();
            await new Promise(r => setTimeout(r, 500));
            
            await listPrograms();
            await new Promise(r => setTimeout(r, 500));
            
            await createProgram();
            await new Promise(r => setTimeout(r, 500));
            
            await listPrograms();
            
            log('========================================');
            log('Test suite complete!', 'success');
            log('========================================');
        }

        // Auto-run health check on load
        window.onload = () => {
            setTimeout(testHealth, 500);
        };
    </script>
</body>
</html>
```

### How to Use:

1. **Save the file above** as `test-api.html` in your project root
2. **Open it in your browser:** Just double-click the file
3. **Click the buttons** to test different API features!

---

## 🎨 Option 3: Start the Frontend

If you want the full admin dashboard UI:

```bash
# Terminal 1: Keep backend running
cd packages/backend
npm run dev

# Terminal 2: Start frontend
cd packages/frontend
npm install
npm run dev
```

Then open: **http://localhost:3000**

---

## 🧪 Testing Checklist

### ✅ Basic Tests (Do These First)

1. **Open:** http://localhost:4000/health
   - Should show: `{"status": "healthy",...}`

2. **Open:** http://localhost:4000/api
   - Should show: `{"message": "Curriculum Generator API"}`

3. **Open:** http://localhost:4000/api/programs
   - Should show: `[]` (empty array initially)

### ✅ Interactive Tests

4. **Use Browser Console** (F12) to create a program:
   ```javascript
   fetch('http://localhost:4000/api/programs', {
     method: 'POST',
     headers: {'Content-Type': 'application/json'},
     body: JSON.stringify({
       program_name: 'My First Program',
       qualification_level: 'Bachelor',
       qualification_type: 'Degree',
       total_credits: 120,
       industry_sector: 'Technology'
     })
   }).then(r => r.json()).then(d => console.log(d));
   ```

5. **Refresh:** http://localhost:4000/api/programs
   - Should now show your created program!

---

## 📱 Available Endpoints to Test

| Endpoint | Method | What It Does |
|----------|--------|--------------|
| `/health` | GET | Server health check |
| `/metrics` | GET | Performance metrics |
| `/api` | GET | API root message |
| `/api/programs` | GET | List all programs |
| `/api/programs` | POST | Create new program |
| `/api/programs/:id` | GET | Get program details |
| `/api/users` | GET | List users |
| `/api/knowledge-base/sources` | GET | List knowledge sources |

---

## 🐛 Troubleshooting

### ❌ "Connection refused" or "Can't connect"

**Problem:** Backend not running  
**Solution:**
```bash
cd packages/backend
npm run dev
```

### ❌ "CORS error"

**Problem:** Browser blocking cross-origin requests  
**Solution:** This is normal when opening HTML files directly. Use the browser console method instead, or start the frontend properly.

### ❌ Empty responses `[]`

**Problem:** Database is empty (this is normal!)  
**Solution:** Create some test data using the POST requests above

---

## 🎯 Next Steps

Once you've tested the API:

1. **Create test data** using the HTML test page
2. **Start the frontend** to see the full UI
3. **Upload an Excel file** to test curriculum generation
4. **Check the documentation** for advanced features

---

## 📚 More Testing Tools

### Use Postman (Professional Tool)
1. Download: https://www.postman.com/downloads/
2. Import: `packages/backend/API_ENDPOINTS.md`
3. Test all endpoints with a nice UI

### Use curl (Command Line)
```bash
# Test health
curl http://localhost:4000/health

# Create program
curl -X POST http://localhost:4000/api/programs \
  -H "Content-Type: application/json" \
  -d '{"program_name":"Test","qualification_level":"Bachelor","qualification_type":"Degree","total_credits":120,"industry_sector":"Tech"}'
```

---

## ✅ Success Indicators

You'll know it's working when:
- ✅ `/health` returns healthy status
- ✅ `/api/programs` returns JSON (even if empty)
- ✅ You can create programs via POST
- ✅ Created programs appear in GET requests
- ✅ No errors in terminal

---

**You're all set!** Start with the health check URL and work your way through the tests. Have fun! 🚀

