import { User, IUser } from '../models/User';
import { AuthUser, UserRole } from '../types/auth';

interface CreateUserInput {
  email: string;
  role: UserRole;
  authProviderId: string;
}

/**
 * Convert Mongoose User document to AuthUser
 */
function toAuthUser(user: IUser): AuthUser {
  return {
    id: user._id.toString(),
    email: user.email,
    // Mongoose's literal-union role widens to the IUser declared union; the
    // enum's runtime values match exactly, so the cast is safe.
    role: user.role as UserRole,
    authProviderId: user.authProviderId,
  };
}

/**
 * Get user by Auth0 provider ID
 */
export async function getUserByAuthProviderId(authProviderId: string): Promise<AuthUser | null> {
  const user = await User.findOne({ authProviderId });

  if (!user) {
    return null;
  }

  return toAuthUser(user);
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<AuthUser | null> {
  const user = await User.findById(userId);

  if (!user) {
    return null;
  }

  return toAuthUser(user);
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<AuthUser | null> {
  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    return null;
  }

  return toAuthUser(user);
}

/**
 * Create a new user
 */
export async function createUser(input: CreateUserInput): Promise<AuthUser> {
  const user = new User({
    email: input.email.toLowerCase(),
    role: input.role,
    authProviderId: input.authProviderId,
  });

  await user.save();

  return toAuthUser(user);
}

/**
 * Update user role
 */
export async function updateUserRole(userId: string, role: UserRole): Promise<AuthUser | null> {
  const user = await User.findByIdAndUpdate(userId, { role }, { new: true });

  if (!user) {
    return null;
  }

  return toAuthUser(user);
}

/**
 * Update last login timestamp
 */
export async function updateLastLogin(userId: string): Promise<void> {
  await User.findByIdAndUpdate(userId, { lastLogin: new Date() });
}

/**
 * Delete user
 */
export async function deleteUser(userId: string): Promise<boolean> {
  const result = await User.findByIdAndDelete(userId);
  return result !== null;
}

/**
 * List all users (admin only)
 */
export async function listUsers(
  limit: number = 50,
  offset: number = 0,
  filter: { role?: UserRole } = {}
): Promise<{ users: AuthUser[]; total: number }> {
  const query: any = {};
  if (filter.role) query.role = filter.role;
  const [users, total] = await Promise.all([
    User.find(query).sort({ createdAt: -1 }).limit(limit).skip(offset),
    User.countDocuments(query),
  ]);

  return {
    users: users.map(toAuthUser),
    total,
  };
}

/**
 * Invite a faculty member.
 *
 * Creates a User with role=faculty + a freshly-generated password and returns
 * the plaintext ONCE so the caller (admin UI) can show it and have the admin
 * pass it to the faculty member. Only the bcrypt hash is stored.
 *
 * If the email already exists:
 *   - and they have no password → generate one (rare — covers Auth0-imported users)
 *   - otherwise return status "exists" without changing the password.
 */
export async function inviteFaculty(
  email: string,
  invitedByUserId?: string,
  profile?: { firstName?: string; lastName?: string; organization?: string }
): Promise<{
  user: AuthUser;
  status: 'invited' | 'exists' | 'password_generated';
  generatedPassword?: string;
}> {
  // Lazy-import to avoid a circular dep with passwordAuthService
  const { generateRandomPassword, hashPassword } = await import('./passwordAuthService');

  const existing = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (existing) {
    if (!existing.passwordHash) {
      const plain = generateRandomPassword();
      existing.passwordHash = await hashPassword(plain);
      existing.passwordSetAt = new Date();
      // Promote role to faculty if the existing record was a placeholder
      if (existing.role === 'sme' || existing.role === 'student') existing.role = UserRole.FACULTY;
      await existing.save();
      return { user: toAuthUser(existing), status: 'password_generated', generatedPassword: plain };
    }
    return { user: toAuthUser(existing), status: 'exists' };
  }

  const plain = generateRandomPassword();
  const user = new User({
    email: email.toLowerCase(),
    role: UserRole.FACULTY,
    authProviderId: `local:${email.toLowerCase()}`,
    passwordHash: await hashPassword(plain),
    passwordSetAt: new Date(),
    invited: true,
    invitedBy: invitedByUserId || undefined,
    invitedAt: new Date(),
    profile: profile || {},
  });
  await user.save();
  return { user: toAuthUser(user), status: 'invited', generatedPassword: plain };
}
