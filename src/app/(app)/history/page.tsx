// Workout history now lives in the Activities hub (History tab).
import { redirect } from 'next/navigation';

export default function HistoryPage(): never {
  redirect('/workouts');
}
