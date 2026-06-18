# Lenus Coaching Platform - UX Audit (Coach/Admin)

> Migration-parity reference document. Captured from the live authenticated session at `https://us.lenus.io` on 2026-06-18.
> Coach account: **LaSean** (avatar initials "LP"). Currency: **USD**. Region host: `us.lenus.io`.
> Capture method: Chrome DevTools Protocol against the authenticated session (DOM extraction + computed styles + full-page screenshots).
> Note on output path: the requested path `/mnt/files/lenus-ux-audit.md` does not exist on this Windows host. This file was written to the project root instead (see final report for the absolute path).
>
> Legend: `[UNCLEAR]` marks anything that could not be confirmed from the rendered UI. Verbatim copy is shown in "quotes".

---

## Document summary

- **Top-level sections:** 18. **Screen / sub-screen entries (H2):** 71.
- **Coach app routes documented** (`https://us.lenus.io/...`):
  - `/dashboard/home` (Overview, Engagement, Financial overview tabs)
  - `/dashboard/clients` (list) and `/dashboard/clients/{id}` (profile: Overview, Goals, Meals, Training, Payment, Communications, Info)
  - `/dashboard/leads`
  - `/dashboard/chat` (Messenger)
  - `/dashboard/client-groups` (Community)
  - `/dashboard/toolbox` and sub-routes: `automations`, `benefits`, `content-collections`, `exercise-blocks`, `exercises`, `flows`, `form-builder`, `habit-templates`, `ingredients`, `meal-plan-templates`, `files` (media), `products`, `recipe-books`, `recipe-list`, `profile-tags`, `training-templates`, `social-media-connections`
  - `/dashboard/settings` sub-routes: `account-and-profile`, `banners`, `ai-settings` (Branding), `client-app-experience`, `coaching-preferences`, `team`
- **Builders documented in depth:** Program builder (full-screen editor), Meal plan template builder (modal) + per-client Meals editor, Form builder (check-in + onboarding).
- **Client/subscriber app:** separate native mobile app, not browsable from the coach portal; reconstructed from settings + forms + coach-visible client data (see Client-Side Screens).
- **Screenshots saved** to `.lenus-audit/shots/` (dashboard, clients, client profile, program builder, meal template builder, groups, form builder).

# Navigation Structure

## Primary sidebar (global, all coach screens)

A fixed, narrow icon-only rail pinned to the left edge of every coach screen. Dark teal background `#1E2F2F`, full viewport height, approx 60px wide. Icons are white/light (`#F7F7F8`). The active item gets a white rounded-square (`8px` radius) highlight behind its icon. No text labels are shown next to icons in the collapsed default state (labels appear on hover/aria-label).

Top cluster (in order, top to bottom):

| Order | Label (aria/route) | Route | Icon description | Notes |
|------|--------------------|-------|------------------|-------|
| 1 | Lenus logo | `/dashboard` | Stylized "L" Lenus mark | Brand home |
| 2 | Home | `/dashboard/home` | House outline | Default landing, active on dashboard |
| 3 | Clients | `/dashboard/clients` | Single person outline | |
| 4 | Leads | `/dashboard/leads` | Phone handset outline | |
| 5 | Messenger | `/dashboard/chat` | Speech bubble outline | |
| 6 | Groups | `/dashboard/client-groups` | Multiple people outline | Community / client groups |
| 7 | Toolbox | `/dashboard/toolbox` | Wrench / tools outline | Content + templates hub |

Bottom cluster (pinned to lower portion of the rail):

| Label | Route | Icon | Notes |
|-------|-------|------|-------|
| Notifications | `[UNCLEAR route]` | Bell outline | |
| Product Help Center | `https://help.lenus.io/en` | Open book outline | Opens external Lenus help site |
| Settings | `/dashboard/settings` | Gear outline | |
| Account/Profile | `[UNCLEAR route]` | Avatar square showing initials "LP" | Coach account menu |

A floating **Intercom** support launcher (blue circular bubble with a red unread dot) is pinned bottom-right on every screen.

## Navigation patterns observed
- **Sidebar**: global, persistent, icon-only (described above).
- **Top tabs**: used within a screen to switch sub-views (e.g. dashboard "Overview / Engagement / Financial overview"; client profile tabs).
- **Right-hand panel**: the dashboard home shows a persistent right-side "Planner" panel (weekly task calendar). [UNCLEAR whether this panel appears on other top-level screens.]
- No bottom tab bar on the coach/desktop web app.

# Coach Dashboard

## Dashboard Home - `https://us.lenus.io/dashboard/home`

**Page title (browser):** empty string (the app does not set `document.title` on this route).
**On-page H1/greeting:** "Welcome back LaSean 👋" (H4-styled, 18px/600).

### Top bar (within content area)
- Left: greeting "Welcome back LaSean 👋".
- Right of greeting: a "Your Key Account Manager" card showing a photo, name "Edward Davis", and email "edward.davis@lenus.io". (This is the Lenus-assigned account manager for the coach.)

### Tab bar
Three tabs (pill-style text tabs, active tab has white background + dark text `#28292A`, inactive tabs grey text `#696C72`):
1. "Overview" (default active)
2. "Engagement"
3. "Financial overview"

A date-range selector sits at the right of the tab row. Default value shown: "Jun 1 - 30" (calendar icon button). On the Overview tab it reads "Jun 1 - 30"; widgets respond to this range.

### Right rail: "Planner" (persistent)
- Heading "Planner" with an expand/pop-out icon button, and an "Add task" button (top right of panel; outline/secondary style).
- Week strip: "Jun 14 - 20, 2026" with previous/next chevrons and a "Today" button.
- Day columns: "Su 14, Mo 15, Tu 16, We 17, Th 18, Fr 19, Sa 20". Current day (Th 18) highlighted with a dark teal filled circle on the date number.
- Section "Today" then empty state: "No tasks yet".

---

### Overview tab (default)

Top-to-bottom widget layout (2-column grid of cards on white background, 16px radius, subtle shadow):

**Row 1**
- **Website traffic** card (left, wide). Info "i" tooltip icon next to title. Legend: "VISITORS" (darker green dot) and "SUBMISSIONS" (lighter green dot). Line chart, Y-axis ticks 85 / 170 / 255. Smooth area/line for visitors with submissions baseline.
- **Conversion** card (right, narrow). Big metric "6%" with a red down-pill "↓ -7%". Bar pair: "76" (All leads) and "5" (Won leads). Legend: "All leads" (sage dot), "Won leads" (dark dot).

**Row 2**
- **Clients and app activity** card (wide). Big metric "79". Legend "CLIENTS" / "ACTIVE IN APP". Area line chart over dates (2026-06-01 → 2026-06-26), Y-axis 0/60/120/180. Right side stat block: "Starting clients 9" and "Ending clients 106".

**Row 3**
- **Average lifetime** stat: "1.5 months".
- **NPS rating** widget: big "9.2" with red down-pill "↓ -0.4". Horizontal gradient score bar (red→yellow→green) numbered 1–10 with a marker at 9.2.

**Row 4**
- **Clients per team member**: horizontal bars per team member. Example row: "Stephanie" with bar value "2".
- **Achievements** card with a "View all" link (text button).

### Engagement tab

Filters at top: "Entire Team" (team/coach selector dropdown) and a category selector "Nutrition" (dropdown).

Widgets:
- **NPS rating**: big "9.2" with "↓ -0.4"; gradient 1–10 score bar marked at 9.2.
- **Response type**: counts across "DETRACTOR / PASSIVE / PROMOTER" (range 0–10; shows value "2" detractor-ish bucket). [Bar/segmented visualization.]
- **Satisfaction by category** (scale 1–5):
  - "Nutrition" = "4.8" (delta "0.0")
  - "Training" = "5.0" (delta "0.1")
  - "Communication" = "4.8" (delta "0.0")
- **Reason for low satisfaction**: filtered by category ("Nutrition"); shows reason bars, e.g. "Personalization" count "2". Scale 0–2 shown.
- **NPS responses table**:
  - Columns: "Date", "NPS rating", "Nutrition", "Training", "Communication".
  - Sample rows: "Jun 17, 2026 07:34 | 10 | 5 | 5 | 4", "Jun 13, 2026 11:28 | 6 | 5 | 5 | 5", "Jun 02, 2026 21:07 | 6 | 4 | 5 | 3", etc. (per-response category sub-scores).

### Financial overview tab

Disclaimer banner (verbatim): "Please note that the data displayed below is intended for monitoring purposes only and should not be used for accounting. The numbers may vary due to currency exchange fluctuations and transaction fees. For accurate and final accounting details, please refer to the official invoices provided by Lenus."

Widgets:
- **Received payments**: subtitle "All successful payments after refunds converted to your local currency on the day". Metric "USD 8,716.00" with red "-42%".
- **Expected payout**: subtitle "What you earn as a coach after we have deducted all fees. Note: Your Lenus invoice may differ from this." Metric "USD 6,284.26" with red "-42%".
- **Financial overview chart**: legend "CHARGE / REFUND / DISPUTE". Bar chart over dates (2026-06-01 → 2026-06-13), Y-axis -700 / 0 / 700 / 1400 (negative bars for refunds).
- **Transactions table**:
  - Columns: "Payment processed", "Received payments", "Expected payout", "Type", "Comment".
  - Sample rows: "Jun 01, 2026 08:00 | USD 189.00 | USD 136.27 | charge", "Jun 14, 2026 13:33 | USD -259.00 | USD -186.74 | refund", etc. Type values seen: "charge", "refund".

### Dashboard empty/loading states
- Planner empty state: "No tasks yet".
- [UNCLEAR] loading skeletons not captured (data loaded before snapshot).

# Client Management

## Clients list - `https://us.lenus.io/dashboard/clients`

**Browser title:** "Clients - Lenus".
**URL carries filter state in query params:** `filterByFollowUp.meals`, `filterByFollowUp.workouts`, `glp1Approved`, `onlyShow` (active|AllClients), `orderBySort` (desc), `page`, `selectedProductTypeFilter` (allProducts), `tagExcludeMode`.

