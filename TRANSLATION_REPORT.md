# OpusTrack Translation Report
**Translation: English → Spanish**
**Date:** 2025-10-28
**Key Changes:** VIC → CVV, Parts → Inventario

## Overview
This document tracks the translation progress for the OpusTrack application from English to Spanish. The translation focuses on **user-facing text only** while preserving all code, variable names, file names, and function names in English.

## Completed Translations

### ✅ Authentication & Core Pages (100%)
- **Login Page** (`/src/app/login/page.tsx`)
  - Form labels, placeholders, buttons
  - Error messages
  - Loading states

- **Signup Page** (`/src/app/signup/page.tsx`)
  - Redirect message
  - All UI text

- **Login Form Component** (`/src/components/login/login-form.component.tsx`)
  - Already translated to Spanish
  - Credentials hints in development mode

- **Auth Components**
  - Login form (`/src/components/auth/login-form.tsx`)
  - Logout button (`/src/components/auth/logout-button.tsx`) - Already in Spanish
  - Signup form (not used - account creation by admins only)

- **Unauthorized Page** (`/src/app/unauthorized/page.tsx`)
  - Access denied messages
  - Navigation links

- **Logout Page** (`/src/app/logout/page.tsx`)
  - Already in Spanish

### ✅ Client Dashboard & Pages (100%)
- **Client Dashboard** (`/src/app/client/page.tsx`)
  - Page title and descriptions: "Mis Incidentes", "Rastrea y reporta incidentes para tu CVV"
  - VIC → CVV throughout
  - Stats cards: "Incidentes Totales", "Abiertos", "En Progreso", "Resueltos"
  - Priority badges: Crítica, Alta, Media, Baja
  - Status badges: Abierto, En Progreso, Cerrado, Desconocido
  - Quick actions section
  - Empty states

- **Client New Incident Page** (`/src/app/client/new/page.tsx`)
  - Form title: "Reportar un Incidente"
  - All form labels: Título, Descripción, Prioridad, Tipo de Incidente
  - VIC → CVV in all references
  - Validation messages
  - Submit buttons: "Enviar Reporte", "Cancelar"
  - Error messages

- **Client Layout** (`/src/app/client/layout.tsx`)
  - Header: "Portal Cliente"

### ✅ FSR (Field Service Representative) Dashboard & Pages (100%)
- **FSR Dashboard** (`/src/app/fsr/page.tsx`)
  - Page title: "Panel FSR"
  - Welcome message: "¡Bienvenido de nuevo! Aquí está tu resumen de trabajo"
  - Stats: "Órdenes de Trabajo Totales", "No Iniciadas", "En Progreso", "Completadas"
  - VIC → CVV in all work order displays
  - Status badges: Completado, En Progreso, No Iniciado
  - Priority labels
  - Urgent work orders section
  - Quick actions

### ✅ Guest Dashboard (100%)
- **Guest Dashboard** (`/src/app/guest/page.tsx`)
  - Title: "Panel de Invitado"
  - Access restriction notice
  - Role badge: "Rol INVITADO"
  - Permissions lists (allowed/denied)
  - Help text

### ✅ Layout Components (100%)
- **Admin Sidebar** (`/src/components/layout/admin-sidebar.tsx`)
  - Already fully translated
  - VIC → CVV: "Centros CVV"
  - Parts → Inventario
  - All menu sections in Spanish

- **Client Sidebar** (`/src/components/layout/client-sidebar.tsx`)
  - "Mis Incidentes", "Reportar Incidente", "Mi Perfil"
  - Header: "Portal Cliente"

- **FSR Sidebar** (`/src/components/layout/fsr-sidebar.tsx`)
  - "Panel", "Órdenes de Trabajo", "Mi Perfil"
  - Header: "Portal FSR"

- **Guest/Invitado Sidebar** (`/src/components/layout/invitado-sidebar.tsx`)
  - "Mi Perfil"
  - Header: "Portal Invitado"

