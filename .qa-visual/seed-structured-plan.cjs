// Seed Stephanie's real "Shelise - Meal Plan 2" (2200 kcal) as a STRUCTURED plan. Transcribed verbatim
// from the PDF she shared. Two writes via the service key (bypasses RLS):
//   1. enrich sample.sam's existing plan (so /nutrition/plan renders the rich structured view live), and
//   2. add it to her company template library (is_template=true) as an authoring starting point.
// Idempotent: the template is deleted-by-name then re-inserted, and sam's plan is a PATCH.
const fs = require('fs');
const env = {};
fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).forEach((l) => {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) { let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); env[m[1]] = v; }
});
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) { console.error('missing SUPABASE url/service key'); process.exit(1); }

const COMPANY = 'c0ffee00-0000-4000-8000-000000000001';
const SAM_PLAN = '13c42116-e36e-4ab5-ba10-a9041356bc74';

const ing = (qty, item) => ({ qty, item });
const structured = {
  goal: 'getting a healthier lifestyle',
  calorieTarget: 2200,
  macros: { proteinG: 174, carbG: 212, fatG: 70 },
  macroSplit: { proteinPct: 33, carbPct: 40, fatPct: 28 },
  slots: [
    {
      name: 'Breakfast',
      kcalTarget: 530,
      recipes: [
        {
          title: 'Baked tomato, egg white and cheese English muffin',
          prepMin: 15, cookMin: 10, kcal: 528, macros: { proteinG: 38, carbG: 51, fatG: 19 },
          ingredients: [
            ing('80g', 'Cherry tomatoes'), ing('125g', 'Whole wheat English muffin'),
            ing('25g', 'Green onion/scallion'), ing('5g', 'Olive oil'),
            ing('40g', 'Cheese, cheddar or jack, reduced fat'), ing('150g', 'Egg white, pasteurized'),
          ],
          spices: [], note: null,
          steps: [
            'Preheat the oven to 450F (convection).',
            'Slice the English muffins in half and toast until golden. Place on a lined baking sheet.',
            'Rinse the scallions and tomatoes. Finely chop the scallions and cut the tomatoes in half. Shred the cheese and whisk the egg whites.',
            'Bring a frying pan to a medium heat with the oil and fry half of the scallions for approximately 2-3 minutes. Add the egg whites, season with salt and pepper, and cook while stirring until the egg white has set. Remove the pan from the heat.',
            'Layer the English muffins with the scrambled egg whites, shredded cheese and tomatoes. Heat in the oven for about 1-2 minutes, or until the cheese has melted.',
            'Serve the English muffins on a plate, top with the remaining scallions, and enjoy!',
          ],
        },
        {
          title: 'Mini Oreo overnight oats',
          prepMin: null, cookMin: 10, kcal: 528, macros: { proteinG: 39, carbG: 51, fatG: 18 },
          ingredients: [
            ing('20g', 'Oreo cookies, mini, original'), ing('195g', 'Total 5% Plain Greek Yogurt, Fage'),
            ing('65g', 'Almond milk, plain, unsweetened'), ing('20g', 'Whey protein powder, flavored'),
            ing('45g', 'Oats'), ing('50g', 'Blueberries'),
          ],
          spices: [],
          note: 'There should be at least twice as much liquid as you have oats. Add more water if you want a thinner consistency. A chocolate flavored protein powder is recommended for this recipe.',
          steps: [
            'Note: this recipe must be prepared the night before and stored in the fridge for at least 4 hours.',
            'Mix up half of the Oreos and the protein powder with the yogurt.',
            'Add the oats to a bowl and mix together with the almond milk.',
            'Start layering the oats and yogurt in a small glass. First, layer some oats, then some yogurt, then oats again. Repeat until you run out of yogurt and oats.',
            'Cover and place in the fridge overnight, or for at least 4 hours, to allow the oats to soak.',
            'When the oats are ready to eat, rinse the berries. Top the overnight oats with the berries and remaining Oreos. Enjoy!',
          ],
        },
      ],
    },
    {
      name: 'Snack 1',
      kcalTarget: 310,
      recipes: [
        {
          title: 'Berries + string cheese',
          prepMin: 2, cookMin: null, kcal: 300, macros: { proteinG: 17, carbG: 40, fatG: 7 },
          ingredients: [
            ing('50g', 'Light String Mozzarella Cheese, Frigo Cheese Heads'),
            ing('150g', 'Blueberries'), ing('250g', 'Strawberries'),
          ],
          spices: [], note: null,
          steps: ['Wash strawberries and blueberries, bring together in a bowl with string cheese and enjoy.'],
        },
      ],
    },
    {
      name: 'Lunch',
      kcalTarget: 575,
      recipes: [
        {
          title: 'Taco bowl with beef',
          prepMin: 10, cookMin: 20, kcal: 579, macros: { proteinG: 45, carbG: 57, fatG: 18 },
          ingredients: [
            ing('135g', 'Ground beef, 93% lean, 7% fat, cooked'), ing('30g', 'Tomato salsa'),
            ing('135g', 'Brown rice, any type, cooked'), ing('85g', 'Sweet whole kernel corn, canned'),
            ing('45g', 'Light/low fat sour cream, 9% fat'), ing('90g', 'Yellow onion'), ing('60g', 'Tomatoes'),
          ],
          spices: [ing('1-2 tsp', 'Taco seasoning'), ing('1-2 pc', 'Garlic clove, minced'), ing('1/2-1 handful', 'Cilantro, chopped')],
          note: 'Pro tip: swap out the sour cream for plain greek yogurt. Feel free to add some seasoning to it but it tastes almost the same.',
          steps: [
            'Rinse the rice. Cook the rice according to the instructions on the packet in a pot of lightly salted water.',
            'Drain the corn and peel and dice the onion. Fry the garlic and onion in a pan over medium-high heat until golden. Add the ground meat and corn and cook until the meat is thoroughly browned. Season with the taco spice mix.',
            'Rinse and dice the tomatoes.',
            'Add the rice to a bowl and top with the beef, salsa, tomatoes, sour cream, and cilantro. Enjoy!',
          ],
        },
        {
          title: 'Coconut rice with tilapia',
          prepMin: 10, cookMin: 25, kcal: 601, macros: { proteinG: 46, carbG: 60, fatG: 19 },
          ingredients: [
            ing('150g', 'Tilapia filet, without skin, cooked'), ing('105g', 'Coconut milk, lite (6-7% fat)'),
            ing('175g', 'Jasmine rice, cooked'), ing('40g', 'Avocado, fresh'), ing('10g', 'Raisins'),
          ],
          spices: [ing('2-3 sec', 'Cooking spray'), ing('1/2 tsp', 'Lime juice')],
          note: null,
          steps: [
            'Rinse the rice before cooking. Heat a pot over high heat with the cooking spray, then add the rice, coconut milk and a pinch of salt. Boil the rice until the coconut milk has decreased at the surface and the rice is visible, then reduce the heat to low, cover and simmer for about 15 minutes. Remove from the heat and let stand for another 5 minutes.',
            'Season the fish with salt and pepper. Put the tilapia in a pan over medium heat with a splash of water and saute on both sides for a few minutes, or until it flakes apart easily with a fork.',
            'Cut the avocado in half and remove the stone. Use a spoon to scoop out the flesh and slice it.',
            'Serve the rice and the fish on a plate. Top the rice with raisins and the fish with avocado slices and lime juice.',
          ],
        },
      ],
    },
    {
      name: 'Snack 2',
      kcalTarget: 210,
      recipes: [
        {
          title: 'Protein shake',
          prepMin: 5, cookMin: null, kcal: 133, macros: { proteinG: 20, carbG: 2, fatG: 5 },
          ingredients: [
            ing('25g', 'Whey protein powder, flavored'),
            ing('300g', 'Almond milk, Unsweetened Original, Almond Breeze'),
          ],
          spices: [],
          note: 'Refer to supplement recommendations for protein powder recommendations.',
          steps: ['Mix protein powder with either water, unsweetened almond milk or fat free milk. If you blend it with ice it will give it a thicker consistency.'],
        },
      ],
    },
    {
      name: 'Dinner',
      kcalTarget: 580,
      recipes: [
        {
          title: 'Slow cooker honey garlic chicken with rice',
          prepMin: 10, cookMin: 240, kcal: 574, macros: { proteinG: 44, carbG: 54, fatG: 19 },
          ingredients: [
            ing('125g', 'Chicken breast, boneless and skinless, cooked'), ing('130g', 'Brown rice, any type, cooked'),
            ing('10g', 'Sesame seeds'), ing('15g', 'Honey'), ing('5g', 'Cornstarch'),
            ing('10g', 'Sesame oil'), ing('10g', 'Tomato paste'),
          ],
          spices: [ing('1-2 tbsp', 'Sambal oelek'), ing('1-3 tbsp', 'Soy sauce'), ing('1-2 tsp', 'Rice vinegar'), ing('1-3 pc', 'Garlic clove, minced')],
          note: 'You need a slow cooker for this recipe. You can make several portions and store them in tupperware to eat another time.',
          steps: [
            'Add the chicken to the crockpot/slow cooker. In a bowl, whisk together the oil, soy sauce, honey, tomato paste, sambal oelek, garlic, and rice vinegar. Pour over the chicken.',
            'Cover and cook on low for 4 to 5 hours, until the chicken is no longer pink in the middle.',
            'Remove the chicken to a plate and let cool slightly. Whisk the cornstarch into the slow cooker cooking liquid. Cover and cook on high for 15 minutes, until the sauce thickens slightly, stirring occasionally.',
            'Meanwhile, shred the chicken with a fork. Serve the chicken with the rice and sauce. Garnish with the sesame seeds. Enjoy!',
          ],
        },
        {
          title: 'Grilled honey mustard teriyaki steak and potatoes',
          prepMin: 120, cookMin: 20, kcal: 576, macros: { proteinG: 43, carbG: 61, fatG: 17 },
          ingredients: [
            ing('125g', 'Sirloin steak, lean, cooked'), ing('15g', 'Honey'),
            ing('275g', 'Potato, small'), ing('10g', 'Olive oil'),
          ],
          spices: [ing('30-60 ml', 'Soy sauce'), ing('1/2-1 tsp', 'Ginger, fresh, grated'), ing('2-3 pc', 'Garlic clove, minced'), ing('1-2 tsp', 'Dijon mustard')],
          note: 'You need a grill/barbecue. Alternatively, cook this in a pan on the stove or under the broiler in the oven.',
          steps: [
            'Note: the steaks need to marinate for at least 2 hours before cooking.',
            'Heat the barbecue to high heat.',
            'Mix the olive oil, honey, ginger, garlic, mustard and soy sauce in a small bowl to create a marinade.',
            'Season the steaks with salt and pepper and place them in a ziploc bag. Pour the marinade in the bag, seal and shake to coat the meat. Let it rest in the fridge for 2 hours.',
            'Wash the potatoes and cut them into bite-sized chunks. Place them in the middle of some tin foil, season with salt, pepper and any herbs of your choice, then wrap to close.',
            'Put the wrapped potatoes on the grill and cook for 45-60 minutes, until tender. Alternatively, bake at 400F (conventional) or 350F (ventilator) for approximately 30 minutes, until soft.',
            'Remove the steaks from the bag and discard the excess marinade. Grill the steaks for 4 minutes, then turn over and cook for another 5 minutes or more depending on the desired doneness. Once cooked, leave to rest for at least 10 minutes before serving.',
            'Serve the steak with the potatoes and enjoy!',
          ],
        },
      ],
    },
  ],
};

