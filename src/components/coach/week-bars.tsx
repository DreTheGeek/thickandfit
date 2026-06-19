'use client';

import { BarChart, Bar, XAxis, ResponsiveContainer, Cell } from 'recharts';
import type { ReactElement } from 'react';

/** Compact weekday bar chart (workouts logged per day this week). */
export function WeekBars({
  data,
}: {
  data: { day: string; count: number; today: boolean }[];
}): ReactElement {
  return (
    <div className="h-[120px] w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 4 }}>
          <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#999' }} />
          <Bar dataKey="count" radius={[3, 3, 0, 0]} maxBarSize={34}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.today ? '#5EBE62' : '#0f0f0f'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
