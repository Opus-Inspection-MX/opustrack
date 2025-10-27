# OpusTrack System Demo Guide

**Vehicle Inspection Center Incident & Work Order Management System**

---

## 🎯 System Overview

OpusTrack is a professional incident management and work order tracking system designed specifically for Vehicle Inspection Centers (VICs) in Mexico. The system provides complete lifecycle management from incident reporting to work order completion.

### Key Features
- 🔒 **Role-Based Access Control** - 4 distinct user roles with granular permissions
- 📱 **Mobile-Friendly** - Responsive design with mobile photo capture
- 📊 **Real-Time Tracking** - Monitor incidents and work orders in real-time
- 📎 **File Attachments** - Upload photos, videos, and documents (HEIC support for iPhone)
- 🔄 **Complete Workflow** - From incident creation to resolution

---

## 👥 User Roles & Access Levels

```mermaid
graph TD
    A[OpusTrack System] --> B[ADMINISTRADOR]
    A --> C[FSR]
    A --> D[CLIENT]
    A --> E[GUEST]

    B --> B1[Full System Access]
    B --> B2[All CRUD Operations]
    B --> B3[User & Role Management]

    C --> C1[Work Order Management]
    C --> C2[Activity Tracking]
    C --> C3[Parts Management]

    D --> D1[Create Incidents]
    D --> D2[View Work Orders]
    D --> D3[Schedule Viewing]

    E --> E1[Read-Only Access]
    E --> E2[View Incidents]
    E --> E3[View Reports]

    style B fill:#ff6b6b
    style C fill:#4ecdc4
    style D fill:#95e1d3
    style E fill:#ffd93d
```

### Role Descriptions

| Role | Access Level | Primary Use Case | VIC Association |
|------|--------------|------------------|-----------------|
| **ADMINISTRADOR** | Full Access | System configuration, user management | ❌ Not VIC-specific |
| **FSR** | Management | Field service, work execution | ✅ Assigned to VIC |
| **CLIENT** | Create & View | Report incidents, track progress | ✅ From specific VIC |
| **GUEST** | Read Only | View-only access, reporting | ❌ Not VIC-specific |

---

## 🔄 System Workflow

```mermaid
sequenceDiagram
    participant Client as CLIENT User
    participant System as OpusTrack
    participant Admin as ADMINISTRADOR
    participant FSR as FSR Technician

    Client->>System: 1. Create Incident
    Note over Client,System: Report issue with photo/video

    System->>Admin: 2. Notify New Incident
    Admin->>System: 3. Create Work Order
    Note over Admin,System: Assign to FSR technician

    System->>FSR: 4. Notify Assignment
    FSR->>System: 5. Start Work Order

    loop Work Activities
        FSR->>System: Add Activity + Photos
        FSR->>System: Record Parts Used
    end

    FSR->>System: 6. Complete Work Order
    System->>Client: 7. Notify Completion
    Note over Client,System: Incident resolved
```

---

## 📋 Features by User Role

### 🔴 ADMINISTRADOR (Administrator)

**Dashboard:** `/admin`

**Full System Control** - Complete access to all features

#### Incident Management
- ✅ View all incidents from all VICs
- ✅ Create, edit, delete incidents
- ✅ Assign incidents to FSR technicians
- ✅ Update incident status and priority
- ✅ View complete incident history

#### Work Order Management
- ✅ Create work orders from incidents
- ✅ Assign work orders to FSR technicians
- ✅ Monitor work order progress
- ✅ View all activities and parts used
- ✅ Mark work orders as complete

#### System Configuration
- ✅ Manage users (create, edit, deactivate)
- ✅ Configure roles and permissions
- ✅ Manage VIC centers
- ✅ Configure incident types and statuses
- ✅ Manage parts inventory
- ✅ Set up schedules

#### Key Pages
- `/admin` - Main dashboard with statistics
- `/admin/incidents` - All incidents
- `/admin/work-orders` - All work orders
- `/admin/users` - User management
- `/admin/roles` - Role configuration
- `/admin/vic-centers` - VIC management
- `/admin/parts` - Inventory management
- `/admin/schedules` - Schedule planning

---

### 🔵 FSR (Field Service Representative)

**Dashboard:** `/fsr`

**Field Operations** - Execute and track work orders