### Header row
- H3 title "Clients" (left).
- **Product-type tabs** (segmented): "All clients" (active), "1-to-1 coaching", "Bootcamps", "Lite membership", "Plans".
- **Search input**, placeholder: "Search by name or email...".
- **"Live"** button (radio/broadcast icon) - go live / live session. [UNCLEAR exact behavior.]
- **"Broadcast"** button (outline/secondary) - opens broadcast composer to message clients.
- **"Create"** button (filled, primary dark-teal `#305555`) - create a new client.

### Quick-filter chip row (counts are live)
Horizontal strip of metric chips; each is a clickable filter:
- "New messages" = 3
- "Reminders" = 11
- "New check-ins" = 16
- "Follow-ups" = 61
- "No check-ins" = 39
- "Expires soon" = 7
- "Payment errors" = 4
- "Old chats" = 54
- "Starting" = 3
- A "⋮" (more) overflow button at the end of the chip row.
- **"Calendar"** button (calendar icon) on the far right - switch to a calendar view.

### Toolbar
- "Filter by tags" button (tag icon).
- "Exclude tags" button.
- Sort control "Newest" (with up/down sort icon) on the right.
- Result count line: "Showing all 80 active clients".

### Table
Column headers (left to right):
1. Select-all checkbox (each row has a row checkbox = bulk selection).
2. "Client name" - circular avatar (photo or colored initials) + full name.
3. "Team member" - assigned coach/team member name (often blank, e.g. "Stephanie" for some).
4. "Tag" - colored tag pills. Observed tags: "TLC" (pink), "T&F" (yellow), "BRID" / "BRID 1" (pink), "PCOS". (T&F = Thick & Fit client cohort.)
5. "Updates" - a count badge (dark pill with number, e.g. "1") or alert icon (red bell) indicating pending updates/items.
6. "Status" - status pill, e.g. "Pending" (yellow outline).
7. "Plan" (plate/meal icon header) = **meal plan** follow-up state: "Not sent" (magenta text) or age like "5 days".
8. "Plan" (dumbbell icon header) = **workout plan** follow-up state: "Not sent" / "5 days" / "6 days".
9. "Period" - subscription period: single start date (e.g. "Jun 12, 2026") with a recurring/auto-renew icon below, OR a date range highlighted in tan (e.g. "Jun 10, 2026 - Aug 10, 2026") for fixed-term plans.
10. "Payment" - a "$" circle icon on some rows (payment status/issue indicator).
11. Row kebab "⋮" menu (far right) - per-row actions.

### Pagination
- "Rows per page" selector defaulting to "20".
- Range label "1-20 of 80".
- "Go to previous page" / "Go to next page" buttons.

### Bulk actions
Selecting row checkboxes (or the header select-all) enables bulk operations. [UNCLEAR exact bulk action labels - not expanded in this pass; the select-all checkbox and per-row checkboxes are present.]

### Sample roster rows (verbatim, for data shape)
| Client | Team | Tag | Meal upd. | Workout upd. | Status | Period |
|--------|------|-----|-----------|--------------|--------|--------|
| Brittany Martin | | TLC | Not sent | Not sent | Pending | Jun 12, 2026 |
| Maria Figueroa | | TLC | Not sent | 5 days | | Jun 11, 2026 |
| Adrianne Fleming | | T&F | Not sent | 5 days | | Jun 10, 2026 - Aug 10, 2026 |
| Mackenzie Francis | | BRID 1 | Not sent | 5 days | (1 update) | Jun 10, 2026 - Sep 10, 2026 |
| Jazmine Langley | | T&F | 5 days | 6 days | | Jun 8, 2026 |
| Alexiah Agnew | Stephanie | | 91 days | 5 days | | May 17, 2026 |

Total active clients in account: **80**.

## Individual Client Profile - `https://us.lenus.io/dashboard/clients/{clientId}`

Example used: Jazmine Langley (`/dashboard/clients/633e8ff8-3fe9-11f1-9eb6-27a3fea17571`). **Browser title:** "{Client name} - Lenus".

### Profile layout (3 columns + docked chat)
1. **Global icon sidebar** (far left, as everywhere).
2. **Client-switcher rail** (second column): vertical list of client avatars with a collapse toggle "»" at top, a "All active clients 80" dropdown header (searchable client picker), and the active client highlighted. Lets the coach jump between clients without returning to the list.
3. **Main content** (center): client header + tab bar + scrolling tabbed sections.
4. **Docked chat panel** (right): the live Messenger thread for this client is always visible. A thin right-edge icon rail toggles right-panel modes (search, chat, notifications, notes/docs, etc.).

### Client header (sticky)
- Avatar + "Jazmine Langley" + a small external-link icon (opens client app view / public profile).
- Subtitle: "29, Female, Body Recomp (Lose weight)" plus a product tag pill "Thick & Fit 6 wee..." (truncated).
- Top-right actions: **"Save & Publish"** (outline/secondary) and **"Save"** (filled primary dark-teal). These are the editor-level save controls for the whole profile.

### Tab bar (section anchors on one scrolling page)
"Overview", "Goals", "Meals", "Training", "Payment", "Communications", "Info". Active tab has a teal underline. All sections render on a single long page.

---

### Overview tab
**Membership overview** card (with "Options" dropdown menu):
- "Period": "Apr 27, 2026 - Unlimited"
- "Type": "Personal Coaching [Personal coaching]"
- "Status": "ACTIVE" (green dot)
- "Payments": a small progress-dot indicator strip.

**Progress overview** card: subtitle "Follow your client's health and performance indicators".
- Buttons: "Add weight milestones", "Edit weight goal".
- A "Body measurements" metric-type dropdown + "Select metrics" control.
- Time-range toggles: "1m", "3m", "6m", "1y".
- Active metric chips (removable, with "x"): "Meal plan", "Weight".
- A line chart plotting selected metrics over time.
- Summary stat tiles: "Current weight" = "212.3 lb"; "Total weight change" = "-15.2 lb"; "Total circumference change" = "0 in".

**Check-in** card: "Seen Jun 9, 2026", "Show All" link.
- Latest check-in entry: "Monday, Jun 8, 2026, 11:53 PM", "Week 1", "Weight 212.3 lb" (delta 0), "Goal 200 lb".
- "Progress pictures": "Front", "Side", "Back" (thumbnails).

**Daily Averages** (nutrition adherence): "Calories 0 / 1850 kcal", "Protein 0% / 38%", "Carbs 0% / 35%", "Fat 0% / 28%". "View logged food" link.

---

### Goals tab
- Heading "Goals" with "Add Goal" and "Add habit" buttons.
- **Activity goals** (subtitle/help "Learn about activity goals"):
  - "Active time - 90 min per day" (edit link)
  - "Water intake - 80 fl oz per day" tagged "Created by client"
  - "Steps - 10000 steps per day"
- **Habits**: help text "Help your clients build healthy routines by setting a habit." with "Learn more about habits" link.
  - A monthly calendar grid ("June 2026", weekday headers S M T W T F S) showing per-day habit status. Legend: "COMPLETED", "PARTIALLY COMPLETED", "NOT STARTED".

---

### Meals tab (per-client meal plan, also the meal-plan builder surface)
**Nutrition Information** block: fields "BMR / TDEE kcal", "Pal" (activity level), "Allergies", "Preferences".

**Meal plan** ("Meal plan sent jun 13, 2026"):
- Buttons: "Save as template", "Preview", "Add plan", "Open".
- "Name" input (char counter "9/40").
- "PDF type and layout" select, value "Standard".
- "Ingredients to avoid": note "Ingredients to avoid are managed in the client's nutrition preferences." + "Edit nutrition preferences" link.
- **Build plan based on**: toggle "Calories only" vs "Calories and macros".
- "Daily intake" kcal input with recommendation "We recommend 2123" + "Apply" button.
- "Macro split template" select: "P: 20 C: 50 F: 30 - Dietary recommendations".
- "Number of meals per day": "5 Meals".
- **Macro flexibility** slider ("macro-tolerance" range): labels "strict: ±1%" / "flexible: ±10%", current "±3". Resulting ranges:
  - Protein "34.7 - 40.7 %" / "157 - 184 g"
  - Carbs "31.7 - 37.7 %" / "143 - 170 g"
  - Fat "24.6 - 30.6 %" / "52 - 64 g"
- **Per-meal calorie distribution** (% of day / kcal): "Breakfast 22.0% 402 kcal", "Protein shake 8.3% 153 kcal", "Lunch 23.9% 440 kcal", "Snack 16.8% 312 kcal", "Dinner 28.9% 531 kcal". (Header showed "200%" aggregate indicator.)

**Meals** (recipe assignments): "Find new recipes", "Show All", "Variations".
- Each meal shows recipe name, actual kcal vs aim, and macro split. Verbatim:
  - Breakfast: "Scrambled egg whites with veggies, turkey bacon & toast 412 kcal (Aim 402) Protein avg. 36% Carbs avg. 34% Fat avg. 30%" (tagged "Own", "Solid")
  - Protein shake: "Protein shake 161 kcal (Aim 153) Protein 67% Carbs 7% Fat 26%"
  - Lunch: "Pan-fried chicken with brown rice 451 kcal (Aim 440) Protein 35% Carbs 33% Fat 32%" ("Own")
  - Snack: "Greek yogurt with berries & almonds 300 kcal (Aim 312) Protein 41% Carbs 42% Fat 17%"
  - Dinner: "Ground beef with potatoes, green beans and avocado 519 kcal (Aim 531) Protein 36% Carbs 34% Fat 30%" ("Own")
  - Note seen: "Not used in the previous plan", "No identical recipes", "6 items".

**Plan's summary**: "Calories 1843 - 1843 (Aim 1850)", "Protein avg. 39% (176g) [34.7-40.7%]", "Carbs avg. 33% (147g) [31.7-37.7%]", "Fat avg. 28% (59g) [24.6-30.6%]".

**Micronutrients** ("Show all", note "*All data might not be available"): "Target 76%", "Fiber 72% 21.7g / 30g", "Iron 131% 11.8mg / 9mg", "Vitamin B12 46% 1.1μg / 2.4μg", "Calcium 112% 1117.5mg / 1000mg", "Vitamin D 46% 2.3μg / 5μg", "Magnesium 92% 239.9mg / 260mg".

