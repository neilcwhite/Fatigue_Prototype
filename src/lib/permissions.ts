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

import type { UserRole, RolePermissions, ProjectMemberRole, ProjectMemberCamel } from './types';

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

// ==================== PROJECT ACCESS CONTROL ====================

/**
 * Check if a user's role bypasses project-level access control
 * (i.e., they can see all projects regardless of project_members)
 */
export function roleBypassesProjectAccess(role: UserRole): boolean {
  return hasPermission(role, 'canViewAllProjects');
}

/**
 * Check if a user can access a specific project
 * @param userRole - The user's global role
 * @param projectId - The project to check access for
 * @param projectMembers - The user's project memberships
 */
export function canUserAccessProject(
  userRole: UserRole,
  projectId: number,
  projectMembers: ProjectMemberCamel[]
): boolean {
  // Roles with canViewAllProjects bypass project-level access
  if (roleBypassesProjectAccess(userRole)) {
    return true;
  }

  // Check if user is a member of this project
  return projectMembers.some(pm => pm.projectId === projectId);
}

/**
 * Get a user's role on a specific project
 * Returns undefined if user has no direct project membership
 */
export function getUserProjectRole(
  projectId: number,
  projectMembers: ProjectMemberCamel[]
): ProjectMemberRole | undefined {
  const membership = projectMembers.find(pm => pm.projectId === projectId);
  return membership?.memberRole;
}

/**
 * Check if user can edit a specific project
 * Requires editor or manager role on the project, OR canEditAllProjects permission
 */
export function canUserEditProject(
  userRole: UserRole,
  projectId: number,
  projectMembers: ProjectMemberCamel[]
): boolean {
  // Roles with canEditAllProjects can edit any project
  if (hasPermission(userRole, 'canEditAllProjects')) {
    return true;
  }

  // Check project-level role
  const projectRole = getUserProjectRole(projectId, projectMembers);
  return projectRole === 'editor' || projectRole === 'manager';
}

/**
 * Check if user can manage a specific project (add/remove members)
 * Requires manager role on the project, OR admin-level permissions
 */
export function canUserManageProject(
  userRole: UserRole,
  projectId: number,
  projectMembers: ProjectMemberCamel[]
): boolean {
  // Admins can manage any project
  if (isAdmin(userRole)) {
    return true;
  }

  // Check for manager role on this specific project
  const projectRole = getUserProjectRole(projectId, projectMembers);
  return projectRole === 'manager';
}

/**
 * Filter a list of projects to only those the user can access
 */
export function filterAccessibleProjects<T extends { id: number }>(
  projects: T[],
  userRole: UserRole,
  projectMembers: ProjectMemberCamel[]
): T[] {
  // Roles with canViewAllProjects see everything
  if (roleBypassesProjectAccess(userRole)) {
    return projects;
  }

  // Filter to only projects user is a member of
  const accessibleProjectIds = new Set(projectMembers.map(pm => pm.projectId));
  return projects.filter(p => accessibleProjectIds.has(p.id));
}

/**
 * Format project member role for display
 */
export function formatProjectRoleLabel(role: ProjectMemberRole): string {
  const labels: Record<ProjectMemberRole, string> = {
    viewer: 'Viewer',
    editor: 'Editor',
    manager: 'Manager',
  };
  return labels[role];
}
