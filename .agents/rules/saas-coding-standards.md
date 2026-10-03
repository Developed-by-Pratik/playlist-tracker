---
description: SaaS coding standards, structured logging practices, modularity guidelines, and zero-breakage guarantees for Playlist Tracker
---

# SaaS Coding Standards & Modularity Rules

All code contributions must follow these strict practices:

## 1. Centralized Observability Logging
- Import `logger` from `@/lib/observability/logger`.
- Never use raw `console.log()` in application code.
- Always include an explicit context string (e.g. `'collaboration'`, `'resources'`, `'study-time'`, `'voice'`, `'admin'`).
- Always pass errors to `logger.error(context, message, metadata, error)`.

## 2. Modular Architecture & Directory Separation
- Business logic, data contracts, and storage helpers go in `src/lib/<domain>/`.
- UI components go in `src/components/<Domain>/`.
- Next.js route handlers and pages go in `src/app/`.
- Never put raw database queries or complex asynchronous logic directly inside JSX components.

## 3. Strict Type Safety
- Zero `any` policy. Use explicit interfaces and type unions.
- Re-export domain interfaces through `src/lib/types/`.

## 4. Continuous Documentation Standards
- Every exported function, service, and domain contract must have clear JSDoc/TSDoc annotations.
- Every phase milestone must produce a detailed walkthrough (`phase_X_walkthrough.md`).
- Complex algorithms (e.g. LWW data merging, idle detection, WebRTC signaling) must have clear inline explanatory comments.
- Any Supabase schema changes must be documented with ready-to-run SQL migration blocks.
- **README.md Synchronization**: Whenever features or schemas are added/updated, update `README.md` to reflect current capabilities.

## 5. Zero Breakage
- Preserve existing playlist tracking, daily habits, and cloud synchronization.
- Build new features modularly with graceful local fallbacks.
- Verify with `npx tsc --noEmit` and `npm run build` after every milestone.

