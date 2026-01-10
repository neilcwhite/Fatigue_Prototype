'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { Eye, AlertTriangle } from '@/components/ui/Icons';
import type { UserRole } from '@/lib/types';
import { formatRoleLabel } from '@/lib/permissions';

interface RoleImpersonationDropdownProps {
  currentRole: UserRole;
  impersonatedRole: UserRole | null;
  onRoleChange: (role: UserRole | null) => void;
}

const AVAILABLE_ROLES: UserRole[] = ['super_admin', 'admin', 'sheq', 'manager', 'user'];

export function RoleImpersonationDropdown({
  currentRole,
  impersonatedRole,
  onRoleChange,
}: RoleImpersonationDropdownProps) {
  const isImpersonating = impersonatedRole !== null;
  const displayRole = impersonatedRole || currentRole;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {isImpersonating && (
        <Chip
          icon={<Eye className="w-4 h-4" />}
          label="Viewing As"
          size="small"
          color="warning"
          sx={{
            fontWeight: 600,
            animation: 'pulse 2s ease-in-out infinite',
            '@keyframes pulse': {
              '0%, 100%': { opacity: 1 },
              '50%': { opacity: 0.7 },
            },
          }}
        />
      )}

      <FormControl size="small" sx={{ minWidth: 150 }}>
        <Select
          value={displayRole}
          onChange={(e) => {
            const newRole = e.target.value as UserRole;
            // If selecting the current role, clear impersonation
            onRoleChange(newRole === currentRole ? null : newRole);
          }}
          sx={{
            bgcolor: isImpersonating ? 'warning.50' : 'background.paper',
            border: isImpersonating ? '2px solid' : '1px solid',
            borderColor: isImpersonating ? 'warning.main' : 'divider',
            '& .MuiOutlinedInput-notchedOutline': {
              border: 'none',
            },
            '&:hover': {
              bgcolor: isImpersonating ? 'warning.100' : 'action.hover',
            },
          }}
        >
          {AVAILABLE_ROLES.map((role) => (
            <MenuItem key={role} value={role}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                <Typography variant="body2" sx={{ flex: 1 }}>
                  {formatRoleLabel(role)}
                </Typography>
                {role === currentRole && (
                  <Chip label="Your Role" size="small" color="primary" sx={{ height: 20 }} />
                )}
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {isImpersonating && (
        <AlertTriangle className="w-5 h-5 text-warning-main" />
      )}
    </Box>
  );
}
