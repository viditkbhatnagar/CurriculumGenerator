import { entryRequirementsLabel } from '../utils/entryRequirements';

describe('entryRequirementsLabel', () => {
  it('labels generated entry requirements a proposal', () => {
    const label = entryRequirementsLabel({ entryRequirementsOrigin: 'proposal' });
    expect(label.heading).toBe('Entry Requirements (Proposal)');
    expect(label.note).toMatch(/institutional approval/);
  });

  it('labels text with no recorded origin a proposal too', () => {
    // Workflows generated before the origin was stored hold the same model-written text.
    expect(entryRequirementsLabel({}).heading).toBe('Entry Requirements (Proposal)');
    expect(entryRequirementsLabel(undefined).note).toBeDefined();
  });

  it('prints institution-supplied requirements without the proposal note', () => {
    expect(entryRequirementsLabel({ entryRequirementsOrigin: 'institution' })).toEqual({
      heading: 'Entry Requirements',
    });
  });
});
