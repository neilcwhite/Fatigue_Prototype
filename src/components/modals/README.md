# Modal Components

This folder contains all modal dialog components.

## Components to Create

### Modal.tsx
Base modal wrapper component.
- Overlay background
- Centered content
- Close on escape/outside click

### ProjectModal.tsx
Create/edit project dialog.
- Name, location, type fields
- Date pickers for start/end
- Save/Cancel buttons

### AssignmentModal.tsx
Create shift assignment dialog.
- Employee selector (multi-select)
- Shift pattern selector
- Date range picker

### ShiftPatternModal.tsx
Create/edit shift pattern dialog.
- Simple mode (single start/end time)
- Weekly mode (different times per day)
- Duty type selector
- Night shift toggle
- Fatigue parameters

### TeamModal.tsx
Create/edit team dialog.
- Team name
- Employee multi-select

### ImportModal.tsx
Excel import dialog.
- File upload
- Preview table
- Validation errors
- Import button

### ExportModal.tsx
Export options dialog.
- Date range selection
- Format options

### ManualOverrideModal.tsx
Override shift times for specific assignment.
- Custom start/end time
- Notes field

## Reference
See `fatigue-management-v76.html` for original modal implementations.
