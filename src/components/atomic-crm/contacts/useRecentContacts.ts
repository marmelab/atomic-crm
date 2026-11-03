import { useEffect } from "react";
import { useRecordContext, useStore } from "ra-core";
import type { Identifier } from "ra-core";

export const RECENT_CONTACTS_STORE_KEY = "contacts.recentlyViewed";
const MAX_RECENT_CONTACTS = 5;
export const RECENT_PERIOD = 24 * 60 * 60 * 1000; // one day

export type RecentContactView = { id: Identifier; viewedAt: number };

const NO_VIEWS: RecentContactView[] = [];

export const useRecentContacts = () => {
  const [views] = useStore<RecentContactView[]>(
    RECENT_CONTACTS_STORE_KEY,
    NO_VIEWS,
  );
  const since = Date.now() - RECENT_PERIOD;
  return views
    .filter((view) => view.viewedAt > since)
    .slice(0, MAX_RECENT_CONTACTS)
    .map((view) => view.id);
};

export const useTrackRecentContact = () => {
  const record = useRecordContext();
  const [, setViews] = useStore<RecentContactView[]>(
    RECENT_CONTACTS_STORE_KEY,
    NO_VIEWS,
  );
  const id = record?.id;

  useEffect(() => {
    if (id == null) return;
    setViews((views) => [
      { id, viewedAt: Date.now() },
      ...views
        .filter((view) => view.id !== id)
        .slice(0, MAX_RECENT_CONTACTS - 1),
    ]);
  }, [id, setViews]);
};
