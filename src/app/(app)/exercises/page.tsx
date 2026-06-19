// The exercise library now lives in the Activities hub (Library tab).
import { redirect } from 'next/navigation';

export default function ExercisesPage(): never {
  redirect('/workouts');
}
