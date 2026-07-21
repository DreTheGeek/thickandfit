"use client";
// Health-profile capture form. Renders the intake Stephanie approved: foods avoided, injuries, the
// hormonal/medical picture (PCOS, thyroid, insulin...), a light pre-exercise safety screen, meds,
// sleep/stress, and a gentle relationship-with-food question. Writes to client_intake via the server
// action, which the coach grounds on immediately. All copy localizes through next-intl (EN/ES).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ReactElement } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { saveHealthProfileAction } from "@/lib/health-profile/actions";
import type { HealthProfileInput } from "@/lib/health-profile/data";
import {
  DIETARY,
  INJURIES,
  CONDITIONS,
  PREGNANCY,
  SAFETY,
  MEDICATIONS,
  EXPERIENCE,
  SLEEP,
  STRESS,
  FOOD_REL,
} from "@/lib/health-profile/labels";

export function HealthProfileForm({
  initial,
}: {
  initial: HealthProfileInput;
}): ReactElement {
  const t = useTranslations("app.health");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  const [dietary, setDietary] = useState<string[]>(initial.dietaryExclusions);
  const [allergies, setAllergies] = useState(initial.allergies);
  const [injuries, setInjuries] = useState<string[]>(initial.injuries);
  const [injuriesMore, setInjuriesMore] = useState(initial.injuriesDescription);
  const [conditions, setConditions] = useState<string[]>(initial.conditions);
  const [pregnancy, setPregnancy] = useState<string | undefined>(
    initial.pregnancy,
  );
  const [safety, setSafety] = useState<string[]>(initial.safety);
  const [meds, setMeds] = useState<string[]>(initial.medications);
  const [experience, setExperience] = useState<string | undefined>(
    initial.trainingExperience,
  );
  const [sleep, setSleep] = useState<string | undefined>(initial.sleep);
  const [stress, setStress] = useState<string | undefined>(initial.stress);
  const [food, setFood] = useState<string | undefined>(
    initial.foodRelationship,
  );

  function toggle(
    list: string[],
    set: (v: string[]) => void,
    value: string,
  ): void {
    set(
      list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
    );
    setStatus("idle");
  }

  function save(): void {
    startTransition(async () => {
      const res = await saveHealthProfileAction({
        dietaryExclusions: dietary,
        allergies,
        injuries,
        injuriesDescription: injuriesMore,
        conditions,
        pregnancy,
        safety,
        medications: meds,
        trainingExperience: experience,
        sleep,
        stress,
        foodRelationship: food,
      });
      if (res.ok) {
        setStatus("saved");
        router.refresh();
      } else {
        setStatus("error");
      }
    });
  }

  const safetyFlagged = safety.length > 0;

  return (
    <div className="px-[22px] pb-28 pt-3">
      <h1 className="tf-display mb-2 text-[32px]">{t("title")}</h1>
      <p className="mb-1 text-[14px] leading-[1.55] text-soft">{t("intro")}</p>
      <p className="mb-7 text-[12px] text-faint">{t("privacy")}</p>

      <div className="flex flex-col gap-7">
        <Section n={1} title={t("sec.foods.q")}>
          <ChipGroup
            options={DIETARY}
            tk="opt.dietary"
            selected={dietary}
            onToggle={(v) => toggle(dietary, setDietary, v)}
            t={t}
            noneLabel={t("none")}
            onNone={() => {
              setDietary([]);
              setStatus("idle");
            }}
          />
          <TextField
            value={allergies}
            onChange={(v) => {
              setAllergies(v);
              setStatus("idle");
            }}
            placeholder={t("sec.allergies.ph")}
            label={t("sec.allergies.q")}
          />
        </Section>

        <Section n={2} title={t("sec.injuries.q")}>
          <ChipGroup
            options={INJURIES}
            tk="opt.injuries"
            selected={injuries}
            onToggle={(v) => toggle(injuries, setInjuries, v)}
            t={t}
            noneLabel={t("none")}
            onNone={() => {
              setInjuries([]);
              setStatus("idle");
            }}
          />
          <TextField
            value={injuriesMore}
            onChange={(v) => {
              setInjuriesMore(v);
              setStatus("idle");
            }}
            placeholder={t("sec.injuriesMore.ph")}
            label={t("sec.injuriesMore.q")}
          />
        </Section>

        <Section
          n={3}
          title={t("sec.conditions.q")}
          why={t("sec.conditions.why")}
        >
          <ChipGroup
            options={CONDITIONS}
            tk="opt.conditions"
            selected={conditions}
            onToggle={(v) => toggle(conditions, setConditions, v)}
            t={t}
            noneLabel={t("none")}
            onNone={() => {
              setConditions([]);
              setStatus("idle");
            }}
          />
        </Section>

        <Section n={4} title={t("sec.pregnancy.q")}>
          <ChoiceRow
            options={PREGNANCY}
            tk="opt.pregnancy"
            value={pregnancy}
            onPick={(v) => {
              setPregnancy(v);
              setStatus("idle");
            }}
            t={t}
          />
        </Section>

        <Section n={5} title={t("sec.safety.q")} why={t("sec.safety.why")}>
          <ChipGroup
            options={SAFETY}
            tk="opt.safety"
            selected={safety}
            onToggle={(v) => toggle(safety, setSafety, v)}
            t={t}
            noneLabel={t("safetyNone")}
            onNone={() => {
              setSafety([]);
              setStatus("idle");
            }}
          />
          {safetyFlagged && (
            <p className="mt-1 rounded-[12px] bg-warm px-4 py-3 text-[13px] leading-[1.5] text-soft">
              {t("sec.safety.note")}
            </p>
          )}
        </Section>

        <Section n={6} title={t("sec.meds.q")}>
          <ChipGroup
            options={MEDICATIONS}
            tk="opt.meds"
            selected={meds}
            onToggle={(v) => toggle(meds, setMeds, v)}
            t={t}
            noneLabel={t("none")}
            onNone={() => {
              setMeds([]);
              setStatus("idle");
            }}
          />
        </Section>

        <Section n={7} title={t("sec.experience.q")}>
          <ChoiceRow
            options={EXPERIENCE}
            tk="opt.experience"
            value={experience}
            onPick={(v) => {
              setExperience(v);
              setStatus("idle");
            }}
            t={t}
          />
        </Section>

        <Section n={8} title={t("sec.sleep.q")}>
          <ChoiceRow
            options={SLEEP}
            tk="opt.sleep"
            value={sleep}
            onPick={(v) => {
              setSleep(v);
              setStatus("idle");
            }}
            t={t}
          />
          <ChoiceRow
            options={STRESS}
            tk="opt.stress"
            value={stress}
            onPick={(v) => {
              setStress(v);
              setStatus("idle");
            }}
            t={t}
          />
        </Section>

        <Section n={9} title={t("sec.food.q")} why={t("sec.food.why")}>
          <ChoiceRow
            options={FOOD_REL}
            tk="opt.food"
            value={food}
            onPick={(v) => {
              setFood(v);
              setStatus("idle");
            }}
            t={t}
          />
        </Section>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-bg/95 px-[22px] py-4 backdrop-blur">
        <div className="mx-auto flex max-w-[520px] items-center gap-3">
          {status === "saved" && (
            <span className="text-[13px] text-accent">{t("saved")}</span>
          )}
          {status === "error" && (
            <span role="alert" className="text-[13px] text-alert-ink">
              {t("error")}
            </span>
          )}
          <div className="ml-auto">
            <Button size="md" disabled={pending} onClick={save}>
              {pending ? "…" : t("save")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  n,
  title,
  why,
  children,
}: {
  n: number;
  title: string;
  why?: string;
  children: React.ReactNode;
}): ReactElement {
  return (
    <section>
      <div className="mb-3 flex items-baseline gap-2.5">
        <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-[7px] bg-ink text-[12px] font-bold text-bg">
          {n}
        </span>
        <h2 className="text-[16px] font-semibold leading-[1.35]">{title}</h2>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
      {why && (
        <p className="mt-1 text-[12px] leading-[1.5] text-faint">{why}</p>
      )}
    </section>
  );
}

type Tr = ReturnType<typeof useTranslations>;

function ChipGroup({
  options,
  tk,
  selected,
  onToggle,
  t,
  noneLabel,
  onNone,
}: {
  options: readonly string[];
  tk: string;
  selected: string[];
  onToggle: (v: string) => void;
  t: Tr;
  noneLabel?: string;
  onNone?: () => void;
}): ReactElement {
  return (
    <div className="flex flex-wrap gap-2">
      {noneLabel && onNone && (
        <Chip
          label={noneLabel}
          active={selected.length === 0}
          onClick={onNone}
        />
      )}
      {options.map((o) => (
        <Chip
          key={o}
          label={t(`${tk}.${o}`)}
          active={selected.includes(o)}
          onClick={() => onToggle(o)}
        />
      ))}
    </div>
  );
}

function ChoiceRow({
  options,
  tk,
  value,
  onPick,
  t,
}: {
  options: readonly string[];
  tk: string;
  value: string | undefined;
  onPick: (v: string) => void;
  t: Tr;
}): ReactElement {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Chip
          key={o}
          label={t(`${tk}.${o}`)}
          active={value === o}
          onClick={() => onPick(o)}
        />
      ))}
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "tf-press inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium transition",
        active
          ? "border-[1.5px] border-ink text-ink"
          : "border border-line text-soft",
      ].join(" ")}
    >
      {active && <Icon name="check" size={11} strokeWidth={2.6} />}
      {label}
    </button>
  );
}

function TextField({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
}): ReactElement {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] text-muted">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-line bg-surface px-3.5 py-3 text-[14px] text-ink outline-none focus:border-ink"
      />
    </label>
  );
}
