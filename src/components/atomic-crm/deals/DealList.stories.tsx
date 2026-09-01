import type { Meta } from "@storybook/react-vite";
import { ResourceContextProvider } from "ra-core";

import DealList from "./DealList";

import {
  StoryWrapper,
  buildCompany,
  buildDeal,
  buildSale,
} from "@/test/StoryWrapper";

const meta = {
  title: "Atomic CRM/Deals/Deal List",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

const dataForAccountManagerFilter = {
  companies: [buildCompany()],
  deals: [
    buildDeal({ id: 1, name: "Jane deal", sales_id: 0 }),
    buildDeal({ id: 2, index: 1, name: "Marie deal", sales_id: 1 }),
  ],
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
