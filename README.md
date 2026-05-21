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
