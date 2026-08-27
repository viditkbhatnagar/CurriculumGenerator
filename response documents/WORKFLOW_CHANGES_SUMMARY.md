# Curriculum Generator Workflow Changes Summary

## Date: October 29, 2025

## Overview

This document summarizes the major changes made to the Curriculum Generator workflow, transitioning from an 8-stage sequential pipeline to a 5-stage AI-integrated collaborative workflow.

---

## Key Changes

### 1. Workflow Structure

**Before:** 8-Stage Sequential Pipeline

- Stage 1: Validation (5%)
- Stage 2: Knowledge Base Retrieval (15%)
- Stage 3: Program Specification (30%)
- Stage 4: Unit Specifications (50%)
- Stage 5: Assessment Package (65%)
- Stage 6: Skill Book (75%)
- Stage 7: Quality Assurance (85%)
- Stage 8: Benchmarking (95%)

**After:** 5-Stage AI-Integrated Workflow

- Stage 1: SME Login & Prompt Selection (5 min)
- Stage 2: AI Research & SME Review (30-60 min)
- Stage 3: Resource Cost Evaluation (15-30 min)
- Stage 4: Curriculum Generation (20-40 min)
- Stage 5: Final Review & Launch (30-60 min)

**Total Time:** 2-4 hours (compared to 15-30 minutes for old workflow, but with much greater SME collaboration and quality control)

---

## Major Feature Additions

### 1. Prompt Library

- **What:** Internal library of course prompts with preset parameters
- **Benefits:**
  - Standardized starting points
  - Eliminates manual Excel uploads
  - Ensures AGI compliance from the start
  - Pre-configured with 120 hours, 15 ECTS, 6-8 modules

### 2. Chat-Based AI Research

- **What:** Interactive chat interface for preliminary curriculum package development
- **Multi-AI Integration:**
  - Perplexity AI for web research and current trends
  - ChatGPT/GPT-4 for content generation
  - Google Gemini for alternative analysis
- **Benefits:**
  - Real-time SME collaboration
  - Iterative refinement during research phase
  - AGI compliance built-in from start

### 3. Preliminary Curriculum Package

- **What:** 13-component AGI-compliant package generated before full curriculum
- **Components:**
  1. Program Overview
  2. Competency & Knowledge Framework
  3. Learning Outcomes, Assessment Criteria & Competencies
  4. Course Framework (120 hours, 6-8 modules)
  5. Topic-Level Sources (APA 7, ≤5 years)
  6. Indicative & Additional Reading List
  7. Assessments (MCQs, case studies, rubrics)
  8. Glossary
  9. Case Studies
  10. Delivery & Digital Tools
  11. References
  12. Submission Metadata
  13. Outcome Writing Guide

### 4. Resource Cost Evaluation

- **What:** Automatic detection and costing of paid resources
- **Process:**
  - AI scans for paid resources (textbooks, software, licenses)
  - Calculates total cost per student and program
  - Notifies management for approval
  - If rejected: AI suggests open-source alternatives
  - Updates instructional plan if substitutions affect pedagogy
  - SME re-approves revised package

### 5. Branded Slide Decks

- **What:** Automatically generated PowerPoint or Canva presentations
- **Features:**
  - Branded templates
  - Consistent visual design
  - One deck per module (6-8 total)
  - Integrated with curriculum content

### 6. Cross-Referencing & Traceability

- **What:** All generated materials reference back to preliminary package
- **Benefits:**
  - Ensures consistency
  - Maintains source attribution
  - Enables audit trail
  - AGI compliance verification

---

## Integration of Old Stages

### Old Stages Now Integrated Into New Workflow

**Old Stage 6: Skill Book Generation**
→ Now in Stage 2 (Preliminary Package - Competency Framework)

**Old Stage 7: Quality Assurance**
→ Distributed across:

- Stage 2: AGI validation during research
- Stage 4: QA during generation
- Stage 5: Final SME review

**Old Stage 8: Benchmarking**
→ Now in Stage 2 (Preliminary Package - Program Overview & Comparative Analysis)

---

## New System Components Required

### Backend Services

1. **Prompt Library Service**
   - Manage course prompts
   - Filter and search
   - Initialize projects

