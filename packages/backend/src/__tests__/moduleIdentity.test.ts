import { moduleDownloadSlugOf } from '../utils/moduleIdentity';

describe('moduleDownloadSlugOf', () => {
  it('names a module by its code, whichever field holds it', () => {
    expect(
      moduleDownloadSlugOf({ moduleCode: 'M42', moduleTitle: 'Strategic Decision Making' })
    ).toBe('M42');
    expect(moduleDownloadSlugOf({ code: 'CHRP302' })).toBe('CHRP302');
  });

  it('makes a code filename-safe', () => {
    expect(moduleDownloadSlugOf({ moduleCode: ' MOD 104/b ' })).toBe('MOD-104-b');
  });

  it('falls back to the title when there is no code, never to a position', () => {
    expect(moduleDownloadSlugOf({ moduleCode: '', moduleTitle: 'Clinical Trial Design' })).toBe(
      'Clinical-Trial-Design'
    );
  });

  it('falls back to the id, then to a generic word', () => {
    expect(moduleDownloadSlugOf({ moduleId: 'mod-m42' })).toBe('mod-m42');
    expect(moduleDownloadSlugOf(undefined)).toBe('Unidentified-module');
    expect(moduleDownloadSlugOf({ moduleCode: '///' })).toBe('module');
  });
});
