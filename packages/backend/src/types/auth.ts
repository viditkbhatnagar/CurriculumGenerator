export enum UserRole {
  ADMINISTRATOR = 'administrator',
  SME = 'sme',
  STUDENT = 'student',
}

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  authProviderId: string;
}

export interface JWTPayload {
  sub: string;
  email?: string;
  [key: string]: any;
}
