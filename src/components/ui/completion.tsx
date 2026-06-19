import type { ReactElement } from 'react';
import { Icon } from './icons';

/**
 * Completion indicator: filled green check when done (functional accent),
 * hollow ring when not. Used across Today, workouts, nutrition, habits.
 */
export function CompletionCheck({
  done,
  size = 24,
}: {
  done: boolean;
  size?: number;
}): ReactElement {
  if (done) {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-full bg-accent text-white"
        style={{ width: size, height: size }}
      >
        <Icon name="check" size={Math.round(size * 0.6)} strokeWidth={2.4} />
      </span>
    );
  }
  return (
    <span
      className="block shrink-0 rounded-full border-2 border-line"
      style={{ width: size, height: size }}
    />
  );
}
