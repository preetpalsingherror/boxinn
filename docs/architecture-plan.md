# BOX INN Member Companion — Architecture & Implementation Plan

**Project:** BOX INN Member Companion  
**Gym Location:** Susheelamma Layout, Puttenahalli, Yelahanka, Bengaluru, Karnataka (Asia/Kolkata, UTC+5:30)  
**Public Website:** https://boxinn.in/ (Companion app complements the website; does not replace or modify it)  
**Application Scope:** Single-facility private mobile-first web application for enrolled members  
**Architecture Style:** Modular Monolith with Clean / Domain-Driven Architecture  

---

## 1. Executive Summary & Brand Alignment

BOX INN is a premier fitness and performance training facility in Yelahanka, Bengaluru, offering strength training, CrossFit, HYROX, functional fitness, and open gym.

The **BOX INN Member Companion** is a private, member-only web application designed to complement the existing public website. It provides an in-gym companion for entrance check-ins, daily consistency streak tracking, equipment guides, trainer-curated exercise tutorials, and membership status visibility.

### Brand & Interface System
- **Tone:** Athletic, high-performance, purposeful, minimal.
- **Color System:**
  - Background Canvas: Dark athletic night (`#0A0B0E`)
  - Elevated Cards / Surfaces: Slate / Charcoal (`#14171F`, `#1D222E`)
  - High-Contrast Text: Crisp off-white (`#F8F9FA`) and muted secondary (`#94A3B8`)
  - Energetic Brand Accent: High-visibility athletic orange / vermilion (`#FF5500`) with focused contrast
- **Mobile Ergonomics:**
  - Thumb-zone navigation with a persistent bottom bar for member essentials (Home, Check-In, Machines, Profile).
  - Minimum touch target sizing of 48×48px.
  - Zero heavy, extraneous animations; instant, responsive interactions.
  - High legibility under varied indoor gym lighting (WCAG AAA text contrast).

---

## 2. Database Strategy (Local Development & Production)

### 2.1 Unified Engine: PostgreSQL Exclusively
To eliminate dialect discrepancies, schema mismatches, and migration divergence, **PostgreSQL (v16+) is used exclusively for both local development and production**. 

*We explicitly reject running SQLite locally while targeting PostgreSQL in production, because Prisma schemas with PostgreSQL native types (`@db.Timestamptz`, `@db.Uuid`), native enums, and SQL check constraints cannot run unchanged across engines.*

### 2.2 Actual Workspace Database Status & Local Setup
In the current workspace environment:
- The PostgreSQL 18 client (`psql 18.6`) and PostgreSQL 18 binaries (`initdb`, `postgres`, `pg_ctl`) are installed at `/usr/lib/postgresql/18/bin/`.
- No system PostgreSQL service is currently running in the background.

Two supported methods are documented for running PostgreSQL locally:

1. **Standard Developer Method (Docker Compose / Local Service)**:
   ```yaml
   # docker-compose.yml
   version: '3.8'
   services:
     postgres:
       image: postgres:16-alpine
       container_name: boxinn-postgres
       environment:
         POSTGRES_USER: boxinn_user
         POSTGRES_PASSWORD: boxinn_dev_password
         POSTGRES_DB: boxinn_companion
         TZ: Asia/Kolkata
       ports:
         - "5432:5432"
       volumes:
         - boxinn_pg_data:/var/lib/postgresql/data
   volumes:
     boxinn_pg_data:
   ```
   Verification:
   ```bash
   psql "postgresql://boxinn_user:boxinn_dev_password@localhost:5432/boxinn_companion" -c "SELECT version(), current_setting('TIMEZONE');"
   ```

2. **Container / Sandboxed Zero-Sudo Method** (Verified in current workspace):
   In restricted container workspaces where Docker sockets or root services are blocked, a dedicated user-space PostgreSQL instance can be initialized directly:
   ```bash
   /usr/lib/postgresql/18/bin/initdb -D "$HOME/.local/share/boxinn_pg" -A trust -U postgres
   /usr/lib/postgresql/18/bin/pg_ctl -D "$HOME/.local/share/boxinn_pg" -l "$HOME/.local/share/boxinn_pg/logfile" -o "-p 5432 -k $HOME/.local/share/boxinn_pg" start
   ```

