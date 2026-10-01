import path from 'path';
import {
  fetchableUrlProblem,
  isInsideRoot,
  isPublicAddress,
  publicOnlyLookup,
} from '../utils/publicUrl';

describe('isPublicAddress', () => {
  it('accepts ordinary internet addresses', () => {
    for (const ip of ['8.8.8.8', '104.16.132.229', '2606:4700::6810:84e5']) {
      expect(isPublicAddress(ip)).toBe(true);
    }
  });

  it('refuses loopback, private, link-local, metadata, CGNAT, multicast and reserved addresses', () => {
    for (const ip of [
      '127.0.0.1',
      '10.1.2.3',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '224.0.0.1',
      '240.0.0.1',
      '::1',
      '::',
      'fe80::1',
      'fc00::1',
      'fd12:3456::1',
      'ff02::1',
    ]) {
      expect(isPublicAddress(ip)).toBe(false);
    }
  });

  it('sees through IPv4-mapped IPv6 addresses, in either spelling', () => {
    expect(isPublicAddress('::ffff:127.0.0.1')).toBe(false);
    expect(isPublicAddress('::ffff:7f00:1')).toBe(false);
    expect(isPublicAddress('::ffff:a9fe:a9fe')).toBe(false);
    expect(isPublicAddress('::ffff:8.8.8.8')).toBe(true);
  });

  it('refuses anything that is not an address', () => {
    expect(isPublicAddress('example.org')).toBe(false);
    expect(isPublicAddress('')).toBe(false);
  });
});

describe('fetchableUrlProblem', () => {
  it('accepts public http and https addresses', () => {
    expect(fetchableUrlProblem('https://www.nist.gov/itl/ai-risk-management-framework')).toBeNull();
    expect(fetchableUrlProblem('http://example.org/page')).toBeNull();
  });

  it('refuses other schemes, credentials and malformed input', () => {
    expect(fetchableUrlProblem('file:///etc/passwd')).toMatch(/http/);
    expect(fetchableUrlProblem('ftp://example.org/x')).toMatch(/http/);
    expect(fetchableUrlProblem('https://user:pass@example.org/')).toMatch(/credentials/);
    expect(fetchableUrlProblem('not a url')).toMatch(/valid/);
  });

  it('refuses hosts that name the machine or the private network', () => {
    for (const url of [
      'http://127.0.0.1:4000/health',
      'http://[::1]/',
      'http://169.254.169.254/latest/meta-data/',
      'http://localhost:6379/',
      'http://api.localhost/',
      'http://redis.internal/',
      'http://printer.local/',
    ]) {
      expect(fetchableUrlProblem(url)).toMatch(/public internet/);
    }
  });
});

describe('publicOnlyLookup', () => {
  it('refuses to connect when a name resolves to a non-public address', (done) => {
    publicOnlyLookup('localhost', {}, (err: NodeJS.ErrnoException | null) => {
      expect(err && err.code).toBe('ENOTPUBLIC');
      done();
    });
  });
});

describe('isInsideRoot', () => {
  const root = path.resolve('/srv/kb');
  it('accepts a folder inside the root', () => {
    expect(isInsideRoot(root, path.resolve(root, 'standards'))).toBe(true);
    expect(isInsideRoot(root, root)).toBe(true);
  });
  it('refuses a folder outside it', () => {
    expect(isInsideRoot(root, path.resolve(root, '../../etc'))).toBe(false);
    expect(isInsideRoot(root, path.resolve('/srv/kb-other'))).toBe(false);
  });
});
