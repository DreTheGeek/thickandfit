// The Coach Interview question bank + pure types. Stephanie (or her assistant Dani) answers these once
// so the AI can coach AS her; each saved section is composed + embedded into coach_knowledge. PURE
// MODULE (no server imports) so the interview page can import the bank + helpers directly.
// The INTERVIEW_BANK content is drafted separately; this file holds the shape + helpers.

export type InterviewQType = 'choice' | 'multi' | 'text' | 'scenario';

export type InterviewQuestion = {
  key: string;
  type: InterviewQType;
  prompt: string;
  help?: string;
  choices?: string[];
  placeholder?: string;
  captures: string;
};

export type InterviewSection = {
  key: string;
  label: string;
  description: string;
  questions: InterviewQuestion[];
};

// Filled from the drafting workflow (draft-coach-interview).
export const INTERVIEW_BANK: InterviewSection[] = [
  {
    "key": "philosophy",
    "label": "Philosophy & Voice",
    "description": "Stephanie's core coaching beliefs, her signature tone, and the language patterns that make her sound like her.",
    "questions": [
      {
        "key": "philosophy-core-belief",
        "type": "text",
        "prompt": "What's your core belief about how women actually get real, lasting results with fitness and nutrition?",
        "placeholder": "e.g., 'Women get results when they stop following someone else's plan and start owning their own decisions...'",
        "captures": "Her foundational coaching philosophy: what she believes drives transformation"
      },
      {
        "key": "philosophy-differentiation",
        "type": "text",
        "prompt": "What makes your coaching different from every other fitness coach out there? What's your unfair advantage?",
        "placeholder": "e.g., 'I don't shame you, I make it easy. Simple meals, no math, macro-first, listen to your body...'",
        "captures": "Her unique positioning and coaching perspective vs. competitors"
      },
      {
        "key": "voice-tone",
        "type": "choice",
        "prompt": "How would you describe your coaching voice most of the time?",
        "choices": [
          "Hype and celebration (lots of emojis, 'YES QUEEN')",
          "Tough love, direct, no BS (I tell you what you need to hear)",
          "Warm, nurturing, big-sister energy (encouraging and supportive)",
          "Educational, clinical, facts-focused (let's talk science)",
          "Mix of celebratory + direct (celebrate wins, keep it real on hard truths)"
        ],
        "captures": "Her self-identified tone and personality so the AI mirrors her exact vibe"
      },
      {
        "key": "voice-emoji-usage",
        "type": "choice",
        "prompt": "How do you use emojis in messages to clients?",
        "choices": [
          "Heavy (2-3+ per message, they're part of my brand)",
          "Moderate (1-2 per message, adds personality)",
          "Minimal (only when it matters, mostly text)",
          "Never (I keep it professional)",
          "Depends on context (celebratory = more, technical = less)"
        ],
        "captures": "How she uses emojis to maintain voice, critical for AI consistency"
      },
      {
        "key": "voice-opening-message",
        "type": "text",
        "prompt": "When you message a brand-new client for the very first time, how do you open? Show me the exact words and tone.",
        "placeholder": "e.g., 'Hey babe! Welcome to the team, I'm so excited to work with you. Here's what to expect...'",
        "captures": "Her exact first-contact cadence and warmth level in client communication"
      },
      {
        "key": "voice-celebrating-win",
        "type": "text",
        "prompt": "A client just hit her weight-loss goal. How do you celebrate with her? Show me what you actually say.",
        "placeholder": "e.g., 'STOP. Let's talk about this. You did the work. This is YOU. I'm so proud.'",
        "captures": "How she celebrates wins: emotional tone and authenticity in praise"
      },
      {
        "key": "voice-hard-feedback",
        "type": "text",
        "prompt": "A client isn't logging food, keeps missing workouts, and blames 'life happens.' How do you deliver real feedback without losing her?",
        "placeholder": "e.g., 'I get it, life is messy. But results come from recommitting, not from trying only when it's easy. What's the one thing we lock in this week?'",
        "captures": "How she balances accountability with compassion; her tough-love approach"
      },
      {
        "key": "voice-slang-tone",
        "type": "text",
        "prompt": "What slang, catchphrases, or signature words do you use all the time? (e.g., 'babe', 'mama', 'lock in', 'let's go')",
        "placeholder": "e.g., 'I say \"let's lock in\" constantly, \"babe\" or \"mama\", \"it's not that deep\"...'",
        "captures": "Signature language patterns so the AI speaks with her exact vocabulary and cadence"
      },
      {
        "key": "voice-spanish-differ",
        "type": "text",
        "prompt": "Does your Spanish voice sound different from your English voice? If so, how?",
        "placeholder": "e.g., 'In English I'm more motivational, in Spanish I'm warmer and more family-focused.' or 'Same voice, different words.'",
        "captures": "Cultural and linguistic differences so the AI avoids a tone-deaf direct translation"
      },
      {
        "key": "philosophy-non-negotiable",
        "type": "multi",
        "prompt": "Pick the things you would NEVER do as a coach (your hard non-negotiables):",
        "choices": [
          "Shame a client for her body or past choices",
          "Give diet advice with no macro context (just 'eat less')",
          "Promise results without effort",
          "Coach without knowing her personal context (health, schedule, food preferences)",
          "Push extreme deficit or restriction",
          "Let a client quit just because it got hard",
          "Fake my results or pretend I have all the answers"
        ],
        "captures": "Her hard boundaries as a coach: what the AI must never violate"
      },
      {
        "key": "philosophy-worst-feeling",
        "type": "text",
        "prompt": "Finish this sentence: the ONE thing you never want a client to feel is...",
        "placeholder": "e.g., 'Alone. Every client deserves to know I have her back, even when she messes up.'",
        "captures": "Her deepest coaching value; what she protects clients from emotionally"
      },
      {
        "key": "philosophy-why-glutes",
        "type": "text",
        "prompt": "Why do you emphasize glutes and lower body so much? What's the philosophy behind it?",
        "placeholder": "e.g., 'Glutes are functional, they build confidence, and women see results fast. It's empowering.'",
        "captures": "Her coaching priorities and the emotional and physical reasoning behind them"
      }
    ]
  },
  {
    "key": "nutrition",
    "label": "Nutrition Method",
    "description": "How Stephanie sets calories and macros, her go-to foods, and how she handles hunger, cheats, and real life around eating.",
    "questions": [
      {
        "key": "nutrition-calorie-setting-philosophy",
        "type": "scenario",
        "prompt": "A new client says she's 'always been a slow loser' and is worried you'll put her calories too low. Walk me through how you set her starting calorie target: what info you need, your gut call, and how you talk her into trusting it.",
        "placeholder": "I pull her activity level, how fast she lost before, and what she can stick to. I'd rather start slightly high than have her quit week 2. I tell her: 'Trust the process, we adjust every 2 weeks.'",
        "captures": "Her calorie-setting logic, risk tolerance (aggressive vs. moderate), and reassurance messaging"
      },
      {
        "key": "nutrition-macro-split-defaults",
        "type": "choice",
        "prompt": "When you set macros for a new client, what's your go-to protein / carb / fat split?",
        "choices": [
          "High protein (1.0g per lb), moderate carbs, rest fats, same for everyone unless they complain",
          "High protein, higher carbs on training days, lower on off-days",
          "High protein (0.8-1.0g per lb), carbs by activity level, fats fill the gap",
          "Flexible, I offer 2-3 templates and see what she prefers",
          "Intuitive, I hit protein and calories first, then refine around what she already eats"
        ],
        "captures": "Her default macro philosophy and how rigid vs. flexible she is with splits"
      },
      {
        "key": "nutrition-protein-brands",
        "type": "text",
        "prompt": "What are your go-to protein sources you always recommend? Brand names and specific products, as detailed as you'd tell a client.",
        "placeholder": "93/7 ground beef, Fage yogurt, protein pasta, egg whites, low-sodium deli turkey, whey isolate. Lean stuff hits protein without blowing up fats.",
        "captures": "Her actual preferred brands and products that define a typical meal"
      },
      {
        "key": "nutrition-carb-sources",
        "type": "text",
        "prompt": "Same for carbs, what do you default to in meal plans?",
        "placeholder": "Rice (white or jasmine), oats, sweet potato, pasta, bread. Simple and budget-friendly.",
        "captures": "Her carb staples and any quality or type preferences"
      },
      {
        "key": "nutrition-fat-sources",
        "type": "text",
        "prompt": "And fats, how do you build them in without going overboard?",
        "placeholder": "Olive oil (1 tbsp measured), avocado, nuts in controlled amounts, butter in cooking. Not anti-fat, just intentional.",
        "captures": "Her approach to fat inclusion and portion control"
      },
      {
        "key": "nutrition-simplicity-rule",
        "type": "scenario",
        "prompt": "Tell me about your 3-5 ingredient meal rule. How strict is it, when do you break it, and how do you explain it to a client who wants more variety?",
        "placeholder": "Fewer ingredients means easier tracking, less decision fatigue. It's a rule, not dogma. Rice + chicken + broccoli + garlic + soy sauce is 5 and it works. Seasonings are free as long as they're logged.",
        "captures": "Her philosophy on meal complexity, how she sells simplicity, and her flexibility boundaries"
      },
      {
        "key": "nutrition-free-veggies-definition",
        "type": "text",
        "prompt": "What do you mean by 'free veggies' in your plans? Which ones, and why are they free?",
        "placeholder": "Spinach, lettuce, broccoli, cauliflower, cucumber, zucchini, onion, bell peppers. Almost no calories, tons of volume, add as much as you want when hungry.",
        "captures": "Which veggies she considers free, the caloric threshold, and her hunger-management strategy"
      },
      {
        "key": "nutrition-raw-cooked-weighing",
        "type": "choice",
        "prompt": "Do you have clients weigh food raw or cooked?",
        "choices": [
          "Always raw, easier to log, consistent data",
          "Always cooked, more realistic to how they'll eat it",
          "Raw for proteins, cooked for carbs",
          "Doesn't matter if they're consistent, I just want accurate tracking",
          "I teach both and let her pick one and stick with it"
        ],
        "captures": "Her preference on weighing protocol and flexibility on consistency vs. perfection"
      },
      {
        "key": "nutrition-always-hungry-adjustment",
        "type": "scenario",
        "prompt": "A client says she's constantly hungry and can't sleep, and thinks you set her calories too low. What's your first move: raise calories, or coach her through it?",
        "placeholder": "I ask: how long in? How much water? How much protein? If she's 2+ weeks in and truly struggling, I add 100-150 cal of protein or veggies, not carbs or fats. Week 1, hunger is normal and gets better.",
        "captures": "Her hunger troubleshooting hierarchy and threshold for upward adjustments"
      },
      {
        "key": "nutrition-cheat-meals-philosophy",
        "type": "scenario",
        "prompt": "A client asks, 'Can I have pizza on Friday?' How do you answer, and what's your philosophy on cheat meals: off-limits, built in, or case-by-case?",
        "placeholder": "Yes, but we count it. No 'cheat meal' labels, it's just food. She makes room for it and logs it. Flexibility is how people sustain.",
        "captures": "Her stance on cheats and indulgences and whether she requires logging vs. trusting clients"
      },
      {
        "key": "nutrition-eating-out-strategy",
        "type": "scenario",
        "prompt": "A client is going to a restaurant with friends and doesn't know the macros. What's your advice: estimate, pick safe options, or take the L for one meal?",
        "placeholder": "Pick a protein (grilled chicken, steak), a starch (rice, potato), and veggies. Ask about oil, estimate fats a little high to be safe, log it, move on. It's about the week, not the day.",
        "captures": "Her practical eating-out framework and her tolerance for imperfection"
      },
      {
        "key": "nutrition-alcohol-handling",
        "type": "text",
        "prompt": "How do you handle alcohol? Count the calories, set a limit, or just log it and move on?",
        "placeholder": "I count it, roughly 100-150 cal a drink. I don't restrict, she's an adult, but she should know it's empty calories and can make her hungrier. Better she stays honest than hides it and spirals.",
        "captures": "Her practical approach to alcohol tracking and her mindset on restriction vs. honesty"
      },
      {
        "key": "nutrition-dietary-restrictions",
        "type": "multi",
        "prompt": "Which dietary restrictions do you see most, and which ones do you adapt easily around? (Select all that apply.)",
        "choices": [
          "Vegetarian / vegan (swap proteins, keep the macro framework)",
          "Dairy-free (cottage cheese, lactase, or plant-based instead of Fage)",
          "Latin American / limited food access (rice, beans, eggs, affordable proteins)",
          "Gluten-free (easy, carbs are still carbs)",
          "Nut allergies (swap fats to oils and seeds)"
        ],
        "captures": "Which restrictions she encounters, her adaptation confidence, and foods she won't compromise on"
      },
      {
        "key": "nutrition-macro-strictness",
        "type": "choice",
        "prompt": "How strict are you about hitting macros dead-on?",
        "choices": [
          "Very strict (protein within ±5g, others within ±10g)",
          "Moderate (protein ±10g, carbs ±20g, fat ±10g)",
          "Loose (as long as calories and protein are close, split doesn't matter much)",
          "Depends on the client (some need rigid tracking, others do fine with 'close enough')",
          "Strict at the start, then loosen once she proves she can sustain it"
        ],
        "captures": "Her tolerance for macro flexibility and when and how she loosens standards"
      }
    ]
  },
  {
    "key": "training",
    "label": "Training Method",
    "description": "Stephanie's programming defaults, her glute-first philosophy, and how she progresses, adapts, and coaches form.",
    "questions": [
      {
        "key": "training-default-split",
        "type": "choice",
        "prompt": "What's your default weekly training split for most clients?",
        "choices": [
          "Upper/Lower (2 upper, 2 lower per week)",
          "Push/Pull/Legs/Upper (4 days)",
          "Full-body 3x per week",
          "Full-body 4x per week",
          "Body-part split (4+ days)",
          "Glute-focused lower, minimal upper (2 lower/glute-heavy, 1 upper)"
        ],
        "captures": "Her go-to programming structure and how it prioritizes lower-body emphasis"
      },
      {
        "key": "training-glute-lower-emphasis",
        "type": "text",
        "prompt": "How much of each client's training goes to glutes and lower body vs. upper body and core? Walk me through a typical week.",
        "placeholder": "e.g., 'Lower body gets 60-70% of weekly volume. 2 lower + 1 upper, or 2 heavy lower + 1 upper + 1 core. Glutes are the star, I lead with them when they're fresh.'",
        "captures": "The exact volume split and sequencing that reflects her lower-body-first philosophy"
      },
      {
        "key": "training-rep-range-preference",
        "type": "choice",
        "prompt": "What rep ranges do you most often program?",
        "choices": [
          "Mostly hypertrophy (8-12 reps)",
          "Mostly strength (3-6 reps)",
          "Mixed: strength (3-5) + hypertrophy (8-12) in the same workout",
          "Higher reps (12-15+) for a metabolic edge",
          "Varied by exercise: heavy compounds (5-6), secondary (8-12), isolation (12-15+)"
        ],
        "captures": "Her preferred rep scheme philosophy and whether she layers intensity approaches"
      },
      {
        "key": "training-progressive-overload-method",
        "type": "scenario",
        "prompt": "A client logs barbell squats: 6 reps at 185 lbs, difficulty 'moderate.' Last week it was 185 for 5 reps at 'hard.' How do you tell her what to do next week?",
        "placeholder": "e.g., 'Stay at 185, aim for 7-8 next week. Hit 8, then bump 5 lbs and reset to 6. I move weight first, then reps.'",
        "captures": "Her specific progressive-overload algorithm and whether she prioritizes weight jumps vs. rep progression"
      },
      {
        "key": "training-cardio-stance",
        "type": "choice",
        "prompt": "What's your stance on steady-state cardio for fat-loss and glute clients?",
        "choices": [
          "Avoid it, prioritize resistance training only",
          "Light activity only (casual walks, 2-3x per week max)",
          "Encourage it but secondary to lifting (30-45 min, 2-3x per week)",
          "Build it in as a regular feature (45-60 min, 3-4x per week)",
          "HIIT/sprint-based only, no steady-state",
          "Client preference, adapt to her schedule and appetite"
        ],
        "captures": "Her metabolic and compliance philosophy on cardio inclusion"
      },
      {
        "key": "training-daily-steps-guidance",
        "type": "text",
        "prompt": "Do you give clients a daily step target or NEAT guidance? What's your reasoning?",
        "placeholder": "e.g., 'Aim for 8-10k steps on rest days. Steps are free cardio, they aid recovery and keep hunger in check without tanking performance. I nudge it, don't make it strict.'",
        "captures": "Whether she uses NEAT as a tool, her target range, and how she positions it"
      },
      {
        "key": "training-low-frequency-client",
        "type": "scenario",
        "prompt": "A client can only train 2-3x per week due to work but wants glute and lower-body focus. How do you adjust her programming?",
        "placeholder": "e.g., '2x: one glute-heavy lower (hip thrusts, leg press, curls) + one upper or full-body. 3x: add a second lower with different glute movement. Fewer days means each session is denser and more glute-focused.'",
        "captures": "Her adaptation strategy for time-constrained clients and how she preserves glute stimulus"
      },
      {
        "key": "training-home-gym-vs-full-gym",
        "type": "text",
        "prompt": "A client has only dumbbells and a resistance band at home, no barbell or machines. How does your programming change vs. a full gym?",
        "placeholder": "e.g., 'Barbell hip thrusts become DB or band-resisted thrusts. Leg press becomes goblet or split squats. Leg curl becomes prone single-leg DB curls. Same patterns, scaled to equipment.'",
        "captures": "Her substitution logic and whether she keeps volume/intensity or adapts expectations"
      },
      {
        "key": "training-women-heavy-lifting-belief",
        "type": "text",
        "prompt": "What do you tell a client who's nervous about lifting heavy because she thinks she'll 'get bulky'?",
        "placeholder": "e.g., 'Progressive overload builds the glute shape you want. Heavy lifting in a deficit creates tone, not bulk. I show her my own lifts and results.'",
        "captures": "Her framing around resistance training and muscle-building, and the narrative she uses to build confidence"
      },
      {
        "key": "training-warmup-priority",
        "type": "choice",
        "prompt": "How important is a structured warmup, and what does a typical one look like?",
        "choices": [
          "Light cardio (2-3 min) + dynamic stretching, then work",
          "3-5 min cardio + dynamic warmup + 1-2 light sets of the first exercise",
          "Joint mobility + glute activation (clamshells, banded work) + cardio + ramp-up sets",
          "Very minimal, jump into light sets and build up",
          "Varies (lower body gets full prep, upper body minimal)"
        ],
        "captures": "Her injury-prevention and performance-prep priorities, especially glute activation"
      },
      {
        "key": "training-form-cues-priority",
        "type": "text",
        "prompt": "When teaching form, what's the #1 thing you prioritize? Where would you rather she use lighter weight with perfect form than push heavy with 'good enough' form?",
        "placeholder": "e.g., 'Mind-muscle connection for glutes. If she's not feeling it in the glutes, the weight doesn't matter. I'd rather she thrust 65 lbs firing her glutes than 95 with all quads.'",
        "captures": "How she trades off weight vs. mind-muscle connection and her cueing philosophy"
      },
      {
        "key": "training-favorite-glute-movements",
        "type": "multi",
        "prompt": "Pick your top 3-5 glute exercises that every client cycles through in some form.",
        "choices": [
          "Barbell back squats",
          "Barbell hip thrusts",
          "Romanian deadlifts (RDL)",
          "Leg press",
          "Bulgarian split squats / split squats",
          "Leg curl (machine or cable)",
          "Hack squat",
          "Glute-focused cable work",
          "Banded hip thrusts or kickbacks",
          "Deadlifts (conventional or sumo)",
          "Smith machine hip thrusts"
        ],
        "captures": "Her signature glute exercises and which movements anchor her programming"
      },
      {
        "key": "training-client-stall-response",
        "type": "scenario",
        "prompt": "A client has stalled on lower-body strength for 3 weeks, no weight or rep progress on squats, leg press, or RDLs. She's eating at goal and sleeping fine. What's your first move?",
        "placeholder": "e.g., 'Check if difficulty rating stayed the same. If still 'moderate,' maybe deload a week (drop 10%, keep volume, reset the nervous system). If she's stronger but the lift stalled, swap in a variation (pause squats, tempo, new machine) to hit new angles.'",
        "captures": "Her diagnostic approach to plateaus and whether she deloads, varies exercises, or adjusts volume/intensity"
      }
    ]
  },
  {
    "key": "clients",
    "label": "Client Psychology & Handling",
    "description": "How Stephanie reads a client's week, keeps a big roster personal, and coaches through motivation dips and lapses.",
    "questions": [
      {
        "key": "clients-checkin-cadence",
        "type": "choice",
        "prompt": "How often do you expect clients to check in (messages, weigh-ins, check-in forms, progress updates)?",
        "choices": [
          "Daily or every other day (accountability and habit building)",
          "2-3 times per week (balanced cadence)",
          "Weekly (structured, consistent touch-point)",
          "Bi-weekly or as needed (low-friction, client-driven)",
          "Varies by tier and stage (customized per person)"
        ],
        "captures": "The check-in frequency and structure that feels normal to her coaching rhythm"
      },
      {
        "key": "clients-checkin-priority",
        "type": "multi",
        "prompt": "When a client checks in, what do you look at FIRST to understand her week and decide how to respond?",
        "choices": [
          "Her weight or scale trend (the objective measure)",
          "Nutrition compliance (macro adherence, photo logging)",
          "How she's feeling mentally and emotionally",
          "Progress photos or body-composition changes",
          "Her own words about what's working or struggling",
          "Her workout adherence and consistency"
        ],
        "captures": "Her diagnostic priority when assessing a client's week and setting her tone"
      },
      {
        "key": "clients-plateau-first-move",
        "type": "scenario",
        "prompt": "A client was losing 1.5-2 lb/week for 4 weeks and has now been flat or trending up for 2 weeks, with near-perfect macros. Walk me through your first move: what you check, what you ask, and your initial message tone.",
        "placeholder": "e.g., 'I'd ask if anything changed: stress, sleep, cycle, water, salt, new workouts. Remind her plateaus are normal and the body adapts. Then decide whether to cut 100 cal or switch her training stimulus.'",
        "captures": "Her troubleshooting sequence and mindset when facing a stall"
      },
      {
        "key": "clients-hard-on-self",
        "type": "scenario",
        "prompt": "A client had one bad day, went 500 calories over, and is spiraling: 'I'm so stupid, I ruined everything, I should just give up.' What do you say, and what's your coaching move?",
        "placeholder": "e.g., 'One day doesn't undo weeks of work. Perfect isn't the goal, consistency is. Let's redirect to tomorrow, not dwell on it.'",
        "captures": "How she handles perfectionism and negative self-talk; her reframe for resilience"
      },
      {
        "key": "clients-motivation-dip",
        "type": "scenario",
        "prompt": "A client is 6 weeks in, hit her first goal, still compliant, but her messages are shorter and less frequent: 'I don't know if this is working anymore.' How do you re-ignite her?",
        "placeholder": "e.g., 'Celebrate what she's done, remind her where she started, show her progress she's overlooking. Then shift the goalpost: glutes now, or a strength PR, not just the scale.'",
        "captures": "How she manages motivation dips and keeps clients engaged past the honeymoon phase"
      },
      {
        "key": "clients-ghosting-pattern",
        "type": "scenario",
        "prompt": "A client goes silent for 2 weeks, then admits she 'fell off and got embarrassed to check in.' What's your response: grace period, restart, or something else?",
        "placeholder": "e.g., 'No judgment, we all slip. I ask what happened and what she needs from me to get back on: a reset, a call, or just permission to start fresh.'",
        "captures": "Her stance on lapses and how she rebuilds trust and prevents churn"
      },
      {
        "key": "clients-non-scale-wins",
        "type": "choice",
        "prompt": "A client messages: 'My weight hasn't moved in 3 weeks, but my jeans fit way better and I PR'd my leg press.' How do you respond?",
        "choices": [
          "Prioritize the non-scale wins hard, the scale is a liar and body comp is what matters",
          "Celebrate the wins, but gently keep weight loss the metric and refocus",
          "Ask her to trust the process, more progress is coming, the scale will follow",
          "Acknowledge both equally, recomposition is real and means her macros are working"
        ],
        "captures": "How she balances celebrating progress with keeping the client goal-focused"
      },
      {
        "key": "clients-onboarding-first-two-weeks",
        "type": "text",
        "prompt": "What's the ONE most important thing you prioritize in a client's first 2 weeks, before you worry about perfect macros or a 10-lb goal?",
        "placeholder": "e.g., 'Building trust and showing her this actually works. If she follows the plan, the results show up, and I have her back.'",
        "captures": "Her onboarding philosophy and what she leads with to set up long-term success"
      },
      {
        "key": "clients-push-vs-back-off",
        "type": "scenario",
        "prompt": "This week you have one client clearly in her groove (logging perfectly, excited) and one barely hitting 80% (skipped meals, a day of no logs, short replies). Do you push the second one, back off, or hold steady? Why?",
        "placeholder": "e.g., 'I back off the one struggling, pushing makes her leave. I check what's going on and maybe simplify. The one in her groove, I push a bit: tighten macros or try a new stimulus.'",
        "captures": "Her judgment on pacing and when to push vs. support; her read on client psychology"
      },
      {
        "key": "clients-roster-size-personal",
        "type": "text",
        "prompt": "You're coaching 256 women. How do you keep a big roster feeling personal so no one feels like a number?",
        "placeholder": "e.g., 'I remember details about their lives, not just their macros. I'll bring up something they told me three weeks ago, celebrate wins by name, and reach out first if someone goes quiet.'",
        "captures": "Her systems and mindset for maintaining connection at scale"
      },
      {
        "key": "clients-response-time-expectation",
        "type": "choice",
        "prompt": "When a client messages, what's a reasonable response time for her to expect? (Assume the AI coach replies in your voice, with Dani as human backup.)",
        "choices": [
          "Within 1-2 hours, always (fast and available)",
          "Within 24 hours, during business hours (reliable but not instant)",
          "Within 24-48 hours, depending on volume (realistic, sustainable)",
          "Same-day if urgent, within 48 hours otherwise (tiered by priority)"
        ],
        "captures": "Her service-level expectation and reliability promise to clients"
      }
    ]
  },
  {
    "key": "scenarios",
    "label": "Real Client Scenarios",
    "description": "Realistic tough situations, walked through in Stephanie's own words, so the AI can handle the hard cases like she would.",
    "questions": [
      {
        "key": "scenarios-scale-vs-measurements",
        "type": "scenario",
        "prompt": "A client is 3 weeks in. Her scale weight hasn't moved (or went up 1-2 lbs), but her waist and glute measurements are down 0.5-1 inch. She texts: 'Is this normal? Am I doing something wrong?' What do you tell her, and how do you explain what's happening?",
        "placeholder": "e.g., 'The scale is lying right now. Measurements down means you're reshaping, building glute muscle while losing fat. This is exactly what I want to see. Keep going.'",
        "captures": "How she reframes scale-stalls during recomposition and explains muscle vs. fat to build confidence"
      },
      {
        "key": "scenarios-stopped-logging",
        "type": "scenario",
        "prompt": "A client who logged consistently for 2 months went dark for 4 days, then admits she 'got overwhelmed' and 'felt guilty' about missing days, so she stopped. She's scared you'll scold her. What's your exact response, and what's the first thing you ask her to do to re-engage?",
        "placeholder": "e.g., 'I'm not mad, I'm proud you showed up 60 times. Guilt kills everything. Let's not be perfect, let's be consistent. Log just your biggest meal tomorrow. One meal.'",
        "captures": "How she rebuilds engagement after a lapse without shame, and the first step she prescribes to restart"
      },
      {
        "key": "scenarios-postpartum",
        "type": "scenario",
        "prompt": "A new client is 6 months postpartum, cleared by her OB, still breastfeeding, and frustrated: 'I don't recognize my body. I want it back before I get heavier.' What do you tell her about realistic timelines, and what's your tone with her right now?",
        "placeholder": "e.g., 'Six months in, you're just getting started. Postpartum isn't a regular cut, your hormones are still shifting and that's okay. We rebuild you stronger, and I'm not rushing you. Let's focus on feeling like yourself first.'",
        "captures": "Her empathy and realistic framing for postpartum: hormonal context, body image, and pace-setting"
      },
      {
        "key": "scenarios-pcos",
        "type": "scenario",
        "prompt": "A client with PCOS and insulin resistance says: 'My doctor told me to lose weight but not how. Everyone online says low-carb, but you gave me 170g carbs. Should I cut carbs?' She sounds scared. How do you coach her?",
        "placeholder": "e.g., 'Your doctor's right that you need to move, but low-carb isn't a PCOS cure, it's marketing. Your macros already account for your PCOS. A deficit and moving your body is what matters. We do this in a way that works for you, not internet dogma.'",
        "captures": "How she educates around PCOS without overstepping into medical claims, and her confidence vs. internet noise"
      },
      {
        "key": "scenarios-glp1",
        "type": "scenario",
        "prompt": "A client on Ozempic/Wegovy messages: 'I'm not hungry at all, I can barely eat 800 calories. My plan says 1600. Should I just eat what I'm hungry for?' She's worried about wasting the medication. What's your concern, and what do you say?",
        "placeholder": "e.g., 'GLP-1 is powerful and I respect it, but too-low calories destroy your metabolism and muscle. Let's lower macros smartly to match real hunger while keeping protein 100g+. Let's also loop in your prescriber, this is between coaching and medicine.'",
        "captures": "Medical awareness without overreach; her priority (protein and muscle) and willingness to adjust macros vs. drop calories"
      },
      {
        "key": "scenarios-binge-restrict-cycle",
        "type": "scenario",
        "prompt": "A client tearfully says: 'I do so good all week, then Friday I binge 3000+ calories, feel guilty all weekend, restrict hard Monday-Wednesday, and repeat. I've been stuck for 6 months.' She's blaming herself. What root cause do you suspect, and what's your move?",
        "placeholder": "e.g., 'This isn't willpower, it's restriction catching up to you. Binges aren't random, they're your body rebelling. Too tight all week means Friday explodes. Let's loosen the plan so you never feel deprived, and the binge goes away.'",
        "captures": "How she diagnoses restriction as root cause; her food-freedom philosophy and how she dismisses guilt"
      },
      {
        "key": "scenarios-knee-back-injury",
        "type": "scenario",
        "prompt": "A client's knee started hurting mid-squat and now her lower back is flaring too (both old problem areas). She's devastated: 'I finally got into training and now this. Do I just stop?' She wants modifications. What's your response, and what boundary do you set?",
        "placeholder": "e.g., 'Flare-ups mean something's off with load or form, not that you stop. But I'm not a PT, so get it cleared and bring me the diagnosis. Meanwhile we keep nutrition on point and train around it with upper-body or isometric work.'",
        "captures": "How she balances reassurance with a medical boundary; stopping vs. modifying, and keeping nutrition and effort going"
      },
      {
        "key": "scenarios-no-bulky-fear",
        "type": "scenario",
        "prompt": "A prospect texts: 'I love the glute results I see, but I don't want to get bulky or look like a bodybuilder. How do I lift heavy without getting too big?' How do you dispel the myth and sell her on your approach?",
        "placeholder": "e.g., 'Getting bulky takes years of intentional eating, genetics, and usually drugs. You won't accidentally wake up huge. Heavy lifting in a deficit sculpts you, it's why you get that tight, toned glute look you want.'",
        "captures": "How she educates on the bulking myth and converts a hesitant prospect"
      },
      {
        "key": "scenarios-travel",
        "type": "scenario",
        "prompt": "A client travels for work every other week and eats out 12+ meals per trip: 'When I travel I just give up. Airport, hotel, restaurants, I can't track accurately.' She's lost 8 lbs and doesn't want to reverse it. What's your strategy, and how do you make it realistic?",
        "placeholder": "e.g., 'You adapt, you don't stop. I'm not asking for perfect tracking when you can't see ingredients. Grilled chicken + rice, burrito bowls, salad with oil on the side. Get the protein, rough-estimate, move on. Consistency beats perfection. I'll give you restaurant scripts.'",
        "captures": "How she reframes travel as adapt-not-abandon; flexibility on tracking rigor and pragmatic restaurant picks"
      },
      {
        "key": "scenarios-latam-food-access",
        "type": "scenario",
        "prompt": "A client in Colombia messages: 'Your plans have Fage, Kodiak, Quest bars I can't find here. My stores have eggs, rice, beans, chicken, but not the branded stuff. Can I still do this?' How do you localize for her?",
        "placeholder": "e.g., 'Brands are just examples, the principle is whole, lean food. Use local chicken, eggs, Greek-style yogurt if you can find it, protein powder, rice, beans. Beans + rice is complete protein. Send me a photo of your grocery and we'll build from real options.'",
        "captures": "How she de-brands her method for international access; principles over products, and problem-solving with the client"
      },
      {
        "key": "scenarios-obsessed-scale",
        "type": "scenario",
        "prompt": "A client weighs herself every morning, sometimes twice a day, seeing ±3 lb swings. Each down day she celebrates, each up day she panics, and the obsession is causing anxiety. How do you break the pattern, and what's your prescription?",
        "placeholder": "e.g., 'The scale is a daily liar, it moves with salt, water, poop, hormones, everything but fat loss. Put it away. Weigh once a week, same day and time, and trust measurements and how your clothes fit.'",
        "captures": "How she reframes obsessive weigh-ins, redirects to measurements and fit, and sets a boundary"
      },
      {
        "key": "scenarios-losing-too-fast",
        "type": "scenario",
        "prompt": "A client lost 12 lbs in 3 weeks and is now week 4, trending -3 to -4 lbs/week, hungry and fatigued. Her plan is 1800 calories but she's eating 1200. She says: 'Why stop if it's working?' How do you intervene?",
        "placeholder": "e.g., 'This pace is unsustainable and it's costing you muscle, not just fat. We raise you back to 1800. You'll lose slower but you'll keep it, and your body will thank you. Speed kills motivation and metabolism.'",
        "captures": "How she catches under-eating, protects muscle, and sells long-term over short-term, firm but not shaming"
      },
      {
        "key": "scenarios-event-deadline",
        "type": "scenario",
        "prompt": "A client says: 'I have a wedding in 6 weeks and I want to look incredible, can we do something aggressive to drop pounds fast?' She's 15+ lbs from goal and asking for a crash diet. How do you handle it without killing her motivation?",
        "placeholder": "e.g., 'Six weeks is actually perfect, not crash-perfect but real-perfect. At a smart -1.5 lb/week you'll be 9 lbs down and tight in the dress. Crash diets leave you depleted and bloated. We do it right so you feel amazing, not just look okay in a photo.'",
        "captures": "How she reframes timelines realistically, refuses crash diets, and centers how-you-feel over aesthetics"
      },
      {
        "key": "scenarios-beginner-intimidated",
        "type": "scenario",
        "prompt": "A total beginner who's never lifted signed up and is intimidated: 'I don't know how to use the machines, I'm embarrassed to ask, what if I do it wrong?' She's considering quitting before she starts. What do you say?",
        "placeholder": "e.g., 'Everyone in that gym looked stupid once, including the strong ones. Form grows, you don't need perfect day one. Start with just the bar, focus on the feeling, watch a 30-second video. Three weeks in you'll own the place. Courage first, competence follows.'",
        "captures": "How she builds beginner confidence: reassurance on imperfection, courage-then-competence, big-sister tone"
      },
      {
        "key": "scenarios-doing-everything-no-loss",
        "type": "scenario",
        "prompt": "A client has tracked macros, logged 5/7 days, and trained 4x/week for 8 weeks and hasn't lost a single pound. She's frustrated: 'I'm doing everything right but nothing's happening, is something wrong with me?' She's about to quit. What's your diagnostic approach, and how do you re-engage her?",
        "placeholder": "e.g., 'Something's wrong with the math, not you. Either calories are higher than you think (portions, drinks, oils) or too low and your metabolism adapted. Send me three days of detailed logs, we find the leak, adjust once, and loss resumes.'",
        "captures": "How she diagnoses a true plateau: reassurance (not-you, the-plan), a systematic audit, and investigator-not-judge tone"
      },
      {
        "key": "scenarios-comparing-to-others",
        "type": "scenario",
        "prompt": "A client is frustrated her friend on the same plan and stats is losing faster with more glute growth: 'Your program works better for her, maybe I'm just not built for this.' She's discouraged and ready to quit. How do you stop the comparison spiral?",
        "placeholder": "e.g., 'I'm shutting this comparison down right now. Her body isn't your body: genetics, hormones, sleep, stress, all different. What I know: you've lost 8 lbs, your measurements are down, you're stronger. Those are your wins. Run your race, not hers.'",
        "captures": "How she kills comparison-based motivation loss, celebrates individual progress, and re-centers the client on herself"
      }
    ]
  },
  {
    "key": "safety",
    "label": "Safety, Boundaries & Referrals",
    "description": "The medical, mental-health, and liability lines Stephanie will not cross, and the exact guardrails the AI must obey.",
    "questions": [
      {
        "key": "safety-medical-conditions-scope",
        "type": "text",
        "prompt": "When a client mentions PCOS, thyroid issues, or insulin resistance, what's your exact response? Walk me through what you will and won't advise on.",
        "placeholder": "e.g., 'I acknowledge it and keep macros simple, protein and consistency help regardless. But hormones and meds are with their doctor. I never adjust for thyroid meds or PCOS specifics without sign-off.'",
        "captures": "How she coaches through metabolic conditions without giving medical advice; her referral trigger for specialists"
      },
      {
        "key": "safety-glp1-weight-loss-meds",
        "type": "text",
        "prompt": "A client tells you she's on Ozempic, Mounjaro, or another GLP-1. What do you need to know, and what's off the table for you as a coach?",
        "placeholder": "e.g., 'I ask her doctor's expectations for calories and macros. I will NOT adjust dosing, manage nausea, or promise results. I keep nutrition simple and flag major changes to her doc.'",
        "captures": "Her approach to clients on weight-loss meds; what she defers to prescribers"
      },
      {
        "key": "safety-eating-disorder-signs",
        "type": "multi",
        "prompt": "Which of these would be red flags for disordered eating that make you pause or refer out? Pick all that apply.",
        "choices": [
          "Obsessively tracks every macro and can't cope if 1g off target",
          "Mentions purging, laxatives, or over-exercising to 'earn' food",
          "Very low body fat with anxiety about gaining any weight",
          "Binge episodes followed by severe restriction",
          "Constant body-checking or reassurance-seeking about how she looks",
          "History of an eating disorder, now in recovery with a therapist",
          "Regularly skips meals or treats fasting as her main strategy"
        ],
        "captures": "Which behavioral red flags trigger her referral reflex; what stays in her lane vs. mental health's"
      },
      {
        "key": "safety-eating-disorder-referral-voice",
        "type": "scenario",
        "prompt": "A client mentions she used to struggle with binge eating, and now she's terrified of overeating even slightly. How do you respond to her, and what do you do next?",
        "placeholder": "e.g., 'I'd say: that history is real, and I'm not a therapist, so let's get you support from someone who is. Meanwhile I keep things simple and not obsessive. Then I recommend she check in with a therapist before we go deep on macros.'",
        "captures": "How warmly she acknowledges the history, her exact referral phrasing, and whether she coaches while referring out"
      },
      {
        "key": "safety-pregnancy-postpartum-limits",
        "type": "choice",
        "prompt": "A client tells you she's pregnant or just postpartum. What's your move?",
        "choices": [
          "Keep coaching exactly as before, macros are macros",
          "Reduce intensity, focus on consistency and hunger cues, keep her OB/GYN in the loop",
          "Pause coaching until she's cleared by her doctor and 6+ weeks postpartum",
          "Refer her to a prenatal/postpartum nutrition specialist",
          "It depends on the stage (early vs. third trimester vs. postpartum), I adjust accordingly"
        ],
        "captures": "Her safety threshold for pregnant and postpartum clients; whether she continues or defers"
      },
      {
        "key": "safety-injury-and-pain",
        "type": "scenario",
        "prompt": "Mid-coaching, a client reports knee pain that started a week ago but wants to keep doing lower-body work. What do you tell her, and where do you draw the line?",
        "placeholder": "e.g., 'I ask: sharp or dull? When did it start? Seen a PT? If it's new and sharp, I pause lower body and have her get cleared by a PT before we progress. Nutrition stays the same.'",
        "captures": "When she pauses workouts vs. continues, how fast she refers to PT, and her liability awareness"
      },
      {
        "key": "safety-supplements-never-recommend",
        "type": "multi",
        "prompt": "Are there supplements or products you would absolutely never recommend, even if a client asked? Pick all that apply.",
        "choices": [
          "Weight-loss pills (phentermine, PhenQ, garcinia cambogia, etc.)",
          "Fat burners with undisclosed stimulants",
          "Detox teas or cleanse products",
          "Herbal thyroid supplements or hormone 'balancers'",
          "Appetite suppressants (prescription or OTC)",
          "Any supplement marketed to override a medical condition",
          "None, I let clients decide with their doctor"
        ],
        "captures": "Which categories she's firm on; her stance on medical-claim supplements and risk tolerance"
      },
      {
        "key": "safety-coaching-vs-therapy-line",
        "type": "text",
        "prompt": "Where's the line between being a supportive coach and stepping into therapy? Describe a moment where you'd say, 'This is beyond my lane, you need a professional.'",
        "placeholder": "e.g., 'If body image is tied to trauma, anxiety, or depression, not just normal diet frustration, I'm honest: I can coach your body, but your mind needs a real therapist.'",
        "captures": "How she recognizes psychological vs. coaching-scope issues and her referral language for therapists"
      },
      {
        "key": "safety-disclaimer-wording",
        "type": "text",
        "prompt": "How do you word your medical/liability disclaimer to clients? What exactly do you tell them you're not?",
        "placeholder": "e.g., 'I'm a CPT and coach, not a doctor. Nutrition coaching isn't medical advice. If you have a health condition, check with your provider before changing your diet.'",
        "captures": "Her exact disclaimer phrasing and what she explicitly rules out"
      },
      {
        "key": "safety-ai-coach-guardrails",
        "type": "text",
        "prompt": "When the AI coach responds in your voice, what are 3 hard no-gos? What must it NEVER say or do?",
        "placeholder": "e.g., '1. Never diagnose or prescribe. 2. Never shame or minimize a medical concern. 3. Never promise results without caveats.'",
        "captures": "Her top non-negotiable safety rules for the AI to follow"
      },
      {
        "key": "safety-medical-advice-referral-topics",
        "type": "multi",
        "prompt": "Which of these should the AI coach immediately flag to you OR refer the client to a healthcare provider? Pick all that apply.",
        "choices": [
          "New fatigue or persistent energy loss",
          "Medication changes",
          "Supplements for a diagnosed condition",
          "Signs of nutrient deficiency (hair loss, brittle nails, etc.)",
          "Blood work results or lab abnormalities",
          "Hormonal changes (irregular cycles, mood shifts)",
          "Caffeine or alcohol safety while on medication"
        ],
        "captures": "Which health signals trigger a flag-to-coach vs. refer-to-provider response; her escalation protocol"
      },
      {
        "key": "safety-non-fitness-trauma",
        "type": "scenario",
        "prompt": "A long-time client starts messaging you about personal trauma, relationship stress, or mental health that has nothing to do with fitness. She seems to view you as her therapist. How do you respond, and how do you set the boundary?",
        "placeholder": "e.g., 'I'd say warmly: I care about you and I'm here for your fitness journey, but this is bigger and you deserve a real therapist who specializes in it. Let me refer you to someone I trust.'",
        "captures": "Her boundary-setting voice, how she stays warm while redirecting, and her referral readiness"
      }
    ]
  }
];

export function allQuestions(): InterviewQuestion[] {
  return INTERVIEW_BANK.flatMap((s) => s.questions);
}
export function sectionByKey(key: string): InterviewSection | undefined {
  return INTERVIEW_BANK.find((s) => s.key === key);
}

// An answer is "filled" when it has non-empty prose / a choice / at least one multi selection.
export function isAnswered(value: string | null | undefined): boolean {
  if (value == null) return false;
  const v = value.trim();
  return v !== '' && v !== '[]';
}

export function countAnswered(answers: Record<string, string | null | undefined>): { answered: number; total: number } {
  const qs = allQuestions();
  return { answered: qs.filter((q) => isAnswered(answers[q.key])).length, total: qs.length };
}

export function sectionAnswered(section: InterviewSection, answers: Record<string, string | null | undefined>): number {
  return section.questions.filter((q) => isAnswered(answers[q.key])).length;
}

// Render an answer as human text for the knowledge document (multi -> comma list).
export function answerToText(q: InterviewQuestion, value: string): string {
  if (q.type === 'multi') {
    try {
      const arr = JSON.parse(value);
      if (Array.isArray(arr)) return arr.filter(Boolean).join(', ');
    } catch {
      /* fall through */
    }
  }
  return value.trim();
}
