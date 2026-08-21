// Coach programs list. Coach-guarded. Links to the builder; "New Program" creates one.
import type { ReactElement } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { PageTitle } from '@/components/ui/section';
import { ButtonLink } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { shootImage } from '@/lib/brand/shoot';
import { CoachSectionTabs } from '@/components/coach/section-tabs';
import { trainingTabs } from '@/lib/coach/section-tabs';

export const dynamic = 'force-dynamic';

type PlanRow = {
  /** How many clients are on it. Only rendered when it is not zero. */
  assigned: number; id: string; name_en: string; weeks: number; is_template: boolean; days: number };

export default async function CoachProgramsPage(): Promise<ReactElement> {
  const ctx = await requireCoach();
  const t = await getTranslations('app.coach');

  let plans: PlanRow[] = [];
  if (ctx.companyId) {
    const supabase = createServiceClient();
    // The DAY COUNT is what she reads first. Her Lenus library listed every program as "5 ITEMS" or
    // "7 ITEMS", because that is how you tell a 3-day split from a 5-day one at a glance, and the
    // name does not always say it. Sorted by name rather than updated_at: the import stamped all 40
    // within the same minute, so recency ordering scrambled a library whose names are already
    // deliberately sequential (Month 1, Month 2, Month 3).
    const [{ data }, { data: sessionRows }, { data: assignRows }] = await Promise.all([
      supabase
        .from('plans')
        .select('id, name_en, weeks, is_template')
        .eq('company_id', ctx.companyId)
        // Archived plans leave the library and stay readable wherever they are already assigned.
        // Stephanie asked to delete 17 of her 40 on 2026-08-13; deleting would have cascaded away
        // the assignments of clients who are mid-program on them (0141).
        .is('archived_at', null)
        .order('name_en', { ascending: true }),
      supabase.from('sessions').select('plan_id').eq('company_id', ctx.companyId),
      // Who is actually ON each program. The single most useful fact when choosing one to assign,
      // and the library never showed it: every card looked equally used.
      supabase.from('plan_assignments').select('plan_id').eq('company_id', ctx.companyId),
    ]);
    const assignedCount = new Map<string, number>();
    for (const a of (assignRows ?? []) as { plan_id: string | null }[]) {
      if (a.plan_id) assignedCount.set(a.plan_id, (assignedCount.get(a.plan_id) ?? 0) + 1);
    }
    const dayCount = new Map<string, number>();
    for (const s of (sessionRows ?? []) as { plan_id: string | null }[]) {
      if (s.plan_id) dayCount.set(s.plan_id, (dayCount.get(s.plan_id) ?? 0) + 1);
    }
    plans = ((data ?? []) as Omit<PlanRow, 'days' | 'assigned'>[]).map((p) => ({
      ...p,
      days: dayCount.get(p.id) ?? 0,
      assigned: assignedCount.get(p.id) ?? 0,
    }));
  }

  // Her own families, read off the names she chose. Order is the order she works in: the numbered
  // progression first, then the 12 week series, then what is attached to a product, then the rest.
  // A plan lands in the FIRST bucket that claims it, so "Month 2: 8 week 5 day" is progression
  // rather than being pulled into the 8-week membership group by an accident of wording.
  const FAMILIES: { key: string; test: (n: string) => boolean }[] = [
    { key: 'famProgression', test: (n) => /^month\s*\d/i.test(n) },
    { key: 'famTwelveWeek', test: (n) => /^12\s*week/i.test(n) },
    { key: 'famChallenge', test: (n) => /challenge/i.test(n) },
    { key: 'famMembership', test: (n) => /snap\s*back|membership/i.test(n) },
    { key: 'famClient', test: (n) => /shelise|eddie/i.test(n) },
  ];
  const buckets = new Map<string, PlanRow[]>();
  for (const p of plans) {
    const fam = FAMILIES.find((f) => f.test(p.name_en))?.key ?? 'famOther';
    if (!buckets.has(fam)) buckets.set(fam, []);
    buckets.get(fam)!.push(p);
  }
  const groups = [...FAMILIES.map((f) => f.key), 'famOther']
    .filter((k) => buckets.has(k))
    .map((k) => ({ key: k, plans: buckets.get(k)! }));

  const sectionTabs = await trainingTabs();

  return (
    <div>
      <CoachSectionTabs tabs={sectionTabs} active="/coach/programs" />
      <div className="mb-1 flex items-center justify-between gap-4">
        <PageTitle>{t('programs')}</PageTitle>
        <ButtonLink href="/coach/programs/new" size="sm" className="shrink-0">
          {t('newProgram')}
        </ButtonLink>
      </div>
      {/* What this page IS, in a sentence, for a coach who has never opened it. Stephanie knows
          her own library; the assistant coaches she hires do not, and a title alone does not say
          whether this is where you build a program or where you hand one to a client. */}
      <p className="tf-measure mb-6 text-[13px] text-muted">{t('programsIntro')}</p>
      {plans.length === 0 ? (
        <p className="text-sm text-muted">{t('noPrograms')}</p>
      ) : (
        // GROUPED, TWO COLUMNS, FULL NAMES.
        //
        // The four-column grid was unreadable at 41 programs. Every name truncated, which is fatal
        // here because her names differ at the END: "12 week 3 day Training Plan 1" and "12 week 3
        // day Training Plan 1- Beginner/Intermediate @HOME" were the same tile. Every card also
        // carried a "Template" badge, on a page where all 41 are templates, so it was 41 repetitions
        // of no information.
        //
        // Her library already has a shape and the flat grid hid it: a Month 1-6 progression, the
        // 12 week series, the membership SNAP BACK programs, the challenges. Grouping is not
        // decoration, it is the structure she built.
        <div className="flex flex-col gap-8">
          {groups.map((g) => (
            <section key={g.key}>
              <h2 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">
                {t(g.key)} <span className="text-line">·</span> {g.plans.length}
              </h2>
              <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
                {g.plans.map((p, i) => (
                  <Link
                    key={p.id}
                    href={`/coach/programs/${p.id}`}
                    className="tf-press group flex items-stretch gap-0 overflow-hidden rounded-2xl bg-surface transition-shadow hover:shadow-[0_2px_12px_rgba(0,0,0,0.10)]"
                  >
                    {/* Her photography, not a stock library and not a coloured block. This is a
                        screen she opens dozens of times a week to pick from her own work, and a
                        column of identical white pills gave her nothing to recognise a program BY.
                        Indexed so a program keeps its picture between visits. */}
                    {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
                    <img
                      src={shootImage(i)}
                      alt=""
                      className="h-[74px] w-[74px] flex-none object-cover"
                    />
                    <span className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3">
                    {/* Wraps rather than truncates. Two lines of a name she wrote beats one line
                        with the distinguishing half cut off. */}
                      <span className="min-w-0">
                        <span className="block text-[14px] font-semibold leading-snug text-ink">
                          {p.name_en}
                        </span>
                        {/* Who is on it, only when somebody is. A "0 clients" badge on every card
                            is the same no-information wallpaper the flat grid already was. */}
                        {p.assigned > 0 && (
                          <span className="mt-1 inline-block rounded-full bg-warm px-2 py-0.5 text-[11px] font-semibold text-soft">
                            {t('planAssigned', { n: p.assigned })}
                          </span>
                        )}
                      </span>
                    <span className="flex shrink-0 items-center gap-2.5 text-[12px] text-muted">
                      {/* Duration only when SHE stated one. Lenus stores no length on a template,
                          so the name is the only statement of it and the import defaults to 12.
                          Printing that default turned "Cardio 4x a week" into a 12 week program on
                          her screen, which is the app inventing a fact and putting it in her mouth.
                          plans.weeks is NOT NULL so it cannot be nulled without a migration, and a
                          migration is the wrong price for a label. */}
                      <span className="tabular-nums">
                        {/\d+\s*week/i.test(p.name_en)
                          ? t('planDaysWeeks', { d: p.days, w: p.weeks })
                          : t('planDays', { n: p.days })}
                      </span>
                      <Icon name="chevronRight" size={16} className="text-line" />
                    </span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
