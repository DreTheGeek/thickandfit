// "Someone just signed up" in Telegram.
//
// WHY THIS DID NOT EXIST. The bot alerted on support tickets and sent a 9pm digest, and that was the
// whole list. A signup, the single event this business is being built to produce, went unannounced
// until the recap that night. Reported 2026-08-03 as "telegram didn't trigger when someone signed
// up": correct, because nothing was ever wired to.
//
// FIRED FROM A DATABASE TRIGGER, not from the signup code path. There are four ways a profile can be
// born (email signup, Google, an admin invite, a direct insert) and wiring the notification into one
// of them is how the next one arrives silently. The row appearing in `profiles` is the one thing
// every path has in common. It also means a signup still announces itself when the app's host is
// down, which is the condition under which you most want to know people are still arriving.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { esc, reply, APP_URL } from './telegram.ts';

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  company_id: string | null;
  created_at: string | null;
};

/** How the account was created, for the one line of context that actually changes what you do. */
async function providerFor(svc: SupabaseClient, profileId: string): Promise<string> {
  try {
    const { data } = await svc.rpc('auth_providers_for', { p_user: profileId });
    const list = (data as string[] | null) ?? [];
    return list.length ? list.join(' + ') : 'email';
  } catch {
    return 'email';
  }
}

export async function sendSignupAlert(svc: SupabaseClient, profileId: string): Promise<boolean> {
  const { data } = await svc
    .from('profiles')
    .select('id, email, full_name, role, company_id, created_at')
    .eq('id', profileId)
    .maybeSingle();
  const p = data as ProfileRow | null;
  if (!p) return false;

  const provider = await providerFor(svc, p.id);

  // Today's running total, so the message answers "is this one person or a wave" without a follow-up
  // command. Cheap: one indexed count.
  const since = new Date(Date.now() - 86_400_000).toISOString();
  let todayCount = 0;
  try {
    const { count } = await svc
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', p.company_id ?? '')
      .gte('created_at', since);
    todayCount = count ?? 0;
  } catch {
    todayCount = 0;
  }

  // A name is not guaranteed: an admin-created account carries no signup metadata, so say so rather
  // than printing an empty line that reads like a rendering bug.
  const name = (p.full_name ?? '').trim() || 'No name yet';
  const isStaff = p.role !== 'subscriber' && p.role !== 'free';

  const lines = [
    isStaff ? '👤 <b>NEW TEAM ACCOUNT</b>' : '🎉 <b>NEW SIGNUP</b>',
    '',
    `<b>${esc(name)}</b>`,
    esc(p.email ?? 'no email'),
    '',
    `<b>Signed up with:</b> ${esc(provider)}`,
    `<b>Role:</b> ${esc(p.role ?? 'subscriber')}`,
  ];
  if (!isStaff) {
    lines.push(
      '',
      todayCount > 1 ? `${todayCount} signups in the last 24h.` : 'First signup in the last 24h.',
      '',
      // Onboarding is where she becomes a real client record, so the useful next click is the
      // clients list rather than this one account.
      `${APP_URL}/coach/clients`,
    );
  } else {
    lines.push('', `${APP_URL}/admin/team`);
  }

  return await reply(lines.join('\n'));
}