### 2.3 Production Strategy
- **Hosted PostgreSQL Cluster**: Provisioned on a managed PostgreSQL provider (e.g., Supabase, Neon, AWS RDS, or Railway).
- **Connection Pooling**: Utilizes connection pooling (PgBouncer or Supabase transaction pooler on port 6543) for runtime application connections, and a direct connection URL (`DIRECT_URL`) on port 5432 for running migrations:
  ```env
  DATABASE_URL="postgresql://user:pass@pooler.db.service:6543/boxinn?pgbouncer=true"
  DIRECT_URL="postgresql://user:pass@direct.db.service:5432/boxinn"
  ```
- **Migration Reproducibility**:
  - Development: `npx prisma migrate dev --name <migration_name>` generates and applies version-controlled SQL files in `prisma/migrations/`.
  - Production CI/CD: `npx prisma migrate deploy` executes before server container startup. Zero drift or manual schema alterations.

---

## 3. Authentication, Verification & Session Security Architecture

### 3.1 Managed Provider vs. Application-Managed IAM Comparison

| Dimension | Managed Auth Provider (e.g. Clerk / Supabase Auth) | Application-Managed IAM (Modular Monolith) |
|---|---|---|
| **Direct Cost** | Free tier initially; escalates with MAUs. Advanced RBAC, custom domains, and audit retention require paid tiers ($25–$100+/month). | **$0.00 / month**. Fully self-hosted and zero third-party billing. |
| **Architectural Fit** | Typically designed for open, self-service signups. Implementing private, admin-approved single-use invitations requires custom webhooks and hybrid sync. | **Exact Fit**. Custom invitation lifecycle, single-use token redemption, email verification, and membership initialization run in atomic database transactions. |
| **Complexity** | External console, webhook signature verification, cross-service eventual consistency, vendor lock-in. | Moderate initial code, but 100% transparent, unified with domain entities, and runs in the existing PostgreSQL database. |
| **Email Verification** | Automated through provider, but requires configuring custom SMTP or SendGrid/Resend for branded transactional emails. | Native table `EmailVerificationToken` with expiring single-use hashes. Decoupled via `IEmailDispatcher` interface. |
| **Session Revocation** | JWTs have fixed lifespans (15m) with refresh token rotation; immediate revocation requires maintaining revocation blacklists. | **Database-Backed Sessions**. Admin can revoke any member's sessions instantly with a single query (`UPDATE "Session" SET revoked_at = NOW() WHERE user_id = $1`). |
| **Deployment Needs** | Third-party cloud dashboard, external project keys, webhook secret provisioning. | Standard environment variables (`DATABASE_URL`). |

**Decision**: We implement an **Application-Managed IAM with Database-Backed Sessions** and a cryptographic email verification token pipeline. No external session packages (such as `iron-session`) are used; session state is managed via PostgreSQL rows and native cryptographic tokens.

---

### 3.2 Two-Stage Account Activation & Genuine Email Verification

Setting `emailVerifiedAt` immediately upon invitation claiming is explicitly rejected because an admin-shared invitation link (e.g. shared over WhatsApp) does not prove that the member owns the registered email address.

Instead, we enforce a strict **Two-Stage Onboarding Flow**:

