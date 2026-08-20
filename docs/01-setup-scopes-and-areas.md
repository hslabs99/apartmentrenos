# Setup Stage 1 — Areas, Scopes & Answers

**Audience:** You have seen a demo but have not yet configured scopes yourself.  
**Goal:** Build the template questions that drive each project’s Check List — what to ask, which answers exist, which catalog lines appear when an answer is chosen, and in what order.

---

## What you are building

Before anyone quotes an apartment, the system needs a **template library**:

| Piece | Where it lives | What it does |
|-------|----------------|--------------|
| **Areas** | Setup → Areas | Room types (Kitchen, Bathroom, Living, …). Every project copies these when areas are added. |
| **Scopes** | Setup → Scopes | Questions shown on the Check List (“Full kitchen reno?”, “Floor finish?”). Each answer can link to catalog lines that import when that answer is chosen. |

**Catalog lines** (quote objects) are already in the system from **import** — you do not create or maintain them in this stage. When editing a scope answer, you **search and select** from that imported list. The **Quote Objects** tab in Setup is for reference only if you need to look something up; no action is required there.

At **project** time, staff pick answers on the Check List. The app creates quote lines from the catalog items you attached to each answer. Pricing uses the project’s price level; Setup defines *what* can appear, not the final dollar total.

This guide focuses on **Areas** and **Scopes**.

---

## Getting to Setup

1. Log in.
2. Open **Projects Setup** in the main navigation.
3. For this guide, use:
   - **Areas** — template rooms (create and order these).
   - **Scopes** — template questions (create, answer, attach catalog lines, order).

You can ignore **Quote Objects** unless you need to search the imported catalog for a name or category while building scopes.

---

## Part A — Template areas (quick start)

Areas are the “rooms” or zones a project can include.

### Create an area

1. Go to **Setup → Areas**.
2. Click **Add area**.
3. Enter a name (e.g. `Kitchen`) and save.
4. Repeat for each standard area you use (Bathroom, Laundry, etc.).

### Edit an area

Click the area name in the left list. The right panel shows tabs:

- **Details** — name, description, default m², etc.
- **Questions** — legacy area questions (separate from scopes; most workflows use scopes instead).
- **Scopes** — scopes tagged for this area (same data as Setup → Scopes, filtered to one area).

### Order areas appear on a project

In the area list, use the **drag handle** (⠿) beside each name, or focus a row and use **arrow keys**.  
That order is used when areas are listed or added to a project.

---

## Part B — Scopes overview

A **scope** is a Check List question. Three kinds:

| Type | Purpose | Has answers? |
|------|---------|--------------|
| **Question** | Normal scope — user picks an answer | Yes |
| **Header** | Section title only (e.g. “Appliances”) | No |
| **Footer** | Marks end of a section block | No |

Each question scope has:

- **Area tags** — which template areas show this question.
- **Question text** — what appears on the Check List (max 200 characters).
- **Answers** — options like Yes / No / Partial.
- **Attached catalog lines** — per answer, which imported items to pull onto the Check List when that answer is chosen.
- **Optional extras** — metrics, calculators, system rules (covered below).

When saved, the system assigns a numeric **Scope ID** (visible when editing).

---

## Part C — Create a scope (step by step)

You can create scopes from **Setup → Scopes** or from **Setup → Areas → [area] → Scopes** tab. Both open the same editor; creating from an area pre-selects that area tag.

### 1. Open the form

- **Setup → Scopes** → **Add scope**, or  
- **Setup → Areas** → select area → **Scopes** tab → **Add scope**.

### 2. Scope Details tab

**Area tags**

- Pick one or more areas from **— Add area…**, or  
- Check **All template areas** to tag every area that exists **at save time**.

> **Important:** “All template areas” is a snapshot. If you add a new area later (e.g. “Study”), existing scopes will **not** automatically include it until you edit the scope and add the new area (or re-save with All areas).

**Scope question**

- Type the question as it should read on the Check List.  
- Example: `Full kitchen makeover including cabinetry?`

**System scope** (optional — skip unless you were shown blinds/system workflows)

- Tags the scope for built-in system rules. Only enable if instructed.

**Expose tool** (optional — scope-level calculator)

- When checked, after the user answers this scope on the Check List, a calculator icon appears **on the scope row** (not on individual SKU lines).
- Choose **M² calculator** (sum rectangular sections) or **Wall m²** (two wall widths × stud height).
- This is separate from the **Calc tool** on individual attached lines (see below).

