# Band Management CRM
## Built on Atomic CRM — Full Implementation Guide

---

## 1. Overview & Terminology Mapping

| Atomic CRM Term | Band CRM Term | Notes |
|---|---|---|
| Deal | Gig | Kanban pipeline: Enquiry → Quoted → Won → Confirmed → Completed |
| Contact | Contact | Venue contacts, bookers, promoters (linked to companies) |
| Company | Company | The hiring entity (promoter, booking agency, or venue business) |
| Sale (user) | Band Member | Users of the app |
| — | **Venue** | **NEW entity** — Physical performance location |
| — | Song | New entity — the Songbook |
| — | Set List | New entity — ordered songs per Gig |
| — | Quote | Generated from template, linked to a Gig |
| — | Invoice | Generated from Gig on completion |

### Data Model Relationships

```
Company (hiring entity: promoter, agency, or venue business)
   ↓ hires band for
Gig (booking/deal)
   ↓ occurs at
Venue (physical location)
```

**Example Scenarios:**
- **Scenario A**: A pub company hires the band to play at their own venue
  - Company: "The Red Lion Pub Ltd" (hiring entity)
  - Venue: "The Red Lion" (performance location)
  - Contact: "Sarah Manager" (linked to company)
  
- **Scenario B**: A promoter hires the band to play at a separate venue
  - Company: "Live Music Promotions Ltd" (hiring entity)
  - Venue: "The Jazz Cellar" (performance location)
  - Contact: "John Promoter" (linked to company)

---

## 2. Database Schema (Supabase Migrations)

### 2.1 Create `venues` table

Venues are physical performance locations, separate from the companies that hire the band.

```sql
-- supabase/migrations/YYYYMMDD_venues.sql

CREATE TABLE IF NOT EXISTS venues (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  address         text,
  city            text,
  postcode        text,
  country         text DEFAULT 'UK',
  capacity        integer,
  stage_size      text,           -- e.g. '20ft x 15ft'
  parking_info    text,
  load_in_notes   text,           -- loading bay access, stairs, etc.
  contact_name    text,           -- venue contact (not in contacts table)
  contact_phone   text,
  contact_email   text,
  website         text,
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated users can manage venues"
  ON venues FOR ALL TO authenticated USING (true);

-- Create index for searching
CREATE INDEX idx_venues_name ON venues(name);
CREATE INDEX idx_venues_city ON venues(city);
```

### 2.2 Extend the `deals` table (Gigs)

The existing `deals` table is used for Gigs. Add band-specific columns including venue reference:

```sql
-- supabase/migrations/YYYYMMDD_band_gig_fields.sql

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS venue_id          uuid REFERENCES venues(id),
  -- company_id already exists (the hiring entity)
  ADD COLUMN IF NOT EXISTS performance_date  date,
  ADD COLUMN IF NOT EXISTS start_time        time,
  ADD COLUMN IF NOT EXISTS end_time          time,
  ADD COLUMN IF NOT EXISTS set_count         integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS fee               numeric(10,2),
  ADD COLUMN IF NOT EXISTS deposit           numeric(10,2),
  ADD COLUMN IF NOT EXISTS deposit_paid      boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS travel_expenses   numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes             text,
  ADD COLUMN IF NOT EXISTS quote_sent_at     timestamptz,
  ADD COLUMN IF NOT EXISTS invoice_sent_at   timestamptz;

-- Create index for venue lookups
CREATE INDEX idx_deals_venue_id ON deals(venue_id);

-- Update the deals_summary view to include venue and company
DROP VIEW IF EXISTS "public"."deals_summary";
CREATE VIEW "public"."deals_summary"
WITH (security_invoker=on)
AS
SELECT
  d.*,
  c.name AS company_name,
  v.name AS venue_name,
  v.city AS venue_city,
  v.address AS venue_address,
  s.first_name || ' ' || s.last_name AS sales_name
FROM deals d
LEFT JOIN companies c ON d.company_id = c.id
LEFT JOIN venues v ON d.venue_id = v.id
LEFT JOIN sales s ON d.sales_id = s.id;
```

