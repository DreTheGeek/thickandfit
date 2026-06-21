const fs = require('fs');
const html = fs.readFileSync('src/app/_body.html', 'utf8');
const marker = html.indexOf('section_coaching');
const start = html.lastIndexOf('<section', marker);
const end = html.indexOf('</section>', marker) + '</section>'.length;
const section = html.slice(start, end);

// image srcs in order
const imgs = [...section.matchAll(/<img[^>]+src="([^"]+)"[^>]*>/g)].map((m) => m[1]);
console.log('IMAGES (' + imgs.length + '):');
imgs.forEach((s) => console.log('  ' + s));

// text content: headings + paragraphs (strip tags, collapse ws)
const text = section
  .replace(/<style[\s\S]*?<\/style>/g, '')
  .replace(/<[^>]+>/g, '\n')
  .replace(/&amp;/g, '&')
  .split('\n')
  .map((s) => s.trim())
  .filter((s) => s.length > 1);
console.log('\nTEXT BLOCKS:');
text.forEach((t) => console.log('  | ' + t));
