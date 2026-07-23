// The v2 direction was promoted to the canonical homepage (/). This route stays as a permanent
// redirect so any bookmark of the old preview URL lands on the live page rather than a 404.
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';

export default function V2Promoted(): ReactElement {
  redirect('/');
}
