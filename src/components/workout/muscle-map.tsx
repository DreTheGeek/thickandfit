import type { ReactElement } from 'react';

// Muscle-activation map (7.1 Workout Player). Stylized front + back figures, monochrome silhouette
// with the exercise's primary muscle group glowing accent. Exercises carry a single muscle_group,
// so we light the primary region (green = functional highlight, per the design system).

type Region =
  | 'neck'
  | 'shoulders'
  | 'chest'
  | 'biceps'
  | 'forearms'
  | 'abs'
  | 'quads'
  | 'adductors'
  | 'traps'
  | 'lats'
  | 'midback'
  | 'lowerback'
  | 'triceps'
  | 'glutes'
  | 'hamstrings'
  | 'calves';

// muscle_groups.key -> which regions light up on each figure.
const MUSCLE_MAP: Record<string, { front?: Region[]; back?: Region[] }> = {
  chest: { front: ['chest'] },
  shoulders: { front: ['shoulders'], back: ['shoulders'] },
  biceps: { front: ['biceps'] },
  triceps: { back: ['triceps'] },
  forearms: { front: ['forearms'], back: ['forearms'] },
  quadriceps: { front: ['quads'] },
  adductors: { front: ['adductors'] },
  calves: { back: ['calves'] },
  glutes: { back: ['glutes'] },
  hamstrings: { back: ['hamstrings'] },
  lats: { back: ['lats'] },
  'middle back': { back: ['midback'] },
  'lower back': { back: ['lowerback'] },
  traps: { back: ['traps'] },
  neck: { front: ['neck'], back: ['neck'] },
};

const BASE = 'var(--c-warm)';
const LINE = 'var(--c-line)';
const ON = '#5EBE62';

function fill(active: Set<Region>, id: Region): string {
  return active.has(id) ? ON : BASE;
}

// Front figure, viewBox 0 0 100 210. Muscle blobs over a plain silhouette.
function FrontFigure({ active }: { active: Set<Region> }): ReactElement {
  return (
    <g stroke={LINE} strokeWidth={0.8}>
      {/* silhouette base */}
      <circle cx={50} cy={16} r={11} fill={BASE} />
      <path d="M35 34h30l-3 62h-24z" fill={BASE} />
      <path d="M35 36l-11 6-6 40 7 2 8-38z" fill={BASE} />
      <path d="M65 36l11 6 6 40-7 2-8-38z" fill={BASE} />
      <path d="M38 94h11l-1 54-11-2z" fill={BASE} />
      <path d="M62 94h-11l1 54 11-2z" fill={BASE} />
      {/* muscle regions */}
      <rect x={45} y={27} width={10} height={7} rx={3} fill={fill(active, 'neck')} stroke="none" />
      <ellipse cx={32} cy={40} rx={8} ry={6.5} fill={fill(active, 'shoulders')} stroke="none" />
      <ellipse cx={68} cy={40} rx={8} ry={6.5} fill={fill(active, 'shoulders')} stroke="none" />
      <rect x={36} y={43} width={12} height={13} rx={5} fill={fill(active, 'chest')} stroke="none" />
      <rect x={52} y={43} width={12} height={13} rx={5} fill={fill(active, 'chest')} stroke="none" />
      <rect x={43} y={58} width={14} height={26} rx={5} fill={fill(active, 'abs')} stroke="none" />
      <ellipse cx={24} cy={56} rx={5.5} ry={10} fill={fill(active, 'biceps')} stroke="none" />
      <ellipse cx={76} cy={56} rx={5.5} ry={10} fill={fill(active, 'biceps')} stroke="none" />
      <ellipse cx={21} cy={78} rx={5} ry={11} fill={fill(active, 'forearms')} stroke="none" />
      <ellipse cx={79} cy={78} rx={5} ry={11} fill={fill(active, 'forearms')} stroke="none" />
      <rect x={38} y={98} width={10} height={42} rx={5} fill={fill(active, 'quads')} stroke="none" />
      <rect x={52} y={98} width={10} height={42} rx={5} fill={fill(active, 'quads')} stroke="none" />
      <rect x={47} y={100} width={6} height={34} rx={3} fill={fill(active, 'adductors')} stroke="none" />
    </g>
  );
}

