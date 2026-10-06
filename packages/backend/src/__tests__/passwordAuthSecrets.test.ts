import bcrypt from 'bcryptjs';

const stored: Record<string, string> = {};
jest.mock('../models/SystemSecret', () => ({
  SystemSecret: {
    findOne: ({ name }: { name: string }) => ({
      select: () => ({ lean: async () => (stored[name] ? { value: stored[name] } : null) }),
    }),
    updateOne: async (q: { name: string }, u: any) => {
      if (!stored[q.name]) stored[q.name] = u.$setOnInsert.value;
    },
  },
}));
const users: any[] = [];
jest.mock('../models/User', () => ({
  User: {
    findOne: ({ email }: { email: string }) => ({
      select: async () => users.find((u) => u.email === email) || null,
    }),
    create: async (doc: any) => {
      users.push(doc);
      return doc;
    },
  },
}));
jest.mock('../services/loggingService', () => ({
  loggingService: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('token-signing secret', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it('uses JWT_SECRET when it is long enough', async () => {
    jest.resetModules();
    process.env.JWT_SECRET = 's'.repeat(40);
    const { jwtSecret } = await import('../services/passwordAuthService');
    expect(await jwtSecret()).toBe('s'.repeat(40));
  });

  it('generates and keeps a secret when JWT_SECRET is unset, never the old constant', async () => {
    jest.resetModules();
    delete process.env.JWT_SECRET;
    const { jwtSecret } = await import('../services/passwordAuthService');
    const first = await jwtSecret();
    expect(first).toHaveLength(96);
    expect(first).not.toBe('dev-secret-change-me-in-production');
    jest.resetModules();
    const again = await import('../services/passwordAuthService');
    expect(await again.jwtSecret()).toBe(first);
  });
});

describe('superadmin seed', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
    users.length = 0;
  });

  it('creates the account without a password when SUPERADMIN_PASSWORD is unset', async () => {
    jest.resetModules();
    delete process.env.SUPERADMIN_PASSWORD;
    const { seedSuperAdmin } = await import('../services/passwordAuthService');
    await seedSuperAdmin();
    expect(users).toHaveLength(1);
    expect(users[0].passwordHash).toBeUndefined();
  });

  it('resets the password only when asked', async () => {
    jest.resetModules();
    const old = await bcrypt.hash('old-password', 4);
    users.push({
      email: 'loganpacey@gmail.com',
      role: 'administrator',
      passwordHash: old,
      save: jest.fn(),
    });
    process.env.SUPERADMIN_PASSWORD = 'a-new-password-1';
    const { seedSuperAdmin } = await import('../services/passwordAuthService');
    await seedSuperAdmin();
    expect(users[0].passwordHash).toBe(old);
    process.env.SUPERADMIN_RESET_PASSWORD = 'true';
    await seedSuperAdmin();
    expect(await bcrypt.compare('a-new-password-1', users[0].passwordHash)).toBe(true);
  });

  it('recognises the password that was committed to the repository', async () => {
    jest.resetModules();
    const { usesCompromisedPassword } = await import('../services/passwordAuthService');
    expect(await usesCompromisedPassword(await bcrypt.hash('loganPacey123!', 4))).toBe(true);
    expect(await usesCompromisedPassword(await bcrypt.hash('something-else', 4))).toBe(false);
  });
});