Click **Scope Answers** tab when area tags and question are set.

### 3. Scope Answers tab — add answers

1. Click **Add answer** for each option (e.g. `Yes`, `No`, `Partial`).
2. Click an answer in the left list to select it.
3. Edit the **Answer label** — this is what users see on the Check List.
4. You need **at least one answer** before you can save.

Per-answer options (left list):

- **Default to true** — the Check List auto-selects this answer so the scope can populate without anyone choosing. Only **one** answer on the scope can have this checked.
- **Suppress 0 SKU Rows** — attached catalog objects with **no matching SKUs** at the project’s tier, style, and colour are **not** added as Check List rows for this answer. If two objects both have SKUs, both still appear. Any answer can have this on (one, two, or all of them).
- **Demolition report** — include attached objects on the demolition trade report.

Removing an answer later can affect projects that already used it — the app will warn you before delete.

### 4. Attach catalog lines to an answer

With an answer selected on the left, use **Attached quote objects** to pick from the imported catalog:

1. Use **Search** to filter by type, name, or category.
2. Expand an object type with **+ / −**.
3. Check the lines that should import when **this answer** is chosen.
4. Selected items appear in the **Selected** list — **drag to reorder**; that order is the Check List line order.

You can attach **different lines to different answers**. Example: “Yes” attaches cabinet install + benchtop; “No” attaches nothing.

### 5. Per-line options (the nuances)

For each selected catalog line, a row of options appears. Hover labels for full tooltips in the app.

| Option | What it does |
|--------|----------------|
| **Inherit m²** | Default **measurement source** on the Check List. Choices include apartment totals, room m², or a **scope metric** (if defined and UOM-compatible). |
| **Locked** | Only when inheriting a **scope metric**. Checked (default): users cannot change the measure on the Check List — it follows the metric. Unchecked: starts from the metric but allows manual override. |
| **Show All** | Instead of one line with a multi-SKU dropdown, create **one Check List row per matching catalog SKU** (for the project’s tier, style, and colour). |
| **No Charge** | Imported lines use **$0** unit and line price (included items, placeholders). |
| **Force** | Answer is hidden or disabled on the Check List unless at least one catalog SKU matches this line at the project tier/style/colour. |
| **Calc tool** | Calculator on **this SKU row**: **M² calculator** or **Wall m²**. Result fills the line measure field. Different from scope-level **Expose tool**. |

**Inherit m² choices (typical)**

- **None** — use the line’s default measurement.  
- **Apartment m² (project total)** / **Soft Floor** / **Hard Floor** — pull from project-level m² fields.  
- **Area m² (room)** — pull from the room’s m² on the Check List.  
- **Scope metric: …** — pull from a metric you defined on this scope (see next section).

SKU count shown beside each line (e.g. “3 SKUs”) reflects catalog matches — amber if zero matches.

### 6. Scope metrics (optional)

At the top of the **Scope Answers** tab, **Scope metrics** let you collect measurements on the Check List when certain answers are selected (max **4** per scope).

For each metric:

1. Click **Add metric**.
2. Set **Label** (e.g. `Tiled floor area`) and **UOM** (M2, LM-Runs, LM, or Unit).
3. Under **Show on checklist when answer is**, tick which answers display this metric row.
4. On attached lines, set **Inherit m²** to that metric so quantities follow what the user enters.

Example flow: answer “Tile floor” → user enters 12.5 m² in the metric → tile supply line inherits 12.5 as quantity (if Locked, they cannot change it).

### 7. Save

Click **Save**. The scope appears in the list with its Scope ID and area tags.

---

## Part D — One scope in many areas

A single scope can tag **Kitchen** and **Bathroom** with the same question and answers. On the Check List, each area shows its own copy of the question.

- Tag areas individually with **— Add area…**, or use **All template areas** once.
- **Order within each area is independent** — reordering Kitchen’s list does not change Bathroom’s order (see Part F).

---

## Part E — Section headers and footers (optional)

Use headers to group questions visually on the Check List.

1. **Setup → Scopes** → **Add header**.
2. Pick **one area** (headers are single-area only).
3. Enter section heading text (e.g. `Appliances`).
4. Save — a paired **Footer** row is created under the header.

**Tips**

