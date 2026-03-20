import type { Meta } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { ListContextProvider } from "ra-core";

import { NotesIteratorMobile } from "./NotesIteratorMobile";
import { StoryWrapper } from "@/test/StoryWrapper";

const singleNote = {
  contact_id: 3,
  date: "2026-03-17T13:50:00.000Z",
  id: 9,
  sales_id: 0,
  status: "warm",
  text: "Only note in the list",
};

const meta = {
  title: "Atomic CRM/Notes/NotesIteratorMobile Pagination",
  parameters: {
    layout: "fullscreen",
  },
  globals: {
    viewport: { value: "mobile1", isRotated: false },
  },
} satisfies Meta;

export default meta;

export const SingleNote = ({
  children,
  setPage = () => {},
}: {
  children?: ReactNode;
  setPage?: (...args: unknown[]) => void;
}) => {
  const listContext = {
    data: [singleNote],
    defaultTitle: undefined,
    displayedFilters: {},
    error: null,
    exporter: false,
    filterValues: {},
    hasNextPage: false,
    hasPreviousPage: false,
    hideFilter: () => {},
    isFetching: false,
    isLoading: false,
    isPaused: false,
    isPending: false,
    onSelect: () => {},
    onSelectAll: () => {},
    onToggleItem: () => {},
    onUnselectItems: () => {},
    page: 1,
    perPage: 25,
    refetch: () => {},
    resource: "contact_notes",
    selectedIds: [],
    setFilters: () => {},
    setPage,
    setPerPage: () => {},
    setSort: () => {},
    showFilter: () => {},
    sort: { field: "date", order: "DESC" },
    total: 1,
  } as any;

  return (
    <StoryWrapper data={{ contact_notes: [singleNote] }}>
      <ListContextProvider value={listContext}>
        <NotesIteratorMobile contactId={3} showStatus />
      </ListContextProvider>
      {children}
    </StoryWrapper>
  );
};
