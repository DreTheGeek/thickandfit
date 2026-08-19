// The advertised trial and the configured trial, read from ONE place.
//
// WHY THIS FILE EXISTS. /vs/cal-ai and /vs/fitia have been telling the public "Start 3 days free.
// No card to start." since launch. Both halves were false, in different ways:
//
//   * The trial is built and switched off. trialDays() in actions.ts reads STRIPE_TRIAL_DAYS,
//     defaults to 0, and encodeForm drops the key, so no trial reaches Stripe. The var is not set
//     in production. A woman arriving from that page hit Checkout and was charged the same day.
//   * "No card to start" stays false even with the trial ON. Stripe Checkout in subscription mode
//     collects a card regardless of trial_period_days unless payment_method_collection is set to
//     'if_required', and it is not. Setting it also means a trial can end with nobody's card on
//     file, which is a different product decision and not one to make from a copy fix.
//
// So the claim was removed and the number was wired to the switch. The marketing page now renders
// the trial line only when a trial is actually configured, reading the SAME env var the checkout
// call reads. Setting STRIPE_TRIAL_DAYS turns the offer and the sentence on together; leaving it
// unset leaves both off. The page cannot drift from the product because there is nothing to keep
// in sync.
//
// Pure and importable from anywhere: no 'use server', no 'server-only'. Both callers are server
// code (the checkout action, and the /vs pages, which are server components), so process.env is
// available and never reaches the browser.

/** Days of free trial to send to Stripe. 0 or unset means charge immediately. */
export function configuredTrialDays(): number {
  const n = Number(process.env.STRIPE_TRIAL_DAYS ?? '');
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Is there a trial to advertise? Never advertise one the checkout call will not actually send. */
export function hasTrial(): boolean {
  return configuredTrialDays() > 0;
}