```mermaid
sequenceDiagram
    autonumber
    actor Admin
    actor Member
    participant App as Application Server
    participant DB as PostgreSQL Database
    participant Mailer as Email Dispatcher (IEmailDispatcher)

    Note over Admin, App: Stage 1: Invitation Creation
    Admin->>App: Create invitation (Email, Full Name, Plan details)
    App->>App: Normalize email: toLowerCase().trim()
    App->>App: Generate 32-byte rawInviteToken & hash (SHA-256)
    rect rgb(20, 25, 35)
    Note over App, DB: Atomic Provisioning Transaction
    App->>DB: INSERT User (status='INVITED', role='MEMBER')
    App->>DB: INSERT Membership (status='ACTIVE', startDate, expiryDate)
    App->>DB: INSERT Invitation (tokenHash, status='PENDING', expiresAt=now+7d)
    end
    App-->>Admin: Returns link: /activate?token=rawInviteToken
    Admin->>Member: Shares activation link via WhatsApp

    Note over Member, App: Stage 2: Invitation Claim & Password Setup
    Member->>App: Opens /activate?token=rawInviteToken
    App->>DB: Verify invitation (tokenHash, status='PENDING', expiresAt > now)
    Member->>App: Submits password & confirms email
    rect rgb(20, 25, 35)
    Note over App, DB: Atomic Claim Transaction
    App->>DB: UPDATE Invitation (status='CLAIMED', acceptedAt=now)
    App->>App: Hash password using bcryptjs (salt rounds 12)
    App->>DB: UPDATE User (passwordHash, status='PENDING_VERIFICATION')
    App->>App: Generate 32-byte rawVerifyToken & hash (SHA-256)
    App->>DB: INSERT EmailVerificationToken (userId, tokenHash, expiresAt=now+24h)
    end
    App->>Mailer: Dispatch email with link: /verify-email?token=rawVerifyToken
    App-->>Member: Render "Check your inbox to verify and activate" (No session created yet!)

    Note over Member, DB: Stage 3: Genuine Email Verification & Session Creation
    Member->>App: Clicks link: /verify-email?token=rawVerifyToken
    App->>App: Compute incomingHash = SHA-256(rawVerifyToken)
    rect rgb(20, 25, 35)
    Note over App, DB: Atomic Activation Transaction
    App->>DB: UPDATE EmailVerificationToken SET usedAt=now WHERE tokenHash=incomingHash AND usedAt IS NULL AND expiresAt > now
    App->>DB: UPDATE User SET status='ACTIVE', emailVerifiedAt=now
    App->>DB: INSERT MemberStreak (userId, currentStreak=0, longestStreak=0)
    App->>App: Generate 32-byte sessionToken & store SHA-256 hash in Session table
    end
    App-->>Member: Set HTTP-only session cookie & redirect to /dashboard
```

#### Prevention of Duplicate Records
1. **Single Staged Record**: When the admin creates an invitation, the `User` is inserted with `status = 'INVITED'`, and `Membership` is created with `status = 'ACTIVE'`.
2. **Claim Step**: Claiming the invitation updates the existing `User` record to `status = 'PENDING_VERIFICATION'` and updates `passwordHash`. No duplicate user or membership is inserted.
3. **Resend Safety**: If the email verification token expires, `/verify-email/resend` invalidates previous unredeemed tokens for that `userId` and issues a fresh token. The member's single `User` and `Membership` rows remain unchanged.
4. **Final Activation**: Verification at `/verify-email?token=...` marks the verification token `usedAt = NOW()`, sets `User.status = 'ACTIVE'`, sets `emailVerifiedAt = NOW()`, initializes `MemberStreak`, and sets the session cookie.
5. **Access Gate**: A user with `status = 'INVITED'` or `'PENDING_VERIFICATION'` **cannot check in, cannot access machine guides, and cannot access protected member routes**.

---

### 3.3 Complete Security Design

#### 1. Password Reset & Account Recovery
- Member enters their email at `/forgot-password`.
- Rate limit: Maximum 3 requests per hour per email.
- **Anti-Enumeration Response**: Always returns `"If an account is associated with this email, a reset link has been dispatched"`, regardless of whether the email exists.
- If user exists and is not suspended:
  - Generates 32-byte `rawResetToken`, hashes with SHA-256, and stores in `PasswordResetToken` with `expiresAt = NOW() + 1 hour`.
  - Invalidates any prior unused reset tokens for that user.
  - Dispatches reset link via `IEmailDispatcher`.
- Member opens `/reset-password?token=rawResetToken` and submits a new password.
- **Atomic Reset Transaction**:
  1. Validates token hash, `usedAt IS NULL`, `expiresAt > NOW()`.
  2. Sets `usedAt = NOW()`.
  3. Hashes new password with `bcryptjs`.
  4. Updates `User.passwordHash`.
  5. **Immediate Session Revocation**: `UPDATE "Session" SET revoked_at = NOW() WHERE user_id = user.id` (logs out all active sessions across all devices).