### 2.3 Gig Members (Band Members on a Gig)

```sql
-- supabase/migrations/YYYYMMDD_gig_members.sql

CREATE TABLE IF NOT EXISTS gig_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id      uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  sales_id    uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  role        text,         -- e.g. 'Lead Guitar', 'Vocals', 'Dep'
  confirmed   boolean DEFAULT false,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (gig_id, sales_id)
);

ALTER TABLE gig_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated users can manage gig_members"
  ON gig_members FOR ALL TO authenticated USING (true);
```

### 2.4 Songbook

```sql
-- supabase/migrations/YYYYMMDD_songs.sql

CREATE TABLE IF NOT EXISTS songs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  artist      text,
  key         text,          -- musical key, e.g. 'G', 'Am'
  tempo       integer,       -- BPM
  duration    integer,       -- seconds
  genre       text,
  notes       text,
  lyrics_url  text,
  chart_url   text,
  tags        text[],
  active      boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated users can manage songs"
  ON songs FOR ALL TO authenticated USING (true);
```

### 2.5 Set Lists

```sql
-- supabase/migrations/YYYYMMDD_setlists.sql

CREATE TABLE IF NOT EXISTS set_lists (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id      uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  name        text NOT NULL DEFAULT 'Set 1',  -- 'Set 1', 'Set 2', etc.
  position    integer NOT NULL DEFAULT 1,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS set_list_songs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  set_list_id  uuid NOT NULL REFERENCES set_lists(id) ON DELETE CASCADE,
  song_id      uuid NOT NULL REFERENCES songs(id) ON DELETE RESTRICT,
  position     integer NOT NULL,
  notes        text,         -- per-gig notes for this song
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE set_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_list_songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can manage set_lists"
  ON set_lists FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated users can manage set_list_songs"
  ON set_list_songs FOR ALL TO authenticated USING (true);
```

### 2.6 Quote Templates

```sql
-- supabase/migrations/YYYYMMDD_quote_templates.sql

CREATE TABLE IF NOT EXISTS quote_templates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  body_html    text NOT NULL,   -- Handlebar/mustache template
  is_default   boolean DEFAULT false,
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gig_quotes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id         uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  template_id    uuid REFERENCES quote_templates(id),
  rendered_html  text NOT NULL,
  sent_at        timestamptz,
  accepted_at    timestamptz,
  version        integer DEFAULT 1,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE quote_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE gig_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated users can manage quote_templates"
  ON quote_templates FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated users can manage gig_quotes"
  ON gig_quotes FOR ALL TO authenticated USING (true);
```

---

## 3. TypeScript Types

Add to `src/components/atomic-crm/types.ts`:

```typescript
// --- Venue ---
export type Venue = {
  id: string;
  name: string;
  address?: string;
  city?: string;
  postcode?: string;
  country?: string;
  capacity?: number;
  stage_size?: string;
  parking_info?: string;
  load_in_notes?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  website?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
};

// --- Gig (extends Deal) ---
export type Gig = Deal & {
  venue_id?: string;
  // Joined from view
  venue_name?: string;
  venue_city?: string;
  venue_address?: string;
  // Gig-specific fields
  performance_date?: string;
  start_time?: string;
  end_time?: string;
  set_count?: number;
  fee?: number;
  deposit?: number;
  deposit_paid?: boolean;
  travel_expenses?: number;
  quote_sent_at?: string;
  invoice_sent_at?: string;
};

// --- Gig Member ---
export type GigMember = {
  id: string;
  gig_id: string;
  sales_id: string;
  role?: string;
  confirmed: boolean;
  // joined
  sales_name?: string;
  sales_email?: string;
};

// --- Song ---
export type Song = {
  id: string;
  title: string;
  artist?: string;
  key?: string;
  tempo?: number;
  duration?: number;  // seconds
  genre?: string;
  notes?: string;
  lyrics_url?: string;
  chart_url?: string;
  tags?: string[];
  active: boolean;
};

// --- Set List ---
export type SetList = {
  id: string;
  gig_id: string;
  name: string;
  position: number;
  songs?: SetListSong[];  // hydrated
};

export type SetListSong = {
  id: string;
  set_list_id: string;
  song_id: string;
  position: number;
  notes?: string;
  // joined
  title?: string;
  artist?: string;
  key?: string;
  duration?: number;
};

// --- Quotes ---
export type QuoteTemplate = {
  id: string;
  name: string;
  body_html: string;
  is_default: boolean;
};

export type GigQuote = {
  id: string;
  gig_id: string;
  template_id?: string;
  rendered_html: string;
  sent_at?: string;
  accepted_at?: string;
  version: number;
};
```

