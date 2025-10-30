/**
 * Analytics Routes
 * API endpoints for system analytics and metrics
 * MongoDB version
 */

import express, { Request, Response, NextFunction } from 'express';
import { CurriculumProject } from '../models/CurriculumProject';
import { Program } from '../models/Program';
import { GenerationJob } from '../models/GenerationJob';
import { KnowledgeBase } from '../models/KnowledgeBase';
import { User } from '../models/User';
import { AuditLog } from '../models/AuditLog';
import { monitoringService } from '../services/monitoringService';
import { loggingService } from '../services/loggingService';
import { analyticsStorageService } from '../services/analyticsStorageService';

const router = express.Router();

/**
 * GET /api/analytics/dashboard
 * Get comprehensive dashboard metrics
 */
router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get date range for recent activity (30 days ago)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Get total projects count
    const totalProjects = await CurriculumProject.countDocuments();

    // Get projects by status
    const projectsByStatus = await CurriculumProject.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);
    const projectStatusMap = projectsByStatus.reduce(
      (acc, item) => {
        acc[item._id] = item.count;
        return acc;
      },
      {} as Record<string, number>
    );

    // Get total programs (old model - if still used)
    const totalPrograms = await Program.countDocuments();

    // Get programs by status
    const programsByStatus = await Program.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);
    const programStatusMap = programsByStatus.reduce(
      (acc, item) => {
        acc[item._id] = item.count;
        return acc;
      },
      {} as Record<string, number>
    );

    // Get generation job statistics
    const totalJobs = await GenerationJob.countDocuments();
    const completedJobs = await GenerationJob.countDocuments({ status: 'completed' });
    const failedJobs = await GenerationJob.countDocuments({ status: 'failed' });
    const successRate = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;

    // Get average generation time
    const completedJobsWithTime = await GenerationJob.find({
      status: 'completed',
      completedAt: { $exists: true },
      startedAt: { $exists: true },
    }).limit(100); // Last 100 for performance

    let avgGenerationTime = null;
    if (completedJobsWithTime.length > 0) {
      const totalTime = completedJobsWithTime.reduce((sum, job) => {
        if (job.completedAt && job.startedAt) {
          const duration = (job.completedAt.getTime() - job.startedAt.getTime()) / 60000; // minutes
          return sum + duration;
        }
        return sum;
      }, 0);
      avgGenerationTime = parseFloat((totalTime / completedJobsWithTime.length).toFixed(2));
    }

    // Get total knowledge base sources
    const totalKBSources = await KnowledgeBase.countDocuments();

    // Get active users (created projects in last 30 days)
    const activeProjectCreators = await CurriculumProject.distinct('smeId', {
      createdAt: { $gte: thirtyDaysAgo },
    });
    const activeProgramCreators = await Program.distinct('createdBy', {
      createdAt: { $gte: thirtyDaysAgo },
      createdBy: { $exists: true },
    });
    const activeUsers = new Set([...activeProjectCreators, ...activeProgramCreators]).size;

    // Get total users
    const totalUsers = await User.countDocuments();

    // Get recent activity (last 7 days) - projects created per day
    const recentProjectActivity = await CurriculumProject.aggregate([
      {
        $match: {
          createdAt: { $gte: sevenDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          projectsCreated: { $sum: 1 },
        },
      },
      {
        $sort: { _id: -1 },
      },
    ]);

    // Get LLM metrics from monitoring service (real-time)
    const llmMetrics = monitoringService.getHealthMetrics();

    // Get total API cost and tokens from DATABASE (persistent, accurate history)
    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);

    const totalLLMCost = await analyticsStorageService.getTotalCost(oneMonthAgo);
    const totalTokens = await analyticsStorageService.getTotalTokens(oneMonthAgo);

    // Get published curricula count
    const publishedCurricula = await CurriculumProject.countDocuments({ status: 'published' });

    res.json({
      success: true,
      data: {
        overview: {
          totalProjects,
          totalPrograms,
          projectsByStatus: projectStatusMap,
          programsByStatus: programStatusMap,
          successRate: parseFloat(successRate.toFixed(2)),
          avgGenerationTime,
          totalKBSources,
          activeUsers,
          totalUsers,
          publishedCurricula,
        },
        llmMetrics: {
          totalCost: parseFloat(totalLLMCost.toFixed(4)),
          totalTokens: Math.round(totalTokens),
          avgResponseTime: llmMetrics.avgResponseTime,
          cacheHitRate: llmMetrics.cacheHitRate,
        },
        recentActivity: recentProjectActivity.map((item) => ({
          date: item._id,
          projectsCreated: item.projectsCreated,
        })),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    loggingService.error('Failed to get dashboard metrics', { error });
    next(error);
  }
});

/**
 * GET /api/analytics/projects
 * Get curriculum project statistics
 */