#### 2. Session Lifecycle & Immediate Suspension Lockout
- **Database-Backed Sessions**: Each login or activation generates a 32-byte random session token (`crypto.randomBytes(32).toString('base64url')`). Only `sessionTokenHash = sha256(sessionToken)` is stored in the database.
- **Cookie Security Profile**:
  - `HttpOnly: true` (prevents direct JavaScript reads via `document.cookie`).
  - `Secure: true` in production (enforced over HTTPS).
  - `SameSite: 'Lax'` (mitigates cross-site request forgery on top-level navigations).
  - `Path: '/'`.
  - In production with HTTPS, prefixed as `__Host-boxinn_session`.
- **Immediate Suspension Lockout**:
  On every protected request, the server queries the database for `Session` joined with `User`.
  If `user.status === 'SUSPENDED'`:
  - The request is immediately rejected with HTTP 403 Forbidden.
  - All active sessions for that user are revoked.
  - *A suspended member cannot continue using an existing session cookie under any circumstance.*

#### 3. CSRF & XSS Complementary Protections
- Acknowledged principle: `HttpOnly` cookies do **not** eliminate all XSS risks (an injected script could still execute authenticated HTTP `fetch` requests).
- **Complementary Defenses**:
  - Next.js Server Actions automatically verify Origin and Host headers, blocking cross-origin form submissions.
  - Strict Content Security Policy (CSP) headers forbidding unauthorized external scripts.
  - Sanitization of all user-supplied inputs and strict parameterized SQL queries via Prisma.

#### 4. Persistent, Shared Rate Limiting (Multi-Instance Safe)
Process-local in-memory counters fail when multiple instances run behind a load balancer and reset on cold restarts. We implement a database-backed sliding window rate limiter in PostgreSQL:

- Database model: `RateLimitAttempt`:
  - `key`: string (e.g. `ip:<ip_address>:login` or `email:<normalized_email>:forgot`)
  - `createdAt`: timestamp
- Evaluation:
  ```sql
  SELECT COUNT(*) FROM "RateLimitAttempt" 
  WHERE key = $1 AND created_at > NOW() - INTERVAL '15 minutes';
  ```
- Limits:
  - `/activate`: Max 5 attempts per 15 minutes per IP.
  - `/verify-email`: Max 5 attempts per 15 minutes per IP.
  - `/login`: Max 5 failed attempts per 15 minutes per email/IP; triggers exponential backoff.
  - `/forgot-password`: Max 3 requests per hour per email.

#### 5. Secure First-Admin Provisioning
- **Zero hardcoded credentials in source control or seed files**.
- Initial admin is provisioned via a dedicated CLI script:
  ```bash
  npm run admin:provision -- --email="admin@boxinn.in" --name="Head Trainer"
  ```
  The script generates a cryptographically random password, hashes it, stores the admin record, and outputs the password **once** to stdout, requiring a password update upon first login.

---

### 3.4 Operational Prerequisites (Realism Check)

The system is **not** production-ready merely because authentication code exists. Before go-live, the following operational requirements must be fulfilled:
1. **Transactional Email Service**: Production integration of an email provider (Resend, SendGrid, or Amazon SES) with verified DNS records (SPF, DKIM, DMARC) for `boxinn.in`. In Phase 1 development, emails are simulated via an abstract `IEmailDispatcher` logging to stdout/test fixtures.
2. **Database Backups & PITR**: Automated daily PostgreSQL snapshots and continuous Write-Ahead Log (WAL) archiving for Point-in-Time Recovery.
3. **Application Monitoring & Observability**: Structured error logging (Pino) and exception alerting (Sentry) to detect failed activations, database connection issues, or suspicious brute-force activity.
4. **Secret Management**: Storing production secrets (`DATABASE_URL`, `SESSION_SECRET`) in a dedicated cloud secret manager (e.g., Doppler, AWS Secrets Manager, or platform environment vaults) with strict access controls and regular rotation.
5. **Uptime & Health Monitoring**: Dedicated `/api/health` endpoint verifying database responsiveness and server time synchronization, monitored by an external synthetic monitor.

---

## 4. Revised Prisma Schema

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

generator client {
  provider = "prisma-client-js"
}