---

## 4. Frontend File Structure

Create these new directories and files under `src/components/atomic-crm/`:

```
src/components/atomic-crm/
├── gigs/                          # Renamed/extended from deals/
│   ├── GigList.tsx                # Kanban board (reuse DealList, rename labels)
│   ├── GigShow.tsx                # Gig detail page
│   ├── GigEdit.tsx                # Edit gig form
│   ├── GigCreate.tsx              # Create gig form
│   ├── GigInputs.tsx              # Form fields (includes company + venue selectors)
│   ├── GigAside.tsx               # Sidebar with members, quote/invoice actions
│   ├── GigMembers.tsx             # Band members panel
│   ├── GigSetLists.tsx            # Set list panel (with drag-and-drop)
│   ├── GigQuoteButton.tsx         # Generate/send quote
│   ├── GigInvoiceButton.tsx       # Generate/send invoice
│   └── index.ts
├── venues/                        # NEW — Venue management
│   ├── VenueList.tsx              # List of venues
│   ├── VenueShow.tsx              # Venue detail page
│   ├── VenueEdit.tsx              # Edit venue form
│   ├── VenueCreate.tsx            # Create venue form
│   ├── VenueInputs.tsx            # Form fields
│   ├── VenueAside.tsx             # Sidebar with venue details
│   ├── AutocompleteVenueInput.tsx # Venue selector for gig forms
│   └── index.ts
├── songs/                         # NEW — Songbook
│   ├── SongList.tsx
│   ├── SongShow.tsx
│   ├── SongEdit.tsx
│   ├── SongCreate.tsx
│   ├── SongInputs.tsx
│   └── index.ts
├── setlists/                      # NEW — Set List builder
│   ├── SetListBuilder.tsx         # Drag-and-drop set list editor
│   ├── SetListSongItem.tsx        # Individual draggable song row
│   ├── SongPickerDialog.tsx       # Modal to pick songs from Songbook
│   └── index.ts
└── quotes/                        # NEW — Quote/Invoice templates
    ├── QuoteTemplateList.tsx
    ├── QuoteTemplateEdit.tsx
    ├── QuotePreviewDialog.tsx
    ├── InvoicePreviewDialog.tsx
    └── index.ts
```

---

## 5. Key Component Implementations

### 5.1 App.tsx — Register New Resources