- **Theme Toggle** (`/src/components/layout/theme-toggle.tsx`)
  - "Claro", "Oscuro", "Sistema"

## Remaining Work

### 🔄 High Priority - Admin Section
The admin section is the largest and most complex area requiring translation:

#### Admin Dashboard & Main Pages
- [ ] `/src/app/admin/page.tsx` - Main admin dashboard
- [ ] `/src/app/admin/profile/page.tsx` - Admin profile page

#### User Management
- [ ] `/src/app/admin/users/page.tsx` - Users list
- [ ] `/src/app/admin/users/new/page.tsx` - Create user
- [ ] `/src/app/admin/users/[id]/page.tsx` - View user
- [ ] `/src/app/admin/users/[id]/edit/page.tsx` - Edit user
- [ ] `/src/app/admin/users/[id]/profile/page.tsx` - User profile
- [ ] `/src/components/admin/users/users-table.tsx` - Users table component
- [ ] `/src/components/admin/users/user-form.tsx` - User form component
- [ ] `/src/components/users/user-form.tsx` - Generic user form
- [ ] `/src/components/users/user-table.tsx` - Generic user table

#### Roles & Permissions
- [ ] `/src/app/admin/roles/page.tsx` - Roles list
- [ ] `/src/app/admin/roles/new/page.tsx` - Create role
- [ ] `/src/app/admin/roles/[id]/page.tsx` - View role
- [ ] `/src/app/admin/roles/[id]/edit/page.tsx` - Edit role
- [ ] `/src/app/admin/roles/[id]/permissions/page.tsx` - Role permissions
- [ ] `/src/app/admin/permissions/page.tsx` - Permissions list
- [ ] `/src/app/admin/permissions/new/page.tsx` - Create permission
- [ ] `/src/app/admin/permissions/[id]/page.tsx` - View permission
- [ ] `/src/app/admin/permissions/[id]/edit/page.tsx` - Edit permission
- [ ] `/src/components/admin/roles/role-form.tsx` - Role form
- [ ] `/src/components/admin/roles/roles-table.tsx` - Roles table
- [ ] `/src/components/admin/roles/permission-selector.tsx` - Permission selector
- [ ] `/src/components/roles/role-form.tsx` - Generic role form
- [ ] `/src/components/roles/role-table.tsx` - Generic role table
- [ ] `/src/components/roles/role-permissions.tsx` - Role permissions component
- [ ] `/src/components/permissions/permission-form.tsx` - Permission form
- [ ] `/src/components/permissions/permission-table.tsx` - Permission table

#### CVV Centers (VIC → CVV)
**Critical:** All "VIC" references must become "CVV" (Centro de Verificación Vehicular)
- [ ] `/src/app/admin/vic-centers/page.tsx` - CVV centers list
- [ ] `/src/app/admin/vic-centers/new/page.tsx` - Create CVV center
- [ ] `/src/app/admin/vic-centers/[id]/page.tsx` - View CVV center
- [ ] `/src/app/admin/vic-centers/[id]/edit/page.tsx` - Edit CVV center
- [ ] `/src/components/admin/vics/vics-table.tsx` - CVVs table **VIC → CVV**
- [ ] `/src/components/admin/vics/vic-form.tsx` - CVV form **VIC → CVV**
- [ ] `/src/components/vic-centers/vic-center-form.tsx` - CVV center form **VIC → CVV**
- [ ] `/src/components/vic-centers/vic-center-table.tsx` - CVV center table **VIC → CVV**

