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
 * Invite a faculty member to the allowlist.
 * Creates a User record with role=faculty, invited=true, and a placeholder
 * authProviderId of `pending:<email>`. On their first Auth0 login, the auth
 * middleware will replace `authProviderId` with the real Auth0 sub.
 *
 * Idempotent: if the email already exists, returns the existing user without
 * re-creating it (status: "exists"); otherwise creates and returns
 * (status: "invited").
 */
export async function inviteFaculty(
  email: string,
  invitedByUserId?: string,
  profile?: { firstName?: string; lastName?: string; organization?: string }
): Promise<{ user: AuthUser; status: 'invited' | 'exists' }> {
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return { user: toAuthUser(existing), status: 'exists' };
  }
  const user = new User({
    email: email.toLowerCase(),
    role: UserRole.FACULTY,
    authProviderId: `pending:${email.toLowerCase()}`,
    invited: true,
    invitedBy: invitedByUserId || undefined,
    invitedAt: new Date(),
    profile: profile || {},
  });
  await user.save();
  return { user: toAuthUser(user), status: 'invited' };
}
