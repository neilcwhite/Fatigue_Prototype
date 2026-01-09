/**
 * ROLE-BASED ACCESS CONTROL (RBAC)
 *
 * 5-tier role hierarchy:
 * 1. super_admin - Full system access, manage other admins
 * 2. admin - Archive/delete projects, CSV import, manage users
 * 3. sheq - View compliance data, manage FAMPs, read-only
 * 4. manager - Create/edit projects, assign employees
 * 5. user - Read-only, view assigned projects only
 */

import type { UserRole, RolePermissions } from './types';

/**
 * Get permissions for a given role
 */
export function getRolePermissions(role: UserRole): RolePermissions {
  switch (role) {
    case 'super_admin':
      return {
        canViewArchived: true,
        canArchiveProjects: true,
        canDeleteProjects: true,
        canImportUsers: true,
        canManageRoles: true,
        canViewAllProjects: true,
        canEditAllProjects: true,
        canViewCompliance: true,
        canManageFAMPs: true,
      };

    case 'admin':
      return {
        canViewArchived: true,
        canArchiveProjects: true,
        canDeleteProjects: true,
        canImportUsers: true,
        canManageRoles: false,  // Cannot manage other admins
        canViewAllProjects: true,
        canEditAllProjects: true,
        canViewCompliance: true,
        canManageFAMPs: true,
      };

    case 'sheq':
      return {
        canViewArchived: false,
        canArchiveProjects: false,
        canDeleteProjects: false,
        canImportUsers: false,
        canManageRoles: false,
        canViewAllProjects: true,  // Can view all for compliance
        canEditAllProjects: false,  // Read-only
        canViewCompliance: true,
        canManageFAMPs: true,  // Can create and manage FAMPs
      };

    case 'manager':
      return {
        canViewArchived: false,
        canArchiveProjects: false,
        canDeleteProjects: false,
        canImportUsers: false,
        canManageRoles: false,
        canViewAllProjects: false,  // Only own projects
        canEditAllProjects: false,  // Only own projects
        canViewCompliance: true,  // Own projects only
        canManageFAMPs: false,  // Can view but not create
      };

    case 'user':
    default:
      return {
        canViewArchived: false,
        canArchiveProjects: false,
        canDeleteProjects: false,
        canImportUsers: false,
        canManageRoles: false,
        canViewAllProjects: false,
        canEditAllProjects: false,
        canViewCompliance: false,  // Read-only viewer
        canManageFAMPs: false,
      };
  }
}

/**
 * Check if a role has a specific permission
 */
export function hasPermission(
  role: UserRole,
  permission: keyof RolePermissions
): boolean {
  const permissions = getRolePermissions(role);
  return permissions[permission];
}

/**
 * Check if role is admin level or higher
 */
export function isAdmin(role: UserRole): boolean {
  return role === 'super_admin' || role === 'admin';
}

/**
 * Check if role is super admin
 */
export function isSuperAdmin(role: UserRole): boolean {
  return role === 'super_admin';
}

/**
 * Get role hierarchy level (higher number = more permissions)
 */
export function getRoleLevel(role: UserRole): number {
  const levels: Record<UserRole, number> = {
    super_admin: 5,
    admin: 4,
    sheq: 3,
    manager: 2,
    user: 1,
  };
  return levels[role];
}

/**
 * Check if role A has higher or equal permissions than role B
 */
export function hasHigherOrEqualRole(roleA: UserRole, roleB: UserRole): boolean {
  return getRoleLevel(roleA) >= getRoleLevel(roleB);
}

/**
 * Validate Sentinel number format
 * Rules: 3-15 characters, alphanumeric only
 */
export function isValidSentinelNumber(sentinel: string): boolean {
  if (!sentinel) return false;
  const length = sentinel.length;
  if (length < 3 || length > 15) return false;
  return /^[A-Za-z0-9]+$/.test(sentinel);
}

/**
 * Format role for display
 */
export function formatRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    sheq: 'SHEQ',
    manager: 'Manager',
    user: 'User',
  };
  return labels[role];
}