#### Incidents
- [ ] `/src/app/admin/incidents/page.tsx` - Incidents list
- [ ] `/src/app/admin/incidents/new/page.tsx` - Create incident
- [ ] `/src/app/admin/incidents/[id]/page.tsx` - View incident (contains "VIC" and "Parts")
- [ ] `/src/app/admin/incidents/[id]/edit/page.tsx` - Edit incident
- [ ] `/src/app/admin/incidents/incident-form.tsx` - Incident form
- [ ] `/src/app/admin/incidents/work-order-form.tsx` - Work order form
- [ ] `/src/components/admin/incidents/incidents-table.tsx` - Incidents table
- [ ] `/src/components/admin/incidents/incident-form.tsx` - Admin incident form
- [ ] `/src/components/incidents/incident-form.tsx` - Generic incident form
- [ ] `/src/components/incidents/incident-table.tsx` - Generic incident table
- [ ] `/src/components/incidents/incident-filters.tsx` - Incident filters

#### Incident Types & Status
- [ ] `/src/app/admin/incident-types/page.tsx` - Incident types list
- [ ] `/src/app/admin/incident-types/new/page.tsx` - Create incident type
- [ ] `/src/app/admin/incident-types/[id]/page.tsx` - View incident type
- [ ] `/src/app/admin/incident-types/[id]/edit/page.tsx` - Edit incident type
- [ ] `/src/app/admin/incident-status/page.tsx` - Incident status list
- [ ] `/src/app/admin/incident-status/new/page.tsx` - Create incident status
- [ ] `/src/app/admin/incident-status/[id]/page.tsx` - View incident status
- [ ] `/src/app/admin/incident-status/[id]/edit/page.tsx` - Edit incident status
- [ ] `/src/components/incident-types/incident-type-form.tsx` - Incident type form
- [ ] `/src/components/incident-types/incident-type-table.tsx` - Incident type table
- [ ] `/src/components/incident-status/incident-status-form.tsx` - Incident status form
- [ ] `/src/components/incident-status/incident-status-table.tsx` - Incident status table

#### Work Orders
- [ ] `/src/app/admin/work-orders/page.tsx` - Work orders list
- [ ] `/src/app/admin/work-orders/new/page.tsx` - Create work order
- [ ] `/src/app/admin/work-orders/[id]/page.tsx` - View work order (contains "Parts")
- [ ] `/src/app/admin/work-orders/[id]/edit/page.tsx` - Edit work order
- [ ] `/src/app/fsr/work-orders/page.tsx` - FSR work orders (contains "VIC" and "Parts")
- [ ] `/src/app/fsr/work-orders/[id]/page.tsx` - FSR work order detail (contains "VIC" and "Parts")
- [ ] `/src/components/admin/work-orders/work-orders-table.tsx` - Work orders table
- [ ] `/src/components/admin/work-orders/work-order-form.tsx` - Work order form
- [ ] `/src/components/work-orders/work-order-form.tsx` - Generic work order form
- [ ] `/src/components/work-orders/work-order-form-enhanced.tsx` - Enhanced work order form
- [ ] `/src/components/work-orders/work-order-edit-form.tsx` - Work order edit form
- [ ] `/src/components/work-orders/work-order-table.tsx` - Work order table
- [ ] `/src/components/work-orders/work-order-filters.tsx` - Work order filters
- [ ] `/src/components/work-orders/work-order-stats.tsx` - Work order stats

#### Work Activities
- [ ] `/src/app/admin/work-activities/page.tsx` - Work activities list
- [ ] `/src/app/admin/work-activities/new/page.tsx` - Create work activity
- [ ] `/src/app/admin/work-activities/[id]/page.tsx` - View work activity (contains "Parts")
- [ ] `/src/app/admin/work-activities/[id]/edit/page.tsx` - Edit work activity
- [ ] `/src/components/work-activities/work-activity-table.tsx` - Work activities table (contains "Parts")
- [ ] `/src/components/work-activities/new-work-activity-form.tsx` - New work activity form
- [ ] `/src/components/work-activities/new-work-activity-wrapper.tsx` - Work activity wrapper
- [ ] `/src/components/work-orders/work-activity-form.tsx` - Work activity form
- [ ] `/src/components/work-orders/work-activity-edit.tsx` - Work activity edit