```tsx
// src/App.tsx
import { CRM } from "@/components/atomic-crm/root/CRM";
import { VenueList, VenueEdit, VenueCreate, VenueShow } from "@/components/atomic-crm/venues";
import { SongList, SongEdit, SongCreate, SongShow } from "@/components/atomic-crm/songs";
import { QuoteTemplateList, QuoteTemplateEdit } from "@/components/atomic-crm/quotes";
import { Building2Icon, MusicIcon, FileTextIcon } from "lucide-react";

const App = () => (
  <CRM
    title="Band Manager"
    dealLabel={{ singular: "Gig", plural: "Gigs" }}
    companyLabel={{ singular: "Company", plural: "Companies" }}
    dealStages={[
      { value: 'enquiry',   label: 'Enquiry' },
      { value: 'quoted',    label: 'Quoted' },
      { value: 'won',       label: 'Won' },
      { value: 'confirmed', label: 'Confirmed' },
      { value: 'completed', label: 'Completed' },
      { value: 'lost',      label: 'Lost' },
    ]}
    extraResources={[
      {
        name: "venues",
        list: VenueList,
        edit: VenueEdit,
        create: VenueCreate,
        show: VenueShow,
        icon: Building2Icon,
        label: "Venues",
      },
      {
        name: "songs",
        list: SongList,
        edit: SongEdit,
        create: SongCreate,
        show: SongShow,
        icon: MusicIcon,
        label: "Songbook",
      },
      {
        name: "quote_templates",
        list: QuoteTemplateList,
        edit: QuoteTemplateEdit,
        icon: FileTextIcon,
        label: "Quote Templates",
      },
    ]}
  />
);

export default App;
```

### 5.2 SetListBuilder.tsx — Drag-and-Drop

Install the drag-and-drop library:
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

```tsx
// src/components/atomic-crm/setlists/SetListBuilder.tsx
import { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { SetListSongItem } from "./SetListSongItem";
import { SongPickerDialog } from "./SongPickerDialog";
import { Button } from "@/components/ui/button";
import { PlusIcon, ClockIcon } from "lucide-react";
import type { SetList, SetListSong } from "../types";

interface Props {
  gigId: string;
  setList: SetList;
  onUpdate: (updated: SetList) => void;
}

export const SetListBuilder = ({ gigId, setList, onUpdate }: Props) => {
  const [songs, setSongs] = useState<SetListSong[]>(setList.songs ?? []);
  const [pickerOpen, setPickerOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const totalDuration = songs.reduce((acc, s) => acc + (s.duration ?? 0), 0);
  const fmt = (secs: number) =>
    `${Math.floor(secs / 60)}m ${secs % 60}s`;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = songs.findIndex(s => s.id === active.id);
      const newIndex = songs.findIndex(s => s.id === over.id);
      const reordered = arrayMove(songs, oldIndex, newIndex).map(
        (s, i) => ({ ...s, position: i + 1 })
      );
      setSongs(reordered);
      onUpdate({ ...setList, songs: reordered });
    }
  };

  const removeSong = (id: string) => {
    const updated = songs
      .filter(s => s.id !== id)
      .map((s, i) => ({ ...s, position: i + 1 }));
    setSongs(updated);
    onUpdate({ ...setList, songs: updated });
  };

  const addSongs = (newSongs: SetListSong[]) => {
    const merged = [
      ...songs,
      ...newSongs.map((s, i) => ({ ...s, position: songs.length + i + 1 })),
    ];
    setSongs(merged);
    onUpdate({ ...setList, songs: merged });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-base">{setList.name}</h3>
        <span className="text-sm text-muted-foreground flex items-center gap-1">
          <ClockIcon size={14} />
          {fmt(totalDuration)} · {songs.length} songs
        </span>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={songs.map(s => s.id)} strategy={verticalListSortingStrategy}>
          {songs.map(song => (
            <SetListSongItem key={song.id} song={song} onRemove={removeSong} />
          ))}
        </SortableContext>
      </DndContext>

      {songs.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-6 border-2 border-dashed rounded-md">
          No songs yet — add some from the songbook
        </div>
      )}

      <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
        <PlusIcon size={14} className="mr-1" /> Add Songs
      </Button>

      <SongPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onAdd={addSongs}
        existingIds={songs.map(s => s.song_id)}
      />
    </div>
  );
};
```

### 5.3 SetListSongItem.tsx — Draggable Row

