import {
  applySoftDeleteFilter,
  applySoftDeleteToPipeline,
  deleteConfirmationProblem,
} from '../utils/softDelete';

describe('deleteConfirmationProblem', () => {
  const programme = {
    projectName: 'Diploma in Logistics and Supply Chain Management',
    id: '6aafd3ef05556f710b7d92a4',
  };

  it('refuses a request that does not name the programme', () => {
    expect(deleteConfirmationProblem(programme, undefined)).toMatch(/confirmName/);
    expect(deleteConfirmationProblem(programme, '')).toMatch(/confirmName/);
    expect(deleteConfirmationProblem(programme, 42)).toMatch(/confirmName/);
  });

  it('refuses a name that is not this programme’s', () => {
    expect(deleteConfirmationProblem(programme, 'Bachelor in Business Administration')).toMatch(
      /does not match/
    );
  });

  it('accepts the programme’s name, ignoring case and surrounding spaces', () => {
    expect(
      deleteConfirmationProblem(programme, '  diploma in logistics and supply chain management ')
    ).toBeNull();
  });

  it('accepts the id for a programme that has no name', () => {
    const unnamed = { projectName: '', id: '6aafd3ef05556f710b7d92a4' };
    expect(deleteConfirmationProblem(unnamed, '6aafd3ef05556f710b7d92a4')).toBeNull();
    expect(deleteConfirmationProblem(unnamed, 'anything else')).toMatch(/does not match/);
  });
});

describe('applySoftDeleteFilter', () => {
  const query = (filter: Record<string, unknown>) => {
    const added: Record<string, unknown>[] = [];
    return {
      getFilter: () => filter,
      where: (f: Record<string, unknown>) => void added.push(f),
      added,
    };
  };

  it('leaves deleted programmes out of an ordinary query', () => {
    const q = query({ createdBy: 'u1' });
    applySoftDeleteFilter(q);
    expect(q.added).toEqual([{ deletedAt: null }]);
  });

  it('leaves alone a query that asks about deletedAt, so deleted programmes can be listed and restored', () => {
    const q = query({ deletedAt: { $ne: null } });
    applySoftDeleteFilter(q);
    expect(q.added).toEqual([]);
  });
});

describe('deleteConfirmationProblem with names the request filter changes', () => {
  it('matches a stored name holding a control character or odd spacing', () => {
    // The app-wide filter strips control characters from the request but not from the database.
    const stored = { projectName: 'Diploma in\u0014 Logistics  and\tSupply', id: 'x' };
    expect(deleteConfirmationProblem(stored, 'Diploma in Logistics and Supply')).toBeNull();
  });
});

describe('applySoftDeleteToPipeline', () => {
  it('leaves deleted programmes out of an aggregation', () => {
    const pipeline: Record<string, unknown>[] = [{ $group: { _id: '$status', n: { $sum: 1 } } }];
    applySoftDeleteToPipeline(pipeline);
    expect(pipeline[0]).toEqual({ $match: { deletedAt: null } });
    expect(pipeline).toHaveLength(2);
  });

  it('keeps a stage that must come first, first', () => {
    const pipeline: Record<string, unknown>[] = [{ $search: { text: {} } }, { $limit: 5 }];
    applySoftDeleteToPipeline(pipeline);
    expect(Object.keys(pipeline[0])).toEqual(['$search']);
    expect(pipeline[1]).toEqual({ $match: { deletedAt: null } });
  });

  it('leaves alone a pipeline that asks about deletedAt', () => {
    const pipeline: Record<string, unknown>[] = [{ $match: { deletedAt: { $ne: null } } }];
    applySoftDeleteToPipeline(pipeline);
    expect(pipeline).toHaveLength(1);
  });
});
