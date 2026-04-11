# BRIEF: Intake Leads Visual Redesign

**Branch:** `feat/increment-1-pipeline-redesign`
**Layer:** Interface
**Scope:** 3 files modified, 0 new files, 0 new dependencies
**Risk:** Low — pure UI, no data model changes, fakerest generator already produces all needed fields

---

## Goal

Redesign the Intake Leads page to match the approved mockup at `mockups/04-intake-outreach.html`. The data model and generator already support every field shown — this is purely a visual/layout upgrade.

## Reference

The mockup HTML is at `mockups/04-intake-outreach.html` in the repo root. Read it for exact visual reference. Key design tokens are already in the codebase:
- Primary cyan: `#4DC8E8` (mapped to Tailwind `primary` in the design system)
- Use existing shadcn/ui components (`Badge`, `Button`, `Card`, `Table` etc.) — do NOT add Tailwind hardcoded colors when a shadcn class exists
- Font: Manrope for headings (class `font-heading`), Inter for body (default)

## Changes

### 1. Status Tab Bar — `IntakeList.tsx`

Replace the current `<IntakeListActions>` FilterButton dropdown with a horizontal tab strip above the table.

**Implementation:**
- Create a `StatusTabBar` component inside `IntakeList.tsx` (not a separate file)
- Use `useGetList('intake_leads')` or `useListContext` to get total counts per status
- Render tabs: All, Uncontacted, In Sequence, Engaged, Not Interested, Unresponsive (exclude qualified/rejected from tabs — they're terminal)
- Active tab applies a `filter` via `useListContext`'s `setFilters` or by setting `filterValues`
- Active tab style: `rounded-xl border border-primary/35 bg-primary/12 text-primary font-semibold`
- Inactive tab style: `rounded-xl border border-border bg-white text-muted-foreground font-semibold`
- Show count in parentheses: e.g., "All (24)", "Uncontacted (8)"
- Place the tab bar between the page header and the table card, with `mb-5 flex flex-wrap gap-3`

### 2. Table Column Changes — `DesktopIntakeTable` in `IntakeList.tsx`

**Remove columns:**
- Checkbox column (remove bulk selection entirely for now — remove `BulkActionsToolbar` and `IntakeBulkRejectButton` too)
- "Created" (`created_at`) column

**Add column: "Outreach Progress"** — between Status and Actions

Render based on status:
- `uncontacted`: text "Ready for first touch" in muted
- `in-sequence`: 
  ```
  <div className="text-sm font-semibold">Touch {outreach_sequence_step}/7</div>
  <div className="mt-2 h-2 w-40 rounded-full bg-muted">
    <div className="h-2 rounded-full bg-primary" style={{ width: `${(outreach_sequence_step / 7) * 100}%` }} />
  </div>
  <div className="mt-2 text-xs text-muted-foreground">Next: {formatted next_outreach_date}</div>
  ```
- `engaged`: text "Reply received" in muted
- `not-interested`: text "Declined" in muted
- `unresponsive`: text `Touch {step}/7 · Next: {date}` in muted (they may still have active sequences)

**Contextual Action Buttons** — replace the static Promote + Reject pair:

| Status | Button | Variant |
|--------|--------|---------|
| `uncontacted` | "Send Outreach" | `bg-primary text-primary-foreground` (solid cyan) |
| `in-sequence` | "View Sequence" | `border-primary/35 bg-primary/12 text-primary` (outline cyan) |
| `engaged` | "Promote" | `bg-green-500 text-white` |
| `not-interested` | "Review Notes" | `variant="outline"` |
| `unresponsive` | "View Sequence" | `border-primary/35 bg-primary/12 text-primary` (outline cyan) |
| `qualified` | (disabled) "Promoted" | `variant="outline" disabled` |
| `rejected` | (disabled) "Rejected" | `variant="outline" disabled` |

- Keep the expand chevron column as the last column
- "Send Outreach" and "View Sequence" just toggle the expanded row (call `toggleExpanded(record.id)`) — actual send functionality is Layer 2
- "Promote" keeps existing `IntakePromoteButton` logic
- "Review Notes" also toggles expanded row

Remove the `<TableHead className="w-12">` checkbox header and all checkbox-related code (`selectedIds`, `onSelect`, `onToggleItem`, `handleToggleAll`, `handleToggleRowSelection`, `allSelected`, `selectableIds`).

### 3. Expanded Row Redesign — `IntakeExpandedRow.tsx`

Replace the vertical stack layout with a **3-column grid**:

```tsx
<div className="grid grid-cols-3 gap-4">
  {/* Left: AI Enrichment Summary */}
  <div className="rounded-2xl border bg-card p-4">
    <h4 className="mb-2 font-heading text-base font-extrabold">AI Enrichment Summary</h4>
    <p className="text-sm leading-6 text-muted-foreground">
      {record.enrichment_summary || "No enrichment data yet."}
    </p>
  </div>

  {/* Center: Outreach Draft */}
  <div className="rounded-2xl border bg-card p-4">
    <h4 className="mb-2 font-heading text-base font-extrabold">Outreach Draft</h4>
    <p className="text-sm leading-6 text-muted-foreground whitespace-pre-wrap">
      {record.outreach_draft || "No draft generated yet."}
    </p>
    {record.outreach_draft && (
      <div className="mt-4 flex gap-2">
        <Button size="sm" className="bg-primary text-primary-foreground">Send Now</Button>
        <Button size="sm" variant="outline">Edit Draft</Button>
      </div>
    )}
  </div>

  {/* Right: Cadence Timeline */}
  <div className="rounded-2xl border bg-card p-4">
    <h4 className="mb-3 font-heading text-base font-extrabold">Cadence Timeline</h4>
    {/* Grid of day blocks */}
  </div>
</div>
```

**Cadence Timeline redesign:**

Update `OUTREACH_CADENCE` to include multi-channel types matching the mockup:
```ts
const OUTREACH_CADENCE = [
  { day: 1, label: "Day 1", type: "Email" },
  { day: 3, label: "Day 3", type: "Email" },
  { day: 4, label: "Day 4", type: "LinkedIn" },
  { day: 7, label: "Day 7", type: "Phone" },
  { day: 14, label: "Day 14", type: "Email" },
  { day: 21, label: "Day 21", type: "Phone" },
  { day: 28, label: "Day 28", type: "Email" },
];
```

Render as a grid of card blocks (not circles):
```
grid grid-cols-7 gap-2 text-center text-xs font-semibold
```

Each block:
- **Completed** (index < outreach_sequence_step): `rounded-xl bg-green-500/12 text-green-700` with "Day N ✓" and channel type below
- **Current/Next** (index === outreach_sequence_step && status is in-sequence): `rounded-xl bg-primary/12 text-primary` with "Day N →" and "next" label
- **Pending** (index > step): `rounded-xl bg-muted text-muted-foreground`

Each block layout:
```html
<div className="rounded-xl px-2 py-3 {color classes}">
  Day {n} {icon}
  <div className="mt-1 font-medium text-muted-foreground">{type} · {status}</div>
</div>
```

**Remove** the Location section and Notes section from the expanded row — they clutter the 3-column layout. Location (city) is already visible in the table. Notes can be accessed via the record detail view later.

### 4. Badge Color Update — `IntakeStatusBadge.tsx`

Update `in-sequence` color to match mockup's cyan treatment instead of amber:
```ts
"in-sequence": "border-primary/60 bg-primary/10 text-primary",
```

Keep all other status colors as-is.

## What NOT to change

- Do NOT modify `types.ts` (IntakeLead type) — data model is complete
- Do NOT modify `intakeLeads.ts` (data generator) — it already produces all needed fields
- Do NOT modify `IntakePromoteButton.tsx` or `IntakeRejectButton.tsx` — keep existing logic, just change where/when they render
- Do NOT add new npm dependencies
- Do NOT touch mobile layout (`IntakeMobileList.tsx`)
- Do NOT implement actual email sending — "Send Now" and "Send Outreach" buttons are UI-only for now (can show a toast: "Outreach sending coming soon")

## Validation

After changes:
1. `npx tsc --noEmit` must pass (may have pre-existing errors in CompanyShow.tsx, StartPage.tsx, oauth-consent-page.tsx — those are known and not from this work)
2. The intake list should render with tab filters, progress bars, contextual actions, and the 3-column expanded view
3. Clicking a row expands to show the enrichment/draft/cadence grid
4. Tab filters should update the displayed leads
