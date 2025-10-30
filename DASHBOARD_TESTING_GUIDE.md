# Dashboard Testing Guide

This guide will help you test the newly functional admin dashboard.

## What's Been Implemented

The admin dashboard (`/admin`) has been completely redesigned to display **live metrics** including:

1. **Total Projects** - Count of all curriculum projects
2. **Published Curricula** - Count of completed and published projects
3. **Active Users** - Users who created projects in the last 30 days
4. **Success Rate** - Percentage of successful curriculum generations
5. **AI Usage Metrics**:
   - Total API Cost (last 30 days)
   - Total Tokens Used (last 30 days)
   - Average Response Time
   - Cache Hit Rate
6. **Generation Performance**:
   - Average generation time
   - Knowledge base sources count
7. **Recent Activity** - Projects created in the last 7 days
8. **Recently Published Curricula** - Table showing the last 10 published projects

## Backend Changes

### Updated Files

1. **`packages/backend/src/routes/analytics.ts`**
   - Migrated from PostgreSQL to MongoDB
   - Added comprehensive dashboard metrics endpoint: `GET /api/analytics/dashboard`
   - Returns live data for projects, users, tokens, costs, and activity
   - Integrated with `monitoringService` for LLM metrics

2. **`packages/backend/src/routes/newWorkflowRoutes.ts`**
   - Added new public endpoint: `GET /api/v2/projects/published`
   - Returns published curricula without authentication requirement
   - Used by dashboard to display recent curricula

### API Endpoints

#### 1. Dashboard Metrics

```
GET /api/analytics/dashboard
```

**Response:**

```json
{
  "success": true,
  "data": {
    "overview": {
      "totalProjects": 15,
      "totalPrograms": 8,
      "successRate": 92.5,
      "avgGenerationTime": 45.2,
      "totalKBSources": 1250,
      "activeUsers": 5,
      "totalUsers": 12,
      "publishedCurricula": 10
    },
    "llmMetrics": {
      "totalCost": 125.45,
      "totalTokens": 1250000,
      "avgResponseTime": 850,
      "cacheHitRate": 0.75
    },
    "recentActivity": [
      {
        "date": "2025-10-30",
        "projectsCreated": 3
      }
    ],
    "timestamp": "2025-10-30T12:00:00.000Z"
  }
}
```

#### 2. Published Curricula

```
GET /api/v2/projects/published?limit=10
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "projectName": "Certified HR Professional",
      "courseCode": "CHRP",
      "status": "published",
      "stageProgress": {
        "stage5": {
          "publishedAt": "2025-10-28T10:30:00.000Z"
        }
      }
    }
  ],
  "count": 10
}
```

## Frontend Changes

### Updated Files

**`packages/frontend/src/app/admin/page.tsx`**

- Converted from static to dynamic client component
- Fetches live data from backend every 30 seconds
- Added loading and error states
- Displays comprehensive metrics with beautiful UI
- Added refresh button for manual updates
- Shows recently published curricula in a table

## Testing Steps

### 1. Start the Backend Server

```bash
cd packages/backend
npm run dev
```

Ensure the backend is running on `http://localhost:3001` (or your configured port).

### 2. Start the Frontend Server

```bash
cd packages/frontend
npm run dev
```

Ensure the frontend is running on `http://localhost:3000`.

### 3. Access the Dashboard

Navigate to: `http://localhost:3000/admin`

### 4. Verify Dashboard Loads

✅ **Expected Behavior:**

- Dashboard shows a loading spinner initially
- After loading, metrics are displayed
- "Last updated" timestamp is shown
- Refresh button is visible

❌ **If dashboard shows error:**

- Check browser console for errors
- Verify backend is running
- Verify `NEXT_PUBLIC_API_URL` in frontend `.env.local` (if set)
- Check backend logs for analytics endpoint errors

### 5. Verify Live Metrics

Check that the following sections display data:

#### Main Metrics (Top Row)

- [ ] **Total Projects** - Shows count (may be 0 if no projects)
- [ ] **Published Curricula** - Shows count
- [ ] **Active Users** - Shows format "X / Y" (active / total)
- [ ] **Success Rate** - Shows percentage

#### AI Usage Metrics (Second Section)

- [ ] **Total API Cost** - Shows dollar amount with 2 decimals
- [ ] **Total Tokens Used** - Shows formatted number (e.g., "1,250,000")
- [ ] **Avg Response Time** - Shows milliseconds
- [ ] **Cache Hit Rate** - Shows percentage

#### Generation Performance (Left Bottom)

- [ ] **Avg. Generation Time** - Shows minutes or "N/A"
- [ ] **Knowledge Base Sources** - Shows count

#### Recent Activity (Right Bottom)

- [ ] Shows list of dates with project counts
- [ ] Shows "No recent activity" if empty

#### Recently Published Curricula (Bottom)

- [ ] Shows table with published projects
- [ ] Shows "No published curricula yet" if empty
- [ ] Each row has project name, course code, status, published date, and "View" link

### 6. Test Auto-Refresh

✅ **Expected Behavior:**

- Dashboard automatically refreshes every 30 seconds
- "Last updated" timestamp updates
- No page reload or flashing

**To verify:**

1. Note the "Last updated" time
2. Wait 30 seconds
3. Timestamp should update automatically

### 7. Test Manual Refresh

1. Click the "Refresh" button in top-right
2. Button should show "Refreshing..."
3. Button should be disabled during refresh
4. Metrics should update
5. "Last updated" timestamp should change

### 8. Test with Real Data

To see meaningful metrics, create some test data:

#### Option 1: Create Projects via UI

1. Navigate to `/projects/new` (if available)
2. Create a new curriculum project
3. Complete stages to get published curricula
4. Return to dashboard to see updated metrics

