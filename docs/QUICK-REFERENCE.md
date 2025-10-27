# OpusTrack Quick Reference Card

**Vehicle Inspection Center Management System**

---

## 🎯 What is OpusTrack?

A complete incident and work order management system for Vehicle Inspection Centers (VICs) in Mexico.

**Key Value:** Track problems from report → assignment → resolution

---

## 👥 Four User Types

### 🔴 ADMINISTRADOR (Boss)
- **Access:** Everything
- **Does:** Configure system, manage users, oversee all work
- **Dashboard:** `/admin`

### 🔵 FSR (Technician)
- **Access:** Work orders, activities, parts
- **Does:** Fix issues, document work, upload photos
- **Dashboard:** `/fsr`

### 🟢 CLIENT (Reporter)
- **Access:** Create & view incidents
- **Does:** Report problems, track progress
- **Dashboard:** `/client`

### 🟡 GUEST (Observer)
- **Access:** View only
- **Does:** See reports, no changes
- **Dashboard:** `/guest`

---

## 🔄 Simple Workflow

```
CLIENT Reports Issue → ADMIN Creates Work Order → FSR Fixes It → Everyone Sees Progress
```

1. **CLIENT** sees problem, takes photo, creates incident
2. **ADMIN** gets notification, creates work order, assigns FSR
3. **FSR** gets work order, documents repair, uploads evidence
4. System auto-closes incident when work complete
5. Everyone can track status in real-time

---

## ✅ What Can Each User Do?

| Action | ADMIN | FSR | CLIENT | GUEST |
|--------|:-----:|:---:|:------:|:-----:|
| Report incident | ✅ | ❌ | ✅ | ❌ |
| Create work order | ✅ | ❌ | ❌ | ❌ |
| Fix/document work | ✅ | ✅ | ❌ | ❌ |
| Upload photos | ✅ | ✅ | ✅ | ❌ |
| Use parts | ✅ | ✅ | ❌ | ❌ |
| View everything | ✅ | ✅* | ✅* | ✅ |
| Manage users | ✅ | ❌ | ❌ | ❌ |
| Configure system | ✅ | ❌ | ❌ | ❌ |

*Limited to assigned/related items

---

## 📱 Mobile Features

- ✅ Take photos directly from phone
- ✅ Works with iPhone (HEIC format)
- ✅ Upload videos
- ✅ Works on any device
- ✅ Real-time updates

---

## 🔑 Demo Login Credentials

```
ADMIN:  admin@opusinspection.com / password123
FSR:    fsr@opusinspection.com / password123
CLIENT: client@opusinspection.com / password123
GUEST:  guest@opusinspection.com / password123
```

---

## 🎬 Demo Script (5 Minutes)

### Minute 1: CLIENT Experience
- Login as CLIENT
- Click "Report Incident"
- Take photo of "problem"
- Submit with description

### Minute 2: ADMIN Control
- Switch to ADMIN
- See new incident
- Create work order
- Assign to FSR technician

### Minute 3: FSR Work
- Switch to FSR
- Open assigned work order
- Add work activity
- Upload before/after photos
- Record parts used

### Minute 4: Tracking
- Show CLIENT view (see progress)
- Show GUEST view (read-only)
- Demonstrate status updates

### Minute 5: ADMIN Overview
- Show all incidents
- Show all work orders
- Show user management
- Show configuration options

---

## 🎯 Key Selling Points

1. **Role-Based Security** → Right people see right things
2. **Mobile-First** → Technicians work from phone
3. **Complete Audit Trail** → Every action tracked
4. **Photo Documentation** → Visual evidence of work
5. **Real-Time Status** → Everyone knows what's happening
6. **Easy to Use** → Intuitive interface, minimal training

---

## 📊 System Capabilities

### For Management (ADMIN)
- Create and manage multiple VICs
- Control user access and permissions
- Track all incidents and work across system
- Generate reports
- Manage parts inventory
- Configure incident types and workflows

### For Technicians (FSR)
- View assigned work orders
- Document all activities
- Upload photos/videos as evidence
- Track time and parts used
- Update status in real-time
- Complete work orders from field

### For Clients (CLIENT)
- Report issues immediately
- Track incident progress
- View assigned technicians
- See work activities
- Get completion notifications

### For Observers (GUEST)
- View all incidents
- Monitor work progress
- Access reports
- No editing capability
- Perfect for supervisors

---

## 💡 Business Benefits

### Efficiency
- ⏱️ Faster incident response
- 📋 Organized work tracking
- 🔄 Automated workflows
- 📱 Mobile accessibility

### Accountability
- 👤 Know who did what, when
- 📸 Photo evidence required
- ⏰ Time tracking
- 📝 Complete audit trail

### Transparency
- 👁️ Real-time status for everyone
- 📊 Clear reporting
- 🔔 Automatic notifications
- 📈 Performance metrics

### Cost Control
- 💰 Track parts usage
- ⏱️ Monitor labor time
- 📉 Identify recurring issues
- 📊 Data-driven decisions

---

## 🔐 Security & Data

- Secure password authentication
- Role-based permissions
- VIC-specific data isolation
- Soft deletes (nothing truly erased)
- User status management
- Session timeout protection

---

## 📱 Technical Highlights

- Modern web technology (Next.js)
- Works on any device
- Cloud storage (Vercel Blob)
- PostgreSQL database
- Automatic backups
- Scalable architecture

---

## ❓ Common Questions

**Q: Can FSR see other FSR's work orders?**
A: Yes, they can view but only edit their assigned ones.

**Q: Can CLIENT users edit incidents?**
A: No, only view. ADMIN and FSR can update.

**Q: What file types are supported?**
A: Photos (JPG, PNG, HEIC), Videos (MP4, MOV), Documents (PDF)

**Q: How big can uploads be?**
A: 10MB per file, up to 10 files per upload.

**Q: Can I add more user roles?**
A: Yes, ADMIN can create custom roles with specific permissions.

**Q: Is it mobile-friendly?**
A: Yes, fully responsive and optimized for mobile use.

**Q: Can we track multiple VICs?**
A: Yes, system supports unlimited VICs.

**Q: Does it work offline?**
A: No, requires internet connection for real-time updates.

---

## 🎨 UI Features

- **Dark/Light Mode** - User preference
- **Responsive Design** - Any screen size
- **Real-time Updates** - Live status changes
- **Search & Filter** - Find anything quickly
- **Status Badges** - Visual indicators
- **Action Buttons** - Context-aware
- **File Preview** - View before upload
- **Progress Indicators** - Know what's happening

---

## 🚀 Next Steps

1. ✅ Review demo documentation
2. ✅ Test with demo accounts
3. ✅ Prepare questions
4. ✅ Schedule follow-up
5. ✅ Customize for your needs

---

*For detailed documentation, see SYSTEM-DEMO.md*
