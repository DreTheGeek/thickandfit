// TEMPORARY DIAGNOSTIC. Delete once the bottom-bar question is settled.
//
// Two fixes for the gap under the tab bar have now been reasoned out rather than measured, and one
// of them shipped a white band across a black screen. The open question cannot be answered from a
// desktop browser: does `100dvh` on THIS phone include the bottom safe-area inset, or stop above it?
// Chromium has no insets to emulate, so the only way to know is to read the numbers off the device.
//
// Open https://www.teamthickandfit.com/viewport-check on the phone, screenshot it, done.
import type { ReactElement } from 'react';
import { ViewportReadout } from './readout';

export const dynamic = 'force-dynamic';

export default function ViewportCheckPage(): ReactElement {
  return <ViewportReadout />;
}
