# BOX INN Member Companion — Setup & Operations Guide

A comprehensive technical operations guide for the **BOX INN Member Companion** application, serving members and staff of BOX INN gym in Puttenahalli, Yelahanka, Bengaluru.

---

## 1. System Overview & Architecture

The BOX INN Member Companion is a private, mobile-first web application designed to operate alongside the gym's public website (`https://boxinn.in/`). The public marketing website remains completely untouched.

### Architecture Highlights
- **Domain Layer (`src/domain/`)**: Pure business logic with zero framework or database dependencies. Houses date manipulation anchored to `Asia/Kolkata`, inclusive membership expiry evaluation, 3-hour attendance session auto-closure, and the deterministic 1-to-3 day streak preservation engine.
- **Application Services (`src/application/`)**: Use-case orchestration (`authService`, `attendanceService`) coordinating domain rules, database transactions, email dispatch, and audit logging.
- **Infrastructure (`src/infrastructure/`)**: PostgreSQL persistence via Prisma ORM, bcrypt password hashing, SHA-256 token hashing, atomic SQL rate limiting, and structured JSON logging with automatic secret redaction.
- **Presentation Layer (`src/presentation/` & `src/app/`)**: Next.js App Router (React 19, TypeScript strict mode), route handlers, CSRF protection, HttpOnly cookie management, and role-based route guards (`MEMBER`, `ADMIN`).

---

## 2. Prerequisites & Local Development

### Prerequisites
- **Node.js**: v20+ or v22+ LTS (Node 24 supported with native ESM)
- **PostgreSQL**: v15, v16, v17, or v18
- **npm**: v10+

### Step-by-Step Local Setup

1. **Clone the repository and enter the directory**:
   ```bash
   git clone <repository-url>
   cd box-inn
   npm install
   ```

2. **Configure Environment Variables**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

   Configure your local settings in `.env`:
   ```env
   NODE_ENV=development
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   GYM_TIMEZONE=Asia/Kolkata

   # PostgreSQL Connection (Unix domain socket or TCP)
   DATABASE_URL="postgresql://postgres@localhost/boxinn_companion?host=/tmp/boxinn_pg&port=5432"
   DIRECT_URL="postgresql://postgres@localhost/boxinn_companion?host=/tmp/boxinn_pg&port=5432"

   # 32-byte hexadecimal secret
   SESSION_SECRET="e9a712f5a4c9b3d18e2f6a7c0b5d4e1f8a9c2b3d4e5f6a7b8c9d0e1f2a3b4c5d"
   CRON_SECRET="dev-cron-reconcile-secret"
   ```

3. **Initialize Database & Apply Migrations**:
   ```bash
   npx prisma migrate deploy
   ```

4. **Seed Development Data**:
   Populate the database with fictional seed users, gym machines, exercise guides, and test memberships:
   ```bash
   npm run prisma:seed
   ```
   *(All seed records use fictional `@boxinn.local` email addresses and mock data).*

5. **Start the Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 3. Seed Accounts & Credentials

The seed script creates the following fictional accounts for local development and QA testing:

| Role | Email | Password | Details |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@boxinn.local` | `AdminPass123!` | Head Coach Vikram (full admin privileges) |
| **Member** | `aarav@boxinn.local` | `MemberPass123!` | Active member with 3-day active streak and valid membership |
| **Pending** | `diya@boxinn.local` | *(Not set)* | Account in `PENDING_VERIFICATION` status for onboarding flow testing |

---

## 4. Test Suites & Verification

The application includes comprehensive unit and integration test suites covering all business rules and security guarantees:

```bash
# 1. Run Domain Unit Tests (39 tests, pure domain rules, no database)
npm test

# 2. Run Database Integration Tests (36 tests, PostgreSQL transactions & API flows)
npm run test:integration

# 3. TypeScript Typecheck
npx tsc --noEmit

