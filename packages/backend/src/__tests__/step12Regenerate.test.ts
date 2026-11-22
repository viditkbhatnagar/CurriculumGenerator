/**
 * Step 12 could not be regenerated once every module had packs (Logan Pacey, AGU, 21 November
 * 2026): the generate call returned the old packs. A full regeneration now clears them first.
 */
import { regenerationBlocker, step12ResetUpdate } from '../services/step12Regenerate';

describe('Step 12 full regeneration', () => {
  it('starts when no Step 12 job is running', () => {
    expect(regenerationBlocker([])).toBeNull();
    expect(
      regenerationBlocker([{ state: 'completed', moduleIndex: 0 }, { state: 'failed' }])
    ).toBeNull();
  });

  it('is refused while a module is generating or queued, naming it', () => {
    expect(regenerationBlocker([{ state: 'active', moduleIndex: 2 }])).toMatch(/module 3/);
    expect(regenerationBlocker([{ state: 'waiting' }])).toMatch(/already generating/);
  });

  it('empties the packs and marks only Step 12 in progress', () => {
    const now = new Date('2026-11-22T10:00:00Z');
    const { update, options } = step12ResetUpdate(now);
    expect(update.$set.step12).toEqual({
      moduleAssignmentPacks: [],
      generatedAt: now,
      regenerationStartedAt: now,
    });
    expect(update.$set['stepProgress.$[p].status']).toBe('in_progress');
    expect(update.$unset).toHaveProperty(['stepProgress.$[p].completedAt']);
    expect(options.arrayFilters).toEqual([{ 'p.step': 12 }]);
  });
});
