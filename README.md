# BOX INN Member Companion

A private, modern web application for members and staff of **BOX INN**, Puttenahalli, Yelahanka, Bengaluru. It serves as a companion to the main gym website and provides a member portal alongside an administrative management dashboard.

---

## Features

### Member Portal

* **Dashboard**: Personalized welcome, active streak tracking, visit count, announcements, and current membership status.
* **QR Check-in**: Check-in mechanism with duplicate scan prevention and validation against membership eligibility.
* **Progress & History**: Attendance calendar, historical visit logs, and streak metrics.
* **Exercise & Machine Library**: Equipment instructions, safety notes, form cues, and QR-accessible machine guide pages.
* **Profile & Security**: Member profile management, password updates, and session logout controls.

### Admin Portal

* **Overview & Metrics**: Database-backed counts of active members, expiring memberships, and daily check-ins.
* **Member & Membership Management**: Directory search, two-stage invitation creation/revocation, renewals, and administrative status controls (freeze, suspend, activate).
* **Attendance Corrections**: Manual visit corrections with mandatory reasons and immutable audit log tracking.
* **Content Management**: Exercise guide updates, machine QR destination management, and gym announcements.

---

## Core Domain Rules

* **Timezone**: All local operations, calendar days, and timestamps are anchored to `Asia/Kolkata`.
* **Attendance & Check-in**:
  * Maximum of one attendance record per member per calendar day, enforced at the database level.
  * Sessions automatically close 3 hours after check-in.
  * Duplicate scans on the same day provide friendly notices without creating extra records.
* **Membership Validity**:
  * Inclusive through the recorded expiry date; access is cut off strictly at `00:00` the following day.
  * No automatic grace period.
  * Suspended, frozen, or future-dated memberships cannot check in.
* **Streak Calculation**:
  * Increments on consecutive attendance days.
  * Preserved across 1 to 3 intervening absent calendar days.
  * Resets after 4 consecutive absent calendar days.
  * Longest streak and historical records are preserved.
  * Admin corrections deterministically recalculate streaks within a database transaction.

---

## Tech Stack & Architecture

* **Framework**: Next.js App Router (React, TypeScript strict mode)
* **Database & ORM**: PostgreSQL with Prisma
* **Styling**: Tailwind CSS and Lucide icons
* **Security & Auth**:
  * Two-stage invitation and email verification
  * SHA-256 hashed session persistence and atomic token redemption
  * PostgreSQL-backed atomic rate limiting
  * CSRF protection and secure session cookie handling (`HttpOnly`, `SameSite=Lax`, `Path=/`)
* **Testing**: Node.js test runner for domain unit/integration suites and Playwright for browser flows

---

## Getting Started

### Prerequisites

* Node.js (v20+ recommended)
* PostgreSQL database instance
* npm

### 1. Clone & Install Dependencies

```bash
git clone <repository-url>
cd boxinn
npm install
```

### 2. Environment Configuration

Copy the sample environment file and configure your local settings:

```bash
cp .env.example .env
```

Ensure your `DATABASE_URL` points to your local PostgreSQL development instance:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/boxinn_dev?schema=public"
NODE_ENV="development"
APP_ORIGIN="http://localhost:3000"
```

### 3. Database Setup & Migrations

Run Prisma migrations and populate the database with development seed data:

```bash
npx prisma migrate dev
npm run prisma:seed
```

> *Note: Seed data contains only fictional users and `@boxinn.local` email addresses.*

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Testing

Run tests against a dedicated local test database:

```bash
# Run domain unit tests (39 tests)
npm test

# Run database integration tests (36 tests)
npm run test:integration

# Type check
npm run typecheck

# Production build check
npm run build
```

---

## Project Structure

```text
src/
├── domain/           # Pure business rules (streaks, membership validity, dates)
├── application/      # Use cases & workflows (auth, attendance, invitations)
├── infrastructure/   # Database (Prisma), rate-limiting, security & cookies
├── presentation/     # Route handlers, middleware guards & validation schemas
├── app/              # Next.js App Router pages (portal, admin, auth)
tests/
├── unit/             # Pure domain unit tests
├── integration/      # Database-backed integration tests
docs/
├── architecture-plan.md     # Architectural specifications & security design
└── setup-and-operations.md  # Detailed setup, operations & deployment guide
```