```tsx
// src/components/atomic-crm/setlists/SetListSongItem.tsx
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon, XIcon } from "lucide-react";
import type { SetListSong } from "../types";

interface Props {
  song: SetListSong;
  onRemove: (id: string) => void;
}

export const SetListSongItem = ({ song, onRemove }: Props) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: song.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const fmt = (secs?: number) => secs
    ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`
    : "–";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-2 bg-card border rounded-md"
    >
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground">
        <GripVerticalIcon size={16} />
      </button>
      <span className="w-6 text-xs text-muted-foreground text-right">{song.position}</span>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{song.title}</p>
        <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
      </div>
      {song.key && (
        <span className="text-xs border rounded px-1.5 py-0.5 text-muted-foreground">{song.key}</span>
      )}
      <span className="text-xs text-muted-foreground w-10 text-right">{fmt(song.duration)}</span>
      <button
        onClick={() => onRemove(song.id)}
        className="text-muted-foreground hover:text-destructive"
      >
        <XIcon size={14} />
      </button>
    </div>
  );
};
```

### 5.4 GigMembers.tsx — Band Members Panel

```tsx
// src/components/atomic-crm/gigs/GigMembers.tsx
import { useState, useEffect } from "react";
import { useDataProvider, useRecordContext } from "react-admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircleIcon, UserPlusIcon } from "lucide-react";
import type { GigMember } from "../types";

export const GigMembers = () => {
  const record = useRecordContext();
  const dataProvider = useDataProvider();
  const [members, setMembers] = useState<GigMember[]>([]);
  const [allSales, setAllSales] = useState<any[]>([]);
  const [selectedSale, setSelectedSale] = useState("");

  useEffect(() => {
    if (!record?.id) return;
    dataProvider.getList("gig_members", {
      filter: { gig_id: record.id },
      sort: { field: "created_at", order: "ASC" },
      pagination: { page: 1, perPage: 50 },
    }).then(({ data }) => setMembers(data));

    dataProvider.getList("sales", {
      filter: { "disabled@neq": true },
      sort: { field: "last_name", order: "ASC" },
      pagination: { page: 1, perPage: 100 },
    }).then(({ data }) => setAllSales(data));
  }, [record?.id]);

  const addMember = async () => {
    if (!selectedSale) return;
    const { data } = await dataProvider.create("gig_members", {
      data: { gig_id: record.id, sales_id: selectedSale, confirmed: false },
    });
    setMembers(m => [...m, data]);
    setSelectedSale("");
  };

  const toggleConfirmed = async (member: GigMember) => {
    await dataProvider.update("gig_members", {
      id: member.id,
      data: { confirmed: !member.confirmed },
      previousData: member,
    });
    setMembers(m => m.map(x => x.id === member.id ? { ...x, confirmed: !x.confirmed } : x));
  };

  const removeMember = async (id: string) => {
    await dataProvider.delete("gig_members", { id, previousData: {} });
    setMembers(m => m.filter(x => x.id !== id));
  };

  const unassigned = allSales.filter(s => !members.some(m => m.sales_id === s.id));

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-semibold text-sm">Band Members on this Gig</h3>
      {members.map(m => (
        <div key={m.id} className="flex items-center gap-2">
          <button onClick={() => toggleConfirmed(m)}>
            <CheckCircleIcon
              size={16}
              className={m.confirmed ? "text-green-500" : "text-muted-foreground"}
            />
          </button>
          <span className="flex-1 text-sm">{m.sales_name ?? m.sales_id}</span>
          {m.role && <Badge variant="outline">{m.role}</Badge>}
          <button
            onClick={() => removeMember(m.id)}
            className="text-xs text-muted-foreground hover:text-destructive"
          >
            ✕
          </button>
        </div>
      ))}
      {unassigned.length > 0 && (
        <div className="flex gap-2 mt-1">
          <Select value={selectedSale} onValueChange={setSelectedSale}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Add band member…" />
            </SelectTrigger>
            <SelectContent>
              {unassigned.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  {s.first_name} {s.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={addMember} disabled={!selectedSale}>
            <UserPlusIcon size={14} />
          </Button>
        </div>
      )}
    </div>
  );
};
```

### 5.5 Quote Generation

```tsx
// src/components/atomic-crm/gigs/GigQuoteButton.tsx
import { useState } from "react";
import { useDataProvider, useRecordContext, useNotify } from "react-admin";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FileTextIcon, SendIcon } from "lucide-react";

