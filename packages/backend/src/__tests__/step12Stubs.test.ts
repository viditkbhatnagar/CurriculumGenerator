import { packStub, isPackStub, hydratePackEntries } from '../services/step12Stubs';
import { isModulePackComplete, missingPackVariants } from '../services/deliverableValidation';

const variant = (id: string, extra: any = {}) => ({
  assignmentId: id,
  deliveryVariant: id.split('-')[1],
  overview: { title: `T ${id}`, assignmentType: 'Report', weighting: 100 },
  brief: { studentFacingIntro: 'x'.repeat(2000), stepByStepInstructions: ['a'] },
  rubric: [{ criterionName: 'C', linkedMLOs: ['M1-LO1'] }],
  ...extra,
});
const pack = {
  moduleId: 'mod-m01',
  moduleCode: 'M01',
  moduleTitle: 'Intro',
  variants: {
    in_person: variant('M01-in_person'),
    self_study: variant('M01-self_study-placeholder', { rubric: [] }),
    hybrid: variant('M01-hybrid'),
  },
};

describe('packStub', () => {
  it('keeps what completeness reads and drops the content', () => {
    const stub = packStub(pack as any);
    expect(isPackStub(stub)).toBe(true);
    expect(stub.variants.in_person).toEqual({
      assignmentId: 'M01-in_person',
      deliveryVariant: 'in_person',
      overview: { title: 'T M01-in_person', assignmentType: 'Report' },
    });
    expect((stub.variants.in_person as any).brief).toBeUndefined();
    expect(JSON.stringify(stub).length).toBeLessThan(600);
  });

  it('answers the completeness rule the same as the full pack', () => {
    const stub = packStub(pack as any);
    expect(missingPackVariants(stub as any)).toEqual(missingPackVariants(pack as any));
    expect(isModulePackComplete(stub as any)).toBe(false);
  });
});

describe('hydratePackEntries', () => {
  it('replaces stubs with stored packs and keeps legacy full entries', () => {
    const legacy = { ...pack, moduleId: 'mod-m02', moduleCode: 'M02' };
    const entries = [packStub(pack as any), legacy];
    const out = hydratePackEntries(entries, [pack]);
    expect(out[0]).toEqual(pack);
    expect(out[1]).toBe(legacy);
  });

  it('keeps Step 4 order from the document, not the order rows were read', () => {
    const p2 = { ...pack, moduleId: 'mod-m02', moduleCode: 'M02' };
    const out = hydratePackEntries([packStub(pack as any), packStub(p2 as any)], [p2, pack]);
    expect(out.map((p: any) => p.moduleId)).toEqual(['mod-m01', 'mod-m02']);
  });

  it('marks a stub whose stored pack is missing as not generated', () => {
    // A stub cannot vouch for content that is gone: the module must show as needing work.
    const out = hydratePackEntries([packStub(pack as any)], []);
    expect(isModulePackComplete(out[0] as any)).toBe(false);
    expect(missingPackVariants(out[0] as any)).toEqual(['in_person', 'self_study', 'hybrid']);
  });
});
