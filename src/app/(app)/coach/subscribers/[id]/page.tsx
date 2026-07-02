// Coach view of one subscriber. Coach-guarded + company-scoped. Real Overview + Workouts.
import type { ReactElement } from 'react';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { fetchHistory } from '@/lib/workout/logging';
import { getCoachBodyStats } from '@/lib/body/stats';
import { getCoachFoodDiaryWeek } from '@/lib/coach/food-diary';
import { getClientMembership, getClientHabits } from '@/lib/coach/client-engagement';
import { getClientCheckin } from '@/lib/coach/client-checkin';
import { SubscriberProfile, type ProfileData } from '@/components/coach/subscriber-profile';
import { getCoachNotes } from '@/lib/coach/notes-actions';
import { getClientFoodPhotos } from '@/lib/food-photos/coach';

export const dynamic = 'force-dynamic';

type Targets = { calories: number; macros: { protein_g: number; carbs_g: number; fat_g: number } };
type OnbAnswers = {
  sex?: string; age?: number; heightCm?: number; weightKg?: number; goalWeightKg?: number;
  activity?: string; goal?: string; tier?: string;
};

export default async function CoachSubscriberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactElement> {
  const ctx = await requireCoach();
  const { id } = await params;
  const locale = await getLocale();
  const t = await getTranslations('app.coach');
  if (!ctx.companyId) notFound();

  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, full_name, email, role, ui_locale, is_legacy_client, created_at, timezone, comp_access_until')
    .eq('id', id)
    .maybeSingle();

  if (!profile || profile.company_id !== ctx.companyId) notFound();

  const tz = (profile.timezone as string | null) || 'America/Chicago';
  const [{ data: onb }, { data: assignment }, history, { count: workoutCount }, notes, { data: me }, { data: physique }, foodPhotos, bodyStats, foodDiary] =
    await Promise.all([
      supabase.from('onboarding_responses').select('answers, computed_targets, predicted_goal').eq('profile_id', id).maybeSingle(),
      supabase
        .from('plan_assignments')
        .select('plan:plan_id (name_en, name_es)')
        .eq('profile_id', id)
        .eq('company_id', ctx.companyId)
        .order('assigned_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      fetchHistory(ctx.companyId, id),
      // Total workout count via a head-only COUNT (history is capped at 20 for display only).
      supabase
        .from('workout_logs')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', ctx.companyId)
        .eq('profile_id', id),
      getCoachNotes('profile', id),
      supabase.from('profiles').select('full_name, email').eq('id', ctx.userId).maybeSingle(),
      // Recent physique reads (flagged ones surface a wellbeing follow-up here).
      supabase
        .from('physique_analyses')
        .select('id, bf_low, bf_high, narrative, flagged, created_at')
        .eq('company_id', ctx.companyId)
        .eq('profile_id', id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(5),
      getClientFoodPhotos(ctx.companyId, id),
      getCoachBodyStats(id, tz),
      getCoachFoodDiaryWeek(id, ctx.companyId, tz),
    ]);
  const meRow = me as { full_name: string | null; email: string | null } | null;

  // Resolve the client's Lenus contact (AI plan assignment target) + their latest meal plan, so the
  // profile can offer Generate-with-AI / Build-manually / View-current-plan.
  const emailFilter = profile.email ? `,email.eq.${profile.email}` : '';
  const { data: contactRow } = await supabase
    .from('contacts')
    .select('id')
    .eq('company_id', ctx.companyId)
    .or(`profile_id.eq.${id}${emailFilter}`)
    .limit(1)
    .maybeSingle();
  const contactId = (contactRow as { id?: string } | null)?.id ?? null;
  let currentPlanId: string | null = null;
  if (contactId) {
    const { data: mp } = await supabase
      .from('meal_plans')
      .select('id')
      .eq('company_id', ctx.companyId)
      .eq('contact_id', contactId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    currentPlanId = (mp as { id?: string } | null)?.id ?? null;
  }

  const [membership, habits, checkin] = await Promise.all([
    getClientMembership(contactId, {
      role: profile.role,
      compUntil: (profile.comp_access_until as string | null) ?? null,
      createdAt: profile.created_at,
    }),
    getClientHabits(id, tz),
    getClientCheckin(ctx.companyId, id),
  ]);

  const targets = (onb?.computed_targets ?? null) as Targets | null;

  // Client intake (the Lenus "Info" gap): from the onboarding answers + profile.
  const answers = (onb?.answers ?? null) as OnbAnswers | null;
  const heightCm = answers?.heightCm ?? null;
  const weightKg = answers?.weightKg ?? null;
  const bmi = heightCm && weightKg ? Math.round((weightKg / (heightCm / 100) ** 2) * 10) / 10 : null;
  const intake = answers
    ? {
        sex: answers.sex ?? null,
        age: answers.age ?? null,
        heightCm,
        weightKg,
        goalWeightKg: answers.goalWeightKg ?? null,
        activity: answers.activity ?? null,
        goal: (onb?.predicted_goal as string | null) ?? answers.goal ?? null,
        tier: answers.tier ?? null,
        bmi,
        timezone: (profile.timezone as string | null) ?? null,
      }
    : null;

  const plan = (assignment?.plan ?? null) as { name_en: string; name_es: string | null } | { name_en: string; name_es: string | null }[] | null;
  const planObj = Array.isArray(plan) ? plan[0] : plan;

  const fmtDate = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' });
  const fmtShort = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' });
  const created = new Date(profile.created_at);
  const days = Math.max(0, Math.round((new Date().getTime() - created.getTime()) / 86400_000));

  type PhysiqueRow = { id: string; bf_low: number | null; bf_high: number | null; narrative: string | null; flagged: boolean; created_at: string };
  const physiqueReads = ((physique as PhysiqueRow[] | null) ?? []).map((p) => ({
    id: p.id,
    bfLow: p.bf_low != null ? Number(p.bf_low) : null,
    bfHigh: p.bf_high != null ? Number(p.bf_high) : null,
    narrative: p.narrative ?? '',
    flagged: Boolean(p.flagged),
    date: fmtShort.format(new Date(p.created_at)),
  }));

  const data: ProfileData = {
    name: (profile.full_name ?? profile.email ?? '').trim() || t('noName'),
    email: profile.email,
    memberSince: fmtDate.format(created),
    role: profile.role,
    locale: profile.ui_locale,
    legacy: profile.is_legacy_client,
    workouts: workoutCount ?? history.length,
    days,
    calories: targets?.calories ?? null,
    macros: targets?.macros
      ? { p: targets.macros.protein_g, c: targets.macros.carbs_g, f: targets.macros.fat_g }
      : null,
    programName: planObj ? (locale === 'es' && planObj.name_es) || planObj.name_en : null,
    history: history.map((h) => ({
      id: h.id,
      date: fmtShort.format(new Date(h.performed_at)),
      completionPct: h.completion_pct,
      enjoyment: h.enjoyment,
      effort: h.effort,
    })),
    id,
    notes,
    coachName: meRow?.full_name ?? meRow?.email ?? 'Coach',
    physiqueReads,
    foodPhotos: foodPhotos.map((p) => ({ id: p.id, url: p.url, caption: p.caption, mealSlot: p.mealSlot, takenOn: p.takenOn })),
    contactId,
    currentPlanId,
    clientLocale: profile.ui_locale === 'es' ? 'es' : 'en',
    intake,
    bodyStats,
    foodDiary,
    membership,
    habits,
    checkin,
  };

  return <SubscriberProfile data={data} />;
}