#### Inventario (Parts → Inventario)
**Critical:** All "Parts" references must become "Inventario"
- [ ] `/src/app/admin/parts/page.tsx` - Parts list **Parts → Inventario**
- [ ] `/src/app/admin/parts/new/page.tsx` - Create part **Parts → Inventario**
- [ ] `/src/app/admin/parts/[id]/edit/page.tsx` - Edit part **Parts → Inventario**
- [ ] `/src/components/admin/parts/parts-table.tsx` - Parts table **Parts → Inventario**
- [ ] `/src/components/admin/parts/part-form.tsx` - Part form **Parts → Inventario**
- [ ] `/src/components/parts/part-form.tsx` - Generic part form **Parts → Inventario**
- [ ] `/src/components/parts/part-table.tsx` - Generic part table **Parts → Inventario**

#### Work Parts
- [ ] `/src/app/admin/work-parts/page.tsx` - Work parts list (contains "Parts")
- [ ] `/src/app/admin/work-parts/new/page.tsx` - Create work part (contains "VIC")
- [ ] `/src/app/admin/work-parts/[id]/page.tsx` - View work part
- [ ] `/src/app/admin/work-parts/[id]/edit/page.tsx` - Edit work part (contains "VIC")
- [ ] `/src/components/work-parts/work-part-table.tsx` - Work parts table
- [ ] `/src/components/work-parts/work-part-form.tsx` - Work part form
- [ ] `/src/components/work-parts/work-part-filters.tsx` - Work part filters
- [ ] `/src/components/work-orders/work-part-form.tsx` - Work order part form (contains "Parts")
- [ ] `/src/components/work-orders/work-part-edit.tsx` - Work part edit

#### Schedules & States
- [ ] `/src/app/admin/schedules/page.tsx` - Schedules list (contains "VIC")
- [ ] `/src/app/admin/schedules/new/page.tsx` - Create schedule (contains "VIC")
- [ ] `/src/app/admin/schedules/[id]/page.tsx` - View schedule (contains "VIC")
- [ ] `/src/app/admin/schedules/[id]/edit/page.tsx` - Edit schedule (contains "VIC")
- [ ] `/src/app/admin/states/page.tsx` - States list (contains "VIC")
- [ ] `/src/app/admin/states/new/page.tsx` - Create state
- [ ] `/src/app/admin/states/[id]/page.tsx` - View state (contains "VIC")
- [ ] `/src/app/admin/states/[id]/edit/page.tsx` - Edit state
- [ ] `/src/components/schedules/schedule-form.tsx` - Schedule form (contains "VIC")
- [ ] `/src/components/schedules/schedule-table.tsx` - Schedule table (contains "VIC")
- [ ] `/src/components/states/state-form.tsx` - State form
- [ ] `/src/components/states/state-table.tsx` - State table (contains "VIC")

#### User Status
- [ ] `/src/app/admin/user-status/page.tsx` - User status list
- [ ] `/src/app/admin/user-status/new/page.tsx` - Create user status
- [ ] `/src/app/admin/user-status/[id]/page.tsx` - View user status
- [ ] `/src/app/admin/user-status/[id]/edit/page.tsx` - Edit user status
- [ ] `/src/components/user-status/user-status-form.tsx` - User status form
- [ ] `/src/components/user-status/user-status-table.tsx` - User status table

### 🔄 Medium Priority - Shared Components

#### Profile
- [ ] `/src/app/profile/page.tsx` - User profile page (contains "VIC")
- [ ] `/src/components/user-profiles/user-profile-form.tsx` - User profile form

#### Common UI Components
- [ ] `/src/components/common/pagination.tsx` - Pagination component
- [ ] `/src/components/common/table-pagination.tsx` - Table pagination

#### File Management
- [ ] `/src/components/ui/file-upload.tsx` - File upload component
- [ ] `/src/components/work-orders/attachment-preview.tsx` - Attachment preview

