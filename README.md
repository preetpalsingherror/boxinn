<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/brand/boxinn-stacked-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="public/brand/boxinn-stacked.png">
  <img alt="BOX INN — Rise Above The Average" src="public/brand/boxinn-stacked-dark.png" width="320">
</picture>

<br/>
<br/>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/brand/boxinn-horizontal-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="public/brand/boxinn-horizontal.png">
  <img alt="BOX INN Horizontal Banner" src="public/brand/boxinn-horizontal.png" width="540">
</picture>

<br/>
<br/>

[![Gym Facility](https://img.shields.io/badge/FACILITY-BOX_INN_YELAHANKA-CADA03?style=for-the-badge&labelColor=0A0B0E&logoColor=CADA03)](https://boxinn.vercel.app)
[![Motto](https://img.shields.io/badge/ESTD_2026-RISE_ABOVE_THE_AVERAGE-F8F9FA?style=for-the-badge&labelColor=14171F)](https://boxinn.vercel.app)
[![Tests](https://img.shields.io/badge/TESTS-78%2F78_PASSING-10B981?style=for-the-badge&labelColor=0A0B0E)](tests/)
[![Stack](https://img.shields.io/badge/STACK-NEXT.JS_15_%E2%80%A2_POSTGRESQL_18-38BDF8?style=for-the-badge&labelColor=0A0B0E)](package.json)

# 🥊 BOX INN Companion — Building Software for My Local Gym in Public

**By Preetpal Singh** — *3rd Year Computer Science & Engineering Student*  
**Built for:** **BOX INN Fitness & Conditioning**, Puttenahalli, Yelahanka, Bengaluru (`Asia/Kolkata`)  
**Live Demo URL:** [**https://boxinn.vercel.app**](https://boxinn.vercel.app)

</div>

---

## 💡 The Story: Why I Built This Instead of Another Toy Project

As a 3rd-year engineering student training regularly at **BOX INN in Yelahanka**, I noticed that while our coaching and equipment on the floor were top-tier, the day-to-day operations still had classic local-gym friction:

1. **Front-Desk & Renewal Chaos**: Tracking whose membership was expiring meant digging through spreadsheets or registers and manually typing out WhatsApp reminders one by one.
2. **Coaches Repeating the Same Machine Setup Cues**: During peak evening hours (6 PM – 8 PM), new members constantly had to wait to ask a trainer *"How do I set the damper on the Concept2 RowErg?"* or *"How do I adjust the dual cable station for triceps pushdowns vs. chest flys?"*
3. **"Is the Gym Crowded Right Now?"**: Students and working professionals around Yelahanka had no way to check live gym floor crowd levels before walking over.
4. **Expensive Hardware Turnstiles weren't worth it**: Biometric scanners fail with chalky/sweaty hands after deadlifts and cost ₹50,000+ to install and maintain.

So I went to the gym staff, asked what they actually needed, and started **building the BOX INN Member & Operations Companion in public**—iterating week by week from real feedback on the gym floor until it was 100% production-ready.

---

## ⚡ Try the Live App Right Now

> 🌐 **Live Production URL:** [https://boxinn.vercel.app](https://boxinn.vercel.app)

### 🔑 Test Accounts (Strict Role Separation)

In a real gym, a member should never touch admin tools, and the front-desk admin portal shouldn't be mixed up with a personal workout profile. Both portals are strictly isolated at the layout and API levels:

| Persona | Login Handle / Email | Password | What to Explore |
| :--- | :--- | :--- | :--- |
| **Member (My Account)** | `preet` *(or `preet@boxinn.local`)* | `preetpal` | 4-day active streak, live floor occupancy, in-app QR check-in camera, attendance heatmap |
| **Member (Demo Athlete)** | `aarav@boxinn.local` | `MemberPass123!` | 3-day active streak, membership progress bar, equipment & video library |
| **Staff Admin / Head Coach** | `admin` *(or `admin@boxinn.local`)* | *(Private — Shared with BOX INN Staff)* | Live gym floor ops, Entrance QR Poster generator, 1-click WhatsApp renewals, multi-exercise machine manager |

### 🏋️ Direct Equipment QR Links (What happens when you scan a machine sticker)
* **All Gym Stations**: [/machines](https://boxinn.vercel.app/machines)
* **Dual Adjustable Cable Station (Multi-Exercise + Videos)**: [/machines/M-CABLE-01](https://boxinn.vercel.app/machines/M-CABLE-01)
* **Concept2 RowErg (HYROX / Conditioning)**: [/machines/M-ROW-01](https://boxinn.vercel.app/machines/M-ROW-01)
* **Rogue Echo Fan Bike**: [/machines/M-BIKE-01](https://boxinn.vercel.app/machines/M-BIKE-01)
* **Concept2 SkiErg Station**: [/machines/M-SKI-01](https://boxinn.vercel.app/machines/M-SKI-01)
* **Olympic Lifting Platform & Rig**: [/machines/M-OLY-01](https://boxinn.vercel.app/machines/M-OLY-01)

---

## 🛠️ Build-in-Public Log: How the Idea Evolved with Gym Feedback

### Iteration 1 — Solving the "Weekend Rest Day" Streak Problem
Most habit apps kill your streak if you miss a single day. In strength and CrossFit/HYROX training, **rest days are mandatory**—if a member trains Friday and comes back Tuesday, losing their streak demotivates them.
* **What I built**: A deterministic **Consistency Streak Engine** (`src/domain/`) pinned to `Asia/Kolkata` that preserves a member's active streak across **1 to 3 intervening rest days**, and only resets on the **4th consecutive absent day** (while preserving their all-time `longestStreak`).
* **Retroactive Admin Fix**: If a member's phone died and the coach logs their past visit later in `/admin/attendance`, the entire historical streak recalculates deterministically inside an atomic PostgreSQL transaction.

### Iteration 2 — ₹0 Hardware Cost Entrance Check-In & Live Crowd Meter
Instead of buying a fingerprint scanner, we turned the reception desk into a QR check-in station.
* **Admin Entrance QR Poster Generator**: From `/admin`, staff can generate and print an official A4 **BOX INN Reception Check-In Poster** (`BOXINN-ENTRANCE-YELAHANKA`) in one click.
* **In-App Camera + Auto Deep-Link Check-In**: Members can scan using the built-in browser camera on `/checkin` or their phone's native camera app. Scanning twice on the same day is idempotent—it shows a friendly confirmation instead of creating duplicate entries.
* **Live Floor Occupancy Counter**: Every check-in opens a **3-hour active floor window**. Both `/home` and `/admin` calculate how many athletes are currently training right now and display a live *Quiet / Moderate / Peak Hours* indicator.

### Iteration 3 — Multi-Exercise Station Stickers & Embedded Video Coaching
When I first showed the machine directory to the gym, we realized a single station (like a Cable Crossover Tower or Lifting Rig) isn't used for just one movement—members do *Triceps Pushdowns*, *High-to-Low Chest Flys*, *Face Pulls*, etc. on the same station.
* **Multiple Exercises per Station**: Upgraded the schema and `/admin/machines` UI so coaches can attach **multiple exercises** to any single machine station, edit/delete machines they don't want, and paste any YouTube, YouTube Shorts, or Vimeo link (automatically normalized to a clean privacy-enhanced embed player).
* **Printable QR Sticker Sheet**: Added a `"Print QR Labels"` view in `/admin/machines` that lays out scannable SVG QR stickers with the BOX INN branding, ready to laminate and stick onto every machine in the gym.

### Iteration 4 — 1-Click WhatsApp Renewals & Zero-Lag Production Speed
* **1-Click WhatsApp Renewal Generator**: In `/admin` and `/admin/members`, any member whose plan is expiring soon or expired gets a direct WhatsApp button that opens `wa.me` with their phone number and a personalized renewal message pre-filled—saving the front desk hours every month.
* **Eliminating UI Lag**: Moved layout role verification to a `sessionStorage` fast-path with background re-validation and route prefetching (`prefetch={true}`), served via a compiled Next.js production build for `<15ms` page transitions.

---

## 📊 Real Impact for BOX INN Yelahanka

| Gym Problem Before | How BOX INN Companion Solves It |
| :--- | :--- |
| Biometric scanner errors with chalky/sweaty hands | **QR Entrance Poster + Smartphone Check-In** (₹0 hardware cost, works in 1 second) |
| Chasing expiring members manually on WhatsApp | **1-Click WhatsApp Renewal Generator** + instant **`+30d` Audited Renewal** button |
| Beginners unsure how to use rowers, ski-ergs, or cables | **Scannable QR Stickers on Machines** opening multi-exercise tabs with embedded video tutorials & safety cues |
| Members showing up during overcrowded peak slots | **Live Gym Floor Occupancy Counter** based on active 3-hour check-in sessions |
| Shared/confusing admin vs. member views | **Strict Role Isolation** (`ADMIN` vs `MEMBER`) with database-backed sessions, CSRF protection, and audit logs |

---

## 🧠 Under the Hood (Engineering & Architecture)

Even though this started as a college project for my gym, I engineered it with production-grade backend practices:

* **Framework**: Next.js 15 App Router (React 19, TypeScript in strict mode)
* **Database**: PostgreSQL 18 + Prisma ORM with serializable/atomic transactions for check-ins, token redemptions, and streak recalculations
* **Security built from scratch (No black-box auth)**:
  * Two-stage member onboarding (Admin Invite -> Member Password Claim -> Email Token Verification)
  * SHA-256 hashed `SessionRecord` tokens in `HttpOnly`, `SameSite=Lax` cookies with instant server-side revocation
  * Double-Submit Cookie CSRF protection on all mutating endpoints (`POST`, `PUT`, `DELETE`)
  * Atomic PostgreSQL sliding-window rate limiter (`RateLimitBucket`)
* **Automated Testing (78 Tests Passing)**:
  * **39 Unit Tests**: Testing inclusive midnight IST membership expiry cutoffs, leap-year calendar math, 3-hour session auto-closure, and the 3-day rest-day streak matrix.
  * **39 Integration & Concurrency Tests**: Testing parallel check-in race conditions (`Promise.all`), concurrent token redemptions, rate-limit bucket exhaustion, and role guards against a live PostgreSQL database.

```text
src/
├── domain/           # Pure business rules (streaks, inclusive expiry, IST dates, 3h sessions)
├── application/      # Use-case services (auth, attendance, invitations, admin actions)
├── infrastructure/   # Prisma client, PostgreSQL rate limiter, password & token hashing
├── presentation/     # Cookie/CSRF security guards & request validation
├── app/              # Next.js App Router (strictly separated (member) and admin portals)
tests/
├── unit/             # 39 fast domain unit tests
└── integration/      # 39 PostgreSQL integration & concurrency race tests
```

---

## 🚀 Running It Locally

### 1. Clone & Install
```bash
git clone https://github.com/preetpalsingherror/boxinn.git
cd boxinn
npm install
```

### 2. Configure `.env`
```bash
cp .env.example .env
```
Point `DATABASE_URL` to your local PostgreSQL instance:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/boxinn_dev?schema=public"
APP_ORIGIN="http://localhost:3000"
```

### 3. Migrate & Seed the Gym Data
```bash
npx prisma migrate dev
npm run prisma:seed
```

### 4. Run Tests & Start Server
```bash
# Run strict TypeScript check + all 78 unit & integration tests
npm run typecheck
npm test
npm run test:integration

# Run in zero-lag production mode
npm run build
npm run start
```

---

*Built with grit in Yelahanka, Bengaluru — if you're a student building software for real local businesses around you, feel free to star ⭐ the repo or reach out!*
