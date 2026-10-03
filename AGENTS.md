# Agent & Developer Guidelines: SaaS Standards & Best Practices

This document defines the architectural rules, coding standards, logging practices, and modularity principles for the **Playlist Tracker** codebase. All automated agents and contributors must strictly adhere to these rules.

---

## 1. 🔍 Centralized Logging & Observability
Every module, service, and async workflow must use the central SaaS observability logger.

- **Import Path**: `import { logger } from '@/lib/observability/logger';`
- **Rule**: **NEVER use raw `console.log()`** in production application code.
- **Log Levels**:
  - `logger.debug(context, message, metadata)`: Granular diagnostics, state transitions, debug traces.
  - `logger.info(context, message, metadata)`: Key milestones, user actions, successful syncs, lifecycle events.
  - `logger.warn(context, message, metadata, error)`: Recoverable degradations, fallback activations, offline modes.
  - `logger.error(context, message, metadata, error)`: Unhandled exceptions, failed network calls, data corruptions.
- **Context Tagging**: Always specify an explicit context string matching the feature domain:
  - Examples: `'collaboration'`, `'auth'`, `'cloud-sync'`, `'resources'`, `'study-time'`, `'webrtc-voice'`, `'admin'`.
- **Catch Blocks**: All `catch (error)` blocks must log through `logger.error` or `logger.warn` with error stack preservation.

---

## 2. 🧩 Modularity & File Organization
Maintain a feature-driven, scalable directory structure. Do not place disparate domain logic in giant catch-all files.

```text
src/
├── app/                        # Next.js App Router (Routes & layout shells)
│   ├── page.tsx                # Main tracker interface
│   ├── admin/page.tsx          # Central Admin Governance Portal
│   └── api/                    # Serverless API routes
├── components/                 # UI Components (Feature-grouped)
│   ├── Collaboration/          # Duo Hub, Chat, Scratchpad, Synergy, Milestone Modals
│   ├── Voice/                  # WebRTC Voice Study Lounge & Floating Dock
│   ├── Resources/              # Bookmarks & Resource Cards
│   ├── VideoList/              # Video playlist cards & checklists
│   ├── Playlist/               # Playlist switcher & modals
│   ├── Sidebar/                # Stats sidebar, growth chart, pomodoro
│   └── Layout/                 # Headers, theme toggle, skeletons, modals
└── lib/                        # Business Logic & Data Layer
    ├── observability/          # SaaS Logger, metrics, audit trail feeds
    ├── collaboration/          # Duo pairing, heartbeat, presence, sync
    ├── voice/                  # WebRTC audio connection & visualizer
    ├── resources/              # Resources storage CRUD & sync helpers
    ├── study-time/             # Active study time tracker with idle detection
    ├── admin/                  # Admin DB inspector & governance queries
    ├── storage.ts              # Core playlist & task storage (unbroken)
    ├── cloud-storage.ts        # Supabase synchronization & LWW merge logic
    └── types/                  # Domain TypeScript interfaces & contracts
```

### Modularity Rules:
1. **Separation of Concerns**:
   - `src/lib/`: Pure business logic, API communication, storage mutations, and state transformers.
   - `src/components/`: Visual rendering, user interaction, animation, and UI state.
   - Never embed database queries or raw fetch logic directly inside JSX render trees; route them through `src/lib/` services.
2. **Component Granularity**:
   - Break large interfaces into focused subcomponents (e.g. `ChatWindow`, `Scratchpad`, `SynergyBadge`).
   - Keep individual component files under 350-400 lines where practical.

---

## 3. 🛡️ Strict TypeScript & Clean Code Standards
- **Zero `any` Policy**: Never use `any`. Use strict interfaces, type unions, generics, or `unknown` with type guards.
- **Contract Integrity**: All shared types must reside in `src/lib/types/` and be re-exported cleanly.
- **React 19 / Next.js Guidelines**:
  - **No synchronous `setState` in effect bodies**: Do not call `setState()` directly inside `useEffect` on mount if it causes cascading re-renders. Use lazy initializers or event handlers instead.
  - **Hooks Optimization**: Wrap heavy callbacks in `useCallback` and expensive derivations in `useMemo`.
  - **Immutability**: Never mutate state objects directly. Always return new references using functional updates or deep clones where required.

---

## 4. 🔄 Backward Compatibility & Zero-Breakage Guarantees
The existing core product (Playlists, Video Checklist Tasks, YouTube playback, Daily Habits, Cloud Sync, Dark Theme) must **never be broken**:
1. **Incremental Delivery**: Work in small, isolated phases. Verify each phase with automated checks before proceeding.
2. **Default-Safe Feature Flags**: New experimental or collaborative features must be opt-in or default-safe (e.g. `collaborationEnabled: false` by default).
3. **Graceful Fallbacks**: Every service relying on external infrastructure (Supabase tables, WebRTC permissions) must provide an automatic local storage / simulated fallback so the app runs smoothly offline or before database migrations are executed.

---

## 5. 📝 Continuous Documentation Standards
Documentation is a first-class citizen in this codebase. Code and documentation must evolve together:

1. **JSDoc / TSDoc Annotations**:
   - Every exported service function, storage transformer, custom hook, and domain type must include a JSDoc block explaining:
     - Purpose and role in the system.
     - Parameter definitions and return values.
     - Edge cases or fallback behaviors.
2. **Phase Walkthroughs & Artifacts**:
   - For every incremental milestone or major feature delivered, create or update a dedicated walkthrough document (e.g. `phase_X_walkthrough.md`) recording:
     - Changes made with clickable file links.
     - Architectural trade-offs and rationale.
     - Test commands and validation results.
3. **Database Schema & Migration Docs**:
   - Any new Supabase tables, RLS policies, or realtime configurations must be documented in both the implementation plan and the root `README.md` with complete, copy-pasteable SQL snippets.
4. **Self-Documenting Code**:
   - Favor descriptive, intention-revealing variable and function names over terse abbreviations.
   - Explain the "why", not just the "what", in non-trivial algorithms (e.g., LWW merge conflict resolution, audio frequency analysis).
5. **README.md Synchronization**:
   - Whenever new features, database tables, environment keys, or architectural modules are delivered, `README.md` must be updated concurrently to reflect current functionality, setup guides, and SQL schemas.

---

## 6. ✅ Verification & Quality Gate
Before any code is committed or claimed complete, the following commands must succeed:
1. `npx tsc --noEmit`: Strict TypeScript compilation with **0 errors**.
2. `npx eslint <modified_files>`: Clean linting with **0 errors**.
3. `npm run build`: Production Next.js build compilation with **0 errors**.

---

## 📚 Related Documentation
- Implementation Plan: [`collaborative_study_buddy_plan.md`](file:///C:/Users/Pratik/.gemini/antigravity-ide/brain/75e5393f-f30c-404e-a8db-cc7e5c8983e4/collaborative_study_buddy_plan.md)
- Phase 1 Walkthrough: [`phase_1_walkthrough.md`](file:///C:/Users/Pratik/.gemini/antigravity-ide/brain/75e5393f-f30c-404e-a8db-cc7e5c8983e4/phase_1_walkthrough.md)

