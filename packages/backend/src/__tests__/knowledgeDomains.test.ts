jest.mock('../knowledge/models', () => ({ KbDomain: {} }));

import { DOMAINS, areasFor, findArea } from '../knowledge/ontology';
import { validateNewDomain, mergeDomains } from '../knowledge/domainRegistry';

const check = (input: any, existing = DOMAINS): any => validateNewDomain(input, existing);

describe('built-in domains', () => {
  it('includes Fashion & Design with unique area codes and names across all domains', () => {
    expect(DOMAINS.some((d) => d.key === 'fashion-design')).toBe(true);
    const codes = DOMAINS.flatMap((d) => d.areas.map((a) => a.code));
    const names = DOMAINS.flatMap((d) => d.areas.map((a) => a.name));
    expect(new Set(codes).size).toBe(codes.length);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('validateNewDomain', () => {
  it('accepts a key and name, giving a domain with no areas one general area', () => {
    const r = check({ key: 'Law', name: 'Law & Policy' });
    expect(r.ok).toBe(true);
    expect(r.domain.key).toBe('law');
    expect(r.domain.areas).toHaveLength(1);
    expect(r.domain.areas[0].name).toBe('Law & Policy (general)');
    const taken = DOMAINS.flatMap((d) => d.areas.map((a) => a.code));
    expect(taken).not.toContain(r.domain.areas[0].code);
  });

  it('rejects a duplicate key or name and a malformed key', () => {
    expect(check({ key: 'business', name: 'X' }).ok).toBe(false);
    expect(check({ key: 'new-one', name: 'business & management' }).ok).toBe(false);
    expect(check({ key: 'Bad Key!', name: 'X' }).ok).toBe(false);
    expect(check({ key: 'ok-key', name: '' }).ok).toBe(false);
  });

  it('codes supplied areas uniquely and refuses an area name already in the library', () => {
    const r = check({
      key: 'law',
      name: 'Law',
      areas: [{ name: 'Contract Law' }, { name: 'Tort Law' }],
    });
    expect(r.ok).toBe(true);
    expect(new Set(r.domain.areas.map((a: any) => a.code)).size).toBe(2);
    expect(check({ key: 'law', name: 'Law', areas: ['Marketing'] }).ok).toBe(false);
  });
});

describe('merged domains', () => {
  it('lists stored domains after built-ins, never replacing a built-in key, and finds their areas', () => {
    const r = check({ key: 'law', name: 'Law', areas: ['Contract Law'] });
    const clash = { ...r.domain, key: 'business' };
    const all = mergeDomains(DOMAINS, [r.domain, clash]);
    expect(all.filter((d) => d.key === 'business')).toHaveLength(1);
    expect(all[all.length - 1].key).toBe('law');
    expect(findArea('Contract Law', all)?.domain.key).toBe('law');
    expect(areasFor(['law'], all).map((a) => a.area.name)).toEqual(['Contract Law']);
  });
});