#### Loading States
- [ ] `/src/app/admin/incident-status/loading.tsx`
- [ ] `/src/app/admin/incidents/loading.tsx`
- [ ] `/src/app/admin/permissions/loading.tsx`
- [ ] `/src/app/admin/work-orders/loading.tsx`
- [ ] `/src/app/admin/work-orders/new/loading.tsx`
- [ ] `/src/app/admin/work-parts/loading.tsx`
- [ ] `/src/app/client/loading.tsx`
- [ ] `/src/app/client/new/loading.tsx`
- [ ] `/src/app/incidents/loading.tsx`

### 🔄 Low Priority - Backend/Actions
These files may contain error messages or user-facing text:
- [ ] `/src/lib/actions/incidents.ts` - Incident actions (contains "VIC")
- [ ] `/src/lib/actions/lookups.ts` - Lookup actions (contains "VIC")
- [ ] `/src/lib/actions/vics.ts` - VIC actions **VIC → CVV**
- [ ] `/src/lib/validations.ts` - Validation messages (contains "VIC")

## Translation Guidelines

### Key Replacements
1. **VIC → CVV**: Vehicle Inspection Center → Centro de Verificación Vehicular
   - "VIC" → "CVV"
   - "VIC Center" → "Centro CVV"
   - "Your VIC" → "Tu CVV"

2. **Parts → Inventario**: Parts inventory management
   - "Parts" → "Inventario"
   - "Part" → "Parte"

### Common Translations
- Work Order → Orden de Trabajo
- Schedule → Calendario/Horario
- Incident → Incidente
- User → Usuario
- Dashboard → Panel
- Profile → Perfil
- Settings → Configuración
- Status → Estado
- Priority → Prioridad
- Description → Descripción
- Edit → Editar
- Delete → Eliminar
- View → Ver
- Create/Add → Crear/Agregar
- Save → Guardar
- Cancel → Cancelar
- Back → Volver
- Loading → Cargando
- Submit → Enviar

### What NOT to Translate
- Code/variable names
- File paths
- Function names
- Database field names
- API endpoints
- Comments in code (optional)
- Environment variables
- CSS class names
- Component names

## Files by Priority Summary

### Completed: 22 files
- Authentication: 6 files
- Client: 3 files
- FSR: 1 file
- Guest: 1 file
- Layout: 5 files
- Common: 6 files

### Remaining: ~150+ files
- Admin section: ~100+ files (highest priority)
- Components: ~40+ files
- Actions/Backend: ~10+ files

## Recommended Approach for Completion

### Phase 1: Critical Admin Pages (1-2 days)
1. Translate admin dashboard
2. Translate CVV (VIC) center pages and components
3. Translate Inventario (Parts) pages and components
4. Translate user management pages

### Phase 2: Work Management (1-2 days)
1. Translate work orders pages
2. Translate work activities pages
3. Translate work parts pages
4. Translate incident pages

### Phase 3: Configuration & Lookups (1 day)
1. Translate roles & permissions
2. Translate incident types & status
3. Translate user status
4. Translate schedules & states

### Phase 4: Shared Components & Polish (0.5-1 day)
1. Translate common components
2. Translate file upload & attachment components
3. Translate loading states
4. Review and quality check

## Testing Checklist
After translation, test:
- [ ] Login flow
- [ ] Client can report incident
- [ ] FSR can view work orders
- [ ] Guest sees restricted access
- [ ] Admin can navigate all sections
- [ ] CVV (not VIC) appears throughout
- [ ] Inventario (not Parts) appears throughout
- [ ] All buttons and labels are in Spanish
- [ ] No English text in user-facing areas
- [ ] Forms validate with Spanish messages
- [ ] Theme toggle works in Spanish

## Notes
- This translation preserves all technical implementation
- Database schema remains unchanged
- API routes remain in English
- Only user-facing text has been translated
- VIC → CVV is critical for Mexican market
- Parts → Inventario aligns with business terminology