// -------------------------------------------------------------
// Enums
// -------------------------------------------------------------

enum UserRole {
  MEMBER
  ADMIN
}

enum UserStatus {
  INVITED
  PENDING_VERIFICATION
  ACTIVE
  SUSPENDED
}

enum InvitationStatus {
  PENDING
  CLAIMED
  EXPIRED
  REVOKED
}

enum MembershipStatus {
  ACTIVE
  SUSPENDED
  FROZEN
  CANCELLED
}

enum CheckinSource {
  ENTRANCE_QR
  ADMIN_MANUAL
}

// -------------------------------------------------------------
// Identity, Authentication & Sessions
// -------------------------------------------------------------

model User {
  id              String        @id @default(uuid()) @db.Uuid
  email           String        @unique @db.VarChar(255) // Normalized: toLowerCase().trim()
  phone           String?       @unique @db.VarChar(32)
  fullName        String        @db.VarChar(128)
  passwordHash    String?       @db.VarChar(255)
  role            UserRole      @default(MEMBER)
  status          UserStatus    @default(INVITED)
  emailVerifiedAt DateTime?     @db.Timestamptz
  createdAt       DateTime      @default(now()) @db.Timestamptz
  updatedAt       DateTime      @updatedAt @db.Timestamptz

  sessions                Session[]
  memberships             Membership[]
  attendanceRecords       AttendanceRecord[]
  streak                  MemberStreak?
  emailVerificationTokens EmailVerificationToken[]
  passwordResetTokens     PasswordResetToken[]
  
  // Administrative relations (Restricted deletions to permanently preserve audit logs)
  createdInvitations     Invitation[]             @relation("AdminInvitations")
  membershipAudits       MembershipAudit[]        @relation("AdminMembershipAudits")
  attendanceCorrections  AttendanceCorrection[]   @relation("AdminAttendanceCorrections")
  createdAnnouncements   Announcement[]           @relation("AdminAnnouncements")

  @@index([role, status])
}

model Session {
  id               String    @id @default(uuid()) @db.Uuid
  userId           String    @db.Uuid
  user             User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  sessionTokenHash String    @unique @db.VarChar(64) // SHA-256 of session cookie token
  ipAddress        String?   @db.VarChar(45)
  userAgent        String?   @db.VarChar(512)
  expiresAt        DateTime  @db.Timestamptz
  revokedAt        DateTime? @db.Timestamptz
  createdAt        DateTime  @default(now()) @db.Timestamptz

  @@index([userId, revokedAt, expiresAt])
}

model Invitation {
  id          String           @id @default(uuid()) @db.Uuid
  email       String           @db.VarChar(255) // Normalized
  tokenHash   String           @unique @db.VarChar(64) // SHA-256 hex digest
  status      InvitationStatus @default(PENDING)
  invitedById String           @db.Uuid
  invitedBy   User             @relation("AdminInvitations", fields: [invitedById], references: [id], onDelete: Restrict)
  expiresAt   DateTime         @db.Timestamptz
  acceptedAt  DateTime?        @db.Timestamptz
  createdAt   DateTime         @default(now()) @db.Timestamptz

  @@index([tokenHash, status, expiresAt])
}

model EmailVerificationToken {
  id        String    @id @default(uuid()) @db.Uuid
  userId    String    @db.Uuid
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String    @unique @db.VarChar(64) // SHA-256 of raw email verification token
  expiresAt DateTime  @db.Timestamptz
  usedAt    DateTime? @db.Timestamptz
  createdAt DateTime  @default(now()) @db.Timestamptz

  @@index([tokenHash, usedAt, expiresAt])
  @@index([userId])
}

model PasswordResetToken {
  id        String    @id @default(uuid()) @db.Uuid
  userId    String    @db.Uuid
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String    @unique @db.VarChar(64) // SHA-256 of raw password reset token
  expiresAt DateTime  @db.Timestamptz
  usedAt    DateTime? @db.Timestamptz
  createdAt DateTime  @default(now()) @db.Timestamptz

  @@index([tokenHash, usedAt, expiresAt])
  @@index([userId])
}