#### Work Order Execution
- ✅ View assigned work orders
- ✅ Start work orders
- ✅ Add work activities with descriptions
- ✅ Upload evidence (photos, videos, documents)
- ✅ Record parts used
- ✅ Complete work orders

#### Activity Tracking
- ✅ Document all work performed
- ✅ Attach before/after photos
- ✅ Record time spent on activities
- ✅ Update work status in real-time

#### Parts Management
- ✅ View available parts
- ✅ Record parts used in repairs
- ✅ Track quantity and costs
- ✅ Update parts inventory

#### Incident Viewing
- ✅ View related incidents
- ✅ Update incident progress
- ✅ Access incident details and history

#### Key Pages
- `/fsr` - Assigned work orders dashboard
- `/fsr/work-orders` - My work orders
- `/fsr/work-orders/[id]/edit` - Execute work order
- `/fsr/incidents` - View related incidents
- `/fsr/schedules` - View schedule

#### Mobile Features
- 📱 Take photos directly from phone camera
- 📱 HEIC format support (iPhone native format)
- 📱 Upload videos from field
- 📱 Real-time updates while working

---

### 🟢 CLIENT (Client User)

**Dashboard:** `/client`

**Incident Reporting** - Report and track issues

#### Incident Creation
- ✅ Create new incidents
- ✅ Describe issue details
- ✅ Set priority level
- ✅ Upload photos/videos of problem
- ✅ Associate with VIC location

#### Tracking
- ✅ View my reported incidents
- ✅ Track incident status
- ✅ View assigned work orders
- ✅ See progress updates
- ✅ View resolution details

#### Work Orders
- ✅ View work orders related to my incidents
- ✅ See assigned technicians
- ✅ View work activities performed
- ✅ Check parts used and costs

#### Key Pages
- `/client` - My incidents dashboard
- `/client/incidents` - Report new incident
- `/client/incidents/[id]` - View incident details
- `/client/work-orders` - Related work orders
- `/client/schedules` - Scheduled maintenance

---

### 🟡 GUEST (Guest/Staff)

**Dashboard:** `/guest`

**⚠️ SOFT-BLOCKED ACCESS** - Limited to profile management only

#### Current Access (Soft-Block)
Guest accounts are currently restricted to profile management only. This is a placeholder role for future expansion.

#### What GUEST Can Do
- ✅ View and edit their own profile
- ✅ Change their password
- ✅ Update contact information

#### What GUEST Cannot Do
- ❌ View incidents
- ❌ View work orders
- ❌ Access parts inventory
- ❌ View schedules
- ❌ Create or modify any data

#### Use Cases
- Temporary account type for onboarding
- Future expansion for:
  - Management oversight
  - Reporting and analytics
  - Auditing
  - Training and observation

#### Key Pages
- `/guest` - Soft-block dashboard (shows access restriction message)
- `/profile` - Profile management (only accessible page)

#### Future Implementation
This role is designed for future expansion. When enabled, GUEST users will have read-only access to view incidents, work orders, parts, and schedules without the ability to create or modify data.

---

## 🗺️ System Navigation Map

```mermaid
graph LR
    A[Login] --> B{User Role}

    B -->|ADMINISTRADOR| C[Admin Dashboard]
    B -->|FSR| D[FSR Dashboard]
    B -->|CLIENT| E[Client Dashboard]
    B -->|GUEST| F[Guest Dashboard]

    C --> C1[Incidents]
    C --> C2[Work Orders]
    C --> C3[Users]
    C --> C4[Roles]
    C --> C5[VIC Centers]
    C --> C6[Parts]
    C --> C7[Schedules]
    C --> C8[Configuration]

    D --> D1[My Work Orders]
    D --> D2[My Profile]

    E --> E1[Report Incident]
    E --> E2[My Incidents]
    E --> E3[My Profile]

    F --> F1[My Profile ONLY]

    style C fill:#ff6b6b
    style D fill:#4ecdc4
    style E fill:#95e1d3
    style F fill:#ffd93d
```

---

## 📊 Complete Permissions Matrix

