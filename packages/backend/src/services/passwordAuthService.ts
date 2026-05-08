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
import { UserRole, AuthUser } from '../types/auth';
import { loggingService } from './loggingService';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me-in-production';
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

  // Update last-login best-effort; failure here shouldn't block login
  User.findByIdAndUpdate(user._id, { lastLogin: new Date() }).catch(() => {
    /* ignore */
  });

  const token = signToken(user);
  loggingService.info('User logged in', { userId: user._id.toString(), email, role: user.role });
  return { token, user: toAuthUser(user) };
}

/** Decode + verify a JWT and return the corresponding user. */
export async function userFromToken(token: string): Promise<AuthUser | null> {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub?: string };
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
 *   - If a user with SUPERADMIN_EMAIL exists, ensure role=administrator.
 *     Reset password ONLY if the user doesn't have one yet, so re-deploys
 *     don't reset a password the user has already changed.
 *   - If no such user exists, create them with role=administrator.
 */
export async function seedSuperAdmin(): Promise<void> {
  const email = (process.env.SUPERADMIN_EMAIL || 'loganpacey@gmail.com').toLowerCase().trim();
  const password = process.env.SUPERADMIN_PASSWORD || 'loganPacey123!';
  const firstName = process.env.SUPERADMIN_FIRST_NAME || 'Logan';
  const lastName = process.env.SUPERADMIN_LAST_NAME || 'Pacey';

  const existing = await User.findOne({ email }).select('+passwordHash');
  if (existing) {
    let dirty = false;
    if (existing.role !== 'administrator') {
      existing.role = 'administrator';
      dirty = true;
    }
    if (!existing.passwordHash) {
      existing.passwordHash = await hashPassword(password);
      existing.passwordSetAt = new Date();
      dirty = true;
    }
    if (dirty) await existing.save();
    return;
  }

  const passwordHash = await hashPassword(password);
  await User.create({
    email,
    role: 'administrator',
    authProviderId: `local:${email}`,
    passwordHash,
    passwordSetAt: new Date(),
    invited: false,
    profile: { firstName, lastName },
  });
  loggingService.info('Seeded superadmin', { email });
}

// ---------- helpers ----------

function signToken(user: IUser): string {
  return jwt.sign({ sub: user._id.toString(), email: user.email, role: user.role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

function toAuthUser(user: IUser): AuthUser {
  return {
    id: user._id.toString(),
    email: user.email,
    role: user.role as UserRole,
    authProviderId: user.authProviderId,
  };
}