// Handlebars-style template rendering (simple implementation)
const renderTemplate = (html: string, data: Record<string, any>) =>
  html.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? "");

export const GigQuoteButton = () => {
  const record = useRecordContext();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const [open, setOpen] = useState(false);
  const [html, setHtml] = useState("");

  const generate = async () => {
    const { data: templates } = await dataProvider.getList("quote_templates", {
      filter: { is_default: true },
      sort: { field: "created_at", order: "DESC" },
      pagination: { page: 1, perPage: 1 },
    });
    const tpl = templates[0];
    if (!tpl) { notify("No default quote template found", { type: "error" }); return; }

    const rendered = renderTemplate(tpl.body_html, {
      venue_name: record.venue_name ?? "Venue TBC",
      company_name: record.company_name ?? "Company TBC",
      performance_date: record.performance_date
        ? new Date(record.performance_date).toLocaleDateString("en-GB", { dateStyle: "long" })
        : "Date TBC",
      fee: record.fee ? `£${Number(record.fee).toFixed(2)}` : "TBC",
      deposit: record.deposit ? `£${Number(record.deposit).toFixed(2)}` : "TBC",
      gig_name: record.name,
      start_time: record.start_time ?? "TBC",
      end_time: record.end_time ?? "TBC",
    });

    setHtml(rendered);
    setOpen(true);
  };

  const save = async () => {
    await dataProvider.create("gig_quotes", {
      data: { gig_id: record.id, rendered_html: html, version: 1 },
    });
    await dataProvider.update("deals", {
      id: record.id,
      data: { stage: "quoted", quote_sent_at: new Date().toISOString() },
      previousData: record,
    });
    notify("Quote saved and gig moved to Quoted", { type: "success" });
    setOpen(false);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={generate}>
        <FileTextIcon size={14} className="mr-1" /> Generate Quote
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Quote Preview</DialogTitle></DialogHeader>
          <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}><SendIcon size={14} className="mr-1" /> Save & Mark Quoted</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
```

### 5.6 Invoice Generation

```tsx
// src/components/atomic-crm/gigs/GigInvoiceButton.tsx
// Similar pattern to GigQuoteButton — generates invoice HTML from gig data
// Key fields included: gig name, date, venue, fee breakdown, deposit deducted,
// balance due, band member list, invoice number (gig id short), payment terms

import { useState } from "react";
import { useRecordContext, useDataProvider, useNotify } from "react-admin";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ReceiptIcon, PrinterIcon } from "lucide-react";