**Food Diary Overview** ("This week"): "Calories 0 / 1850 kcal", "Protein 0% / 38%", "Carbs 0% / 35%", "Fat 0% / 28%". Weekly bar chart (Sun-Sat, Y-axis 0/500/1000/1500/2000). "View logged food".

---

### Training tab
**Training Plan**: "Add plan" button.
- Template reference: "Template: 12 week 5 day Training Plan 1 ADVANCED".
- Assigned plan: "Jazmine 12 week 4 day Training Plan 1", "Published Jun 12, 2026 | Last update Jun 12, 2026".
- "Structure: Simple List", "6 items", "Edit" button.

**Training History** table: columns "Completion", "Enjoyment", "Effort", "Date". Rows grouped by week:
- "14-20 JUN. 2026": "Full upperbody - Jazmine 12 week 4 day Training Plan 1 - 100% - Great - Moderate - JUN 16"; "Hamstrings & Glutes - ... - 100% - Great - Hard - JUN 15".
- "7-13 JUN. 2026": "Quads & Glutes - Thick & Fit: 6 week Body Recomp challenge - 100% - Great - Hard - JUN 7".
- "Show more".
(Enjoyment values: "Great"; Effort values: "Moderate"/"Hard". Completion as %.)

**Training Preferences**:
- "Sessions per week" (number input).
- "Experience level": "Intermediate" (select).
- "Locations" (multi-select, placeholder "Select client workout locations").
- "Injuries (0)" body-part toggle chips: "Knee", "Shoulder", "Elbow", "Wrist", "Back", "Lower back", "Abs".
- "Injuries description" (textarea, placeholder "Client injury description").
- "Equipment" (multi-select, placeholder "Select client equipment").

---

### Payment tab
**Payments overview** (with "Options"):
- "Monthly Price": "USD 279.00"
- "Subscription Duration": "Ongoing"
- "Minimum Commitment": "4 months"
- "Billing Cycle": "Monthly" / "Month Apart" [as rendered]
- "Payment status".

**Upcoming discounts & credits**: "Add discount" button; empty state "No upcoming discounts or credits".

**Upcoming payments**: "Add payment" button; entry "USD 279.00 - Recurring payment - Due Jul 9, 2026".

**Payment history**:
- "USD 0.00 / USD 279.00 - Paid - Charged: Jun 9, 2026 - Due Jun 9, 2026"
- "USD 129.00 - Paid - Charged: Apr 24, 2026 - Due Apr 24, 2026"

---

### Communications tab
- **Flow / Schedule**: "Default flow - Started Monday, Jun 8, 2026 - Active". "History: 19 items sent".
- **Files**: "Upload file" (file picker, placeholder "Add file from library").
- **Email and Publishing History**:
  - "Meal plan published Jun 13, 2026"
  - "Jazmine 12 week 4 day Training Plan 1 published Jun 12, 2026"
  - "Receipt for subscription payment sent Jun 9, 2026" (links to a generated receipt PDF; "View")
  - "Show more".

### Docked chat panel (right, always visible on profile)
- Live message thread with the client (coach + client bubbles, timestamps, "Read: ..." receipts; coach name shown e.g. "Coach Daniella").
- Inline activity cards in-thread: "4 activities logged", "Pilates 49m 59sec".
- Composer at bottom: text input placeholder "Aa", emoji button, mic/voice button, attach "+" button, and a send button.

---

### Info tab
**Client info** ("Edit"):
- "Name": "Jazmine Langley"
- "Email": "jlangle7@eagles.n..." (truncated)
- "Phone": "+1 919 931 0138"
- "Height": "5 ft 6 in"
- "Weight": "212.3 lb"
- "Date of birth": "Dec 24, 1996"
- "Sex assigned at birth": "Female"
- "Gender": "Female"
- "Start weight": "227.6 lb"
- "BMI": "34.3"
- "Country": "United States of America"
- "Language": "English (US)"
- "Measurement": "Imperial"
- "Time zone": "America/New_York"

**Additional client information** ("Filled Jun 8, 2026, 11:53 PM", "Restart client onboarding", "Show All") - these are the captured onboarding answers:
- "Screening for eating disorders": "Potential risk" (with "View")
- "Area of Focus": "All around"
- "Level of Training": "Intermediate"
- "Steps": "10K"
- "Sleep": "7-8"
- "PCOS": "No"
- "Additional information": "I want to make sure I prioritize fiber in my meal plan. I feel so much better when I'm intentional about my fiber intake."
- "Training experience": "Weight lifting in the gym since May of 2023."
- "Training schedule": "4 days"
- "Training location": "The gym (must..." (truncated)

> Note: The full per-client profile is a single editable page; the meal-plan and training-plan builders also open from here (see Program Builder and Meal Plan Builder sections for the dedicated editors).

# Toolbox (Content & Template Library)

## Toolbox hub - `https://us.lenus.io/dashboard/toolbox`

The Toolbox is a content/asset library with its own left sub-navigation (a second column inside the page, in addition to the global icon rail). H4 label "Toolbox". Sub-nav items (each is a route under `/dashboard/toolbox/...`):

| Label | Route | Purpose |
|-------|-------|---------|
| Automations | `/automations` | Automated rules/triggers |
| Benefits | `/benefits` | Client perks/benefits |
| Content Collections | `/content-collections` | Grouped content sets |
| Exercise blocks | `/exercise-blocks` | Reusable exercise groupings (supersets/circuits) |
| Exercises | `/exercises` | Exercise library |
| Flows | `/flows` | Communication / message automation flows |
| Forms | `/form-builder` | Form builder (onboarding + check-in forms) |
| Habits | `/habit-templates` | Habit templates |
| Ingredients | `/ingredients` | Ingredient/food database |
| Meal plan templates ("New" badge) | `/meal-plan-templates` | Meal plan builder/templates |
| Media library | `/files` | Uploaded media/files |
| Products | `/products` | Coaching products (sellable plans) |
| Recipe books | `/recipe-books` | Grouped recipe collections |
| Recipes | `/recipe-list` | Recipe library |
| Tags | `/profile-tags` | Client profile tags |
| Training templates | `/training-templates` | Workout program templates |
| Social media connections | `/social-media-connections` | Connect IG/FB/TikTok |

### Toolbox > Social media connections - `/dashboard/toolbox/social-media-connections`
- Subtitle "Connect social media accounts". "Manage connections" button.
- Table: columns "Social media platform", "Account", "Followers". Rows: "Facebook - -", "Instagram - -", "Tiktok | Steph | Online Fitness Coach | 819468".
- Privacy explainer (verbatim, abridged): "To provide you with valuable insights, our platform can access certain data from your connected social media accounts through our external partner, Ayrshare..." plus "In the future, it will be possible to schedule and post content from the Lenus platform."

(Other Toolbox sub-pages: Recipes, Ingredients, Products, Flows, Forms, etc. are documented under their relevant feature sections below.)

# Program Builder

## Training templates list - `https://us.lenus.io/dashboard/toolbox/training-templates`
**Browser title:** "Workouts - Lenus". H3 "Training templates", subtitle "Create Training templates with sessions and exercises you can reuse across clients and products".
- **"Create Template"** button (primary).
- Search input placeholder "Search by name".
- Table columns: "Name", "Structure", "Number of items", "Attached to products".
  - "Structure" value observed: "SIMPLE LIST".
  - "Number of items" e.g. "5 ITEMS", "6 ITEMS", "1 ITEM".
  - "Attached to products" shows the product(s) the template is bundled into, e.g. "Thick & Fit Lite membership", "Her Again 6 week challenge".
- 38 templates total ("1-38 of 38", "Page 1 of 1"). Naming pattern is monthly progression: "Month 1: 6 week 3 day workout split BEGINNER", "Month 2: 8 week 5 day workout split ADVANCED!", plus "@HOME", "PREGNANCY", "ADVANCED" variants.

## Program Builder editor (opens full-screen from a template row, or "Create Template", or client Training tab "Edit"/"Add plan")

The editor replaces the page (same URL in this build). Layout = 3 panels:

### Top bar
- "← Exit" (left), template name title (e.g. "Thick & Fit: 6 week Body Recomp challenge").
- Right: "Settings" (gear) and "Save template" (primary dark-teal).

### Left panel: session/day list
- Header "SIMPLE LIST" with "Add item +".
- Each session row: drag handle (reorder), green dumbbell icon, session name, summary "X sets (Y exercises)", collapse chevron. Sessions act as the workout days.
- Observed sessions: "Hamstrings & Glutes - 33 sets (14 exercises)", "Full upperbody - 46 sets (20 exercises)", "Cardio & core - 18 sets (6 exercises)", "Quads & Glutes - 32 sets (13 exercises)", "Daily post workout stretch - 1 sets (1 exercises)".

> Note on structure: this template uses a flat "Simple List" of sessions (the coach assigns/schedules days), rather than an explicit Week>Day grid. The "Structure" field implies other structures may exist. [UNCLEAR what alternative structures are available beyond "Simple List".]

### Center panel: selected session editor
- Session header with session name, "Save as block", "Session settings".
- Content is a vertical list of **format blocks**. Each block has a format label and a "⋮" menu. Observed formats:
  - **"Straight set"** - a single exercise.
  - **Circuit/superset block** (named, e.g. "Glute activation") with "[n] rounds" and "Rest between rounds: 20 seconds", containing multiple exercises.
- **Per-exercise fields** (within a block):
  - Exercise thumbnail/video preview.
  - Exercise name.
  - "sets" (number stepper).
  - A rep-unit field that switches between "reps", "minutes", or "sec" (dropdown), e.g. "1 sets / 6 minutes" for cardio "Incline walk", "15 reps / 20 sec" for "Glutebridges".
  - Rest value ("sec").
  - An instruction/notes text area (collapsible, with an "x" to clear), holding multi-line technique cues, e.g. "Set treadmill incline to 8-15% depending on fitness level..." and quoted coaching cues.
- Exercise/set "⋮" menu provides per-exercise actions. [UNCLEAR exact items: expected to include replace/substitute exercise, duplicate, delete; menu did not expand cleanly in this pass.] Exercise alternatives/substitutions are also handled via circuit/superset formats.