# 4. Production Next.js Build
npm run build
```

### Test Coverage Highlights
- **Date & Timezone**: Verification of `Asia/Kolkata` offsets across day boundaries, midnight crossovers, and leap years.
- **Membership Status**: Inclusive access through the recorded expiry date; strict cutoff at `00:00` on the following day; no automatic grace period; distinct handling of suspended vs expired memberships.
- **Attendance & Streaks**: 3-hour automatic session closure; duplicate scan idempotency; 1 to 3 intervening absent days preserving streaks; 4 consecutive absent days resetting streaks; longest streak retention; deterministic full recalculation on admin corrections.
- **Security & Auth**: Two-stage activation (invite claim -> pending verification -> email verification -> active); raw token storage prohibition; database-backed session revocation; atomic PostgreSQL rate limiting under concurrency.

---

## 5. Security & Authentication Architecture

### Two-Stage Member Activation Flow
To prevent unverified email takeovers and ensure verified ownership:
1. **Stage 1 (Admin Invitation)**:
   - Admin generates an invitation via `/api/admin/invitations`.
   - A cryptographically random token (`generateSecureToken(32)`) is generated.
   - Only its SHA-256 hash is saved to `invitation_tokens`.
   - The member receives the activation link with the raw token: `/activate?token=...`.
2. **Stage 2 (Account Setup & Claim)**:
   - Member submits password and profile details to `/api/auth/invitation/claim`.
   - The token is atomically claimed (`claimed_at = NOW()`).
   - The user is created or updated with status `PENDING_VERIFICATION`. **No session is issued.**
   - A separate email verification token is generated, hashed, and dispatched via email.
3. **Stage 3 (Email Verification & Activation)**:
   - Member clicks the verification link sent to their inbox: `/verify-email?token=...`.
   - The verification token is atomically redeemed (`used_at = NOW()`).
   - User status transitions to `ACTIVE`, and `email_verified_at` is stamped.
   - An authenticated session is created, setting the `HttpOnly` session cookie and CSRF cookie.

### Token Hashing Policy
- **Never Store Raw Tokens**: Raw tokens for sessions, invitations, email verifications, and password resets are NEVER written to the database.
- **SHA-256**: All lookup and redemption queries hash incoming tokens via `crypto.createHash('sha256').update(token).digest('hex')` before running SQL queries.

### Session Management & Multi-Device Revocation
- **Database-Backed Sessions**: Session tokens are 32-byte cryptographically random hex strings.
- **Revocation**:
  - Logout revokes the specific session.
  - Password reset immediately revokes **all** active sessions across all devices for that user.
  - Administrative suspension immediately revokes all active sessions for that user.

### CSRF Protection
- State-changing requests (`POST`, `PUT`, `DELETE`, `PATCH`) require a valid `x-csrf-token` header matching the `boxinn_csrf` cookie (Double Submit Cookie pattern).

### Atomic Rate Limiting
- Backed by PostgreSQL `rate_limit_buckets` table using atomic `INSERT ... ON CONFLICT (key) DO UPDATE` queries.
- Prevents race conditions during high-concurrency brute force attacks.
- Configurable per action (e.g., login, password reset, check-in, invitation claiming).

---

## 6. Email Service Configuration

### In-Memory Dispatcher (Development & Testing)
In local development, the application uses `InMemoryEmailDispatcher` (`src/infrastructure/email/email-dispatcher.ts`). It stores dispatched emails in memory and logs activation links to the terminal console without connecting to external services.

### Production Transactional Email Integration
In production, implement `IEmailDispatcher` with your chosen transactional email service provider (e.g., Resend, Postmark, AWS SES, or SendGrid):

```typescript
// Example: src/infrastructure/email/resend-email-dispatcher.ts
import { Resend } from 'resend';
import { IEmailDispatcher, EmailPayload } from './email-dispatcher.ts';

export class ResendEmailDispatcher implements IEmailDispatcher {
  private resend: Resend;
  private fromAddress: string;

  constructor(apiKey: string, fromAddress: string) {
    this.resend = new Resend(apiKey);
    this.fromAddress = fromAddress;
  }