model RateLimitAttempt {
  id        String   @id @default(uuid()) @db.Uuid
  key       String   @db.VarChar(128) // e.g. "ip:103.21.244.1:login"
  createdAt DateTime @default(now()) @db.Timestamptz

  @@index([key, createdAt])
}

// -------------------------------------------------------------
// Membership & Renewals
// -------------------------------------------------------------

model Membership {
  id               String           @id @default(uuid()) @db.Uuid
  userId           String           @db.Uuid
  user             User             @relation(fields: [userId], references: [id], onDelete: Restrict)
  planName         String           @db.VarChar(64)
  startDate        String           @db.VarChar(10) // YYYY-MM-DD (Asia/Kolkata)
  expiryDate       String           @db.VarChar(10) // YYYY-MM-DD (Asia/Kolkata)
  status           MembershipStatus @default(ACTIVE)
  suspensionReason String?          @db.Text
  notes            String?          @db.Text
  createdAt        DateTime         @default(now()) @db.Timestamptz
  updatedAt        DateTime         @updatedAt @db.Timestamptz

  audits           MembershipAudit[]

  @@index([userId, status])
  @@index([expiryDate])
}

model MembershipAudit {
  id                 String     @id @default(uuid()) @db.Uuid
  membershipId       String     @db.Uuid
  membership         Membership @relation(fields: [membershipId], references: [id], onDelete: Restrict) // Audit records never cascade-delete
  adminId            String     @db.Uuid
  admin              User       @relation("AdminMembershipAudits", fields: [adminId], references: [id], onDelete: Restrict)
  action             String     @db.VarChar(64) // CREATED, EXTENDED, SUSPENDED, REACTIVATED, FROZEN
  beforeState        String?    @db.Text        // JSON snapshot of previous fields
  afterState         String     @db.Text        // JSON snapshot of updated fields
  reason             String     @db.Text
  createdAt          DateTime   @default(now()) @db.Timestamptz
}

// -------------------------------------------------------------
// Attendance & Streak Engine
// -------------------------------------------------------------

model AttendanceRecord {
  id           String        @id @default(uuid()) @db.Uuid
  userId       String        @db.Uuid
  user         User          @relation(fields: [userId], references: [id], onDelete: Restrict)
  gymDate      String        @db.VarChar(10) // Asia/Kolkata date YYYY-MM-DD
  checkInTime  DateTime      @db.Timestamptz // Server authoritative UTC timestamp
  checkOutTime DateTime?     @db.Timestamptz // Nullable until checked out or auto-closed
  source       CheckinSource @default(ENTRANCE_QR)
  isAutoClosed Boolean       @default(false)
  createdAt    DateTime      @default(now()) @db.Timestamptz

  corrections  AttendanceCorrection[]

  // Database-level uniqueness: strictly one attendance record per member per gym date
  @@unique([userId, gymDate])
  @@index([gymDate])
}

model MemberStreak {
  userId             String   @id @db.Uuid
  user               User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  currentStreak      Int      @default(0)
  longestStreak      Int      @default(0)
  lastAttendanceDate String?  @db.VarChar(10) // YYYY-MM-DD
  streakStartDate    String?  @db.VarChar(10) // YYYY-MM-DD
  updatedAt          DateTime @updatedAt @db.Timestamptz
}

model AttendanceCorrection {
  id                 String           @id @default(uuid()) @db.Uuid
  attendanceRecordId String           @db.Uuid
  attendanceRecord   AttendanceRecord @relation(fields: [attendanceRecordId], references: [id], onDelete: Restrict) // Audit records never cascade-delete
  adminId            String           @db.Uuid
  admin              User             @relation("AdminAttendanceCorrections", fields: [adminId], references: [id], onDelete: Restrict)
  originalGymDate    String           @db.VarChar(10)
  correctedGymDate   String           @db.VarChar(10)
  beforeState        String?          @db.Text // JSON snapshot
  afterState         String           @db.Text // JSON snapshot
  reason             String           @db.Text
  createdAt          DateTime         @default(now()) @db.Timestamptz
}

// -------------------------------------------------------------
// Facility & Content Guides
// -------------------------------------------------------------