- Click a scope row **before** adding a header to insert the header **below** that row (same area).
- Move the **Footer** down with reorder controls to wrap more questions inside the section.
- Headers and footers do not have answers and do not add quote lines.

---

## Part F — Sort order (where things appear)

Order matters in two places: **areas on a project**, and **scopes within an area**.

### 1. Order of areas (project level)

**Setup → Areas** — drag areas in the left list (or arrow keys).  
This is the order areas tend to follow when added to projects.

### 2. Order of scopes within one area

Each area has its own scope sequence. Use **either** location — they update the same data:

**Option A — Setup → Scopes**

1. In the **Area** column filter, choose a **specific area** (not “All areas”).
2. Use **↑ ↓** beside each row, or focus the row and use arrow keys.

> Reorder arrows are **disabled** when the filter is “All areas” — you must pick one area first.

**Option B — Setup → Areas → [area] → Scopes tab**

1. Select the area.
2. Open the **Scopes** tab.
3. Drag the **⠿ handle** on each row, or use arrow keys on the focused row.

This order is what appears on the **Check List** and **Workbench** for that template area.

### 3. Order of lines within an answer

In the scope form, **Scope Answers** → select answer → drag items in the **Selected** list.  
That sets Check List line order when that answer is chosen.

### 4. Order of answers

Answers appear on the Check List in the order they are listed in the left panel (top to bottom). Add answers in the sequence you want; there is no separate reorder control for answer buttons today — add them in display order or recreate if you need a different order.

---

## Part G — Edit, delete, and find scopes

### Edit

- **Setup → Scopes** — click the blue question text, or select a row and use edit.  
- **Setup → Areas → Scopes** — pencil icon on the row.

### Delete

- **Setup → Scopes** — tick checkboxes, then **Delete selected**.

### Filter by area

Use the **Area** dropdown in the Scopes table header to focus on one room’s questions.

---

## Part H — What happens on a project (so Setup choices make sense)

1. A **project** gets template **areas** (Kitchen, etc.).
2. The **Check List** shows **scopes** tagged for each area, in the order you set.
3. The user picks an **answer** for each scope.
4. The app imports **catalog lines** attached to that answer as scope lines (respecting Show All, No Charge, Force, inherit rules, etc.).
5. Staff adjust measures, SKUs, and prices on the Check List; **Setup** defined the starting structure.

If nothing appears after choosing an answer, common causes:

- No catalog lines attached to that answer in Setup.  
- **Force** is on but no SKU matches the project tier/style/colour.  
- The line’s category/product type has no matching catalog SKUs.

---

## Recommended first exercise

Try this minimal path once:

1. Confirm **Kitchen** exists under **Areas** (create if needed).
2. **Add scope** — tag **Kitchen**, question `Test scope — include X?`
3. Add answers **Yes** and **No**.
4. On **Yes**, search the catalog and attach one line. Leave **No** with nothing attached.
5. Save.
6. Filter Scopes by **Kitchen** and move your scope to the top with **↑**.
7. Open a test project → Kitchen on Check List → confirm the question appears and **Yes** adds your line.

Once that works, repeat for real questions, multiple answers, Show All SKUs, and metrics.

---

## Quick reference — checklist before go-live

- [ ] All standard **areas** created and ordered  
- [ ] Each Check List question has a **scope** with clear wording  
- [ ] Every meaningful **answer** has the correct **catalog lines** attached  
- [ ] **Show All / No Charge / Force / Inherit / Locked / Calc tool** set where needed  
- [ ] **Scope metrics** defined for tiled areas, run lengths, etc. if quantities should be collected once and reused  
- [ ] **Scope order** checked per area (filter by area in Setup → Scopes)  
- [ ] **Headers** added if the Check List should show section groupings  

---

## Glossary

| Term | Meaning |
|------|---------|
| **Template area** | Master room type in Setup → Areas |
| **Scope** | Template Check List question |
| **Answer** | One selectable option on that question |
| **Catalog line** | Imported product or labour row (shown as “quote object” in the app) — search and attach only; created by import |
| **Scope metric** | Optional measurement field on the Check List tied to specific answers |
| **Show All** | Explode one line into multiple SKU rows instead of a dropdown |
| **Tag / area tag** | Link a scope to one or more template areas |

---

*Document 1 of the Setup user manual series — scopes and areas. Later guides can cover project Check List and Workbench workflows in depth.*
