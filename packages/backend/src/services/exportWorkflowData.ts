/**
 * What the whole-programme export is built from, and what its cache key covers.
 *
 * Logan Pacey's email of 17 November 2026 (Diploma in Logistics pilot, workflow
 * 6af5a0a3b706bd9a5b7af54a) said the export's "Unresolved Issues" list claimed the job roles had
 * not been matched to occupation codes, when two roles with twelve matches each were stored on
 * the workflow. The export routes built their own trimmed copy of the workflow (Steps 1 to 13,
 * the project name and the assessment rules), so the stored occupation evidence, the
 * knowledge-base evidence and Step 14 never reached the document, and the checks that read them
 * reported "not checked".
 *
 * The Word export, the PDF export and their cache hash now all take the same fields from here,
 * so a field added to one cannot be missing from another. The cache hash must cover everything
 * the render reads: otherwise a change to that field would be served from a stale cached file.
 */

/** The fields the document is rendered from, and so the fields its cache key must cover. */
export function exportContentOf(workflow: any) {
  return {
    projectName: workflow.projectName,
    step1: workflow.step1,
    step2: workflow.step2,
    step3: workflow.step3,
    step4: workflow.step4,
    step5: workflow.step5,
    step6: workflow.step6,
    step7: workflow.step7,
    step8: workflow.step8,
    step9: workflow.step9,
    step10: workflow.step10,
    step11: workflow.step11,
    step12: workflow.step12,
    step13: workflow.step13,
    step14: workflow.step14,
    assessmentRules: workflow.assessmentRules,
    occupationEvidence: workflow.occupationEvidence,
    kbEvidence: workflow.kbEvidence,
    knowledgeLibrary: workflow.knowledgeLibrary,
  };
}

/** The data handed to the Word renderer: the content, and the dates on the title page. */
export function exportRenderDataOf(workflow: any) {
  return {
    ...exportContentOf(workflow),
    createdAt: workflow.createdAt?.toISOString?.(),
    updatedAt: workflow.updatedAt?.toISOString?.(),
  };
}
