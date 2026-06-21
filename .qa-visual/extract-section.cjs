const fs = require('fs');
const html = fs.readFileSync('src/app/_body.html', 'utf8');

const marker = html.indexOf('section_coaching');
const start = html.lastIndexOf('<section', marker);
const endTag = html.indexOf('</section>', marker);
const end = endTag === -1 ? -1 : endTag + '</section>'.length;

const section = html.slice(start, end);
const before = html.slice(0, start);
const after = html.slice(end);

console.log('marker:', marker, 'start:', start, 'end:', end);
console.log('integrity (before+section+after===html):', before + section + after === html);
console.log('section length:', section.length);
console.log('contains Empowering:', /empowering women through fitness/i.test(section));
console.log('contains Meals (last feature):', /meals you will/i.test(section));
console.log('contains other sections leaked? hero "helping women":', /helping women/i.test(section));
console.log('section starts:', JSON.stringify(section.slice(0, 120)));
console.log('section ends:', JSON.stringify(section.slice(-80)));
// count nested <section> inside (should be 0 for a clean single section)
console.log('nested <section> count inside:', (section.match(/<section/g) || []).length);