model Machine {
  id          String     @id @default(uuid()) @db.Uuid
  code        String     @unique @db.VarChar(32) // e.g. "M-CHEST-01"
  name        String     @db.VarChar(128)
  category    String     @db.VarChar(64)
  location    String?    @db.VarChar(64)
  description String?    @db.Text
  imageUrl    String?    @db.VarChar(512)
  isActive    Boolean    @default(true)
  createdAt   DateTime   @default(now()) @db.Timestamptz

  exercises   Exercise[]
}

model Exercise {
  id                String   @id @default(uuid()) @db.Uuid
  machineId         String?  @db.Uuid
  machine           Machine? @relation(fields: [machineId], references: [id], onDelete: SetNull)
  title             String   @db.VarChar(128)
  targetMuscleGroup String   @db.VarChar(64)
  difficulty        String   @default("ALL_LEVELS") @db.VarChar(32)
  instructions      String   @db.Text
  formCues          String   @db.Text // JSON string array of cues
  safetyPrecautions String?  @db.Text
  videoUrl          String?  @db.VarChar(512)
  trainerName       String?  @db.VarChar(64)
  createdAt         DateTime @default(now()) @db.Timestamptz
}

model Announcement {
  id          String    @id @default(uuid()) @db.Uuid
  title       String    @db.VarChar(255)
  content     String    @db.Text
  isUrgent    Boolean   @default(false)
  createdById String    @db.Uuid
  createdBy   User      @relation("AdminAnnouncements", fields: [createdById], references: [id], onDelete: Restrict)
  publishedAt DateTime  @default(now()) @db.Timestamptz
  expiresAt   DateTime? @db.Timestamptz
}
```

#### SQL Migration Invariants
```sql
ALTER TABLE "Membership" 
  ADD CONSTRAINT "check_membership_dates" 
  CHECK (expiry_date >= start_date);

ALTER TABLE "MemberStreak" 
  ADD CONSTRAINT "check_streak_nonnegative" 
  CHECK (current_streak >= 0 AND longest_streak >= current_streak);

ALTER TABLE "AttendanceRecord" 
  ADD CONSTRAINT "check_checkout_timing" 
  CHECK (check_out_time IS NULL OR check_out_time >= check_in_time);