### Right panel: insertion library (tabs)
- Tabs: "Exercises", "Formats", "Blocks".
- **Exercises tab**: search "Search by exercise name", a filter icon, "+" add. List of exercises each with thumbnail + a badge: "Own" (coach's custom exercise) or "Customized". Observed: "Dynamic Warm-up (Own)", "Plank Walkouts (Own)", "Treadmill jog (Own)", "Jumping Jacks (Own)", "Stairmaster", "Banded rows (Own)", "Bodyweight Squat (Customized)", "Rowing machine (Own)", "Leg Extension (Customized)", "Gorilla Squats (Own)", etc. Footer link "Create and add exercise to your library".
- **Formats tab**: set/format types to insert (straight set, circuit, etc.). [Content not fully expanded.]
- **Blocks tab**: previously saved exercise blocks (from "Save as block").

### Onboarding promo (modal popover) seen in builder
"New training builder" coachmark: "We're delighted to introduce our new Training builder, designed to help you create training plans in an easy and structured way. The new builder provides you with: A better overview; More efficient building; New training formats; Essential information in one place." Links "Read more about the changes", "Snooze", pager "1 of 6", "Next".

### Related Toolbox pages for programs
- **Exercises** (`/dashboard/toolbox/exercises`): the full exercise library (create/edit exercises, video, instructions).
- **Exercise blocks** (`/dashboard/toolbox/exercise-blocks`): saved supersets/circuits reusable across templates.

# Meal Plan Builder

Meal planning in Lenus has three surfaces: (1) the per-client **Meals tab** (the live plan editor, fully documented in Client Management > Meals tab), (2) **Meal plan templates** (a new reusable-template builder), and (3) the **Recipes** + **Ingredients** libraries that feed both.

## Meal plan templates - `https://us.lenus.io/dashboard/toolbox/meal-plan-templates`
**Browser title:** "Meal plan templates - Lenus". H3 "Meal plan templates", subtitle "Manage templates to use as a starting point when building personalized meal plans".
- Empty state (no templates yet in this account): card "Meal plan template - A meal plan is a reusable structure you can apply to different clients. Set it up once, then use it to quickly generate meal plans." with "Create template" (primary) and "Learn more" (links to help article 10494172-meal-plan-template-builder). "New" badge on the nav item.

### "Create meal plan template" modal (builder, step 1)
Two-column form (label/help left, field right). Sections:
- **General**
  - "Name*" (required text input).
  - "Plan type*" select, default "Calories + macros". Help: "Choose if this plan tracks only calories, or calories + macros." (Other option: calories only.)
- **Daily intake**
  - Help: "Select the calorie target the system should aim for in the meal plan."
  - "Calories*" number input with "kcal" suffix (default "2000").
- **Macro target**
  - Help: "Pick the macros you want to aim for and decide how much flexibility to allow."
  - "Macro target" preset dropdown, default "Balanced lifestyle" showing macro pills "P: 30%" (green), "C: 40%" (yellow), "F: 30%" (pink).
  - "Macro flexibility" dropdown, default "Strict (±2%) - precise matches, limited variety" (more-flexible options expected in the list).
- **Meals**
  - Help: "Select the calorie distribution between all plan meals."
  - "+ Add meal" button. "Show macros" toggle (on by default).
  - Default meals with kcal / % of day / macro grams (P/C/F): "Breakfast 600 kcal 30% (44/59/20)", "Lunch 600 kcal 30% (44/59/20)", "Dinner 800 kcal 40% (59/78/27)".
- **Food preferences**
  - Help: "These food preferences were pre-filled using your coaching settings. You can review and adjust them to personalize the meal plan template."
  - "Allergies", "Dietary preferences", "Ingredients to avoid" (chips, e.g. "Skyr, plain", "Skyr, flavored", "+5").
- **Availability**: "Available in the USA".
- Footer: "Cancel" / "Continue" (proceeds to recipe-assignment step). [Step 2 not captured.]

## Per-client meal plan (the working builder)
See **Client Management > Meals tab** for the full live editor. Recap of its build controls: "Build plan based on" (Calories only / Calories and macros), "Daily intake" with "We recommend {n}" + "Apply", "Macro split template" preset, "Number of meals per day", a "Macro flexibility" slider ("strict: ±1%" to "flexible: ±10%"), per-meal calorie distribution, recipe assignment per meal slot (Breakfast/Protein shake/Lunch/Snack/Dinner), live "Plan's summary" (calories + macros vs aim), a "Micronutrients" panel (Fiber, Iron, B12, Calcium, Vitamin D, Magnesium vs targets), and a "Food Diary Overview" of the client's actual logging. Buttons: "Add plan", "Preview", "Save as template", "Open". PDF export via "PDF type and layout" (e.g. "Standard").

## Recipes library - `https://us.lenus.io/dashboard/toolbox/recipe-list`
**Browser title:** "Recipes - Lenus". H3 "Recipes", subtitle "Browse all available recipes from Lenus's curated library and your own creations".
- "Create recipe" button (primary).
- Filter tabs: "All", "Favourites", "My recipes".
- Filter dropdowns: "Ingredients", "Cooking time", "Type", "Meal", "Cuisine", "Season". "Clear all filters".
- Search "Search by name".
- **Recipe cards** (grid): recipe name, calories (e.g. "412 kcal"), macro line "P: 35 / C: 48 / F: 17" (grams), cooking time ("70 mins"), and an ingredient preview list (3 ingredients + "+n" overflow). Vegan recipes carry a 🌱. Examples: "Butter chicken 412 kcal", "Fried rice with vegetables and eggs 400 kcal", "Crispy baked tempeh with asparagus and brown rice 🌱 403 kcal".

## Ingredients database - `https://us.lenus.io/dashboard/toolbox/ingredients`
**Browser title:** "Ingredients - Lenus". H3 "Ingredients", subtitle "Create your own ingredients if they're missing or you want to add a branded version. Add their macros and start using them in recipes."
- "Create" button.
- Search "Search ingredients".
- Table columns: "Name", "Languages", "Protein/ 100g", "Carbs/ 100g", "Fat/ 100g", "Kcal/ 100g".
- 131 custom ingredients ("Rows per page 10", "1-10 of 131"). Examples: "92/8 Lean Ground Chicken - 20.5 / 0 / 8 / 155", "Banana - 0.8 / 22.9 / 0.5 / 102", "Barebells protein bar- chocolate dough - 30.8 / 30.8 / 10.8 / 348".

## Recipe books - `https://us.lenus.io/dashboard/toolbox/recipe-books`
Grouped recipe collections (a "recipe book" bundles recipes for assignment). [Listed in nav; not deep-dived this pass.]

# Community & Broadcasts

## Groups (Community) - `https://us.lenus.io/dashboard/client-groups`
**Browser title:** "Client groups - Lenus". This is the community/group feed feature.

### Layout
- **Left: group list.** "Create group" button. Filter toggle "Only show groups with new activities". Each group row: name, "{n} members", and an unread/post count badge. Observed groups:
  - "HER again challenge - 0 members - 258"
  - "Team Thick & Fit - 78 members - 6"
  - "Thick & Fit Lite membership - 3 members - 1"
  - "Thick & Fit Body recomp challenge - 0 members"
- **Right: selected group feed.** Header with group name, "Add clients" and "Add post" buttons. Tabs: "Posts ({count})" and "Your conversations". Search "Search group posts".

### Post feed
- Each post: author name + avatar (e.g. "Coach Steph"), role badge ("Admin"), timestamp ("Jan 3, 3:47 PM"), optional "Pinned" badge, rich-text body (supports emoji and long-form), reaction count, and a comment thread.
- Comments: inline "Add comment" input per post, "Reply" action, "View previous comments" expander, reaction counters.
- Example pinned post (verbatim opening): "Welcome to the "Her Again" Challenge! 👑 Hey beautiful, I am beyond excited that you're here..." with a "Challenge habits to follow" checklist (NO ALCOHOL; Hit 10k steps daily; Drink at least 80oz water daily; Post in community dashboard 3x a week minimum; etc.).

### "Add post" composer (modal "Create post")
- Prompt "What do you want to share?", textarea placeholder "Write here...", char counter "0 / 3000".
- "Add poll" button (create a poll post).
- Media: "Select from media library" / "Select media"; "Record video"; "Record audio note"; "Upload image, video, audio, or PDF" / "Add file".
- Footer: "Cancel" / "Create post".
- **Post types supported:** text, poll, image, video, audio note (recorded or uploaded), PDF.

## Broadcasts (mass messaging)
Triggered by the **"Broadcast"** button on the Clients list (also "Broadcast" appears elsewhere). First step is a type chooser modal "Select broadcast type":
- "Broadcast chat message"
- "Broadcast lesson"
- "Broadcast email"
- "Cancel"

### Broadcast chat message - 3-step wizard
Steps shown as a stepper: "1 Recipients", "2 Content", "3 Review & send".

**Step 1 - Recipients:** "Select between all clients or custom segments." Help: "With custom segments you can easily select the group of clients you message most frequently. Reach out to your Key Account Manager to help set them up." Filters:
- "To *" (required base audience selector).
- "Sex assigned at birth": All / Female / Male.
- "Weight goal": "All goals" (searchable "Search weight goals to include").
- "Client type": "All client types".
- "Products": "All products" (searchable).
- "Include if tagged with": "All tags".
- "Exclude if tagged with": "None".
- "Language": "All languages".
- "Country": "All countries".
- "Loyalty Segment": "All loyalty segments".
- "Exclude clients with messages unread by you" (toggle).
- **Summary**: "An individual message will be sent to: {n} - Adrianne Fleming & 78 more" with "View clients" and "Preview".
- Buttons: "Cancel", "Next".

**Step 2 - Content:**
- "Add media content": Select from media library / Record video / Record audio note / Upload video, audio, or image.
- "Message" textarea with personalization tokens: "Add 'First name'", "Add 'Full name'".
- "Attach PDFs": Select from media library / Upload PDF(s).
- Recipient summary repeated. Buttons: "Cancel", "Previous", "Next".

**Step 3 - Review & send:** final confirmation + send. [Step 3 content not fully expanded; "Next" from Content leads here.]

> "Broadcast lesson" and "Broadcast email" follow analogous wizards (lesson = push a content lesson; email = send an email blast). [Their inner steps not deep-dived this pass.]

# Check-in & Onboarding Forms

## Forms hub - `https://us.lenus.io/dashboard/toolbox/form-builder`
**Browser title:** "Forms - Lenus". Two managed form groups on one page:

### Check-in forms ("Used to check in on your clients regularly")
- "Create new" button. "Learn more about check-ins" link.
- Table columns: "Form title", "Assigned clients", "Published", "Created", "Attached to products", "Language".
- Rows:
  - "Your weekly check-in" - 81 (80 active) - Published Apr 20, 2026 - Created Feb 29, 2024 - "Thick & Fit Lite membership +2".
  - "Nutrition Weekly Check-in" - 4 (0 active) - Jan 15, 2025 - Jan 9, 2025.
  - "Workout Only Weekly Check-in" - 2 (0 active) - Jan 17, 2025.
  - "Current challenge form" - (no assigned) - Apr 7, 2026 - "Thick & Fit: 6 week Body Recomp challenge".

### Onboarding forms ("Tailor your onboarding form to your clients' goals")
- "Create new", "Preview", "Learn more about onboarding".
- Table columns: "Form title", "Client goal", "Calorie goal", "Published", "Created", "Attached to products", "Language".
- Rows (goal-specific):
  - "Body Recomp MAINTAIN THE SAME WEIGHT" - Body Recomp - Maintenance - "Personal coaching +1".
  - "Fat Loss/Weight Loss" - Fat loss/Weightloss - Deficit - "Personal coaching +1".
  - "Gain Weight/Calorie Surplus" - Bulk/Gain weight - Surplus - "Personal coaching".
  - "Nutrition Coaching" - Nutrition Only Clients - Deficit - "Personal coaching".
  - "Challenge onboarding" - Lose body fat/body recomp - Deficit - "Personal coaching +1".

## Form builder (editor modal)
Opens when a form row is clicked or "Create new". Full-screen modal:
- Header: form title with edit pencil; language selector (flag dropdown, e.g. "en-US").
- Body: a vertical stack of **question-block cards**. Each card: a TYPE label header (e.g. "MULTILINE TEXT", with "| REQUIRED" suffix if required), a drag handle (reorder), a delete (trash) icon, a "Title" field and a "Question" field. "TEXT BLOCK" cards also have "Media (optional)" with "Select from media library" / "Add file".
- Right **add-question palette**:
  - QUESTION: "Multiline text - Ask an open question"; "Select - Question with options"; "Rating - Ask for rating".
  - BLOCKS: "Sleep duration - Ask for the amount of hours slept".
  - CONTENT: "Text block - Add a paragraph of text to your form".
- Footer: "Preview" (eye), "Save & publish" (split button with dropdown).
- **Question/block types observed in built forms:** TEXT BLOCK, MULTILINE TEXT, SELECT (with "Add option" / or add "Other"), STARS (rating), SMILEY (rating), SLEEP QUALITY (0-10 "TERRIBLE"..."EXCELLENT"), BODY MEASUREMENT (Weight), CIRCUMFERENCE (Thigh/Chest/Upper Arm/Waist/Hip), PROGRESS PICTURES (Front/Back/Side image uploads), SLEEP DURATION.

## "Your weekly check-in" - full question list (in order)
1. TEXT BLOCK - Title "Hey there 👋🏼"; "It's time for your check-in. You can update your measurements and tell me how your week has been."
2. MULTILINE TEXT - "Status" / "How have you been since your last update?"
3. MULTILINE TEXT - "Wins" / "What is one thing you have been winning at this past week?"
4. MULTILINE TEXT - "Opportunities" / "What is one thing you have been struggling with this last week?"
5. MULTILINE TEXT - "Non Scale Wins" / "Would love to know any non-scale related wins you had this week!"
6. STARS - "Macros" / "How closely have you been following your macros?"
7. BODY MEASUREMENT (REQUIRED) - "Body Measurements" / "Add your latest measurements" (Weight)
8. SLEEP QUALITY (REQUIRED) - "Sleep quality" / "During the past 7 days, how would you rate your sleep quality overall?" (scale 0-10, TERRIBLE to EXCELLENT)
9. CIRCUMFERENCE (REQUIRED) - "Circumference" / "Add your latest measurements" (Thigh, Chest, Upper Arm, Waist, Hip)
10. STARS (REQUIRED) - "Energy level" / "1 = low energy, 5 = very energized"
11. SMILEY (REQUIRED) - "Mood" / "1 = poor, 5 = very good"
12. STARS (REQUIRED) - "Meal plan use" / "How well did the meal plan work for you last week? 1 = not at all, 5 = very well"
13. STARS (REQUIRED) - "Workout plan use" / "Did you use your workout plan? 1 = not at all, 5 = used the entire plan"
14. MULTILINE TEXT - "Sleep" / "How many hours do you sleep on average each night?"
15. MULTILINE TEXT - "Steps" / "How many steps are you averaging daily?"
16. SELECT - "Steps" / "Can you see yourself hitting 10K steps a day? (Mark Yes if you already do this)" - options: Yes, No
17. MULTILINE TEXT - "Water" / "How much water are you drinking daily in oz or liters?"
18. SELECT - "Water" / "Can you see yourself drinking a gallon of water a day? (Mark Yes if you already do this)" - options: Yes, No
19. PROGRESS PICTURES (REQUIRED) - "Progress pictures" (Front / Back / Side uploads)
20. MULTILINE TEXT - "Alcohol" / "How many alcoholic drinks are you averaging a week? and explain what kind of alcohol if any."

## "Fat Loss/Weight Loss" onboarding form - question list (in order)
1. TEXT BLOCK - "Welcome {{firstName}}" / "Let's start with some basic questions regarding your physical measurements" (note: personalization token `{{firstName}}`).
2. "Physical condition" / "This input is needed to calculate your basal metabolic rate (BMR) so that your daily need for calories can be determined" (height/weight/age/sex inputs).
3. SELECT - "Activity level" / "Describe your physical activity level during leisure time".
4. SELECT - "Activity level at work" / "Describe your physical activity level during work (including working from home and studying)".
5. PROGRESS/BEFORE PICTURES - "Before pictures" / "NO MIRROR SELFIES, in a well lit area please take full figure images (head to toe) in a sports bra/tank top & shorts or bikini please. ALL progress pictures need to be taken like this".
6. SELECT - "Area of Focus" / "What is your area of focus?" - options: Back, Mid Section, Glutes, Quads, Hamstrings, All around.
7. SELECT - "Steps" / "How many steps a day do you currently take?" - options: 1K, 2K, 3K, 4K, 5K, 6K, 7K, 8K, 9K, 10K, 10K +.
8. SELECT - "Level of Training?" / "What is your experience level?" - options: Beginner, Intermediate, Advanced/Athlete.

> Note: The captured client Info tab (Jazmine Langley) also showed onboarding answers for "Screening for eating disorders", "Sleep", "PCOS", "Additional information", "Training experience", "Training schedule", "Training location". These appear either in other goal-specific onboarding forms (e.g. "Challenge onboarding", "Nutrition Coaching") or as standard Lenus onboarding fields. [UNCLEAR which form each belongs to; only "Fat Loss/Weight Loss" was opened in full this pass.]

# Leads (Sales CRM)

## Leads - `https://us.lenus.io/dashboard/leads`
**Browser title:** "Leads - Lenus". URL params: `page`, `rowsPerPage` (25), `onlyReferredLeads`, `hasRecordings`, `signedUpAgain`.
- Buttons: "Create lead", "Send offer".
- **Quick filter by status** chips: "New lead", "Contacted", "In dialog", "First meeting", "Offer sent", "Won", "On hold", "Lost", "No WhatsApp", "Less developed countries", "Referred", "Signed up again".
- Filters: "Filter by tags", "Exclude tags", "Filter by country", "Filter by type".
- Search "Search by name, email or phone number...".
- Table columns: (checkbox), "Lead name", "Tags", "Phone number", "Status", "Lead type", "Arrived".
  - Status values seen: "New Lead", "Contacted". Lead type: "Standard". "Arrived" = relative time ("39 minutes ago", "yesterday", "2 days ago").
- This is the sales pipeline / lead inbox. "Send offer" pushes a coaching offer to a lead; "Create lead" adds one manually.

# Messenger

## Messenger inbox - `https://us.lenus.io/dashboard/chat`
**Browser title:** "Chat - Lenus".
- Top counters (unread/queues): "4", "16", "11" (correspond to New messages / New check-ins / Reminders style buckets). "Only unread" filter toggle.
- Search "Search clients".
- **Conversation list**: each row = client avatar + name, last-message timestamp, last-message preview (or "{name} sent a media message"), an unread count badge, and client tags (e.g. "Follow up", "T&F", "GLP1", "BRNZ", "BRID"). Some rows show inline check-in context (e.g. "Since last check-in Habit completed: 0/13 days").
- Selecting a conversation opens the thread (same chat UI as the docked panel on the client profile).
- **Composer** (shared with profile chat): text input placeholder "Aa", emoji picker, voice/mic record, attach "+" (media/file), send button. Supports media messages, audio notes.

# Analytics

Lenus surfaces analytics primarily through the **Dashboard Home tabs** (see Coach Dashboard section) rather than a separate "Analytics" route:
- **Overview tab**: Website traffic (Visitors/Submissions line chart), Conversion %, Clients & app activity (clients vs active-in-app), Starting/Ending clients, Average lifetime, NPS rating, Clients per team member, Achievements.
- **Engagement tab**: NPS rating, Response type (Detractor/Passive/Promoter), Satisfaction by category (Nutrition/Training/Communication, 1-5), Reason for low satisfaction, per-response NPS table. Filters: team selector ("Entire Team"), category selector.
- **Financial overview tab**: Received payments, Expected payout, Charge/Refund/Dispute chart, transactions table.
- **Date range**: a date-range picker on the dashboard (default "Jun 1 - 30") scopes Overview metrics.
- Additional analytics are embedded contextually: per-client Progress overview charts (Overview tab of a client) with "1m / 3m / 6m / 1y" ranges; Food Diary weekly charts; Training History.
- Social reach analytics appear under Toolbox > Social media connections (follower counts via Ayrshare).

[UNCLEAR] No standalone `/analytics` route was found; reporting is distributed across the dashboard and per-client views.

# Settings

Settings has its own left sub-nav. Sub-sections: "Account & Profile", "Banners", "Branding", "Client App Experience", "Coaching preferences", "Team". Most pages have a "Save changes" (or "Save & Publish") button top-right.

## Account & Profile - `/dashboard/settings/account-and-profile`
- **Account**: "Your email" (e.g. "lasean@kaldrbusiness.com") with "Change email".
- **UI settings**: "Language" ("English (US)", "Change language"); "Time format" ("12-hour (1:23 PM)", "Change time format").
- **Profile**: "Your display name"; "Your avatar" ("Visible to clients in chat and groups", "Add file").

## Branding - `/dashboard/settings/ai-settings`
Subtitle: "Refine your brand elements to enhance your brand and optimize AI-driven personalized suggestions".
- **Brand positioning** ("developed by the Lenus Growth Team", contact KAM/support): "Brand USP", "Core message" ("Show all").
- **Brand communication**: "Tone of voice".
(Note: the route is `/ai-settings` though the label is "Branding"; these brand attributes feed AI personalization.)

## Banners - `/dashboard/settings/banners`
Subtitle: "Fully customize the appearance and content of your app banners". "Save & Publish".
- Banner-type tabs: "Upselling", "Onboarding", "Check-in".
- **Customize banner** (Upselling shown): "Personalize your 1-1 upselling banner for Free, Lite and Bootcamp clients".
  - "Banner image" ("Choose file" / "Upload"; "For optimum display, you should use a picture in landscape format").
  - "Headline" (char counter "17/30").
  - "Description" (char counter "121/145").
  - "Restore to default".
  - Default content example: headline "Personal coaching", description "Ready to take your journey to the next level? Experience personalized plans and dedicated support tailored just for you." with "Learn more".

## Client App Experience - `/dashboard/settings/client-app-experience`
Subtitle: "Customize how clients interact with the app, track progress, and receive check-in reminders." "Save changes".
- **Chat & Communication** (toggles): "Allow clients to send audio messages in chat"; "Allow clients to send video messages in chat"; "Allow clients to send images messages in chat"; "Share habit summary in chat" ("Automatically send clients a habit summary after each check-in, showing how many times each habit was completed since the last check-in"); "Show upselling in app" ("Show content promoting 1-to-1 coaching to Lite membership clients in the app").
- **Progress Tracking (Weight, Calories, Check-ins)** (toggles): "Display weight progress in app"; "Display calories and macros" ("Let clients view calories and macros in activity tracking, history, meal details, and meal plan PDFs"); "Display weight progress in check-ins"; "Allow clients to fill and send check-ins"; "Remind clients to complete their check-ins" (scheduled: "Send reminder to all", "Send on", "Skip reminders if the client has already checked in"); "Remind clients via..." Push notification / Chat message / Email.
- **Client Access and Expiry**: "Automatically remove client access to the app" (after subscription ends, etc.).

## Coaching preferences - `/dashboard/settings/coaching-preferences`
Subtitle: "Fine-tune your coaching style, meal plans, workouts, and client engagement settings." "Save changes".
- **Meal Plan Settings**: "Default meal plan name (English (US))"; "Display recipe ingredients in" (unit); "Create a 'follow-up' reminder for meal plan"; "Select meal plan format"; "Default macro flexibility"; "Allergies"; "Dietary preferences"; "Ingredients to avoid" (chips, e.g. "Skyr, plain", "Skyr, flavored", "Yogurt, soy-based", "Smoothies", "+3"); "Availability" ("Available in the USA").
- **Training Plan Settings**: "Default training plan name"; "Create a 'follow-up' reminder for training plans"; "Default dropset behavior"; "Include Lenus exercise instructions in client app" ("Show built-in exercise guides in the client app (when available)").
- **Client Handling & Engagement**: "Preferred measurement unit"; "Days without a message before switching to 'Old chats'" ("After this number of days without a message from you, a client will be moved to the 'Old chats' category"); "Client birthday reminder" ("Automatically create a reminder on your client birthday").
- **Onboarding Preferences**: "Require clients to fill onboarding questionnaire" ("Make onboarding questionnaires mandatory for new clients"); "Choose when to send the onboarding questionnaire".
- **Email notifications**: "Send an email to {email} every time there is a:" New message / New check-in / New lead.
- **Danger** zone: "Delete all follow-ups" button.

## Team - `/dashboard/settings/team`
Subtitle: "Invite new team members to your coaching organization and manage their access levels." "Invite new team member" button.
- Table columns: "Name", "Email", "Role", "2FA", "Last seen".
- Roles observed: "Owner", "Coach Manager", "Assistant".
- Members (this account):
  - Stephanie Pantoja - stephisblessedd@gmail.com - Owner - 2FA Disabled - Jun 16, 2026.
  - LaSean Pickens (you) - lasean@kaldrbusiness.com - Coach Manager - Disabled - Jun 17, 2026.
  - Rodney Williams - support@levelupautomations.com - Coach Manager - Disabled - Jun 17, 2026.
  - Daniella Cattaneo - daniellathickandfitcoaching@gmail.com - Assistant - Disabled - Jun 16, 2026.

# Toolbox Modules (remaining)

## Flows - `/dashboard/toolbox/flows`
"Automatically send Lessons and Messages to your clients based on the number of days since they started their product." "Create" button. Table column: "Name". Flows: "Default flow", "HER again challenge", "Thick & Fit 6 week body recomp challenge" (3). These are day-based drip sequences attached to products (the per-client Communications tab references "Default flow").

## Products - `/dashboard/toolbox/products`
The sellable coaching offerings, grouped:
- **1-to-1 Coaching**: "Personal coaching product". Table column "Name" → "Personal coaching" (1 product). "Learn more about Products".
- **Packages**: "Challenges or pure content products without personal coaching." Columns: "Name", "App access", "Price", "Created on", "Product status". Empty state: "No existing packages - Your packages will appear here after you have created them." "Create new". "Learn more about Packages".
- **Bootcamps**: "Time-limited group coaching, e.g. summer challenge, 8 weeks of strong glutes." "Learn about Bootcamps".
- **Lite memberships**: "Learn more about Lite memberships".
- Full table columns across product types: Name, App access, Price, Created on, Product status, Duration.

## Habits - `/dashboard/toolbox/habit-templates`
Two lists:
- **Habit behaviors** ("Add habit behavior"): columns "Habit behavior", "Created at". Examples: "sleep 7-8 hours a night", "NO ALCOHOL", "Have 4 perfect macro days weekly", "drink 1/2 gallon (64oz) daily", "I hit 10k steps aday", "Drink a gallon of water a day!", "I take 3 deep breaths".
- **Habit triggers** ("Add habit trigger"): columns "Habit trigger", "Created at". Examples: "4 out 7 days of the week", "Everyday".
- A client habit = behavior + trigger (frequency).

## Automations - `/dashboard/toolbox/automations`
"Create automatic actions for your repetitive processes."
- **Aftercare** automation: "Aftercare offer - Send a Lite product offer email and chat message to all ending clients." Fields: "Product *" (Select product), "Send Offer Email (days before expiry)*" ("The email offer will be sent this many days before the client's plan expires"), "Enabled" toggle, "Edit appearance", "Save".

## Benefits - `/dashboard/toolbox/benefits`
- **Client referral**: "Activate your referral program, by setting up the discount amount that your clients and their referral will receive. Available only for 1-1 clients."
- Table columns: "Title", "Description", "Amount", "Status". Example: "Give 60 USD, Get 60 USD - Earn 60 USD in rewards when you bring a friend on board! - 60 - active".

## Content Collections - `/dashboard/toolbox/content-collections`
"Create collections of content, select where they should appear in the app and style them to reflect your unique app." "Create". Empty/intro card: "A collection can contain any type of content and be used in countless ways - highlight featured content, explain your app, or share holiday recipes."

## Tags - `/dashboard/toolbox/profile-tags`
Client profile tags. "Create new". Columns: "Tag preview", "Name", "Clients", "Account", "Created at". Examples: "Daniella (Daniella Cattaneo, 0 clients)", "LaSean (LaSean Pickens, 0)", "PLATIMUM 2x MONTHLY ZOOM (Stephanie, 4 (2 active))". Tags are per-team-member-created and applied to clients/leads.

## Media library - `/dashboard/toolbox/files`
"Add new". Language selector. Columns: "Title", "Type", "Language", "Created". Search. Types observed: "PDF", "Video". Examples: "2 week anti-inflammatory meal plan (PDF)", "Fast Food Guide (PDF)", "How to do a check in (Video)", "Lite membership intro (Video)", "Macro daily summary". This is the shared media store referenced by broadcasts, posts, lessons, and chat.

## Exercise Blocks - `/dashboard/toolbox/exercise-blocks`
Reusable exercise groupings. Search "Search by block name". Columns: "Title", "Type", "Custom tags", "Delete". 7 blocks. Types: "Full session", "Warm up". Examples: "Full body plate circuit (Full session)", "Leg day warm up (Warm up)", "Glute activation (Warm up)", "Dynamic Warm-Up (Warm up)".

## Exercises - `/dashboard/toolbox/exercises`
Exercise library. "Create". Search "Search by name or muscle group...", "Select muscle groups" filter. Filter tabs: "Customized", "My exercises", "Favorite". Columns: "Exercise Name", "Favorite", "Customized". Large built-in catalog (e.g. "1/2 Barbell Squat", "1 Kettlebell Jerk", ...) plus the coach's own ("Own"/"Customized") exercises. Per-exercise editing supports video/thumbnail and instructions (surfaced in the program builder).

## Recipe books - `/dashboard/toolbox/recipe-books`
"Create Recipe books to organize and reuse recipes across products." "Create new". Columns: "Name", "Attached to products". Examples: "Asian, Indian and middle eastern dishes", "Breakfast, Lunch/Dinner, Pescatarian, Vegetarian and Sweets (attached to: Her Again 6 week challenge, Thick & Fit: 6 week Body Recomp challenge)".

# Client-Side Screens

> IMPORTANT SCOPE NOTE: The Lenus **client/subscriber experience is a separate native mobile app** (iOS/Android), not part of the coach web portal at `us.lenus.io/dashboard/*`. It was not directly browsable from this authenticated coach session (no "view as client" web surface was reachable). The screens below are reconstructed from authoritative coach-side evidence: (a) the "Client App Experience" settings that toggle each client feature, (b) the client-filled forms (onboarding + weekly check-in) captured verbatim above, and (c) the client-generated data surfaced in the coach UI (training history, food diary, habits, progress photos, chat). Items that are inferred rather than directly observed are marked [INFERRED].

## Client app feature set (from Settings > Client App Experience)
The client app exposes (each is a coach-controllable toggle):
- **Chat**: send/receive text, audio messages, video messages, image messages (each individually permissible). Habit summary auto-shared after check-in.
- **Progress tracking**: weight progress view, calories & macros view (in activity tracking, history, meal details, and meal plan PDFs), weight progress in check-ins.
- **Check-ins**: fill and send check-ins; receive scheduled check-in reminders (push / chat / email, time-zone adjusted).
- **Upselling**: in-app banners promoting 1-to-1 coaching to Lite/Free/Bootcamp members.
- **Community**: group feed access (posts, comments, reactions, polls) for clients in a group.
- **Content/Lessons**: lessons delivered via Flows (day-based drip) and Content Collections.

## Client home / dashboard [INFERRED]
Likely surfaces: today's workout, meal plan / macro targets, habit tracker, check-in prompt, chat with coach, community feed, upsell banner. [INFERRED from feature toggles; exact layout not observed.]

## Workout player [INFERRED from coach-side Training History]
Coach-side evidence shows clients complete workouts and log three signals per session: **Completion %** (e.g. "100%"), **Enjoyment** (e.g. "Great"), and **Effort** (e.g. "Moderate"/"Hard"). Each session belongs to a named plan/day (e.g. "Full upperbody - Jazmine 12 week 4 day Training Plan 1"). The player presents exercises with the builder-defined fields (sets, reps/minutes/sec, rest, video/thumbnail, instruction cues, circuit rounds + rest-between-rounds). [Logging UI not directly observed.]

## Food logging screen [INFERRED from coach-side Food Diary]
Coach-side "Food Diary Overview" and "Daily Averages" show clients log food against daily calorie + macro targets (Calories / Protein% / Carbs% / Fat%), per-day and per-week (Sun-Sat bar chart). Meal plans assign recipes per meal slot (Breakfast / Protein shake / Lunch / Snack / Dinner). [INFERRED] client food logging likely supports search, recent foods, and per-meal macro breakdown; barcode scanning not confirmed [UNCLEAR].

## Community feed (client view)
Mirrors the coach Groups feed: posts (text, image, video, audio, poll, PDF), reactions, comments/replies, pinned posts, "View previous comments". Clients post to the group dashboard (one challenge rule was "Post in community dashboard 3x a week minimum").

## Progress / check-in screen (client view)
The client fills the **weekly check-in form** documented above (20 questions: status/wins/opportunities, macros rating, body measurement = weight, sleep quality 0-10, circumference Thigh/Chest/Upper Arm/Waist/Hip, energy/mood ratings, meal & workout plan use ratings, sleep hours, steps, water, progress pictures Front/Back/Side, alcohol). Submitted check-ins appear on the coach's client Overview tab.

## Habit tracking (client view)
Clients track habits = behavior + trigger/frequency (e.g. "Drink a gallon of water a day! / Everyday", "Hit 10k steps daily"). Coach-side habit calendar shows per-day status "COMPLETED / PARTIALLY COMPLETED / NOT STARTED". Client marks habits complete in-app. Activity goals also tracked: Active time (min/day), Water intake (fl oz/day), Steps (steps/day).

## Profile / settings (client view) [INFERRED]
Client profile holds the Info-tab data (name, email, phone, height, weight, DOB, sex, gender, country, language, measurement unit, time zone) plus onboarding answers. [INFERRED] client can edit some personal fields and notification preferences.

## Notifications (client view)
Per settings, clients receive: check-in reminders, habit summaries, broadcast messages/lessons/emails, chat messages, birthday reminders, and upsell/aftercare offers (via push notification, chat message, and/or email).

# Component Inventory

All values are from computed styles in the live coach web app.

## Color palette (hex)
| Token | Hex | RGB | Usage |
|-------|-----|-----|-------|
| Sidebar / dark surface | `#1E2F2F` | 30,47,47 | Left icon rail; also heading-dark text |
| Primary brand teal | `#305555` | 48,85,85 | Primary buttons, active accents, avatar fallback bg, chart series |
| Accent sage green | `#A5C9B3` | 165,201,179 | Positive chart fills/series |
| Accent salmon | `#E9ABA5` | 233,171,165 | Negative/refund chart fills |
| Error / danger red | `#C1301F` | 193,48,31 | Errors, dispute, down-deltas (text) |
| Down-delta pill bg | light red/pink | (approx `#FBE9E7`) | "-7%" / "-0.4" decrease pills |
| Link / info blue | `#106CD5` | 16,108,213 | Links / informational chart series |
| Text primary | `#28292A` | 40,41,42 | Body text, headings on light |
| Text muted | `#696C72` | 105,108,114 | Secondary text, inactive tabs, captions |
| Text on dark / light | `#F7F7F8` | 247,247,248 | Text/icons on teal/dark |
| Border (light) | `#EEEEF2` | 238,238,242 | Card borders, dividers |
| Border (input/control) | `#D8DADF` | 216,218,223 | Outline buttons, input borders |
| Background (app) | `#FFFFFF` | 255,255,255 | Page + card background |
| Tag pill (pink) bg / border | `#F9E4EE` / `#F1BBD5` | 249,228,238 / 241,187,213 | "TLC"/"BRID" tags (other tags use yellow, etc.) |

## Typography
- **Font family:** `Inter, Arial, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Helvetica Neue", sans-serif`.
- **Base body:** 13px, color `#28292A`, weight 400.
- **H3:** 22px / weight 600 / line-height 28px (big metric numbers, section page titles).
- **H4:** 18px / 600 / 24px (card/section headings, greeting).
- **H5:** 15px / 500 / color `#1E2F2F` (sub-headings).
- **Labels / captions:** 12-13px, muted `#696C72`.
- No H1/H2 in use; the app scales from H3 down. (Big numeric KPIs are H3-sized 22px 600.)

## Buttons
- **Primary** (e.g. "Create", "Save", "Save template"): bg `#305555`, text `#F7F7F8`, border-radius 8px, padding 0 16px, height 40px, font 15px / 500. No border.
- **Secondary / outline** (e.g. "Broadcast", "Save & Publish", "Add task"): transparent bg, text `#28292A`, 1px solid `#D8DADF` border, radius 8px, padding 0 16px, height 40px, 15px / 500.
- **Text / ghost** (e.g. tab labels, "View all", "Show All", "Edit"): no bg/border; active = `#28292A`, inactive = `#696C72`. Tab labels 13px / 500, padding 8px 16px.
- **Destructive**: red text/treatment (e.g. "Delete all follow-ups" in a "Danger" section). [Exact red token not separately sampled; aligns with `#C1301F`.]
- **Icon buttons**: square, ~40px, 8px radius (e.g. calendar, kebab, send).
- **Split button**: "Save & publish" has an attached dropdown chevron.

## Cards
- Background `#FFFFFF`, border 1px solid `#EEEEF2`, border-radius 16px, box-shadow `rgba(0,0,0,0.04) 0px 2px 16px 0px`. Internal padding roughly 8-16px (varies; KPI cards larger).

## Inputs
- Search inputs: transparent field inside a bordered wrapper (1px `#D8DADF`, ~8px radius), height ~40-41px, font 13px, leading search icon. Placeholders muted.
- Form fields (form builder, settings): underline/box style with `#D8DADF` borders, label above, char counters shown where limited (e.g. "17/30").
- Toggles (settings): standard switch, teal `#305555` when on.
- Steppers (sets/reps): number input with up/down, plus a unit dropdown (reps/minutes/sec).
- Sliders (macro flexibility, NPS): horizontal track with handle; NPS uses a red→yellow→green gradient.

## Navigation
- **Global sidebar:** width 64px, bg `#1E2F2F`, full height, icon-only. Active item = white rounded-square (8px radius) behind the icon. Icons light `#F7F7F8`.
- **Secondary left sub-nav** (Toolbox, Settings, client-switcher): labeled vertical list, light background, active item highlighted with a light grey/teal pill.
- **Tabs:** text tabs with active underline (client profile) or active-pill (dashboard).

## Avatars / profile images
- ~38-40px, border-radius 8px (rounded square, not circle) for client/coach list avatars. Photo or colored-initial fallback (initials in `#305555` on tinted bg). In-list client avatars appear circular in some tables (e.g. clients list shows circular avatars). [Mixed: list = circular, profile/account = rounded square ~8px.]

## Badges / pills
- **Tag pills:** soft pastel fill + matching 1px border, radius 8px, padding 0 4px, 12-13px. Color-coded per tag (pink `#F9E4EE`/`#F1BBD5`; "T&F" yellow; etc.).
- **Status pills:** outline style, e.g. "Pending" amber/yellow outline; "ACTIVE" with green dot.
- **Count badges:** dark filled pill with white number (e.g. updates "1"); unread counts on conversations.
- **Delta pills:** small rounded pill, red bg for decreases ("-7%", "↓ -0.4"), green for increases.
- **"New" badge:** on nav items (e.g. Meal plan templates).

## Spacing
- Card internal padding ~16px; gaps between cards/sections ~16-24px. Control height standard 40px. Border radius scale: 8px (controls, pills, avatars), 16px (cards).

## Misc
- **Intercom** support launcher: blue circular bubble, bottom-right, with red unread dot (global).
- Charts: line/area (traffic, clients, weight), bar (financial, food diary), gradient scale bar (NPS), horizontal bars (clients per team member). Library [INFERRED] a charting lib (e.g. Recharts/visx); axis labels muted, series in teal/sage/salmon/blue.

# Copy Inventory

Verbatim strings captured across the coach app (grouped by type).

## CTA / button labels
"Create", "Create Template", "Create template", "Create recipe", "Create lead", "Create new", "Create group", "Create post", "Add task", "Add plan", "Add item", "Add meal", "Add Goal", "Add habit", "Add post", "Add clients", "Add discount", "Add payment", "Add file", "Add new", "Add habit behavior", "Add habit trigger", "Save", "Save changes", "Save & Publish", "Save template", "Save as block", "Save as template", "Send offer", "Send Offer Email", "Broadcast", "Broadcast chat message", "Broadcast lesson", "Broadcast email", "Invite new team member", "Manage connections", "Upload", "Upload file", "Choose file", "Select media", "Select from media library", "Record video", "Record audio note", "Add poll", "Preview", "Open", "Edit", "Options", "Apply", "View clients", "View logged food", "View all", "Show All", "Show all", "Show more", "Find new recipes", "Restore to default", "Restart client onboarding", "Change email", "Change language", "Change time format", "Delete all follow-ups", "Continue", "Next", "Previous", "Cancel", "Exit", "Today", "Go to previous page", "Go to next page", "Clear all filters", "Learn more".

## Input placeholders
"Search by name or email..." (clients), "Search by name" (templates), "Search by name, email or phone number..." (leads), "Search clients" (messenger), "Search ingredients", "Search group posts", "Search by name or muscle group..." (exercises), "Search by block name", "Search" (media), "Select muscle groups", "Select client workout locations", "Select client equipment", "Client injury description", "Add file from library", "Add comment", "Write here..." (post), "Write a title", "Write a question", "Aa" (chat composer), "Select product".

## Section / page headers
"Welcome back LaSean 👋", "Overview", "Engagement", "Financial overview", "Website traffic", "Conversion", "Clients and app activity", "Average lifetime", "NPS rating", "Clients per team member", "Achievements", "Planner", "Clients", "Leads", "Messenger", "Groups", "Toolbox", "Settings", "Membership overview", "Progress overview", "Check-in", "Daily Averages", "Goals", "Activity goals", "Habits", "Nutrition Information", "Plan's summary", "Micronutrients", "Food Diary Overview", "Training Plan", "Training History", "Training Preferences", "Payments overview", "Upcoming discounts & credits", "Upcoming payments", "Payment history", "Email and Publishing History", "Client info", "Additional client information", "Meal Plan Settings", "Training Plan Settings", "Client Handling & Engagement", "Onboarding Preferences", "Email notifications", "Chat & Communication", "Progress Tracking (Weight, Calories, Check-ins)", "Client Access and Expiry", "Brand positioning", "Brand communication", "Habit behaviors", "Habit triggers", "Client referral".

## Empty states
- Planner: "No tasks yet".
- Meal plan templates: "Meal plan template - A meal plan is a reusable structure you can apply to different clients. Set it up once, then use it to quickly generate meal plans."
- Products > Packages: "No existing packages - Your packages will appear here after you have created them".
- Client payment discounts: "No upcoming discounts or credits".
- Content collections: "A collection can contain any type of content and be used in countless ways - highlight featured content, explain your app, or share holiday recipes".
- Recipes (meal plan): "Not used in the previous plan", "No identical recipes".

## Instructional / helper copy (verbatim)
- Clients > Broadcast custom segments: "With custom segments you can easily select the group of clients you message most frequently. Reach out to your Key Account Manager to help set them up".
- Financial disclaimer: "Please note that the data displayed below is intended for monitoring purposes only and should not be used for accounting. The numbers may vary due to currency exchange fluctuations and transaction fees. For accurate and final accounting details, please refer to the official invoices provided by Lenus."
- Expected payout: "What you earn as a coach after we have deducted all fees. Note: Your Lenus invoice may differ from this."
- Received payments: "All successful payments after refunds converted to your local currency on the day".
- Progress overview: "Follow your client's health and performance indicators".
- Ingredients to avoid (meals): "Ingredients to avoid are managed in the client's nutrition preferences."
- Micronutrients footnote: "*All data might not be available".
- Training templates: "Create Training templates with sessions and exercises you can reuse across clients and products".
- Recipes: "Browse all available recipes from Lenus's curated library and your own creations".
- Ingredients: "Create your own ingredients if they're missing or you want to add a branded version. Add their macros and start using them in recipes."
- Flows: "Automatically send Lessons and Messages to your clients based on the number of days since they started their product".
- Settings > Coaching preferences: "Fine-tune your coaching style, meal plans, workouts, and client engagement settings".
- Settings > Client App Experience: "Customize how clients interact with the app, track progress, and receive check-in reminders."
- Settings > Branding: "Refine your brand elements to enhance your brand and optimize AI-driven personalized suggestions".
- Settings > Banners (upselling): "Personalize your 1-1 upselling banner for Free, Lite and Bootcamp clients" + default "Ready to take your journey to the next level? Experience personalized plans and dedicated support tailored just for you."
- Client App > habit summary: "Automatically send clients a habit summary after each check-in, showing how many times each habit was completed since the last check-in."
- Client App > "Old chats": "After this number of days without a message from you, a client will be moved to the 'Old chats' category."
- Onboarding before-pictures (verbatim): "NO MIRROR SELFIES, in a well lit area please take full figure images (head to toe) in a sports bra/tank top & shorts or bikini please. ALL progress pictures need to be taken like this".
- Referral default: "Earn 60 USD in rewards when you bring a friend on board!".
- Personalization tokens available in copy: `{{firstName}}`, "Add 'First name'", "Add 'Full name'".

## Tooltips
- Website traffic card has an "i" info tooltip. [Tooltip body text not captured on hover this pass - UNCLEAR.]

# User Flows

Numbered, observed/derived step sequences. (Where a step's exact final-confirm screen was not expanded, it is marked.)

## 1. Coach assigns a program to a client
1. Sidebar > "Clients" > click the client row to open the profile.
2. Open the "Training" tab.
3. Click "Add plan" (or "Edit" on an existing plan) to open the program builder.
4. Either start blank or apply a "Template" (e.g. "12 week 5 day Training Plan 1 ADVANCED").
5. In the builder: add/reorder sessions (days) via "Add item"; within a session add format blocks ("Straight set" / circuit) from the right "Exercises / Formats / Blocks" panel; set per-exercise sets, reps/minutes/sec, rest, and instruction notes.
6. Click "Save template" (template) or "Save" / "Save & Publish" on the client profile to assign and publish to the client.
7. Result: appears on the client profile Training tab as "Published {date}" and in "Email and Publishing History".

## 2. Coach sends a broadcast to all clients
1. Sidebar > "Clients" > click "Broadcast".
2. Choose type: "Broadcast chat message" (or lesson / email).
3. Step 1 "Recipients": set "To *" base audience and optional segment filters (sex, weight goal, client type, products, include/exclude tags, language, country, loyalty segment, exclude-unread). Review summary "An individual message will be sent to: {n}". Click "Next".
4. Step 2 "Content": write the "Message" (insert "First name" / "Full name" tokens), optionally add media and attach PDFs. Click "Next".
5. Step 3 "Review & send": confirm and send. [Final send button on step 3 not expanded this pass.]

## 3. Coach creates a new meal plan
1. Per client: Clients > open client > "Meals" tab > "Add plan".
   - Set "Build plan based on" (Calories only / Calories and macros), "Daily intake" (use "We recommend {n}" + "Apply"), "Macro split template", "Number of meals per day", and the macro-flexibility slider.
   - Assign a recipe to each meal slot (Breakfast/Protein shake/Lunch/Snack/Dinner) via "Find new recipes"; watch live "Plan's summary" + "Micronutrients".
   - "Preview" (client PDF), then "Save" / "Save & Publish"; optionally "Save as template".
2. Reusable template route: Toolbox > "Meal plan templates" > "Create template" > fill Name, Plan type, Calories, Macro target + flexibility, per-meal distribution, food preferences, availability > "Continue" to assign recipes.

## 4. Client logs a completed workout
1. (Client native app) Open assigned workout/session for the day.
2. Perform exercises (each shows sets, reps/time, rest, video, cues; circuits show rounds + rest-between-rounds).
3. Mark completion and rate the session: Completion %, Enjoyment (e.g. "Great"), Effort (e.g. "Hard").
4. Result: appears coach-side under client profile "Training" tab > "Training History" with the date, plan/day name, and the three ratings. [Client logging UI inferred from coach-side data.]

## 5. Client logs a meal using food search
1. (Client native app) Open food logging / food diary.
2. Search foods / pick from the meal plan recipes; add quantities. [Barcode/recent-foods UI: UNCLEAR/native.]
3. Logged intake rolls up to daily Calories + Protein/Carbs/Fat vs targets.
4. Result: coach-side "Food Diary Overview" (weekly Sun-Sat chart) and "Daily Averages" reflect logged food; "View logged food" opens detail.

## 6. Client submits a check-in
1. (Client native app) Receive check-in reminder (push/chat/email) and open the assigned check-in form ("Your weekly check-in").
2. Answer questions in order: status/wins/opportunities/non-scale wins (text), macros adherence (stars), body weight (measurement), sleep quality (0-10), circumference (Thigh/Chest/Upper Arm/Waist/Hip), energy & mood (ratings), meal/workout plan use (ratings), sleep hours, steps, water, upload progress pictures (Front/Back/Side), alcohol.
3. Submit.
4. Result: coach-side client profile "Overview" > "Check-in" shows the submission ("Monday, Jun 8, 2026, 11:53 PM", Week #, Weight, Goal, progress pictures); feeds the Engagement/NPS analytics.

## 7. Client sends a message to coach
1. (Client native app) Open chat with coach.
2. Type in the composer ("Aa"), optionally attach image/video/audio note (subject to coach's Client-App chat permissions), send.
3. Result: appears in coach "Messenger" inbox (unread badge, "{name} sent a media message" for media) and in the docked chat on the client profile, with read receipts ("Read: ...").

## 8. Coach views a client's progress over time
1. Sidebar > "Clients" > open the client.
2. "Overview" tab > "Progress overview": choose metric(s) via "Body measurements" / "Select metrics" (chips like "Weight", "Meal plan"), pick range "1m / 3m / 6m / 1y".
3. Read summary tiles: "Current weight", "Total weight change", "Total circumference change".
4. Scroll to "Check-in" history ("Show All"), "Daily Averages", and (Meals tab) "Food Diary Overview"; (Training tab) "Training History".
5. Account-wide trends live on Dashboard Home > Overview/Engagement tabs (with date-range picker).

