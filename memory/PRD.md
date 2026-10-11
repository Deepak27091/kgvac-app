# KG Vac Service – Job Manager (PRD)

## Overview
Internal job scheduling & management mobile app (Expo React Native + FastAPI + MongoDB) for KG Vac Service, a commercial cleaning business. 1 admin + 2 staff users.

## Features Added (Iteration 2)
- **Quick Reschedule Picker**: Inline calendar + 15-min time slot grid replaces manual date typing on reschedule modal and the new/edit job form.
- **Daily Summary Email**: Server scheduler sends each active user a morning email at 12:00 UTC listing their day's jobs (customer, service, address) via Emergent Resend.
- **Overdue Jobs**: Jobs with scheduled time in the past that are still Scheduled/Start/Processing/Rescheduled are flagged `is_overdue=true`. New dashboard stat card "Overdue" + red Overdue pill on job cards + `/api/jobs?overdue=true` filter.
- **Signature Capture**: Completing a job opens a signature pad; signature stored as base64 data URL and shown on Job Details.
- **Seed password idempotency**: Added `RESEED_PASSWORDS=true` env flag so dev/preview password changes are safely restored on backend restart.

## Core Features Delivered (MVP)
- **Auth**: JWT + bcrypt + token-version invalidation; Admin + 2 Staff seed accounts.
- **Password management**: Change password (self), admin-initiated reset (email link), forgot-password flow (Emergent Resend).
- **Dashboard**: Today / Upcoming / Scheduled / Started / Processing / Completed / Rescheduled / Cancelled stats + Today's Schedule + Upcoming jobs + Earnings header. Role-scoped (admin sees all, staff sees own).
- **Jobs**: Create / edit / view / list / search / filter (status, date range, assignee, category). Status workflow with 6 states (Scheduled, Start, Processing, Completed, Rescheduled, Cancelled) + colored badges. Reschedule records original/new in activity. Cancel confirms + optional reason. Notes editable.
- **Earnings**: Admin sees total/today/month/by-staff/by-category breakdown; staff sees own only. Cancelled jobs excluded.
- **Customers**: CRUD + search; customer details show past & upcoming jobs; new-job shortcut.
- **Service Categories**: Admin can add/activate/deactivate; seeded Grease Trap Cleaning, Drain Cleaning, Other.
- **Calendar**: Monthly calendar with multi-dot status indicators; day selection shows job list for date; admin can add from selected date.
- **Notifications**: In-app notification center + Emergent push (SuprSend relay). Server reminder scheduler sends 24h & 1h before job start to assigned staff + admins (dedup via reminders_sent).
- **Activity log**: Per job — created, edited, status changes, note updates, assignment changes.
- **Admin screens**: User management (create user, deactivate, send reset email), Service Categories.

## Tech
- Backend: FastAPI, Motor (MongoDB), PyJWT, bcrypt, httpx. Lifespan seeds users/categories + starts asyncio reminder loop.
- Frontend: Expo SDK 57, Expo Router, React Query, react-native-safe-area-context, react-native-calendars, @react-native-vector-icons/feather, expo-notifications, expo-secure-store.
- Integrations: Emergent Resend (password reset email), Emergent Push (job reminders).