// Back figure, mirrored anatomy.
function BackFigure({ active }: { active: Set<Region> }): ReactElement {
  return (
    <g stroke={LINE} strokeWidth={0.8}>
      <circle cx={50} cy={16} r={11} fill={BASE} />
      <path d="M35 34h30l-3 62h-24z" fill={BASE} />
      <path d="M35 36l-11 6-6 40 7 2 8-38z" fill={BASE} />
      <path d="M65 36l11 6 6 40-7 2-8-38z" fill={BASE} />
      <path d="M38 94h11l-1 60-11-2z" fill={BASE} />
      <path d="M62 94h-11l1 60 11-2z" fill={BASE} />
      {/* muscle regions */}
      <rect x={45} y={27} width={10} height={7} rx={3} fill={fill(active, 'neck')} stroke="none" />
      <path d="M40 35h20l-4 12h-12z" fill={fill(active, 'traps')} stroke="none" />
      <ellipse cx={32} cy={41} rx={8} ry={6.5} fill={fill(active, 'shoulders')} stroke="none" />
      <ellipse cx={68} cy={41} rx={8} ry={6.5} fill={fill(active, 'shoulders')} stroke="none" />
      <path d="M36 49h9l-2 20h-8z" fill={fill(active, 'lats')} stroke="none" />
      <path d="M64 49h-9l2 20h8z" fill={fill(active, 'lats')} stroke="none" />
      <rect x={46} y={49} width={8} height={20} rx={3} fill={fill(active, 'midback')} stroke="none" />
      <rect x={44} y={71} width={12} height={16} rx={4} fill={fill(active, 'lowerback')} stroke="none" />
      <ellipse cx={24} cy={56} rx={5.5} ry={10} fill={fill(active, 'triceps')} stroke="none" />
      <ellipse cx={76} cy={56} rx={5.5} ry={10} fill={fill(active, 'triceps')} stroke="none" />
      <ellipse cx={21} cy={78} rx={5} ry={11} fill={fill(active, 'forearms')} stroke="none" />
      <ellipse cx={79} cy={78} rx={5} ry={11} fill={fill(active, 'forearms')} stroke="none" />
      <rect x={38} y={89} width={11} height={15} rx={6} fill={fill(active, 'glutes')} stroke="none" />
      <rect x={51} y={89} width={11} height={15} rx={6} fill={fill(active, 'glutes')} stroke="none" />
      <rect x={38} y={106} width={10} height={34} rx={5} fill={fill(active, 'hamstrings')} stroke="none" />
      <rect x={52} y={106} width={10} height={34} rx={5} fill={fill(active, 'hamstrings')} stroke="none" />
      <rect x={39} y={144} width={9} height={26} rx={4} fill={fill(active, 'calves')} stroke="none" />
      <rect x={52} y={144} width={9} height={26} rx={4} fill={fill(active, 'calves')} stroke="none" />
    </g>
  );
}

export function MuscleMap({
  muscleKey,
  frontLabel,
  backLabel,
}: {
  muscleKey: string | null;
  frontLabel: string;
  backLabel: string;
}): ReactElement {
  const map = muscleKey ? MUSCLE_MAP[muscleKey] : undefined;
  const front = new Set<Region>(map?.front ?? []);
  const back = new Set<Region>(map?.back ?? []);

  return (
    <div className="grid grid-cols-2 gap-2">
      {[
        { label: frontLabel, node: <FrontFigure active={front} /> },
        { label: backLabel, node: <BackFigure active={back} /> },
      ].map((f) => (
        <div key={f.label} className="flex flex-col items-center">
          <svg viewBox="0 0 100 175" className="h-auto w-full max-w-[130px]" role="img">
            {f.node}
          </svg>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-[2px] text-faint">
            {f.label}
          </div>
        </div>
      ))}
    </div>
  );
}