const buildInvoiceHtml = (record: any, members: any[]) => `
  <div style="font-family: sans-serif; max-width: 700px; margin: 0 auto; padding: 32px;">
    <h1 style="font-size: 28px; margin-bottom: 4px;">Invoice</h1>
    <p style="color: #666;"># INV-${record.id?.substring(0, 8).toUpperCase()}</p>
    <hr/>
    <h2 style="font-size: 18px;">${record.name}</h2>
    <p><strong>Client:</strong> ${record.company_name ?? '–'}</p>
    <p><strong>Venue:</strong> ${record.venue_name ?? '–'}</p>
    <p><strong>Date:</strong> ${record.performance_date
      ? new Date(record.performance_date).toLocaleDateString('en-GB', { dateStyle: 'long' })
      : '–'}</p>
    <p><strong>Time:</strong> ${record.start_time ?? '–'} – ${record.end_time ?? '–'}</p>
    <hr/>
    <table style="width:100%; border-collapse: collapse;">
      <tr><td style="padding:8px 0;">Performance Fee</td>
          <td style="text-align:right;">£${Number(record.fee ?? 0).toFixed(2)}</td></tr>
      <tr><td style="padding:8px 0;">Travel Expenses</td>
          <td style="text-align:right;">£${Number(record.travel_expenses ?? 0).toFixed(2)}</td></tr>
      <tr style="border-top: 1px solid #ddd;">
        <td style="padding:8px 0;"><strong>Total</strong></td>
        <td style="text-align:right;"><strong>£${(Number(record.fee ?? 0) + Number(record.travel_expenses ?? 0)).toFixed(2)}</strong></td>
      </tr>
      ${record.deposit ? `<tr><td style="padding:8px 0; color:#666;">Less Deposit Received</td>
        <td style="text-align:right; color:#666;">–£${Number(record.deposit).toFixed(2)}</td></tr>` : ''}
      <tr style="border-top: 2px solid #333;">
        <td style="padding:8px 0;"><strong>Balance Due</strong></td>
        <td style="text-align:right;"><strong>£${Math.max(0,
          Number(record.fee ?? 0) + Number(record.travel_expenses ?? 0) - (record.deposit_paid ? Number(record.deposit ?? 0) : 0)
        ).toFixed(2)}</strong></td>
      </tr>
    </table>
    <hr/>
    <p style="color:#666; font-size:13px;">Payment due within 30 days of invoice date.</p>
  </div>
`;