```

---

## 5. Concurrency Control & Serialization Strategy

### 5.1 Concurrent Attendance Scans (Entrance QR)
- **Constraint**: `@@unique([userId, gymDate])` on `AttendanceRecord`.
- **Handling**: When two scan requests for the same member arrive concurrently on the same gym date, PostgreSQL enforces uniqueness. The first insert succeeds; the second insert fails with unique constraint violation `P2002`.
- The application catches `P2002`, loads the existing record, evaluates the 3-hour session status, and returns the friendly confirmation message (`"Already checked in today at 07:15 AM"`). Zero duplicate records are created.

### 5.2 Concurrent Attendance Corrections & Streak Recalculation
- **Race Condition**: Two administrators correcting historical attendance for the same member simultaneously could cause interleaved streak recalculations and desynchronized state.
- **Serialization Strategy**: **Row-Level Lock on `MemberStreak`**:
  ```sql
  SELECT * FROM "MemberStreak" WHERE "userId" = $1 FOR UPDATE;
  ```
- **Atomic Transaction Sequence**:
  In a single serializable/locked transaction:
  1. Acquire row lock: `SELECT ... FROM "MemberStreak" WHERE "userId" = $1 FOR UPDATE`.
  2. Insert or update `AttendanceRecord`.
  3. Insert `AttendanceCorrection` audit record with before/after state and reason.
  4. Fetch the full chronological attendance ledger: `SELECT "gymDate" FROM "AttendanceRecord" WHERE "userId" = $1 ORDER BY "gymDate" ASC`.
  5. Execute pure domain `recalculateFullStreak(dates)`.
  6. Update `MemberStreak` with `{ currentStreak, longestStreak, lastAttendanceDate, streakStartDate, updatedAt: new Date() }`.
  7. Commit transaction and release row lock.

---

## 6. Three-Hour Session Closure Server-Side Policy

1. **Authoritative Timestamp Capture**:
   - Server captures `checkInTime = new Date()` (UTC timestamp from server system clock).
   - Server derives `gymDate = toGymLocalDate(checkInTime, 'Asia/Kolkata')`.
   - Database record starts with `checkOutTime = NULL` and `isAutoClosed = false`.
2. **Exact Deadline**:
   $$\text{autoCloseDeadline} = \text{checkInTime} + 3\text{ hours}$$
3. **Persistence Strategy**:
   - **Lazy On-Query Reconciliation**: When an attendance record is queried and `checkOutTime IS NULL`:
     - If `serverNow >= autoCloseDeadline`:
       - Evaluated in memory as `isClosed = true`, `isAutoClosed = true`, `effectiveCheckOutTime = autoCloseDeadline`.
       - Persisted to DB:
         ```sql
         UPDATE "AttendanceRecord" 
         SET check_out_time = check_in_time + INTERVAL '3 hours', is_auto_closed = TRUE 
         WHERE id = $1 AND check_out_time IS NULL;
         ```
   - **Scheduled Sweep**: A background job periodically reconciles overdue records in batch.
4. **Duplicate Scans**:
   - Any duplicate scan on the same gym date finds the existing record via `UNIQUE(userId, gymDate)`.
   - If within 3 hours: `"You are already checked in today at [Time]. Workout in progress!"`
   - If 3+ hours or checked out: `"You already completed your workout for today (checked in at [Time]). See you tomorrow!"`
   - **One attendance record per member per local calendar day is strictly preserved.**

---

## 7. Dependencies & Clean Architecture Boundaries

### Verified Dependencies (`package.json`)
```json
{
  "dependencies": {
    "next": "^15.1.5",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@prisma/client": "^6.2.1",
    "bcryptjs": "^2.4.3",
    "clsx": "^2.1.1",
    "lucide-react": "^0.473.0",
    "tailwind-merge": "^2.6.0"
  },
  "devDependencies": {
    "typescript": "^5.7.3",
    "@types/node": "^22.10.7",
    "@types/react": "^19.0.7",
    "@types/react-dom": "^19.0.3",
    "@types/bcryptjs": "^2.4.6",
    "prisma": "^6.2.1",
    "tailwindcss": "^3.4.17",
    "postcss": "^8.5.1",
    "autoprefixer": "^10.4.20"
  }
}
```

*Note: `iron-session` has been completely removed. Session state is database-backed using standard HTTP cookies and native Node cryptography.*

---

## 8. Integration & Security Test Suite Plan (Phase 1B)

```
tests/integration/
├── invitation-redemption.test.ts  # Race conditions & atomic single-use claims
├── email-verification.test.ts     # Genuine verification tokens, expiry, resend, activation
├── password-reset.test.ts         # Expiry, single-use, anti-enumeration, session revocation
├── attendance-concurrency.test.ts # Simultaneous QR check-ins & UNIQUE constraint integrity
├── session-lifecycle.test.ts      # Expiry, logout, immediate suspension lockout
├── admin-authorization.test.ts    # Server-side RBAC guards & non-cascading audit retention
├── streak-concurrency.test.ts     # Row-level lock & atomic recalculation under concurrent corrections
└── rate-limiting.test.ts          # Database-backed rate limiting across windows
```

### Key Test Scenarios
1. **Email Verification Before Activation**:
   - Claiming invitation sets `User.status = 'PENDING_VERIFICATION'`.
   - Protected routes reject access with HTTP 403.
   - Calling `/verify-email?token=...` transitions `User.status = 'ACTIVE'`, sets `emailVerifiedAt`, creates session.
2. **Resend Email Verification Safety**:
   - Resending verification invalidates previous unused token, creates a new token, leaves user and membership rows singular.
3. **Session Revocation on Account Suspension**:
   - Active member with valid session cookie is suspended by an admin.
   - Immediate subsequent request with that session cookie is rejected (HTTP 403) and all sessions for that user are revoked.
4. **Concurrent Attendance Corrections**:
   - 2 concurrent admin corrections on the same member's attendance ledger.
   - Both commit serially via `SELECT ... FOR UPDATE` row locks; final streak matches deterministic recalculation over the unified ledger.
5. **Database-Backed Rate Limiting**:
   - 6th failed login within 15 minutes is rejected with HTTP 429.