| Feature | ADMINISTRADOR | FSR | CLIENT | GUEST |
|---------|---------------|-----|--------|-------|
| **Incidents** |
| View Incidents | ✅ All | ✅ All | ✅ Own VIC | ⚠️ Soft-blocked |
| Create Incidents | ✅ | ❌ | ✅ Own VIC | ❌ |
| Edit Incidents | ✅ | ✅ | ❌ | ❌ |
| Delete Incidents | ✅ | ❌ | ❌ | ❌ |
| Assign Incidents | ✅ | ❌ | ❌ | ❌ |
| Close Incidents | ✅ | ❌ | ❌ | ❌ |
| **Work Orders** |
| View Work Orders | ✅ All | ✅ Assigned | ✅ Related | ⚠️ Soft-blocked |
| Create Work Orders | ✅ | ❌ | ❌ | ❌ |
| Edit Work Orders | ✅ | ✅ Assigned | ❌ | ❌ |
| Delete Work Orders | ✅ | ❌ | ❌ | ❌ |
| Assign Work Orders | ✅ | ❌ | ❌ | ❌ |
| Complete Work Orders | ✅ | ✅ | ❌ | ❌ |
| **Work Activities** |
| View Activities | ✅ | ✅ | ✅ Related | ⚠️ Soft-blocked |
| Create Activities | ✅ | ✅ | ❌ | ❌ |
| Edit Activities | ✅ | ✅ Own | ❌ | ❌ |
| Delete Activities | ✅ | ✅ Own | ❌ | ❌ |
| Upload Files | ✅ | ✅ | ❌ | ❌ |
| **Parts & Inventory** |
| View Parts | ✅ | ✅ | ❌ | ⚠️ Soft-blocked |
| Create Parts | ✅ | ❌ | ❌ | ❌ |
| Edit Parts | ✅ | ❌ | ❌ | ❌ |
| Delete Parts | ✅ | ❌ | ❌ | ❌ |
| Record Parts Used | ✅ | ✅ | ❌ | ❌ |
| **Profile Management** |
| View Own Profile | ✅ | ✅ | ✅ | ✅ |
| Edit Own Profile | ✅ | ✅ | ✅ | ✅ |
| Change Password | ✅ | ✅ | ✅ | ✅ |
| **Users & Configuration** |
| View Users | ✅ | ❌ | ❌ | ❌ |
| Create Users | ✅ | ❌ | ❌ | ❌ |
| Edit Users | ✅ | ❌ | ❌ | ❌ |
| Delete Users | ✅ | ❌ | ❌ | ❌ |
| Manage Roles | ✅ | ❌ | ❌ | ❌ |
| Manage Permissions | ✅ | ❌ | ❌ | ❌ |
| Manage VICs | ✅ | ❌ | ❌ | ❌ |
| **Schedules** |
| View Schedules | ✅ | ❌ | ❌ | ⚠️ Soft-blocked |
| Create Schedules | ✅ | ❌ | ❌ | ❌ |
| Edit Schedules | ✅ | ❌ | ❌ | ❌ |
| Delete Schedules | ✅ | ❌ | ❌ | ❌ |
| **Reports** |
| View Reports | ✅ | ❌ | ❌ | ⚠️ Soft-blocked |
| Export Reports | ✅ | ❌ | ❌ | ❌ |

**Note:** ⚠️ Soft-blocked = Feature exists but GUEST role is currently restricted from accessing it. This is a placeholder for future expansion.

---

## 🔄 Typical Use Case Scenarios

### Scenario 1: New Incident Report

```mermaid
flowchart TD
    A[CLIENT notices issue] --> B[Login to /client]
    B --> C[Click 'Report Incident']
    C --> D[Fill details & upload photo]
    D --> E[Submit incident]
    E --> F[ADMIN receives notification]
    F --> G[ADMIN creates work order]
    G --> H[Assign to FSR]
    H --> I[FSR receives work order]

    style A fill:#95e1d3
    style F fill:#ff6b6b
    style I fill:#4ecdc4
```

### Scenario 2: FSR Work Execution

```mermaid
flowchart TD
    A[FSR views assigned work] --> B[Start work order]
    B --> C[Document first activity]
    C --> D[Take before photos]
    D --> E[Perform repair work]
    E --> F[Take after photos]
    F --> G[Record parts used]
    G --> H{More work needed?}
    H -->|Yes| C
    H -->|No| I[Complete work order]
    I --> J[Incident auto-closes]

    style A fill:#4ecdc4
    style I fill:#4ecdc4
    style J fill:#51cf66
```

