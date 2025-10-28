# Student-Facing Features

This document describes the student-facing features implemented in the Curriculum Generator App.

## Overview

The student portal provides two main interactive learning features:
1. **AI Tutor** - Context-aware chatbot for personalized learning support
2. **Interactive Simulations** - Workplace scenario-based learning with performance feedback

## Features Implemented

### 1. AI Tutor Chat Interface (Task 17.1)

**Location:** `/student/tutor`

**Components:**
- `ChatInterface` - Main chat container with message history
- `MessageList` - Displays conversation messages
- `MessageBubble` - Individual message display with timestamps
- `TypingIndicator` - Animated indicator when AI is responding
- `ChatInput` - Text input with send button
- `SuggestedResources` - Displays relevant course materials
- `FollowUpQuestions` - Shows AI-generated follow-up questions

**Features:**
- ✅ Real-time chat with message history
- ✅ Streaming message display support
- ✅ Typing indicators during AI response
- ✅ Message timestamps (relative time format)
- ✅ Suggested resources based on conversation
- ✅ Follow-up questions to deepen understanding
- ✅ Resource engagement tracking
- ✅ Responsive design for desktop and tablet

**Requirements Satisfied:**
- 8.1: Context-aware responses based on course content
- 8.5: Response time tracking and display

### 2. Interactive Simulation Interface (Task 17.2)

**Location:** `/student/simulations`

**Components:**
- `SimulationInterface` - Main simulation orchestrator
- `ScenarioSetup` - Form to create new scenarios
- `ScenarioDisplay` - Shows context and current situation
- `ActionSelector` - Interactive action buttons with categories
- `FeedbackDisplay` - Shows feedback after each action
- `ProgressBar` - Visual progress indicator
- `PerformanceReportDisplay` - Detailed performance report

**Features:**
- ✅ Scenario creation with customizable parameters
- ✅ Context and situation display
- ✅ Interactive action buttons categorized by type
- ✅ Real-time feedback after each action
- ✅ Running score display
- ✅ Progress tracking (current step / total steps)
- ✅ Detailed performance report with:
  - Overall score (0-100)
  - Category scores (analysis, communication, decision, implementation)
  - Strengths and areas for improvement
  - Detailed feedback
  - Actionable recommendations
- ✅ Replay functionality
- ✅ Scenario completion screen

**Requirements Satisfied:**
- 9.1: Realistic workplace scenario generation
- 9.2: Branching scenario paths based on decisions
- 9.3: Performance evaluation against best practices
- 9.4: Detailed feedback with specific justifications
- 9.5: Replay functionality with different approaches

## Technical Implementation

### State Management
- Uses React Query for server state management
- Custom hooks (`useTutorBot`, `useSimulation`) encapsulate business logic
- Optimistic updates for better UX

### API Integration
- Axios-based API client with interceptors
- Automatic auth token injection
- Error handling and retry logic

### Styling
- Tailwind CSS for responsive design
- Custom animations for typing indicators and progress bars
- Accessible color schemes and contrast ratios

### Type Safety
- Full TypeScript implementation
- Shared types between frontend and backend
- Type-safe API calls and responses

## Usage

### AI Tutor

```tsx
import { ChatInterface } from '@/components/tutor-bot';

<ChatInterface
  studentId="student-123"
  courseId="course-456"
  courseName="Introduction to Business Intelligence"
/>
```

### Simulations

```tsx
import { SimulationInterface } from '@/components/simulation';

<SimulationInterface
  studentId="student-123"
  courseId="course-456"
/>
```

## API Endpoints Used

### Tutor Bot
- `GET /api/tutor/history/:studentId` - Fetch conversation history
- `POST /api/tutor/chat` - Send message and get response
- `POST /api/tutor/track-resource` - Track resource engagement

### Simulations
- `POST /api/simulations/create` - Create new scenario
- `POST /api/simulations/:id/action` - Process student action
- `GET /api/simulations/:id/evaluate` - Get performance report
- `POST /api/simulations/:id/reset` - Reset scenario for replay

## Future Enhancements

Potential improvements for future iterations:

1. **AI Tutor**
   - Voice input/output support
   - Multi-language support
   - Collaborative learning (group chats)
   - Integration with course calendar and deadlines

2. **Simulations**
   - Multiplayer scenarios
   - Video/audio elements in scenarios
   - Mobile app support
   - Leaderboards and achievements
   - Export performance reports as PDF

3. **General**
   - Offline mode support
   - Push notifications for important updates
   - Accessibility improvements (screen reader support)
   - Dark mode

## Testing

To test the student features:

1. Navigate to `/student` to see the dashboard
2. Click "AI Tutor" to access the chat interface
3. Click "Interactive Simulations" to start a simulation
4. Try different scenarios and difficulty levels
5. Complete a simulation to see the performance report

## Dependencies

New dependencies added:
- `axios` (^1.6.2) - HTTP client
- `date-fns` (^2.30.0) - Date formatting utilities

## Notes

- Student ID and Course ID are currently hardcoded for demo purposes
- In production, these should come from authentication context
- All components are fully responsive (desktop and tablet)
- Components follow accessibility best practices