export const GigInvoiceButton = () => {
  const record = useRecordContext();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const [open, setOpen] = useState(false);
  const [html, setHtml] = useState("");

  const generate = async () => {
    const { data: members } = await dataProvider.getList("gig_members", {
      filter: { gig_id: record.id },
      sort: { field: "created_at", order: "ASC" },
      pagination: { page: 1, perPage: 50 },
    });
    setHtml(buildInvoiceHtml(record, members));
    setOpen(true);
  };

  const print = () => {
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.print(); }
  };

  const markSent = async () => {
    await dataProvider.update("deals", {
      id: record.id,
      data: { invoice_sent_at: new Date().toISOString() },
      previousData: record,
    });
    notify("Invoice marked as sent", { type: "success" });
    setOpen(false);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={generate}>
        <ReceiptIcon size={14} className="mr-1" /> Generate Invoice
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Invoice Preview</DialogTitle></DialogHeader>
          <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
          <DialogFooter>
            <Button variant="ghost" onClick={print}><PrinterIcon size={14} className="mr-1" /> Print</Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={markSent}>Mark as Sent</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
```

---

## 6. Deal/Gig Pipeline Stages

Customise the Kanban stages in `App.tsx` (shown in §5.1). The CRM's deal stage flow maps to:

```
Enquiry → Quoted → Won → Confirmed → Completed → (Lost)
```

- **Enquiry**: Initial contact / booking enquiry received
- **Quoted**: Quote sent to client
- **Won**: Client accepted quote
- **Confirmed**: Deposit received, gig confirmed
- **Completed**: Gig played, invoice sent
- **Lost**: Enquiry didn't convert

---

## 7. Navigation & Menu

Update the sidebar navigation in `src/components/atomic-crm/root/CRM.tsx` (or the navigation config file) to include:

| Menu Item | Icon | Route |
|---|---|---|
| Dashboard | LayoutDashboard | / |
| Gigs | Music2 | /deals |
| Contacts | Users | /contacts |
| Companies | Building | /companies |
| **Venues** | Building2 | **/venues** |
| **Songbook** | Music | /songs |
| **Quote Templates** | FileText | /quote_templates |
| Band Members | UserCircle | /sales |
| Settings | Settings | /settings |

---

## 8. Gig Detail Page Layout

The `GigShow.tsx` / `GigAside.tsx` should display:

**Main panel:**
- Gig name
- Company (hiring entity) - linked
- Venue (performance location) - linked
- Date/time
- Stage badge (Enquiry / Quoted / Won etc.)
- Fee, deposit, travel expenses
- Activity timeline (from Atomic CRM core)
- Notes

**Sidebar / Aside:**
- **Band Members** panel (`<GigMembers />`)
- **Set Lists** panel (`<GigSetLists />`)
  - Tab per set (Set 1, Set 2, etc.)
  - Drag-and-drop `<SetListBuilder />`
- **Actions**:
  - `<GigQuoteButton />`
  - `<GigInvoiceButton />`
  - Stage progression buttons

---

## 9. Quote Template Variables

Use `{{handlebars}}` style variables in template HTML. Supported merge fields:

| Variable | Description |
|---|---|
| `{{gig_name}}` | Name of the gig/booking |
| `{{company_name}}` | Hiring company name |
| `{{venue_name}}` | Venue name (performance location) |
| `{{venue_city}}` | Venue city |
| `{{venue_address}}` | Venue address |
| `{{performance_date}}` | Formatted date |
| `{{start_time}}` | Start time |
| `{{end_time}}` | End time |
| `{{fee}}` | Total fee (formatted) |
| `{{deposit}}` | Deposit amount |
| `{{set_count}}` | Number of sets |
| `{{contact_name}}` | Primary contact name |

---

## 10. Dependencies to Install

```bash
# Drag and drop (set list builder)
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities

# Rich text editor for quote templates (optional)
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit
```

---

## 11. Implementation Checklist

### Database (Supabase)
- [ ] Run migration: **`venues` table** (NEW)
- [ ] Run migration: `gig_members` table
- [ ] Run migration: `songs` table
- [ ] Run migration: `set_lists` + `set_list_songs` tables
- [ ] Run migration: `quote_templates` + `gig_quotes` tables
- [ ] Extend `deals` table with gig-specific columns (including `venue_id` FK)
- [ ] Update `deals_summary` view to join venues table
- [ ] Create default quote template (seed data)

### TypeScript
- [ ] Add **Venue** type to `types.ts` (NEW)
- [ ] Add Song, SetList, GigMember, QuoteTemplate types to `types.ts`
- [ ] Extend Deal type with Gig fields (including `venue_id`)

### Frontend — Venues (NEW)
- [ ] VenueList with search, filter by city
- [ ] VenueCreate / VenueEdit forms
- [ ] VenueShow detail view with gig history
- [ ] AutocompleteVenueInput for gig forms
- [ ] VenueAside with venue details

### Frontend — Gigs
- [ ] Update App.tsx with renamed deal labels and stages
- [ ] Extend GigInputs with **company selector** (hiring entity) + **venue selector** + date/time, fee fields
- [ ] Build GigAside with members + set list sections
- [ ] Wire up GigQuoteButton (with company + venue variables)
- [ ] Wire up GigInvoiceButton (with company + venue display)

### Frontend — Songbook
- [ ] SongList with search, filter by genre/key
- [ ] SongCreate / SongEdit forms
- [ ] Song detail view

### Frontend — Set Lists
- [ ] SetListBuilder with @dnd-kit drag-and-drop
- [ ] SetListSongItem draggable row
- [ ] SongPickerDialog (searchable list from songbook)
- [ ] GigSetLists (tabs per set, add/remove sets)
- [ ] Persist order changes to Supabase in real-time

### Frontend — Quotes & Invoices
- [ ] QuoteTemplateList + editor (with merge field hints including company + venue)
- [ ] GigQuoteButton — preview + save + advance stage
- [ ] GigInvoiceButton — preview + print/PDF

### Testing
- [ ] Unit tests for template rendering helper
- [ ] Unit tests for drag-and-drop reorder logic

### FakeRest Provider Updates (for demo mode)
- [ ] Add venues data generator
- [ ] Update deals generator to include venue_id references
- [ ] Emulate deals_summary view with venue joins
