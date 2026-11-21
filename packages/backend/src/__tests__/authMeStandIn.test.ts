import { requireSignedIn } from '../middleware/auth';
import authRoutes from '../routes/auth';

function run(sub: string | undefined, authProviderId?: string) {
  const res: any = { status: jest.fn(() => res), json: jest.fn(() => res) };
  const next = jest.fn();
  requireSignedIn({ auth: sub ? { sub } : undefined, user: { authProviderId } } as any, res, next);
  return { res, next };
}

describe('GET /api/auth/me answers only a real sign-in', () => {
  it('refuses the anonymous stand-in an expired token falls through to', () => {
    const { res, next } = run('anonymous-user', 'anonymous-user');
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('lets a password sign-in through', () => {
    const { next } = run('local:someone@example.com', 'local:someone@example.com');
    expect(next).toHaveBeenCalled();
  });

  it('puts requireSignedIn on the /me route', () => {
    const layer = (authRoutes as any).stack.find((l: any) => l.route?.path === '/me');
    const handlers = layer.route.stack.map((s: any) => s.handle);
    expect(handlers).toContain(requireSignedIn);
  });
});