const NOTE = "If you ever feel like you're not full, feel free to add spinach, onions, or cucumbers - they're virtually free calories and make the plate bigger without moving your macros.";

async function api(method, path, body, extraHeaders) {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json',
      Prefer: 'return=representation', ...(extraHeaders || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : [];
}

(async () => {
  // 1. Enrich sam's live plan.
  const patched = await api('PATCH', `meal_plans?id=eq.${SAM_PLAN}`, {
    name: 'Your Meal Plan',
    calorie_goal: 2200,
    split_protein_pct: 33, split_carb_pct: 40, split_fat_pct: 28,
    num_meal_groups: structured.slots.length,
    structured,
    notes: NOTE,
  });
  console.log('patched sam plan:', patched[0]?.id, '-> structured slots:', structured.slots.length);

  // 2. Template in her library (delete-by-name then insert for idempotency).
  const TEMPLATE_NAME = 'Shelise - Meal Plan 2 (2200 kcal)';
  await api('DELETE', `meal_plans?company_id=eq.${COMPANY}&is_template=eq.true&name=eq.${encodeURIComponent(TEMPLATE_NAME)}`);
  const tmpl = await api('POST', 'meal_plans', {
    company_id: COMPANY, contact_id: null, name: TEMPLATE_NAME, is_template: true,
    calorie_goal: 2200, split_protein_pct: 33, split_carb_pct: 40, split_fat_pct: 28,
    num_meal_groups: structured.slots.length, structured, notes: NOTE,
  });
  console.log('template inserted:', tmpl[0]?.id, TEMPLATE_NAME);
  console.log('DONE');
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
