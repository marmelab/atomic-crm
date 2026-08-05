import type { Meta } from "@storybook/react-vite";
import { ResourceContextProvider } from "ra-core";

import { CompanyList } from "./CompanyList";

import { StoryWrapper, buildCompany, buildSale } from "@/test/StoryWrapper";

const meta = {
  title: "Atomic CRM/Companies/Company List",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

const dataForAccountManagerFilter = {
  companies: [buildCompany()],
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
    <ResourceContextProvider value="companies">
      <CompanyList />
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
    <ResourceContextProvider value="companies">
      <CompanyList />
    </ResourceContextProvider>
  </StoryWrapper>
);
