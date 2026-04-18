# GoalForge — Phases 1–4

Personal goal operating system. Phases 1–4: Core + AI Planning + Google Sheets + WhatsApp Bot.

## Features (Phase 1 + 2 + 3 + 4 + 5 + 6)

### Phase 1: Core
- Firebase Auth (email/password signup + login, WhatsApp number capture)
- Yearly goal plan setup (guided 7-step form matching Elivate Network structure)
- Monthly goals with predefined library + custom goals
- 4 tracking types: Target, Measurable, Habit, Checklist
- Progress dashboard with consistency percentages and pace indicators
- 66-day habit tracker with "never miss twice" reset logic
- Light/dark mode toggle
- Mobile-first responsive design

### Phase 2: AI-Powered Planning
- AI-generated weekly breakdown from monthly goals (Anthropic Claude)
- AI-generated daily focus plan from weekly actions
- Month-start AI calibration (analyzes goals against past performance)
- Weekly reflection prompts with AI analysis
- Goal rollover from previous month (carry forward unfinished goals)
- PDF export of monthly goals + weekly plan
- Per-goal AI feedback (realistic, ambitious, overloaded assessment)

### Phase 3: Google Sheets Integration
- Auto-generate styled daily tracker from goals + daily IPAs
- Template: task columns, progress %, streaks, status emojis, dropdowns
- Monthly summary, weekly breakdown, task hit rates, fine calculator
- New tab per month in same spreadsheet
- Bidirectional sync: sheet data flows back into app dashboard
- Quotes & Guide sheet auto-generated

### Phase 4: WhatsApp Bot + AI Coach
- Twilio WhatsApp integration (Meta Business API ready for migration)
- AI coach with FULL goal context: yearly vision, monthly goals, weekly plan, 66-day habit, assigned tasks
- Commands: goals, habit, done habit, done [task], update [goal] [number], weekly, help
- Free-form chat with goal-aware AI coaching
- Scheduled cron reminders: morning check-in, midday push, evening push, night review
- Zero-progress emergency alert (fires if 0 tasks done by midday)
- Assigned task reminders from team leader
- Conversation memory (last 10 exchanges)
- Smart skip: doesn't nag when all tasks are done
- Adaptive personality: supportive when working hard, firm when slacking

