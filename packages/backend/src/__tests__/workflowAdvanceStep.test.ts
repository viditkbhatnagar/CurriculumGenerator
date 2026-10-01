/**
 * Approving a step must persist its approval. Every stepN is free-form (Schema.Types.Mixed), so
 * Mongoose does not see `workflow.stepN.approvedAt = ...` unless the path is marked modified:
 * approvals of Steps 1-7 and 9 were never saved, and approved steps reloaded as unapproved.
 */
import mongoose from 'mongoose';
import { CurriculumWorkflow } from '../models/CurriculumWorkflow';

function loaded(currentStep: number) {
  const doc: any = CurriculumWorkflow.hydrate({
    _id: new mongoose.Types.ObjectId(),
    projectName: 'Test programme',
    createdBy: new mongoose.Types.ObjectId(),
    currentStep,
    status: `step${currentStep}_pending`,
    stepProgress: [1, 2, 3].map((step) => ({
      step,
      status: step === currentStep ? 'in_progress' : 'pending',
    })),
    step1: { programTitle: 'Test programme' },
    step2: { knowledgeItems: [] },
  });
  doc.save = jest.fn().mockResolvedValue(doc);
  return doc;
}

describe('advanceStep', () => {
  it('saves the approval of a step stored as free-form data', async () => {
    const doc = loaded(1);
    doc.step1.approvedAt = new Date();
    expect(doc.isModified('step1')).toBe(false); // what used to be saved: nothing
    await doc.advanceStep(1);
    expect(doc.isModified('step1')).toBe(true);
    expect(doc.save).toHaveBeenCalled();
  });

  it('saves a re-approval of a step the programme has moved past', async () => {
    const doc = loaded(3);
    doc.step2.approvedAt = new Date();
    await doc.advanceStep(2);
    expect(doc.isModified('step2')).toBe(true);
    expect(doc.currentStep).toBe(3);
  });
});
