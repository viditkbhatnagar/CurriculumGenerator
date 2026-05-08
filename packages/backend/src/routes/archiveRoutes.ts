/**
 * Archive routes — read-only access to legacy v1/v2 curriculum data.
 *
 * Background: the database contains 11 `curriculumprojects` records from
 * a previous version of the generator, each paired with a
 * `preliminarycurriculumpackages` document holding the full curriculum
 * (programOverview, competencyFramework, courseFramework, learningOutcomes,
 * readingList, assessments, glossary, caseStudies, etc.). The current
 * /workflow page only reads `curriculumworkflows` so these projects are
 * invisible.
 *
 * These endpoints surface that data in read-only form for administrators.
 * No editing, no migration — just visibility. If we ever want to promote
 * one of these into the v3 workflow, build a separate "promote" endpoint.
 */

import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { validateJWT, loadUser, requireRole } from '../middleware/auth';
import { UserRole } from '../types/auth';
import { CurriculumProject } from '../models/CurriculumProject';
import { PreliminaryCurriculumPackage } from '../models/PreliminaryCurriculumPackage';
import { loggingService } from '../services/loggingService';

const router = Router();

// All archive routes require admin privileges.
router.use(validateJWT, loadUser, requireRole(UserRole.ADMINISTRATOR));

/**
 * GET /api/v3/archive
 * Returns a lightweight list of every legacy project with a summary of
 * how rich its preliminary package is (so the admin UI can show status
 * + content counts at a glance, without pulling the full payload).
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const projects = await CurriculumProject.find().sort({ createdAt: -1 }).lean().exec();

    if (projects.length === 0) {
      return res.json({ success: true, data: [], count: 0 });
    }

    const projectIds = projects.map((p: any) => p._id);
    const packages = await PreliminaryCurriculumPackage.find({
      projectId: { $in: projectIds },
    })
      .lean()
      .exec();

    const pkgByProject = new Map<string, any>();
    packages.forEach((pkg: any) => {
      pkgByProject.set(String(pkg.projectId), pkg);
    });

    const data = projects.map((p: any) => {
      const pkg = pkgByProject.get(String(p._id));
      const summary = summarisePackage(pkg);
      return {
        id: String(p._id),
        projectName: p.projectName || '(untitled)',
        courseCode: p.courseCode || null,
        status: p.status,
        currentStage: p.currentStage || null,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        publishedAt: p.stageProgress?.stage5?.publishedAt || null,
        hasPackage: !!pkg,
        summary,
      };
    });

    res.json({ success: true, data, count: data.length });
  } catch (error) {
    loggingService.error('Failed to list archive projects', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list archive projects',
    });
  }
});

/**
 * GET /api/v3/archive/:id
 * Returns the project metadata + full preliminary curriculum package
 * for the given id.
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, error: 'Invalid project id' });
    }

    const project = await CurriculumProject.findById(req.params.id).lean().exec();
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const pkg = await PreliminaryCurriculumPackage.findOne({ projectId: project._id })
      .lean()
      .exec();

    res.json({
      success: true,
      data: {
        project: {
          id: String(project._id),
          projectName: (project as any).projectName || '(untitled)',
          courseCode: (project as any).courseCode || null,
          status: project.status,
          currentStage: (project as any).currentStage || null,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
        },
        package: pkg || null,
      },
    });
  } catch (error) {
    loggingService.error('Failed to fetch archive project', {
      error,
      id: req.params.id,
    });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch archive project',
    });
  }
});

/** Cheap stats summary so the list view can show counts without the body. */
function summarisePackage(pkg: any) {
  if (!pkg) return null;
  const len = (v: any) => (Array.isArray(v) ? v.length : v ? 1 : 0);
  const modules = pkg.courseFramework?.modules;
  return {
    modules: Array.isArray(modules) ? modules.length : 0,
    learningOutcomes: len(pkg.learningOutcomes),
    glossary: len(pkg.glossary),
    caseStudies: len(pkg.caseStudies),
    references: len(pkg.references),
    hasProgramOverview: !!pkg.programOverview?.programTitle,
    hasCompetencyFramework: !!pkg.competencyFramework,
    hasReadingList: !!pkg.readingList,
    hasAssessments: !!pkg.assessments,
  };
}

export default router;
