import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { parseIcsEvents } from "./parseIcsEvents.ts";

// Client + Session Operations cadence correction: the real observed
// title variance on Leif's own "Year Planning" calendar (confirmed by
// inspecting it directly before writing this) is "1:1s", "1:1 week",
// "1:1", and "1:1s add" — never a single exact string.
//
// CANONICAL CONVENTION (confirmed with Leif): all four historical
// variants mean the exact same thing — "Leif was open for 1:1 client
// sessions during that week." Going forward, Leif will consistently
// title every new one of these events exactly "1:1s" — that is the one
// canonical spelling for any NEW event. The leading-"1:1" match below is
// kept permanently (not narrowed to an exact "1:1s" check) specifically
// so every existing historical event keeps counting without requiring
// Leif to go back and rename his own calendar history — while still
// correctly excluding this same calendar's other real events ("Th
// Group", "4 Corners", "Personal Group", "Groups").
export const isExpectedWindowTitle = (title: string): boolean =>
  /^1:1/i.test(title.trim());

export type SyncResult = {
  upserted: number;
  softDeleted: number;
  skippedRecurring: number;
  skippedNotAllDay: number;
};

// Read-only ingestion: pulls the ICS feed text (already fetched by the
// caller — see index.ts), upserts every "1:1"-titled all-day event into
// expected_session_windows by (calendar, event id), and soft-deletes any
// previously-synced window for this calendar that no longer appears in
// the feed (Leif deleted/moved it in Google Calendar). Never writes back
// to the calendar itself.
export const syncExpectedSessionWindows = async ({
  icsText,
  offerId,
  calendarId,
}: {
  icsText: string;
  offerId: number;
  calendarId: string;
}): Promise<SyncResult> => {
  const events = parseIcsEvents(icsText);
  let upserted = 0;
  let skippedRecurring = 0;
  let skippedNotAllDay = 0;
  const seenEventIds = new Set<string>();

  for (const event of events) {
    if (!isExpectedWindowTitle(event.summary)) continue;
    if (event.hasRecurrenceRule) {
      skippedRecurring++;
      continue;
    }
    if (!event.startDate || !event.endDate) {
      skippedNotAllDay++;
      continue;
    }
    seenEventIds.add(event.uid);

    const { data: existing } = await supabaseAdmin
      .from("expected_session_windows")
      .select("id")
      .eq("external_calendar_id", calendarId)
      .eq("external_event_id", event.uid)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin
        .from("expected_session_windows")
        .update({
          raw_title: event.summary,
          window_start: event.startDate,
          window_end: event.endDate,
          deleted_at: null,
          synced_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabaseAdmin.from("expected_session_windows").insert({
        offer_id: offerId,
        external_calendar_id: calendarId,
        external_event_id: event.uid,
        raw_title: event.summary,
        window_start: event.startDate,
        window_end: event.endDate,
        synced_at: new Date().toISOString(),
      });
    }
    upserted++;
  }

  const { data: existingRows } = await supabaseAdmin
    .from("expected_session_windows")
    .select("id, external_event_id")
    .eq("external_calendar_id", calendarId)
    .is("deleted_at", null);

  let softDeleted = 0;
  for (const row of existingRows ?? []) {
    if (!seenEventIds.has(row.external_event_id)) {
      await supabaseAdmin
        .from("expected_session_windows")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", row.id);
      softDeleted++;
    }
  }

  return { upserted, softDeleted, skippedRecurring, skippedNotAllDay };
};
