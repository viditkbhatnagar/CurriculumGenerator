/**
 * Runs the content audit (services/curriculumDrift) on stored lesson plans and records the
 * findings on the programme as `contentAudit`, which the unresolved issues read
 * (contentAuditIssues).
 *
 * A module is audited each time its lesson plans are saved (step10Store.saveModulePlan), so the
 * findings follow the lessons; `auditProgrammeContent` audits every module at once, for a
 * programme whose lessons were written before the audit existed.
 */
import mongoose from 'mongoose';
import { CurriculumWorkflow } from '../models/CurriculumWorkflow';
import { loggingService } from './loggingService';
import { auditModule, auditProportion, DriftFinding, DriftModule } from './curriculumDrift';
import type { ModuleAudit } from './contentAuditIssues';

const keyOf = (moduleId: string) => String(moduleId).replace(/[.$]/g, '_');

/** The Step 4 facts the audit judges a module by: its code, title, year/level and topics. */
function driftModuleOf(module: any, plan: any): DriftModule {
  return {
    moduleCode: module?.code || module?.moduleCode || plan?.moduleCode || plan?.moduleId,
    moduleTitle: module?.title || module?.moduleTitle || plan?.moduleTitle,
    group: module?.group,
    topics: module?.topics || [],
  };
}

/** Findings for one module's stored lessons. */
export function findingsFor(module: any, plan: any): DriftFinding[] {
  const lessons = Array.isArray(plan?.lessons) ? plan.lessons : [];
  if (!lessons.length) return [];
  const drift = driftModuleOf(module, plan);
  return [...auditModule(drift, JSON.stringify(lessons)), ...auditProportion(drift, lessons)];
}

/** Lessons written without any reading or textbook passage to teach from (lessonSources). */
export function ungroundedCount(plan: any): number {
  const lessons: any[] = Array.isArray(plan?.lessons) ? plan.lessons : [];
  return lessons.filter((l) => !(l?.groundedIn?.sourceIds?.length || l?.groundedIn?.bookPassages))
    .length;
}

function recordOf(module: any, plan: any): ModuleAudit {
  return {
    moduleCode: String(driftModuleOf(module, plan).moduleCode || ''),
    findings: findingsFor(module, plan),
    checkedAt: new Date(),
    lessons: Array.isArray(plan?.lessons) ? plan.lessons.length : 0,
    ungroundedLessons: ungroundedCount(plan),
  };
}

/**
 * Audits one module's lessons as just saved and records the result. Never throws: an audit must
 * not stop a save. `module` is the Step 4 module when the caller has it; otherwise it is read.
 */
export async function auditSavedModule(workflowId: string, plan: any, module?: any) {
  try {
    if (!plan?.moduleId || !mongoose.isValidObjectId(workflowId)) return;
    let step4Module = module;
    if (!step4Module?.group) {
      const wf: any = await CurriculumWorkflow.findById(workflowId, { 'step4.modules': 1 }).lean();
      step4Module = (wf?.step4?.modules || []).find((m: any) => m?.id === plan.moduleId);
    }
    await CurriculumWorkflow.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(workflowId) },
      { $set: { [`contentAudit.modules.${keyOf(plan.moduleId)}`]: recordOf(step4Module, plan) } }
    );
  } catch (error) {
    loggingService.warn('Content audit of a saved module failed', {
      workflowId,
      moduleId: plan?.moduleId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Audits every module's stored lessons and replaces the programme's audit. */
export async function auditProgrammeContent(workflowId: string) {
  const { loadModulePlans } = await import('./step10Store');
  const wf: any = await CurriculumWorkflow.findById(workflowId, { 'step4.modules': 1 }).lean();
  if (!wf) throw new Error('Workflow not found');
  const modules: any[] = wf.step4?.modules || [];
  const plans = await loadModulePlans(workflowId);
  const audit: Record<string, ModuleAudit> = {};
  for (const plan of plans as any[]) {
    if (!plan?.moduleId) continue;
    const module = modules.find((m) => m?.id === plan.moduleId);
    audit[keyOf(plan.moduleId)] = recordOf(module, plan);
  }
  await CurriculumWorkflow.collection.updateOne(
    { _id: new mongoose.Types.ObjectId(workflowId) },
    { $set: { contentAudit: { modules: audit, checkedAt: new Date() } } }
  );
  const findings = Object.values(audit).flatMap((m) => m.findings);
  return {
    modules: Object.keys(audit).length,
    modulesWithFindings: Object.values(audit).filter((m) => m.findings.length).length,
    findings: findings.length,
    byRule: findings.reduce<Record<string, number>>((acc, f) => {
      acc[f.rule] = (acc[f.rule] || 0) + 1;
      return acc;
    }, {}),
  };
}
