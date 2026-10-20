/**
 * A search that finds nothing is recorded on the programme (services/kbEvidence), not only logged.
 */
const mockSearch = jest.fn();
jest.mock('../services/ragEngine', () => ({
  RAGEngine: jest.fn().mockImplementation(() => ({ semanticSearch: mockSearch })),
}));
jest.mock('../services/bookGroundingService', () => ({
  getWorkflowBookGrounding: jest.fn().mockResolvedValue([]),
  buildBookGroundingBlock: jest.fn(),
}));
// The programme draws on no textbook library here (knowledge/programmeLibrary).
jest.mock('../knowledge/programmeLibrary', () => ({
  libraryContextFor: jest.fn().mockResolvedValue([]),
}));

import { CurriculumWorkflow } from '../models/CurriculumWorkflow';
import { retrieveKBContext } from '../services/kbRetrieval';

const id = '6a619d817a037be307a8fa7c';

describe('recording what a step found in the knowledge base', () => {
  let updateOne: jest.SpyInstance;
  beforeEach(() => {
    updateOne = jest
      .spyOn(CurriculumWorkflow.collection, 'updateOne')
      .mockResolvedValue({} as never);
  });
  afterEach(() => jest.restoreAllMocks());

  it('records zero passages when the search finds nothing', async () => {
    mockSearch.mockResolvedValue([]);
    await retrieveKBContext(['marketing'], { workflowId: id, stage: 'step2' });
    const [, update] = updateOne.mock.calls[0];
    expect(update.$set['kbEvidence.step2']).toMatchObject({ passages: 0, books: 0 });
  });

  it('records Step 5 per module, and the passages found', async () => {
    mockSearch.mockResolvedValue([
      { content: 'A passage on pricing.', source: { title: 'Standard' }, similarityScore: 0.8 },
    ]);
    await retrieveKBContext(['pricing'], { workflowId: id, stage: 'step5', moduleId: 'mod-m02' });
    const [, update] = updateOne.mock.calls[0];
    expect(update.$set['kbEvidence.step5.mod-m02']).toMatchObject({ passages: 1 });
  });

  it('records zero when the search itself fails', async () => {
    mockSearch.mockRejectedValue(new Error('index missing'));
    await retrieveKBContext(['x'], { workflowId: id, stage: 'step3' });
    const [, update] = updateOne.mock.calls[0];
    expect(update.$set['kbEvidence.step3']).toMatchObject({ passages: 0 });
  });

  it('records nothing without a programme', async () => {
    mockSearch.mockResolvedValue([]);
    await retrieveKBContext(['x'], { stage: 'step1' });
    expect(updateOne).not.toHaveBeenCalled();
  });
});
