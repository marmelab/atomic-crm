# Deleting `tags`

The simplest of the five: `tags` is a **field** (`number[]`) on `Contact` plus a small standalone `tags` folder. No shared subsystem, no config prop, no aggregated column.

## Frontend specifics
- Tag-only components under `contacts/` — delete outright: `TagsList.tsx`, `TagsListEdit.tsx`, `BulkTagButton.tsx`. Clean their consumers (`ContactShow`, `ContactAside`, `ContactListContent`, `ContactList`, `ContactListFilter`).
- The `contacts.tags` field lives in `contactModel.ts`, `useContactImport.tsx`, `providers/commons/mergeContacts.ts`, the FakeRest generators (`dataGenerator/contacts.ts` + `index.ts` + `types.ts`), the stories/tests (`ContactList.stories.tsx`, `ContactList.test.tsx`, `StoryWrapper.tsx`), and the sample CSVs (`contacts_export.csv`, `test-data/contacts.csv`).
- i18n: drop the `bulk_tag` block, `filters.tags`, and the `tags` resource block (both catalogs — see SKILL.md).

## Backend
- Drop the `tags` table + its grants/policies/sequence. `merge_contacts` in `02_functions.sql` merges `tags` — drop those lines + the now-unused local var, and renumber step comments.

## grep — benign matches to leave
- `tags` matches `stage` — filter it out (`grep -viE "stage"`).