router.get('/projects', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, status } = req.query;

    // Build filter
    const filter: any = {};
    if (startDate) {
      filter.createdAt = { $gte: new Date(startDate as string) };
    }
    if (endDate) {
      filter.createdAt = { ...filter.createdAt, $lte: new Date(endDate as string) };
    }
    if (status) {
      filter.status = status;
    }

    // Get project statistics
    const projects = await CurriculumProject.find(filter);
    const totalProjects = projects.length;
    const completedProjects = projects.filter((p) => p.status === 'published').length;
    const inProgressProjects = projects.filter((p) =>
      ['research', 'cost_review', 'generation', 'final_review'].includes(p.status)
    ).length;
    const cancelledProjects = projects.filter((p) => p.status === 'cancelled').length;

    // Get projects by stage
    const projectsByStage = await CurriculumProject.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$currentStage',
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Get average timeline metrics
    const completedWithTimeline = await CurriculumProject.find({
      status: 'published',
      'timeline.totalTime': { $exists: true },
    });

    let avgTotalTime = null;
    if (completedWithTimeline.length > 0) {
      const totalTime = completedWithTimeline.reduce(
        (sum, p) => sum + (p.timeline.totalTime || 0),
        0
      );
      avgTotalTime = Math.round(totalTime / completedWithTimeline.length);
    }

    // Get recent completed projects
    const recentCompleted = await CurriculumProject.find({ status: 'published' })
      .sort({ 'stageProgress.stage5.publishedAt': -1 })
      .limit(10)
      .select('projectName courseCode createdAt stageProgress.stage5.publishedAt');

    res.json({
      success: true,
      data: {
        statistics: {
          totalProjects,
          completedProjects,
          inProgressProjects,
          cancelledProjects,
          avgTotalTime,
        },
        byStage: projectsByStage.map((item) => ({
          stage: item._id,
          count: item.count,
        })),
        recentCompleted: recentCompleted.map((p) => ({
          projectName: p.projectName,
          courseCode: p.courseCode,
          createdAt: p.createdAt,
          publishedAt: p.stageProgress?.stage5?.publishedAt,
        })),
      },
    });
  } catch (error) {
    loggingService.error('Failed to get project statistics', { error });
    next(error);
  }
});

/**
 * GET /api/analytics/users
 * Get user engagement data
 */
router.get('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get total users
    const totalUsers = await User.countDocuments();

    // Get users by role
    const usersByRole = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
        },
      },
    ]);
    const roleMap = usersByRole.reduce(
      (acc, item) => {
        acc[item._id] = item.count;
        return acc;
      },
      {} as Record<string, number>
    );

    // Get active users (logged in within last 30 days)
    const activeUsers = await User.countDocuments({
      lastLogin: { $gte: thirtyDaysAgo },
    });

    // Get top contributors
    const topContributors = await CurriculumProject.aggregate([
      {
        $group: {
          _id: '$smeId',
          projectCount: { $sum: 1 },
          lastProjectCreated: { $max: '$createdAt' },
        },
      },
      { $sort: { projectCount: -1 } },
      { $limit: 20 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    ]);

    // Get recent activity from audit logs
    const recentActivity = await AuditLog.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          activeUsers: { $addToSet: '$userId' },
          totalActions: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
      {
        $project: {
          date: '$_id',
          activeUsers: { $size: '$activeUsers' },
          totalActions: 1,
        },
      },
    ]);

    // Get top actions
    const topActions = await AuditLog.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalUsers,
          usersByRole: roleMap,
          activeUsers,
          activeUserPercentage:
            totalUsers > 0 ? parseFloat(((activeUsers / totalUsers) * 100).toFixed(2)) : 0,
        },
        topContributors: topContributors.map((item) => ({
          userId: item._id,
          email: item.user?.email || 'Unknown',
          role: item.user?.role || 'Unknown',
          projectCount: item.projectCount,
          lastProjectCreated: item.lastProjectCreated,
        })),
        activityTimeline: recentActivity.map((item) => ({
          date: item.date,
          activeUsers: item.activeUsers,
          totalActions: item.totalActions,
        })),
        topActions: topActions.map((item) => ({
          action: item._id,
          count: item.count,
        })),
      },
    });
  } catch (error) {
    loggingService.error('Failed to get user engagement data', { error });
    next(error);
  }
});

/**
 * GET /api/analytics/knowledge-base
 * Get knowledge base statistics
 */
router.get('/knowledge-base', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get total sources
    const totalSources = await KnowledgeBase.countDocuments();

    // Get sources by domain
    const byDomain = await KnowledgeBase.aggregate([
      {
        $group: {
          _id: '$domain',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Get sources by type
    const byType = await KnowledgeBase.aggregate([
      {
        $group: {
          _id: '$sourceType',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Get average credibility score
    const avgCredResult = await KnowledgeBase.aggregate([
      {
        $group: {
          _id: null,
          avgScore: { $avg: '$credibilityScore' },
        },
      },
    ]);
    const avgCredibilityScore =
      avgCredResult.length > 0 ? parseFloat(avgCredResult[0].avgScore.toFixed(2)) : null;

    // Get sources added over time
    const timeline = await KnowledgeBase.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          sourcesAdded: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalSources,
          avgCredibilityScore,
        },
        byDomain: byDomain.map((item) => ({
          domain: item._id,
          count: item.count,
        })),
        byType: byType.map((item) => ({
          type: item._id,
          count: item.count,
        })),
        timeline: timeline.map((item) => ({
          date: item._id,
          sourcesAdded: item.sourcesAdded,
        })),
      },
    });
  } catch (error) {
    loggingService.error('Failed to get knowledge base statistics', { error });
    next(error);
  }
});

export default router;
