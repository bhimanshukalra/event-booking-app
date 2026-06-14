# Event Booking Platform

Concurrency-safe event booking platform with event discovery, temporary reservation locking, mocked payments, ticket validation, admin workflows, and live inventory visibility.

The project is currently in **Foundation**. The first target is to make the backend and mobile app run locally with seeded event discovery before moving into booking reservations.

## Project Structure

```text
backend/  Express + TypeScript + Prisma + PostgreSQL API
mobile/   Expo + React Native + TypeScript app
```

## Prerequisites

- Node.js 24 LTS or another Prisma-supported Node version
- pnpm 11
- PostgreSQL
- Redis is optional for Phase 2 reservation support

## Backend Setup

Create `backend/.env` from the example and set `DATABASE_URL`.

Optional backend environment variables:

```text
PORT=4000
REDIS_URL=redis://localhost:6379
```

Redis support is best-effort at this stage. PostgreSQL remains the source of truth for reservation correctness if Redis is unavailable or not configured.

```bash
cd backend
pnpm install
pnpm exec prisma migrate dev
pnpm run prisma:seed
pnpm run dev
```

Useful backend commands:

```bash
pnpm run build
pnpm run test
pnpm run prisma:generate
pnpm run prisma:migrate
pnpm run prisma:reset
pnpm run prisma:seed
```

To reset the local database without manual SQL:

```bash
pnpm run prisma:reset
pnpm run prisma:seed
```

## Mobile Setup

Create `mobile/.env` from the example and set `EXPO_PUBLIC_API_URL` to your backend API URL.

```bash
cd mobile
pnpm install
pnpm run start
```

Useful mobile commands:

```bash
pnpm run ios
pnpm run android
pnpm run web
pnpm exec tsc --noEmit
```

## Root Commands

From the repository root:

```bash
pnpm run backend:dev
pnpm run backend:build
pnpm run backend:test
pnpm run mobile:start
pnpm run mobile:typecheck
pnpm run format
pnpm run lint
pnpm run check
```

## Current Foundation API

```text
GET /health
GET /events
GET /events/:id
```

Seeded demo users:

```text
customer@eventbooking.local
admin@eventbooking.local
staff@eventbooking.local
```

Protected demo auth checks:

```text
GET /auth/me
GET /auth/demo-users
GET /auth/admin-check
GET /auth/staff-check
```

Use the `x-demo-user-email` header to run protected requests as a seeded user.

## Foundation Verification

Run the full foundation check from the repository root:

```bash
pnpm run check
```

This verifies formatting, backend TypeScript build, mobile TypeScript build, and backend API smoke tests.

## Admin Surface Decision

For Foundation, admin/staff work starts as backend API-only. A web admin UI can be added later if it helps the demo, but Phase 1.1 does not require one.
