/**
 * Turn a stored message body into readable text.
 *
 * Her migrated Lenus messages are HTML, and we were printing the source. A real check-in reminder
 * rendered on screen as:
 *
 *   <p>Hi Samone 👋</p><p><br></p><p></p><p>Check-in time! ⏰ Head to the app now...
 *
 * across the whole thread. Every automated message she has ever sent looked like that.
 *
 * DELIBERATELY CONVERTED TO TEXT, NOT RENDERED AS HTML. These rows came from another company's
 * database via a scrape; dropping them into dangerouslySetInnerHTML would make every historical
 * message an XSS surface, and the only formatting they carry is paragraph breaks, which survive
 * this fine. Messages typed in our own app are plain text already and pass through untouched.
 */

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  '#39': "'",
  apos: "'",
  nbsp: ' ',
};

export function messageBodyText(raw: string | null): string {
  if (!raw) return '';
  // Fast path: nothing that looks like a tag or an entity, so it is already plain text.
  if (!/[<&]/.test(raw)) return raw;

  let s = raw;
  // Block-level ends become newlines BEFORE tags are stripped, or paragraphs run together into one
  // wall of text, which is how "Check-in time!" ended up glued to the greeting.
  s = s.replace(/<\s*br\s*\/?\s*>/gi, '\n');
  s = s.replace(/<\s*\/\s*(p|div|li|h[1-6])\s*>/gi, '\n');
  s = s.replace(/<\s*li[^>]*>/gi, '• ');
  s = s.replace(/<[^>]+>/g, '');
  s = s.replace(/&([a-zA-Z#0-9]+);/g, (m, e: string) => ENTITIES[e.toLowerCase()] ?? ENTITIES[e] ?? m);
  // Lenus emits empty paragraphs as spacers (<p></p><p><br></p>), which become runs of blank lines.
  // Collapse to at most one, so a message keeps its shape without a gap down the rail.
  s = s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  return s.trim();
}
