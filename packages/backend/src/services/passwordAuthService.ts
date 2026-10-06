/**
 * Built-in email + password authentication.
 *
 * This is the primary auth flow for the curriculum generator. The Auth0
 * integration that was added earlier is left in place for environments
 * that want SSO; without Auth0 env vars this module is the sole path.
 *
 * Issues a JWT signed with `JWT_SECRET` (env var) on successful login.
 * The middleware in middleware/auth.ts verifies it. Tokens expire after
 * `JWT_EXPIRES_IN` (default 7 days).
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User, IUser } from '../models/User';
import { SystemSecret } from '../models/SystemSecret';
import { UserRole, AuthUser } from '../types/auth';
import { loggingService } from './loggingService';

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const BCRYPT_ROUNDS = 10;

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResult {
  token: string;
  user: AuthUser;
}

/**
 * The secret login tokens are signed with: JWT_SECRET when it is set, otherwise one the server
 * generated and stored (models/SystemSecret). It used to fall back to a constant committed in
 * this file, which let anyone who had read the repository sign a token for any user.
 */
let cachedSecret: string | null = null;
const MIN_SECRET_LENGTH = 32;

export async function jwtSecret(): Promise<string> {
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv && fromEnv.length >= MIN_SECRET_LENGTH) return fromEnv;
  if (cachedSecret) return cachedSecret;
  if (fromEnv) {
    loggingService.warn('JWT_SECRET is shorter than 32 characters; using a generated secret');
  }
  const stored = await SystemSecret.findOne({ name: 'jwt' }).select('+value').lean();
  if (stored?.value) {
    cachedSecret = stored.value;
    return cachedSecret;
  }
  // Two instances starting at once may both try; the unique name keeps whichever wins.
  await SystemSecret.updateOne(
    { name: 'jwt' },
    { $setOnInsert: { name: 'jwt', value: crypto.randomBytes(48).toString('hex') } },
    { upsert: true }
  );
  const created = await SystemSecret.findOne({ name: 'jwt' }).select('+value').lean();
  if (!created?.value) throw new Error('Could not establish a token-signing secret');
  loggingService.warn('JWT_SECRET is not set; generated a signing secret and stored it');
  cachedSecret = created.value;
  return cachedSecret;
}

/**
 * Passwords that were committed to the repository and so are known to anyone who has read it.
 * An account still using one is reported at boot; it must be changed.
 */
const COMPROMISED_PASSWORDS = ['loganPacey123!'];

export async function usesCompromisedPassword(passwordHash: string | undefined): Promise<boolean> {
  if (!passwordHash) return false;
  for (const known of COMPROMISED_PASSWORDS) {
    if (await bcrypt.compare(known, passwordHash)) return true;
  }
  return false;
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid email or password');
    this.name = 'InvalidCredentialsError';
  }
}

/** Verify email + password and issue a JWT. */
export async function login(input: LoginInput): Promise<LoginResult> {
  const email = input.email.trim().toLowerCase();
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !user.passwordHash) {
    throw new InvalidCredentialsError();
  }

  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) throw new InvalidCredentialsError();

  // Update last-login + clear the admin-visible plaintext invite password
  // (see User.pendingPlaintextPassword). Best-effort; failure shouldn't
  // block login.
  User.findByIdAndUpdate(user._id, {
    lastLogin: new Date(),
    $unset: { pendingPlaintextPassword: '' },
  }).catch(() => {
    /* ignore */
  });

  const token = await signToken(user);
  loggingService.info('User logged in', { userId: user._id.toString(), email, role: user.role });
  return { token, user: toAuthUser(user) };
}

/** Decode + verify a JWT and return the corresponding user. */
export async function userFromToken(token: string): Promise<AuthUser | null> {
  try {
    const payload = jwt.verify(token, await jwtSecret()) as { sub?: string };
    if (!payload?.sub) return null;
    const user = await User.findById(payload.sub);
    if (!user) return null;
    return toAuthUser(user);
  } catch {
    return null;
  }
}

/** Hash a password — used both by login seed + invite flow. */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/**
 * Generate a memorable random password: 4 alphanumeric segments separated by
 * dashes (e.g. "Tk3-9Wmn-Hp4r-Q8Aj"). Long enough to resist guessing,
 * readable enough to share over chat / email without typo trauma.
 */
export function generateRandomPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const segment = (n: number) =>
    Array.from({ length: n }, () => alphabet[crypto.randomInt(0, alphabet.length)]).join('');
  return `${segment(3)}-${segment(4)}-${segment(4)}-${segment(4)}`;
}

/** Set or replace a user's password. Returns nothing — the caller already has the user record. */
export async function setUserPassword(userId: string, plain: string): Promise<void> {
  const passwordHash = await hashPassword(plain);
  await User.findByIdAndUpdate(userId, { passwordHash, passwordSetAt: new Date() });
}

/**
 * Idempotent superadmin seed. Runs at boot.
 *   - If a user with SUPERADMIN_EMAIL exists, ensure role=administrator. The password is set
 *     only when the account has none, or when SUPERADMIN_RESET_PASSWORD=true, so a re-deploy
 *     does not reset a password the user has changed.
 *   - If no such user exists, create them with role=administrator.
 *
 * The password comes from SUPERADMIN_PASSWORD only. It used to default to a password committed
 * in this file; without the variable an account is created with no password and cannot sign in
 * until one is set.
 */
export async function seedSuperAdmin(): Promise<void> {
  const email = (process.env.SUPERADMIN_EMAIL || 'loganpacey@gmail.com').toLowerCase().trim();
  const password = process.env.SUPERADMIN_PASSWORD || '';
  const reset = (process.env.SUPERADMIN_RESET_PASSWORD || '').toLowerCase() === 'true';
  const firstName = process.env.SUPERADMIN_FIRST_NAME || 'Logan';
  const lastName = process.env.SUPERADMIN_LAST_NAME || 'Pacey';

  const existing = await User.findOne({ email }).select('+passwordHash');
  if (existing) {
    let dirty = false;
    if (existing.role !== 'administrator') {
      existing.role = 'administrator';
      dirty = true;
    }
    if (password && (!existing.passwordHash || reset)) {
      existing.passwordHash = await hashPassword(password);
      existing.passwordSetAt = new Date();
      dirty = true;
    }
    if (dirty) await existing.save();
    if (await usesCompromisedPassword(existing.passwordHash)) {
      loggingService.error(
        'The superadmin still uses a password that was committed to the repository. Set SUPERADMIN_PASSWORD and SUPERADMIN_RESET_PASSWORD=true, or change it.',
        { email }
      );
    }
    return;
  }

  await User.create({
    email,
    role: 'administrator',
    authProviderId: `local:${email}`,
    ...(password ? { passwordHash: await hashPassword(password), passwordSetAt: new Date() } : {}),
    invited: false,
    profile: { firstName, lastName },
  });
  loggingService.info('Seeded superadmin', { email, hasPassword: !!password });
}

// ---------- helpers ----------

async function signToken(user: IUser): Promise<string> {
  return jwt.sign(
    { sub: user._id.toString(), email: user.email, role: user.role },
    await jwtSecret(),
    { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
  );
}

function toAuthUser(user: IUser): AuthUser {
  return {
    id: user._id.toString(),
    email: user.email,
    role: user.role as UserRole,
    authProviderId: user.authProviderId,
  };
}