### Phase 5: Team Accountability
- Create team or join via invite code/link/Member ID
- Recursive tree structure with unlimited depth visibility
- Leader dashboard: invite code sharing, member tree drill-down, progress stats
- Assigned tasks with three scopes: direct downline, full tree, or specific members
- Task types: one-time or recurring with deadlines
- Optional proof requirement (text/link/screenshot)
- Customizable fines per task with per-member exemption list
- Member fine tracking with overdue task list
- Team member progress visibility (goals, habits, today's tasks)
- AI coach receives assigned tasks in WhatsApp context

### Phase 6: Analytics & History
- Month close-out reports with full stats (by type, category, weekly breakdown)
- Historical timeline: up to 12 months of past reports
- Year-to-date dashboard: avg completion, total goals completed, habit days
- Visual monthly trend bar chart
- Category breakdown (YTD completion rates per goal category)
- AI-powered trend analysis: patterns, strengths, recommendations
- Auto report generation on month rollover
- Expandable month cards with deep stats (types, habit consistency, weekly plans)
- Best month highlighting

## Setup

### 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project (or use existing `fhg-onboarding`)
3. Enable **Authentication** → Email/Password
4. Enable **Firestore Database** in production mode
5. Copy your Firebase config from Project Settings → Your apps → Web app

### 2. Configure Environment
```bash
cp .env.example .env
```
Fill in your Firebase config values and Anthropic API key in `.env`

**AI Features (Phase 2):**
- For development: add your Anthropic API key directly to `.env` as `VITE_ANTHROPIC_API_KEY`
- For production: create a Cloud Function proxy and set `VITE_AI_ENDPOINT` instead (keeps key server-side)

### 3. Deploy Firestore Rules
Copy `firestore.rules` to your Firebase project.

### 4. Install & Run
```bash
npm install
npm run dev
```

### 5. Deploy to Vercel
```bash
npm i -g vercel
vercel
```
Set environment variables in Vercel Dashboard → Settings → Environment Variables.

### 6. Set up WhatsApp Bot
1. Create a Twilio account → get Account SID and Auth Token
2. Go to Messaging → Try it out → Send a WhatsApp message
3. Follow sandbox setup — send the join code from your phone
4. Set webhook URL in Twilio sandbox config:
   - When a message comes in: `https://your-app.vercel.app/api/bot/webhook` (POST)
5. Add Twilio env vars to Vercel

### 7. Set up Cron Jobs (cron-job.org — free)
Create these scheduled jobs pointing to your Vercel deployment:

| Time (WAT) | URL | Purpose |
|------------|-----|---------|
| 7:00 AM | `/api/cron/check?phase=morning_checkin&secret=YOUR_SECRET` | Morning motivation |
| 12:30 PM | `/api/cron/check?phase=zero_progress_alert&secret=YOUR_SECRET` | Emergency nudge if 0 done |
| 1:00 PM | `/api/cron/check?phase=midday_push&secret=YOUR_SECRET` | Midday accountability |
| 6:00 PM | `/api/cron/check?phase=evening_push&secret=YOUR_SECRET` | Evening push |
| 9:30 PM | `/api/cron/check?phase=night_review&secret=YOUR_SECRET` | End of day review |

For production: migrate from Twilio sandbox to a WhatsApp Business number, or later to Meta Business API directly.

## Project Structure
```
src/
├── App.jsx                 # Main app with auth flow + routing (6 views)
├── main.jsx                # Entry point
├── index.css               # Tailwind imports
├── lib/
│   ├── firebase.js         # Firebase config + exports
│   ├── useAuth.js          # Auth state hook
│   ├── theme.js            # Theme system + shared UI components
│   ├── ai.js               # Anthropic API (weekly plans, calibration, reflection)
│   ├── pdfExport.js        # PDF export via print dialog
│   └── sheets.js           # Client-side Google Sheets service
├── components/
│   ├── Nav.jsx             # Bottom navigation (6 tabs + theme toggle)
│   ├── CalibrationCard.jsx # AI month-start goal calibration
│   └── GoalRollover.jsx    # Roll unfinished goals forward
└── pages/
    ├── AuthPage.jsx        # Login + Signup
    ├── YearlyPlanSetup.jsx # 7-step guided yearly plan form
    ├── Dashboard.jsx       # Home dashboard
    ├── GoalsPage.jsx       # Monthly goals + calibration + rollover + PDF
    ├── WeeklyPage.jsx      # Weekly plan + daily focus + reflections
    ├── TrackerPage.jsx     # Google Sheets generation + sync + stats
    ├── HabitPage.jsx       # 66-day habit tracker
    └── YearlyPage.jsx      # Yearly plan view + sign out

api/                        # Vercel serverless functions
├── sheets/
│   ├── _utils.js           # Shared: Sheets API auth, template builder, formatting
│   ├── generate.js         # POST: Create/add monthly tracker tab
│   └── sync.js             # POST: Read sheet data for dashboard sync
├── bot/
│   ├── _config.js          # Firebase Admin init, timezone, shared config
│   ├── _firebase.js        # Server-side data access (goals, habits, history)
│   ├── _coach.js           # AI coach: dynamic system prompt, message generation
│   ├── _twilio.js          # Twilio WhatsApp messaging
│   └── webhook.js          # POST: Main WhatsApp webhook (command routing + AI chat)
└── cron/
    └── check.js            # GET: Scheduled coaching reminders (multi-phase)
```

## App Flow
1. User signs up → lands on Yearly Plan Setup (7-step wizard)
2. After completing yearly plan → main app with 6 tabs
3. **Home**: overview, income tracker, goal progress
4. **Goals**: add from library or custom, AI calibration, rollover, PDF export
5. **Weekly**: AI-generated weekly plan, daily focus planner, weekly reflections
6. **Tracker**: generate Google Sheet daily tracker, sync data, view stats
7. **66-Day**: one habit at a time, never-miss-twice rule, progress map
8. **Year**: view full yearly plan, sign out

## Next Phases
- Phase 2: AI-powered weekly breakdowns + month-start calibration
- Phase 3: Google Sheets integration (auto-generate daily tracker)
- Phase 4: WhatsApp bot + AI coach (Twilio)
- Phase 5: Team accountability (recursive tree, assigned tasks)
- Phase 6: Analytics, reports, month-to-month history