#### Option 2: Use API to Create Test Data

```bash
# Create a test project (adjust based on your API)
curl -X POST http://localhost:3001/api/v2/projects \
  -H "Content-Type: application/json" \
  -d '{
    "projectName": "Test Curriculum",
    "courseCode": "TEST",
    "promptId": "..."
  }'
```

### 9. Test Error Handling

#### Test Backend Offline

1. Stop the backend server
2. Refresh dashboard
3. ✅ Should show error message with "Retry" button
4. Start backend
5. Click "Retry"
6. ✅ Dashboard should load successfully

#### Test Invalid Response

This is automatically handled - if backend returns invalid data, error state is shown.

### 10. Test Responsive Design

Test the dashboard on different screen sizes:

- [ ] **Desktop (1920x1080)** - 4-column grid for main metrics
- [ ] **Tablet (768px)** - 2-column grid
- [ ] **Mobile (375px)** - Single column layout
- [ ] All cards remain readable
- [ ] Table scrolls horizontally on small screens

## Expected Metrics Behavior

### When Starting Fresh (No Data)

```
Total Projects: 0
Published Curricula: 0
Active Users: 0 / 0
Success Rate: 0%
Total API Cost: $0.00
Total Tokens Used: 0
Avg Response Time: 0ms (or actual if monitoring has data)
Cache Hit Rate: 0%
Avg. Generation Time: N/A
Knowledge Base Sources: 0
Recent Activity: No recent activity
Recently Published Curricula: No published curricula yet
```

### With Sample Data

After creating projects and using the system:

```
Total Projects: 15
Published Curricula: 8
Active Users: 5 / 12
Success Rate: 85.7%
Total API Cost: $245.80
Total Tokens Used: 2,450,000
Avg Response Time: 850ms
Cache Hit Rate: 72.5%
Avg. Generation Time: 42.3m
Knowledge Base Sources: 3,250
Recent Activity:
  2025-10-30: 3 projects
  2025-10-29: 2 projects
  2025-10-28: 1 project
Recently Published Curricula:
  [Table with 8-10 published projects]
```

## Troubleshooting

### Dashboard Shows $0 Cost and 0 Tokens

**Cause:** Monitoring service may not have recorded metrics yet, or time window is too short.

**Solution:**

1. Create some curriculum projects to trigger AI API calls
2. Wait for metrics to accumulate
3. Check monitoring service is properly recording LLM costs in `openaiService.ts`

### "Failed to fetch metrics" Error

**Possible Causes:**

1. Backend not running
2. Wrong API URL configured
3. CORS issues
4. MongoDB connection issues

**Debug Steps:**

1. Check backend console for errors
2. Verify MongoDB is connected
3. Test analytics endpoint directly: `curl http://localhost:3001/api/analytics/dashboard`
4. Check browser Network tab for failed requests

### Published Curricula Section Empty

**Cause:** No projects have reached "published" status yet.

**Solution:**

1. Create a test project
2. Complete all 5 stages
3. Publish the curriculum
4. Refresh dashboard

### Metrics Not Updating

**Cause:** Auto-refresh interval issue or React state not updating.

**Debug Steps:**

1. Check browser console for errors
2. Manually click "Refresh" button
3. Verify timestamp updates
4. Check Network tab to see if API calls are being made

## Performance Considerations

The dashboard makes two API calls:

1. `GET /api/analytics/dashboard` - Main metrics
2. `GET /api/v2/projects/published` - Recent curricula

**Expected Load Time:** < 2 seconds for both requests

If dashboard is slow:

1. Check MongoDB query performance
2. Add database indexes if needed
3. Consider caching frequently accessed metrics
4. Reduce auto-refresh interval if needed

## Additional Testing Scenarios

### Concurrent Users

1. Open dashboard in multiple browser tabs
2. Verify all tabs show consistent data
3. Create a project in one tab
4. Verify other tabs update after auto-refresh

### Long Running

1. Leave dashboard open for 5+ minutes
2. Verify auto-refresh continues working
3. Check for memory leaks in browser DevTools

### Network Issues

1. Simulate slow network (Chrome DevTools → Network → Slow 3G)
2. Verify loading states work correctly
3. Verify error handling for timeouts

## Success Criteria

✅ **Dashboard is functional when:**

1. All metrics display without errors
2. Auto-refresh works every 30 seconds
3. Manual refresh button works
4. Error states show properly when backend is down
5. Published curricula table displays (when data exists)
6. Responsive design works on all screen sizes
7. No console errors in browser
8. No backend errors in server logs
9. API calls complete in < 2 seconds
10. Metrics are accurate and match database data

## Next Steps (Optional Enhancements)

If you want to enhance the dashboard further:

1. **Add Charts** - Use Chart.js or Recharts for visualizations
2. **Export Reports** - Add CSV/PDF export functionality
3. **Date Range Filters** - Allow filtering metrics by custom date ranges
4. **Real-time Updates** - Use WebSockets for live updates
5. **User Authentication** - Add proper admin authentication
6. **Drill-down Views** - Click metrics to see detailed breakdowns
7. **Alerts/Notifications** - Show alerts for failed generations or high costs

## Support

If you encounter issues:

1. Check this guide first
2. Review browser console errors
3. Check backend logs
4. Verify MongoDB connection
5. Ensure all dependencies are installed (`npm install`)

## Summary

The dashboard is now fully functional with:

- ✅ Live metrics from MongoDB
- ✅ Token usage tracking
- ✅ API cost monitoring
- ✅ Published curricula list
- ✅ Auto-refresh every 30 seconds
- ✅ Beautiful, responsive UI
- ✅ Error handling and loading states

The dashboard provides real-time insights into your curriculum generation system!
