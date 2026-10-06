import { loginRequiredFor, requireLoginWhenEnabled, validateJWT } from '../middleware/auth';

jest.mock('../services/passwordAuthService', () => ({
  userFromToken: jest.fn(async (token: string) =>
    token === 'good'
      ? { id: 'u1', email: 'a@b.c', role: 'faculty', authProviderId: 'local:a' }
      : null
  ),
}));
jest.mock('../services/userService', () => ({}));
jest.mock('../services/auditService', () => ({ createAuditLog: jest.fn() }));
jest.mock('../models/User', () => ({ User: {} }));

const LMS = 'l'.repeat(40);

function call(mw: any, method: string, path: string, token?: string) {
  const req: any = { method, path, headers: token ? { authorization: `Bearer ${token}` } : {} };
  const res: any = {
    statusCode: 200,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json() {
      return this;
    },
  };
  return new Promise<{ status: number; req: any; passed: boolean }>((resolve) => {
    const next = () => resolve({ status: res.statusCode, req, passed: true });
    const done = res.json;
    res.json = function (body: unknown) {
      done.call(this, body);
      resolve({ status: res.statusCode, req, passed: false });
      return this;
    };
    mw(req, res, next);
  });
}

describe('login switches', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it('changes nothing while REQUIRE_AUTH is off', async () => {
    delete process.env.REQUIRE_AUTH;
    expect(loginRequiredFor('POST')).toBe(false);
    const r = await call(requireLoginWhenEnabled, 'DELETE', '/v3/workflow/x');
    expect(r.passed).toBe(true);
  });

  it('requires a login for changes, but not for reads, with REQUIRE_AUTH alone', async () => {
    process.env.REQUIRE_AUTH = 'true';
    expect((await call(requireLoginWhenEnabled, 'POST', '/v3/workflow/x')).status).toBe(401);
    expect((await call(requireLoginWhenEnabled, 'GET', '/v3/workflow/x')).passed).toBe(true);
    const signedIn = await call(requireLoginWhenEnabled, 'POST', '/v3/workflow/x', 'good');
    expect(signedIn.passed).toBe(true);
    expect(signedIn.req.auth.email).toBe('a@b.c');
  });

  it('leaves signing in open', async () => {
    process.env.REQUIRE_AUTH = 'true';
    expect((await call(requireLoginWhenEnabled, 'POST', '/auth/login')).passed).toBe(true);
  });

  it('requires a login for reads too with REQUIRE_AUTH_READS, except the LMS token on GET', async () => {
    process.env.REQUIRE_AUTH = 'true';
    process.env.REQUIRE_AUTH_READS = 'true';
    process.env.LMS_SERVICE_TOKEN = LMS;
    expect((await call(requireLoginWhenEnabled, 'GET', '/v3/workflow/x')).status).toBe(401);
    const lms = await call(requireLoginWhenEnabled, 'GET', '/v3/workflow/x', LMS);
    expect(lms.passed).toBe(true);
    expect(lms.req.auth.sub).toBe('service:lms');
    expect((await call(validateJWT, 'POST', '/v3/workflow/x', LMS)).status).toBe(403);
    expect((await call(requireLoginWhenEnabled, 'GET', '/v3/workflow/x', 'wrong')).status).toBe(
      401
    );
  });
});
