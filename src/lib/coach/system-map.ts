// System coverage map: the single source of truth for "what should work, what connects to what,
// and what action produces what reaction." Doubles as a QA / bug-testing checklist. Client-safe
// (pure data). Keep statuses honest; this is the contract the App Health Coverage tab renders.

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
  { area: 'Nutrition', name: 'Photo-to-macro AI logging', status: 'live', route: '/nutrition', connects: ['OpenRouter/Gemini', 'foods', 'food_log'], action: 'Snap a food photo', reaction: 'AI returns foods + portions + macros + cooked/uncooked with confidence (the #1 differentiator)' },

  // Training
  { area: 'Training', name: 'Program builder', status: 'live', route: '/coach/programs', connects: ['programs', '/api/programs', 'exercises'], action: 'Build / save / assign a program', reaction: 'Day cards, exercise picker, sets/reps; save as template or assign' },
  { area: 'Training', name: 'Workout player + logging', status: 'partial', route: '/dashboard (subscriber)', connects: ['workout_logs', 'set_logs', 'workout_completion_history'], action: 'Subscriber runs a workout', reaction: 'Web player logs sets; completion history feeds coach view' },

  // Subscribers
  { area: 'Subscribers', name: 'Subscriber list', status: 'live', route: '/coach/subscribers', connects: ['profiles'], action: 'Search / segment subscribers', reaction: 'Filterable table of app accounts' },
  { area: 'Subscribers', name: 'Subscriber profile (overview, workouts)', status: 'partial', route: '/coach/subscribers/[id]', connects: ['profiles', 'workout_completion_history'], action: 'Open a subscriber', reaction: 'Overview + workouts real; nutrition/community/progress/messages/billing/notes are placeholders', notes: 'Trim empty tabs to the ones with real data' },

  // Comms
  { area: 'Comms', name: 'Inbox / direct messages', status: 'planned', route: '/coach/inbox', connects: ['messages table', 'Realtime'], action: 'Message a client', reaction: 'Planned (placeholder today)' },
  { area: 'Comms', name: 'Community feed', status: 'live', route: '/community', connects: ['community_posts', 'post_reactions', 'post_comments'], action: 'Post / react / comment', reaction: 'Subscriber feed + challenge leaderboard live; coach moderation view + create-challenge in WP7' },
  { area: 'Comms', name: 'Broadcasts composer', status: 'partial', route: '/coach/broadcasts', connects: ['Resend/Twilio'], action: 'Compose a broadcast', reaction: 'Composer UI exists; send backend not wired' },
  { area: 'Comms', name: 'Email (Resend transactional)', status: 'partial', route: null, connects: ['Resend', 'Supabase Auth SMTP'], action: 'Auth / waitlist event', reaction: 'Branded templates via Supabase SMTP; broader transactional sends pending' },
  { area: 'Comms', name: 'Push / SMS notifications', status: 'partial', route: '/notifications', connects: ['notifications', 'push_subscriptions', 'Web Push'], action: 'Trigger a notification', reaction: 'In-app + web-push delivery built; scheduled triggers (reminders/expiry) + Twilio SMS in WP11/WP13' },

  // Billing
  { area: 'Billing', name: 'Stripe checkout + subscriptions', status: 'live', route: '/checkout', connects: ['subscriptions', 'payments', 'webhook_events'], action: 'Subscribe / pay', reaction: 'Checkout + 3DS + webhook reconciliation built (test mode); live account connection is the last step' },

  // Forms / check-ins
  { area: 'Check-ins', name: 'Forms', status: 'partial', route: '/coach/forms', connects: ['forms tables'], action: 'Open / build a form', reaction: 'Basic forms surface; full builder + responses pending' },
  { area: 'Check-ins', name: 'Habits', status: 'planned', route: '/coach (nav)', connects: ['habits tables'], action: 'Track a habit', reaction: 'Planned (nav item placeholder)' },

  // Platform
  { area: 'Platform', name: 'Light / dark theme', status: 'live', route: 'all', connects: ['next-themes', 'data-theme'], action: 'Toggle theme (top bar)', reaction: 'Whole app flips via CSS-var tokens; choice persists' },
  { area: 'Platform', name: 'Language (EN / ES)', status: 'live', route: 'all', connects: ['next-intl', 'profiles.ui_locale'], action: 'Switch language in Settings', reaction: 'UI + content locale persist to the profile' },
  { area: 'Platform', name: 'App Health + coverage', status: 'live', route: '/coach/health', connects: ['system-health', 'system-map'], action: 'Open App Health', reaction: 'Real service probes, live data counts, and this coverage checklist' },
  { area: 'Platform', name: 'Error monitoring + analytics', status: 'planned', route: null, connects: ['Sentry', 'PostHog'], action: 'Any runtime error / event', reaction: 'Planned: Sentry capture + PostHog product analytics' },
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
