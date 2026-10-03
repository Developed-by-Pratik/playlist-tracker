# Next.js YouTube Playlist Tracker & Learning Hub

A premium, serverless-native **YouTube Playlist Tracker & Learning Hub** designed for developers, students, and self-learners. This application features multi-playlist tracking, Google OAuth (Supabase Auth), automated real-time cloud synchronization, a unified global growth dashboard, and an integrated accordion-collapsible Pomodoro Timer.

Built with **Next.js (App Router + Turbopack)**, **Supabase**, **Framer Motion**, and **Vanilla CSS** for fluid, glassmorphic aesthetics.

---

## 🌟 Key Features

* **Multi-Playlist Support**: Track progress across multiple playlists concurrently. Add any YouTube playlist by pasting its URL, featuring live data preview cards prior to saving.
* **Supabase Authentication**: Secure login flow using Google OAuth, guarded by client-side session gates.
* **Unified Global Growth Dashboard**: 
  * Aggregated learning progress, completion metrics, and streaks calculated across all of your active playlists.
  * Premium, responsive SVG progress charts visualizing daily completion rates.
* **Last-Write-Wins (LWW) Sync**: Smart data conflict resolution protocol ensuring seamless real-time syncing across devices and secure, merge-safe playlist deletion logic.
* **Accordion-Style Collapsible Sidebar**: Fully coordinated sidebar where expanding the Pomodoro Timer (Focus tab), Daily Growth chart, or Milestones automatically collapses any other open sections.
* **Zero Client-Side Keys**: Secured YouTube Data API fetch routes run on serverless endpoints, utilizing Next.js hour-long revalidated static caching (`unstable_cache`) to optimize API quotas.
* **Legacy Data Migration**: Automatic, non-destructive migration that ports legacy local flat structures into a clean structured multi-playlist database schema on first authenticated login.
* **Resources & Links Hub**: Curate and manage essential study links (GitHub repositories, documentation, cheatsheets, and practice links) with instant search, auto-domain formatting, and 1-click clipboard copying.
* **Daily Study Time Tracker**: Automatic active focus time accumulator with 10-minute idle detection, tab visibility detection, and automatic midnight reset.
* **Workspace Mode Toggle (Solo vs. Duo)**: One-click master toggle enabling distraction-free solo study or rich duo collaboration.
* **1-on-1 Duo Pairing**: Connect with a study buddy via a persistent 6-character Duo Code or instant 1-click Demo Partner simulation.
* **Read-Only Partner Progress Mirror**: Live accountability card mirroring your partner's active playlist, overall course completion percentage, today's tasks completed, current study streak, and today's total focus time without edit permissions.
* **Real-Time Presence & Synergy Badge**: Live header presence indicators (`Online Now 🟢`, `Active 12m ago`, `Private 👻`) and interactive companion badge.
* **Privacy & Ghost Mode**: Instant privacy switch allowing users to pause presence broadcasting and mask learning statistics whenever private study is preferred.
* **1-on-1 Duo Chat**: Real-time study buddy chat with message timestamps, unread notification alerts, quick motivational chips, and automated demo bot responses.
* **Shared Daily Scratchpad**: Real-time collaborative scratchpad for code snippets and daily sprint notes that auto-resets every midnight (12:00 AM) for a clean daily slate.
* **Milestone Celebrations**: Canvas confetti particle bursts synchronized when learners hit 50% course progress or 100% course completion milestones.
* **1-on-1 WebRTC Voice Study Lounge**: Peer-to-peer audio room with Web Audio API volume analysis, avatar speaking glow pulses, microphone mute/unmute, and partner deafen controls.
* **Persistent Floating Audio Dock**: Minimalist glassmorphic dock keeping audio co-working live and controllable while browsing playlist videos, checking off tasks, or writing notes.
* **Centralized SaaS Observability**: Structured in-memory ring-buffer logging (`DEBUG`, `INFO`, `WARN`, `ERROR`) capturing API operations, sync merges, and client diagnostics for administrative audit trails.

---

## 🛠️ Technology Stack

* **Frontend Framework**: Next.js 16 (App Router, Turbopack)
* **Styling**: Modern Vanilla CSS (Sleek dark mode, custom fonts, glassmorphism, responsive grid systems)
* **Animations**: Framer Motion (Fluid list reorderings, smooth accordion transitions, scale-on-hover micro-interactions)
* **Backend Database & Services**: Supabase (PostgreSQL, Realtime Engine, GoTrue Auth)
* **APIs**: YouTube Data API v3 (Server-side proxied)

---

## 📦 Environment Setup