2. **AI Research Service**
   - Orchestrate multi-AI research
   - Generate preliminary package
   - Manage chat interaction

3. **Resource Cost Service**
   - Scan for paid resources
   - Calculate costs
   - Notify management

4. **Alternative Suggester Service**
   - Find open-source alternatives
   - Compare quality
   - Update instructional plans

5. **Curriculum Generation Service v2**
   - Generate from preliminary package
   - Create slide decks
   - Cross-reference materials

6. **Refinement Service**
   - Process SME refinements
   - Regenerate affected sections
   - Track revisions

7. **Publication Service**
   - Finalize approval
   - Deploy to LMS
   - Enable enrollment

### Database Collections

1. **CoursePrompt** - Library of course prompts
2. **CurriculumProject** - Project tracking
3. **PreliminaryCurriculumPackage** - Research output with chat history
4. **ResourceCostEvaluation** - Cost analysis and approvals
5. **FullCurriculumPackage** - Generated materials
6. **CurriculumReview** - Review and approval tracking

### External Integrations

1. **Perplexity AI API** - Deep web research
2. **Google Gemini API** - Alternative analysis
3. **OpenAI API (Enhanced)** - Content generation + embeddings
4. **WebSocket** - Real-time chat communication
5. **LMS APIs** - Course deployment (Moodle, Canvas, Blackboard)

### Frontend Components

1. **Prompt Library Interface** - Browse and select prompts
2. **Chat Interface** - AI research collaboration
3. **Resource Approval Dashboard** - Management approvals
4. **Curriculum Review Interface** - SME final review

---

## Benefits of New Workflow

| Aspect                    | Old Workflow                | New Workflow              | Benefit                   |
| ------------------------- | --------------------------- | ------------------------- | ------------------------- |
| **Initiation**            | Excel upload (manual)       | Prompt selection          | Faster, standardized      |
| **SME Involvement**       | Post-generation review only | Collaborative throughout  | Better quality control    |
| **Research Quality**      | Single RAG retrieval        | Multi-AI deep research    | More comprehensive        |
| **Resource Management**   | Not addressed               | Dedicated cost evaluation | Budget control            |
| **AGI Compliance**        | Post-generation validation  | Built-in from start       | Fewer revisions           |
| **Alternative Resources** | Not supported               | AI-suggested alternatives | Cost savings              |
| **Output Formats**        | Documents only              | Documents + Slides + Sims | Complete teaching package |
| **Traceability**          | Limited                     | Full cross-referencing    | Audit compliance          |

---

## Migration Path

### Phase 1: Database & Backend (Weeks 1-2)

- [ ] Create new database collections
- [ ] Implement new service layer
- [ ] Integrate Perplexity and Gemini APIs
- [ ] Build WebSocket infrastructure

### Phase 2: Frontend (Weeks 3-4)

- [ ] Design Prompt Library interface
- [ ] Build chat interface
- [ ] Create Resource Approval dashboard
- [ ] Enhance Curriculum Review interface

### Phase 3: Testing (Week 5)

- [ ] Unit tests for new services
- [ ] Integration tests for multi-AI workflow
- [ ] E2E tests for complete workflow
- [ ] UAT with SMEs

### Phase 4: Deployment (Week 6)

- [ ] Production deployment
- [ ] User training
- [ ] Documentation
- [ ] Monitor and iterate

---

## Files Updated

1. ✅ **NEW_WORKFLOW_DOCUMENT.md** - Complete new workflow specification
2. ✅ **WORKFLOW_DOCUMENT.md** - Updated with 5-stage workflow
3. ⏳ **WORKFLOW.md** - User flows and data flow diagrams (in progress)
4. ⏳ **ARCHITECTURE.md** - New components and services (pending)
5. ⏳ **Implementation Guide** - Developer implementation guide (pending)

---

## Next Steps

1. Complete updates to WORKFLOW.md
2. Complete updates to ARCHITECTURE.md
3. Create implementation guide for developers
4. Get stakeholder approval
5. Begin Phase 1 development

---

**Document Version:** 1.0
**Last Updated:** October 29, 2025
**Status:** Workflow Design Complete, Implementation Pending
