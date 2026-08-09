// System coverage map: the single source of truth for "what should work, what connects to what,
// and what action produces what reaction." Doubles as a QA / bug-testing checklist. Client-safe
// (pure data). Keep statuses honest; this is the contract the /admin/health Coverage section renders.

export type CoverageStatus = 'live' | 'partial' | 'planned';

export type CoverageItem = {
  area: string;
  name: string;
  status: CoverageStatus;
  route: string | null;
  connects: string[]; // tables / edge fns / external services it touches
  action: string; // what the user does
  reaction: string; // what the system does in response
  notes?: string;
};

export const COVERAGE: CoverageItem[] = [
  // Auth & access
  { area: 'Auth', name: 'Email + password sign-in', status: 'live', route: '/auth/sign-in', connects: ['profiles', 'auth.users', 'JWT hook'], action: 'Submit email + password', reaction: 'Session set; routed by role (coach → /coach, subscriber → /onboarding or /dashboard)' },
  { area: 'Auth', name: 'Session persistence', status: 'live', route: 'middleware', connects: ['middleware', '@supabase/ssr'], action: 'Navigate between pages', reaction: 'Rotated auth cookies refreshed every request so logins persist' },
  { area: 'Auth', name: 'Role-based access (RBAC + RLS)', status: 'live', route: 'all', connects: ['RLS policies', 'is_coach()', 'current_company_id()'], action: 'Any data read/write', reaction: 'Row-level security scopes to company + role; role self-promotion blocked' },
  { area: 'Auth', name: 'Google / Apple / Magic Link', status: 'planned', route: '/auth/sign-in', connects: ['Supabase Auth providers'], action: 'Click social sign-in', reaction: 'Not wired yet (email/password only today)' },

  // Clients CRM
  { area: 'Clients', name: 'Clients list + faceted filters', status: 'live', route: '/coach/clients', connects: ['contacts', 'client_subscriptions', 'tags', 'contact_tags'], action: 'Filter / search / sort / save a smart list', reaction: 'URL-driven faceted results with live counts; smart lists persist to saved_segments' },
  { area: 'Clients', name: 'Client detail (billing, payments, engagement, tags)', status: 'live', route: '/coach/clients/[id]', connects: ['contacts', 'contact_transactions', 'legacy_client_snapshot', 'contact_tags'], action: 'Open a client', reaction: 'Shows grandfathered price, payment ledger, engagement snapshot, tags' },
  { area: 'Clients', name: 'Edit client / add note inline', status: 'planned', route: '/coach/clients/[id]', connects: ['contacts'], action: 'Edit contact fields or add a coach note', reaction: 'Not editable yet (read-only from the Lenus + GHL import)' },

  // Leads
  { area: 'Leads', name: 'Pipeline board (Kanban)', status: 'live', route: '/coach/leads', connects: ['opportunities', 'pipelines', 'pipeline_stages'], action: 'Switch pipeline / filter by status / search', reaction: 'Stage columns with per-stage count + value, KPI strip, rotting flags' },
  { area: 'Leads', name: 'Lead detail + activity timeline', status: 'live', route: '/coach/leads/[id]', connects: ['opportunities', 'opportunity_audit'], action: 'Open a lead', reaction: 'Status, value/stage strip, contact rail, activity timeline' },
  { area: 'Leads', name: 'Drag stage / edit opportunity', status: 'planned', route: '/coach/leads', connects: ['opportunities', 'GHL write API'], action: 'Move a card or edit a deal', reaction: 'Not wired (sync is one-way GHL → app today)' },

  // Automation
  { area: 'Automation', name: 'GHL manual sync (Sync now)', status: 'live', route: '/api/internal/ghl-sync', connects: ['GHL API', 'opportunities', 'contacts'], action: 'Click "Sync now"', reaction: 'Fetches pipelines + opportunities, upserts, links by ghl_contact_id/email' },
  { area: 'Automation', name: 'GHL daily auto-sync (cron)', status: 'live', route: 'vercel cron', connects: ['Vercel Cron', '/api/internal/ghl-sync'], action: 'Daily at 06:00 UTC', reaction: 'Same sync runs unattended (Hobby plan caps cron at daily)' },
  { area: 'Automation', name: 'Dunning / win-back sequences', status: 'planned', route: null, connects: ['contact_transactions', 'Resend/Twilio'], action: 'Payment fails / client lapses', reaction: 'Planned: automated recovery sequence' },

  // Overview
  { area: 'Overview', name: 'Business Overview KPIs', status: 'live', route: '/coach', connects: ['monthly_revenue view', 'contacts', 'opportunities', 'client_subscriptions'], action: 'Open Home', reaction: 'MRR, active members, lifetime revenue, open leads, at-risk, revenue trend, pipeline' },

  // Nutrition
  { area: 'Nutrition', name: 'Recipe library + filters', status: 'live', route: '/coach/tool/recipes', connects: ['recipes', 'recipe_ingredients', 'recipe_books'], action: 'Browse / filter / open a recipe', reaction: 'Image grid with macros; detail shows macro ring, ingredients, method' },
  { area: 'Nutrition', name: 'Recipe books', status: 'live', route: '/coach/tool/recipe-books', connects: ['recipe_books', 'recipes'], action: 'Open a book', reaction: 'Filters the recipe browser to that book' },
  { area: 'Nutrition', name: 'Meal plans', status: 'live', route: '/coach/tool/meal-plans', connects: ['meal_plans', 'contacts'], action: 'Search / open a plan', reaction: 'Per-client plan with calorie goal, macro split, meal groups' },
  { area: 'Nutrition', name: 'Photo-to-macro logging', status: 'live', route: '/nutrition', connects: ['OpenRouter/Gemini', 'foods', 'food_log'], action: 'Snap a food photo', reaction: 'The scanner returns foods + portions + macros + cooked/uncooked with confidence (the #1 differentiator)' },

  // Training
  { area: 'Training', name: 'Program builder', status: 'live', route: '/coach/programs', connects: ['programs', '/api/programs', 'exercises'], action: 'Build / save / assign a program', reaction: 'Day cards, exercise picker, sets/reps; save as template or assign' },
  { area: 'Training', name: 'Workout player + logging', status: 'partial', route: '/dashboard (subscriber)', connects: ['workout_logs', 'set_logs', 'workout_completion_history'], action: 'Subscriber runs a workout', reaction: 'Web player logs sets; completion history feeds coach view' },

  // Subscribers
  { area: 'Subscribers', name: 'Subscriber list', status: 'live', route: '/coach/subscribers', connects: ['profiles'], action: 'Search / segment subscribers', reaction: 'Filterable table of app accounts' },
  { area: 'Subscribers', name: 'Subscriber profile (overview, workouts)', status: 'live', route: '/coach/subscribers/[id]', connects: ['profiles', 'plan_assignments', 'workout_logs', 'workout_completion_history'], action: 'Open a subscriber', reaction: 'Overview (assigned program, macro targets, recent activity) + full workout history from real data; empty placeholder tabs already trimmed' },

  // Comms
  { area: 'Comms', name: 'Inbox / direct messages', status: 'live', route: '/coach/inbox', connects: ['conversations', 'messages', 'Realtime'], action: 'Message a client', reaction: 'Realtime two-way DM threads (coach <-> subscriber) with unread badges and mark-read' },
  { area: 'Comms', name: 'Community feed', status: 'live', route: '/community', connects: ['community_posts', 'post_reactions', 'post_comments'], action: 'Post / react / comment / coach broadcast', reaction: 'Subscriber feed + challenge leaderboard; coach view with a broadcast composer that fans out notifications to members' },
  { area: 'Comms', name: 'Email (Resend transactional)', status: 'partial', route: null, connects: ['Resend', 'Supabase Auth SMTP'], action: 'Auth / waitlist event', reaction: 'Branded templates via Supabase SMTP; broader transactional sends pending the Resend key' },
  { area: 'Comms', name: 'Notifications + scheduled triggers', status: 'partial', route: '/notifications', connects: ['notifications', 'push_subscriptions', 'pg_cron', 'Web Push'], action: 'Reminder / renewal / check-in due / challenge close', reaction: 'In-app + web-push live; pg_cron generators fire reminders, renewal + comp-expiry nudges, check-in nudges and challenge close (timezone-correct). Twilio SMS still key-gated' },

  // Billing
  { area: 'Billing', name: 'Stripe checkout + subscriptions', status: 'live', route: '/checkout', connects: ['subscriptions', 'payments', 'webhook_events'], action: 'Subscribe / pay', reaction: 'Checkout + 3DS + webhook reconciliation built (test mode); live account connection is the last step' },

  // Forms / check-ins
  { area: 'Check-ins', name: 'Check-in forms + responses', status: 'live', route: '/checkin', connects: ['forms', 'form_fields', 'form_responses'], action: 'Coach assigns a form; subscriber submits a check-in', reaction: 'Assigned forms render at /checkin; submissions land in form_responses for coach review' },
  { area: 'Check-ins', name: 'Habits', status: 'live', route: '/dashboard', connects: ['habits', 'habit_logs'], action: 'Check off a daily habit', reaction: 'Habit toggles log per local day; streak tracked' },

  // Platform
  { area: 'Platform', name: 'Light / dark theme', status: 'live', route: 'all', connects: ['next-themes', 'data-theme'], action: 'Toggle theme (top bar)', reaction: 'Whole app flips via CSS-var tokens; choice persists' },
  { area: 'Platform', name: 'Language (EN / ES)', status: 'live', route: 'all', connects: ['next-intl', 'profiles.ui_locale'], action: 'Switch language in Settings', reaction: 'UI + content locale persist to the profile' },
  { area: 'Platform', name: 'System health + coverage', status: 'live', route: '/admin/health', connects: ['system-health', 'system-map'], action: 'Open System health in the operator portal', reaction: 'Real service probes, live data counts, deploy info, and this coverage checklist' },
  { area: 'Platform', name: 'Scan intelligence', status: 'live', route: '/admin/intelligence', connects: ['ai_inferences', 'food_log', 'scan-intelligence'], action: 'Open Scan intelligence in the operator portal', reaction: 'Correction rate, portion error, confidence calibration and per-model runs/latency/errors' },
  { area: 'Platform', name: 'Error monitoring + analytics', status: 'planned', route: null, connects: ['Sentry', 'PostHog'], action: 'Any runtime error / event', reaction: 'Planned: Sentry capture + PostHog product analytics (key-gated)' },

  // Coach intelligence
  { area: 'Coach Intelligence', name: 'Coach chat (her voice, grounded)', status: 'live', route: '/coach-chat', connects: ['OpenRouter', 'coach_knowledge', 'pgvector', 'coach_messages'], action: 'Ask the coach a question', reaction: 'Streams a grounded answer in Stephanie’s voice from her knowledge base + the member’s logs; medical-claim guardrails' },
  { area: 'Coach Intelligence', name: 'Plan generation', status: 'live', route: '/coach-chat', connects: ['plan-gen', 'meal_plans', 'programs'], action: 'Generate a plan from intake', reaction: 'PCOS-aware meal/workout plan from intake + knowledge' },
  { area: 'Coach Intelligence', name: 'Nightly insights + gamification', status: 'live', route: '/api/internal/generate-insights', connects: ['user_insights', 'user_streaks', 'user_badges', 'pg_cron'], action: 'Nightly cron', reaction: 'Generates a personalized insight, recomputes streaks, awards badges' },
  { area: 'Coach Intelligence', name: 'Model cost controls (rate-limit + meter)', status: 'live', route: 'all model routes', connects: ['ai_usage_log', 'rate-limit'], action: 'Any model call', reaction: 'Every model route is rate-limited + metered to ai_usage_log (caps OpenRouter spend)' },
  { area: 'Coach Intelligence', name: 'Knowledge base (ingest)', status: 'live', route: '/coach/settings/knowledge', connects: ['coach_knowledge', 'embeddings'], action: 'Ingest method/voice text', reaction: 'Chunks + embeds into the knowledge base feeding the chat context' },
  { area: 'Coach Intelligence', name: 'Voice clone', status: 'planned', route: null, connects: ['voice provider'], action: 'Coach voice speaks', reaction: 'Phase 3 (PRD-32): cloned voice for the coach' },

  // Text-to-macro (the headline nutrition differentiator)
  { area: 'Nutrition', name: 'Text-to-macro logging', status: 'live', route: '/nutrition', connects: ['OpenRouter', 'foods', 'food_log', 'text-parse'], action: 'Type a meal in natural language', reaction: 'The parser turns items + portions into a confirmable macro preview, then logs (kills the ChatGPT-screenshot workflow)' },

  // Access / entitlement
  { area: 'Billing', name: 'Entitlement + paywall', status: 'live', route: '(app) layout', connects: ['subscriptions', 'profiles.comp_access_until', 'isEntitled'], action: 'Open the app un-paid', reaction: 'Hard wall to /checkout unless an active sub OR a live coach-granted comp; comped (free) users in; comp/sub expiry auto-locks' },

  // Mid-ticket coaching workflow
  { area: 'Coaching', name: 'Mid-ticket draft + approval', status: 'live', route: '/coach/drafts, /coach/approvals, /coach/assignments', connects: ['coaching_assignments', 'approval_queue'], action: 'Assistant drafts; Stephanie approves', reaction: 'Drafts held in approval_queue; approve publishes to the client; bypass blocked; per-assistant payout rollup' },

  // Engagement
  { area: 'Engagement', name: 'Challenges + leaderboard + auto-close', status: 'live', route: '/coach/challenges', connects: ['challenges', 'challenge_participants', 'badges', 'pg_cron'], action: 'Coach publishes a challenge', reaction: 'Renders on the community leaderboard; nightly close-challenges cron awards the leader the Champion badge + notifies participants' },

  // Legal / account
  { area: 'Legal', name: 'Consent + medical disclaimer', status: 'live', route: '/disclaimer, /onboarding', connects: ['consent capture'], action: 'Sign up / onboard', reaction: 'Terms + privacy consent at signup; medical / assumption-of-risk disclaimer gates onboarding' },
  { area: 'Legal', name: 'Account deletion + data export', status: 'live', route: '/account', connects: ['account/actions', 'security_events'], action: 'Export or delete my data', reaction: 'GDPR/CCPA export + right-to-delete, audited to security_events' },
  { area: 'Legal', name: 'Login audit (Fort Knox)', status: 'live', route: '/auth/sign-in', connects: ['session_logs'], action: 'Any sign-in attempt', reaction: 'Success/failure + IP/device logged to session_logs' },
];

export function coverageByArea(items: CoverageItem[] = COVERAGE): { area: string; items: CoverageItem[] }[] {
  const order: string[] = [];
  const map = new Map<string, CoverageItem[]>();
  for (const it of items) {
    if (!map.has(it.area)) {
      map.set(it.area, []);
      order.push(it.area);
    }
    map.get(it.area)!.push(it);
  }
  return order.map((area) => ({ area, items: map.get(area)! }));
}

export function coverageTotals(items: CoverageItem[] = COVERAGE): Record<CoverageStatus, number> {
  return items.reduce(
    (acc, it) => {
      acc[it.status] += 1;
      return acc;
    },
    { live: 0, partial: 0, planned: 0 } as Record<CoverageStatus, number>,
  );
}