### Scenario 3: Admin System Management

```mermaid
flowchart TD
    A[ADMIN Dashboard] --> B{Task Type}
    B -->|User Management| C[Add/Edit Users]
    B -->|VIC Setup| D[Configure VIC Centers]
    B -->|Inventory| E[Manage Parts]
    B -->|Configuration| F[Set Incident Types]
    B -->|Oversight| G[Monitor All Work]

    C --> H[Assign Roles]
    D --> I[Set Locations]
    E --> J[Update Stock]
    F --> K[Define Workflows]
    G --> L[Generate Reports]

    style A fill:#ff6b6b
```

---

## 📱 Mobile & File Upload Features

### Supported File Types
- 📷 **Images:** JPEG, PNG, GIF, WebP, **HEIC/HEIF** (iPhone native)
- 🎥 **Videos:** MP4, QuickTime/MOV
- 📄 **Documents:** PDF

### Upload Limits
- **Max File Size:** 10MB per file
- **Max Files:** 10 files per upload
- **Storage:** Vercel Blob (cloud) or Filesystem

### Mobile Capabilities
- Direct camera capture from mobile browser
- Front/back camera selection
- Automatic HEIC to standardized format handling
- Upload from photo gallery
- Real-time progress indication

---

## 🔐 Security Features

### Authentication
- Secure password hashing (bcrypt)
- JWT session tokens (30-day expiration)
- Protected routes with middleware

### Authorization
- Database-driven role-based access control
- Granular permission system
- Route-level protection
- Resource-level access control

### Data Protection
- User status validation (ACTIVO/INACTIVO/SUSPENDIDO)
- Soft deletes for audit trails
- VIC-based data isolation for clients
- Activity logging

---

## 🎨 User Interface Highlights

### Design Features
- 🌓 **Dark/Light Mode** - Theme toggle support
- 📱 **Responsive Design** - Works on all devices
- ♿ **Accessible** - WCAG compliant components
- 🎯 **Intuitive Navigation** - Role-specific dashboards
- 📊 **Real-time Updates** - Live status indicators
- 🎨 **Modern UI** - shadcn/ui components

### Dashboard Views
- **Statistics Cards** - Quick metrics overview
- **Recent Activity** - Latest incidents and work orders
- **Status Badges** - Visual status indicators
- **Action Buttons** - Context-aware controls
- **Search & Filters** - Quick data access

---

## 🚀 Getting Started

### Test Accounts

After database seeding, use these credentials for demo:

```
ADMINISTRADOR
Email: admin@opusinspection.com
Password: password123
Access: Full system control

FSR (Field Service Rep)
Email: fsr@opusinspection.com
Password: password123
Access: Work order execution

CLIENT
Email: client@opusinspection.com
Password: password123
Access: Incident reporting

GUEST
Email: guest@opusinspection.com
Password: password123
Access: Read-only viewing
```

### Demo Flow Recommendation

1. **Start as CLIENT** → Report an incident with photos
2. **Switch to ADMIN** → Create work order and assign to FSR
3. **Switch to FSR** → Execute work, add activities and parts
4. **View as GUEST** → Show read-only access
5. **Return to ADMIN** → Show full system configuration

---

## 📈 System Statistics Example

| Metric | Description |
|--------|-------------|
| **VICs** | Vehicle Inspection Centers in system |
| **Active Users** | Users with ACTIVO status |
| **Open Incidents** | Incidents not yet closed |
| **Pending Work Orders** | Work orders in progress |
| **Parts in Inventory** | Available parts across all VICs |
| **Completed This Month** | Work orders finished this month |

---

## 🔧 Technical Stack

- **Frontend:** Next.js 15, React, TypeScript
- **Backend:** Next.js API Routes, Server Actions
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** NextAuth.js with JWT
- **Storage:** Vercel Blob / Filesystem
- **UI:** Tailwind CSS, shadcn/ui
- **Mobile:** Responsive PWA-ready

---

## 📞 Support & Resources

- **Documentation:** `/docs` folder
- **Project Configuration:** `CLAUDE.md`
- **Database Schema:** `prisma/schema.prisma`
- **Environment Setup:** `.env` file

---

*Last Updated: October 2024*
*System Version: MVP 1.0*
