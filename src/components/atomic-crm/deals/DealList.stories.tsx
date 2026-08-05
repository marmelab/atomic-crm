import type { Meta } from "@storybook/react-vite";
import { ResourceContextProvider } from "ra-core";

import type { Deal } from "../types";
import DealList from "./DealList";

import { StoryWrapper, buildCompany, buildSale } from "@/test/StoryWrapper";

const meta = {
  title: "Atomic CRM/Deals/Deal List",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

const buildDeal = (overrides: Partial<Deal> = {}): Deal => ({
  amount: 1000,
  archived_at: undefined,
  category: "Other",
  company_id: 1,
  contact_ids: [],
  created_at: "2025-01-01T09:00:00.000Z",
  description: "",
  expected_closing_date: "2025-02-01T09:00:00.000Z",
  id: 1,
  index: 0,
  name: "Acme deal",
  sales_id: 0,
  stage: "opportunity",
  updated_at: "2025-01-01T09:00:00.000Z",
  ...overrides,
});

const dataForAccountManagerFilter = {
  companies: [buildCompany()],
  deals: [buildDeal()],
  sales: [
    buildSale({ administrator: true, first_name: "Jane", id: 0 }),
    buildSale({
      administrator: false,
      email: "mariecurie@atomic.dev",
      first_name: "Marie",
      id: 1,
      last_name: "Curie",
      user_id: "1",
    }),
  ],
};

export const AdminAccountManagerFilter = () => (
  <StoryWrapper data={dataForAccountManagerFilter}>
    <ResourceContextProvider value="deals">
      <DealList />
    </ResourceContextProvider>
  </StoryWrapper>
);

export const NonAdminAccountManagerFilter = () => (
  <StoryWrapper
    authProvider={{
      canAccess: async ({ resource }) => resource !== "sales",
    }}
    data={dataForAccountManagerFilter}
  >
    <ResourceContextProvider value="deals">
      <DealList />
    </ResourceContextProvider>
  </StoryWrapper>
);
