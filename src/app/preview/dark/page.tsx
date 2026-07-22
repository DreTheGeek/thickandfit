// Dark-premium treatment of the landing page, for a side-by-side decision against the cream one.
// Same component and same copy: only the token set changes, which is the point. Noindexed, because
// it is a decision aid and not a second public home page competing for the same queries.
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Thick & Fit (dark preview)',
  robots: { index: false, follow: false },
};

export { default } from '../../page';
