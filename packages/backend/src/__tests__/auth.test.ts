import { UserRole } from '../types/auth';

describe('Authentication System', () => {
  describe('UserRole enum', () => {
    it('should have correct role values', () => {
      expect(UserRole.ADMINISTRATOR).toBe('administrator');
      expect(UserRole.SME).toBe('sme');
      expect(UserRole.STUDENT).toBe('student');
    });

    it('should have all three roles defined', () => {
      const roles = Object.values(UserRole);
      expect(roles).toHaveLength(3);
      expect(roles).toContain('administrator');
      expect(roles).toContain('sme');
      expect(roles).toContain('student');
    });
  });

  describe('Auth configuration', () => {
    it('should validate role strings', () => {
      const validRoles = ['administrator', 'sme', 'student'];
      
      validRoles.forEach(role => {
        expect(Object.values(UserRole)).toContain(role);
      });
    });

    it('should reject invalid roles', () => {
      const invalidRoles = ['admin', 'teacher', 'user', ''];
      
      invalidRoles.forEach(role => {
        expect(Object.values(UserRole)).not.toContain(role);
      });
    });
  });
});