Create a `.env.local` file in the root of the project and add the following keys:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# YouTube API Configuration
YOUTUBE_API_KEY=AIzaSyA...
```

---

## 🗄️ Supabase Database Schema

To support real-time sync and data persistence, create a table named `tracker_data` in your Supabase Postgres Database with the following SQL schema:

```sql
create table public.tracker_data (
  id uuid default gen_random_uuid() not null,
  sync_id text not null,                -- Matches user's authenticated UID (or "local" for offline mode)
  data jsonb not null,                  -- JSON payload containing playlists, subtasks, and updatedAt timestamp
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  constraint tracker_data_pkey primary key (id),
  constraint tracker_data_sync_id_key unique (sync_id)
);

-- Enable Row-Level Security (RLS)
alter table public.tracker_data enable row level security;

-- RLS Policies
create policy "Users can read their own sync data"
  on public.tracker_data for select
  using (auth.uid()::text = sync_id);

create policy "Users can insert their own sync data"
  on public.tracker_data for insert
  with check (auth.uid()::text = sync_id);

create policy "Users can update their own sync data"
  on public.tracker_data for update
  using (auth.uid()::text = sync_id);

-- Duo Partnerships Table (1-on-1 Buddy pairing)
create table public.duo_partnerships (
  id uuid default gen_random_uuid() not null,
  duo_code text not null,
  user_a text not null,
  user_b text not null,
  status text not null default 'active',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  constraint duo_partnerships_pkey primary key (id),
  constraint duo_partnerships_duo_code_key unique (duo_code)
);

alter table public.duo_partnerships enable row level security;
create policy "Users can view their own duo partnerships"
  on public.duo_partnerships for select using (true);
create policy "Users can create or update duo partnerships"
  on public.duo_partnerships for insert with check (true);
create policy "Users can update duo partnerships"
  on public.duo_partnerships for update using (true);

-- Partner Snapshots Table (Read-Only Mirror & Presence)
create table public.partner_snapshots (
  id uuid default gen_random_uuid() not null,
  user_id text not null,
  display_name text not null,
  avatar_url text,
  active_playlist text,
  progress_pct numeric default 0,
  today_completed integer default 0,
  current_streak integer default 0,
  today_study_seconds integer default 0,
  is_private boolean default false,
  last_active_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  constraint partner_snapshots_pkey primary key (id),
  constraint partner_snapshots_user_id_key unique (user_id)
);

alter table public.partner_snapshots enable row level security;
create policy "Anyone can read partner snapshots"
  on public.partner_snapshots for select using (true);
create policy "Users can upsert their own snapshot"
  on public.partner_snapshots for insert with check (true);
create policy "Users can update their own snapshot"
  on public.partner_snapshots for update using (true);

-- Duo Chat Messages Table
create table public.duo_messages (
  id text not null,
  partnership_id text not null,
  sender_id text not null,
  sender_name text not null,
  message text not null,
  is_read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  constraint duo_messages_pkey primary key (id)
);

alter table public.duo_messages enable row level security;
create policy "Users can view duo messages"
  on public.duo_messages for select using (true);
create policy "Users can insert duo messages"
  on public.duo_messages for insert with check (true);
create policy "Users can update duo messages"
  on public.duo_messages for update using (true);

-- Duo Daily Scratchpad Table
create table public.duo_scratchpads (
  id uuid default gen_random_uuid() not null,
  partnership_id text not null,
  note_date text not null,               -- 'YYYY-MM-DD'
  content text default '',
  last_edited_by text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  constraint duo_scratchpads_pkey primary key (id),
  constraint duo_scratchpads_partnership_date_key unique (partnership_id, note_date)
);

alter table public.duo_scratchpads enable row level security;
create policy "Users can view shared scratchpad"
  on public.duo_scratchpads for select using (true);
create policy "Users can upsert shared scratchpad"
  on public.duo_scratchpads for insert with check (true);
create policy "Users can update shared scratchpad"
  on public.duo_scratchpads for update using (true);
```

---

## 🚀 Local Development

Follow these steps to run the application locally:

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run Development Server**:
   ```bash
   npm run dev
   ```

3. **Open the Application**:
   Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

4. **Verify TypeScript & Production Compilation**:
   ```bash
   npm run build
   ```

---

## 🌐 Production Deployment (Vercel)

1. **Import Repository**: Link your repository to a new project in your **Vercel Dashboard**.
2. **Add Environment Variables**: Insert your `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `YOUTUBE_API_KEY` into the Vercel project environment settings.
3. **Configure Google OAuth Redirects**:
   * Navigate to your **Supabase Dashboard** -> **Authentication** -> **URL Configuration**.
   * Under **Redirect URLs**, add your deployment URL (e.g., `https://your-app-name.vercel.app`).
4. **Deploy**: Trigger a production deploy. Your app is now live, secure, and auto-scaling!