  async sendEmail(payload: EmailPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const { data, error } = await this.resend.emails.send({
        from: this.fromAddress,
        to: payload.to,
        subject: payload.subject,
        html: payload.htmlBody,
        text: payload.textBody,
      });
      if (error) return { success: false, error: error.message };
      return { success: true, messageId: data?.id };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  }
}
```

Set environment variables in production:
```env
EMAIL_PROVIDER="resend"
RESEND_API_KEY="re_123456789..."
EMAIL_FROM="BOX INN <noreply@boxinn.in>"
```

---

## 7. Background Jobs & Reconcile Cron

### Maintenance Endpoint: `/api/cron/reconcile`
The application exposes a maintenance endpoint that performs two critical tasks:
1. **Auto-Closure of Overdue Sessions**: Closes any open attendance sessions older than 3 hours with `is_auto_closed = true`.
2. **Rate Limit Cleanup**: Deletes expired rate-limit bucket rows from the database.

### Security
The endpoint requires an authorization token via HTTP header:
```http
POST /api/cron/reconcile
Authorization: Bearer <CRON_SECRET>
```

### Scheduling Options
- **Vercel Cron**: Configure `vercel.json`:
  ```json
  {
    "crons": [
      {
        "path": "/api/cron/reconcile",
        "schedule": "0 * * * *"
      }
    ]
  }
  ```
- **Linux Crontab** (e.g., on an EC2 or VPS):
  ```bash
  0 * * * * curl -s -X POST https://members.boxinn.in/api/cron/reconcile -H "Authorization: Bearer $CRON_SECRET" > /dev/null
  ```
- **GitHub Actions Scheduled Workflow**:
  ```yaml
  name: Hourly Gym Reconciliation
  on:
    schedule:
      - cron: '0 * * * *'
  jobs:
    reconcile:
      runs-on: ubuntu-latest
      steps:
        - run: curl -sf -X POST ${{ secrets.APP_URL }}/api/cron/reconcile -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
  ```

---

## 8. Database Migrations & Backups

### Creating & Applying Migrations
```bash
# Apply pending migrations in production or staging
npx prisma migrate deploy

# Create a new migration during development
npx prisma migrate dev --name <descriptive_name>
```

### PostgreSQL Backup Procedure
```bash
# Full logical backup of schema and data
pg_dump -h <host> -U <user> -d boxinn_companion -F c -b -v -f "boxinn_backup_$(date +%Y%m%d_%H%M%S).dump"
```

### PostgreSQL Restore Procedure
```bash
# Restore to a clean database
pg_restore -h <host> -U <user> -d boxinn_companion -v "boxinn_backup_<timestamp>.dump"
```

---

## 9. Production Deployment Checklist

1. [ ] **HTTPS Enforced**: Ensure all traffic is served over TLS/SSL so `Secure` cookies (`__Host-boxinn_session`) are transmitted securely.
2. [ ] **Reverse Proxy Headers**: If deployed behind Cloudflare, NGINX, or AWS ALB, ensure `x-forwarded-for` and `x-forwarded-proto` headers are correctly forwarded for rate-limiting.
3. [ ] **Environment Secrets**: Verify `SESSION_SECRET` and `CRON_SECRET` are high-entropy random strings (`openssl rand -hex 32`) and distinct from development values.
4. [ ] **Database Connection Pooling**: For serverless deployments (Vercel, AWS Lambda), connect via Supabase/PgBouncer connection pooler using `DATABASE_URL` with `?pgbouncer=true`, and configure `DIRECT_URL` for running migrations.
5. [ ] **Transactional Email Verified**: Verify SPF, DKIM, and DMARC DNS records for `boxinn.in` so activation and verification emails are delivered reliably to members' inboxes.
6. [ ] **Monitoring & Health Checks**: Ping `/api/health` regularly (e.g., every 60 seconds) with an uptime monitor to verify database connectivity and response latencies.
