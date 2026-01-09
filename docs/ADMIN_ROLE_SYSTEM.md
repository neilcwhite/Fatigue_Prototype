# Admin Role System Implementation

## Overview

The Fatigue Management System now supports a 5-tier role-based access control (RBAC) system to manage user permissions and administrative functions.

## Role Hierarchy

From highest to lowest privileges:

### 1. Super Admin
**Full system access**
- Manage other administrators
- All admin permissions
- Override any restrictions
- System configuration

### 2. Admin
**System management**
- ✅ Archive/unarchive projects
- ✅ Delete projects (with safeguards)
- ✅ CSV user import with Sentinel validation
- ✅ Manage users and assignments
- ✅ View and manage all compliance data
- ✅ Create and manage FAMPs
- ❌ Cannot manage other admins or super admins

### 3. SHEQ (Safety, Health, Environment, Quality)
**Compliance and safety management**
- ✅ View all projects and compliance data
- ✅ Create and manage Fatigue Assessments (FAMPs)
- ✅ View all Network Rail compliance violations
- ✅ Generate compliance reports
- ❌ Cannot edit projects or assignments
- ❌ Read-only access to projects

### 4. Manager
**Project management**
- ✅ Create and edit own projects
- ✅ Assign employees to shifts
- ✅ View compliance for own projects
- ✅ View FAMPs for own projects
- ❌ Cannot view other managers' projects
- ❌ Cannot archive or delete projects

### 5. User
**Read-only access**
- ✅ View assigned projects only
- ✅ View own shift schedules
- ❌ Cannot edit anything
- ❌ Cannot view compliance data
- ❌ Cannot view FAMPs

## Database Schema Changes

### 1. User Profile - Expanded Role Types

```sql
-- user_profile.role column
ALTER TABLE user_profile
ADD CONSTRAINT user_profile_role_check
CHECK (role IN ('super_admin', 'admin', 'sheq', 'manager', 'user'));
```

**Migration:** Existing `viewer` roles → `user` roles

### 2. Projects - Archive Support

```sql
-- Soft delete functionality
ALTER TABLE projects
ADD COLUMN archived BOOLEAN DEFAULT FALSE;

-- Index for filtering
CREATE INDEX idx_projects_archived
ON projects(organisation_id, archived);
```

**Behavior:**
- Archived projects are hidden from non-admin users
- All associated FAMPs are also hidden
- Admins can toggle visibility of archived projects
- Data is preserved (soft delete, not hard delete)

### 3. Employees - Sentinel Numbers

```sql
-- External employee identifier
ALTER TABLE employees
ADD COLUMN sentinel_number VARCHAR(15);

-- Unique constraint within organisation
CREATE UNIQUE INDEX idx_employees_sentinel_org
ON employees(organisation_id, sentinel_number)
WHERE sentinel_number IS NOT NULL;

-- Format validation
ALTER TABLE employees
ADD CONSTRAINT employees_sentinel_format_check
CHECK (
  sentinel_number IS NULL OR
  (LENGTH(sentinel_number) BETWEEN 3 AND 15 AND sentinel_number ~ '^[A-Za-z0-9]+$')
);
```

**Sentinel Number Rules:**
- 3-15 characters long
- Alphanumeric only (A-Z, a-z, 0-9)
- Unique within organisation
- Not user-controlled (external system)
- Optional field

## Admin Features

### 1. Project Archiving

**Purpose:** Soft delete projects without losing data

**How it works:**
1. Admin clicks "Archive" on a project
2. Project `archived` field set to `true`
3. Project disappears from normal user views
4. All FAMPs associated with project also hidden
5. Admins can toggle "Show Archived" to view/restore

**UI Controls:**
- Archive button (admin only)
- "Show Archived Projects" toggle (admin only)
- Restore archived project button (admin only)

### 2. Project Deletion

**Purpose:** Permanently remove projects with safeguards

**Safeguards:**
- Admin must type project name to confirm
- Warning about permanent data loss
- Shows count of related data (employees, shifts, FAMPs)
- Confirmation dialog with clear messaging
- Cannot be undone

**Cascade behavior:**
- Deletes all assignments
- Deletes all shift patterns
- Deletes all associated FAMPs
- Archives employee records (doesn't delete employees)

### 3. CSV User Import

**Purpose:** Bulk import employees with Sentinel number validation

**CSV Format:**
```csv
name,sentinel_number,role,email
John Smith,ABC123,Engineer,john.smith@example.com
Jane Doe,XYZ789,Supervisor,jane.doe@example.com
```

**Required columns:**
- `name` - Employee full name
- `sentinel_number` - 3-15 alphanumeric characters

**Optional columns:**
- `role` - Job role/title
- `email` - Email address

**Import Logic:**

| Scenario | Action |
|----------|--------|
| Sentinel is new | ✅ Import employee |
| Sentinel exists + name matches | ⏭️ Skip (already exists) |
| Sentinel exists + name differs | ⚠️ Flag for admin review |

**Conflict Resolution:**
When Sentinel number exists but name differs, admin must review:
- Option 1: Skip (keep existing)
- Option 2: Update name
- Option 3: Create duplicate with warning

**Validation:**
- Checks for duplicate Sentinel numbers within CSV
- Validates Sentinel format (3-15 alphanumeric)
- Validates email format if provided
- Reports all errors before import

## Implementation Files

### Type Definitions
**File:** `src/lib/types.ts`

```typescript
// Role types
export type UserRole = 'super_admin' | 'admin' | 'sheq' | 'manager' | 'user';

// Permission interface
export interface RolePermissions {
  canViewArchived: boolean;
  canArchiveProjects: boolean;
  canDeleteProjects: boolean;
  canImportUsers: boolean;
  canManageRoles: boolean;
  canViewAllProjects: boolean;
  canEditAllProjects: boolean;
  canViewCompliance: boolean;
  canManageFAMPs: boolean;
}

// CSV import types
export interface CSVImportRow { /* ... */ }
export interface CSVImportResult { /* ... */ }
export interface CSVImportConflict { /* ... */ }
```

### Permission Utilities
**File:** `src/lib/permissions.ts`

```typescript
// Get permissions for role
getRolePermissions(role: UserRole): RolePermissions

// Check specific permission
hasPermission(role: UserRole, permission: keyof RolePermissions): boolean

// Role checks
isAdmin(role: UserRole): boolean
isSuperAdmin(role: UserRole): boolean

// Hierarchy checks
getRoleLevel(role: UserRole): number
hasHigherOrEqualRole(roleA: UserRole, roleB: UserRole): boolean

// Sentinel validation
isValidSentinelNumber(sentinel: string): boolean

// Display
formatRoleLabel(role: UserRole): string
```

### CSV Import Utilities
**File:** `src/lib/csvImport.ts`

```typescript
// Parse CSV file
parseCSV(csvContent: string): CSVImportRow[]

// Validate rows
validateCSVRows(rows: CSVImportRow[]): string[]

// Process against existing employees
processCSVImport(
  csvRows: CSVImportRow[],
  existingEmployees: Employee[]
): CSVImportResult

// Summary formatting
formatImportSummary(result: CSVImportResult): string

// Example CSV generation
generateExampleCSV(): string
```

### Database Migration
**File:** `database/migrations/add_admin_features.sql`

Complete SQL migration script with:
- Role enum updates
- Archived flag addition
- Sentinel number field
- Indexes and constraints
- Comments and documentation
- Rollback instructions

## Usage Examples

### Check if user can archive projects

```typescript
import { hasPermission } from '@/lib/permissions';

const userRole = user.role; // 'admin'
if (hasPermission(userRole, 'canArchiveProjects')) {
  // Show archive button
}
```

### Filter archived projects

```typescript
// For admins viewing archived projects
const projects = allProjects.filter(p =>
  showArchived ? true : !p.archived
);

// For non-admin users
const projects = allProjects.filter(p => !p.archived);
```

### Import users from CSV

```typescript
import { parseCSV, validateCSVRows, processCSVImport } from '@/lib/csvImport';

// Parse CSV file
const rows = parseCSV(fileContent);

// Validate
const errors = validateCSVRows(rows);
if (errors.length > 0) {
  // Show validation errors
  return;
}

// Process import
const result = processCSVImport(rows, existingEmployees);

// Handle conflicts
if (result.conflicts.length > 0) {
  // Show conflict resolution UI
}

// Import new employees
for (const row of result.imported) {
  await createEmployee({
    name: row.name,
    sentinel_number: row.sentinel_number,
    role: row.role,
    email: row.email,
  });
}
```

## Next Steps

### Phase 1: Backend Implementation ✅
- [x] Database schema updates
- [x] Type definitions
- [x] Permission utilities
- [x] CSV import utilities

### Phase 2: UI Components (Pending)
- [ ] Admin controls in Project View
  - [ ] Archive/Restore button
  - [ ] Delete button with confirmation
  - [ ] "Show Archived" toggle
- [ ] CSV Import modal
  - [ ] File upload
  - [ ] Preview table
  - [ ] Validation error display
  - [ ] Conflict resolution interface
- [ ] Role management UI
  - [ ] User list with roles
  - [ ] Role assignment dropdown
  - [ ] Permission indicator badges

### Phase 3: API Endpoints (Pending)
- [ ] `POST /api/projects/:id/archive`
- [ ] `POST /api/projects/:id/restore`
- [ ] `DELETE /api/projects/:id`
- [ ] `POST /api/employees/import-csv`
- [ ] `GET /api/users` (admin only)
- [ ] `PATCH /api/users/:id/role` (super admin only)

### Phase 4: Row Level Security (Pending)
- [ ] Update Supabase RLS policies
- [ ] Respect archived flag in queries
- [ ] Role-based project visibility
- [ ] FAMP visibility based on project archive status

## Security Considerations

1. **Role checks server-side:** Never trust client role - always verify on backend
2. **Cascade delete safeguards:** Require explicit confirmation for destructive actions
3. **Audit logging:** Track who archived/deleted projects and when
4. **Sentinel uniqueness:** Enforce at database level, not just application
5. **CSV validation:** Sanitize all inputs before database insertion
6. **Permission checks:** Use utility functions consistently across codebase

## Testing Checklist

- [ ] Role permissions work correctly for each tier
- [ ] Archived projects hidden from non-admins
- [ ] Archived projects visible to admins with toggle
- [ ] FAMPs hidden when parent project archived
- [ ] Delete confirmation requires exact project name
- [ ] CSV import handles all three scenarios correctly
- [ ] Sentinel number validation prevents invalid formats
- [ ] Duplicate Sentinel numbers within CSV detected
- [ ] Conflict resolution UI allows admin review
- [ ] Permission checks prevent unauthorized actions
