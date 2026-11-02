import { renderHook } from "vitest-browser-react";
import { CoreAdminContext, type DataProvider } from "ra-core";
import fakeRestDataProvider from "ra-data-fakerest";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import type { Contact } from "../types";
import { COMPANY_DRAFT_SOURCE, useTypedCompany } from "./useTypedCompany";

const contact = {
  first_name: "Jane",
  last_name: "Doe",
} as Contact;

const setup = async (companies: { id: number; name: string }[] = []) => {
  const dataProvider: DataProvider = fakeRestDataProvider({ companies });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <CoreAdminContext dataProvider={dataProvider}>{children}</CoreAdminContext>
  );
  const { result } = await renderHook(() => useTypedCompany(), { wrapper });
  return { transform: result.current, dataProvider };
};

const listCompanies = async (dataProvider: DataProvider) =>
  (
    await dataProvider.getList("companies", {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "id", order: "ASC" },
      filter: {},
    })
  ).data;

describe("useTypedCompany", () => {
  it("creates the typed company and links the contact to it", async () => {
    const { transform, dataProvider } = await setup();

    const result = await transform({
      ...contact,
      [COMPANY_DRAFT_SOURCE]: "  Acme  ",
    });

    const companies = await listCompanies(dataProvider);
    expect(companies).toMatchObject([{ name: "Acme" }]);
    expect(result.company_id).toBe(companies[0].id);
    expect(result).not.toHaveProperty(COMPANY_DRAFT_SOURCE);
  });

  it("links an existing company with the same name instead of duplicating it", async () => {
    const { transform, dataProvider } = await setup([{ id: 7, name: "Acme" }]);

    const result = await transform({
      ...contact,
      [COMPANY_DRAFT_SOURCE]: "acme",
    });

    expect(result.company_id).toBe(7);
    expect(await listCompanies(dataProvider)).toHaveLength(1);
  });

  it("keeps the picked company and ignores the typed text", async () => {
    const { transform, dataProvider } = await setup([{ id: 7, name: "Acme" }]);

    const result = await transform({
      ...contact,
      company_id: 7,
      [COMPANY_DRAFT_SOURCE]: "Other",
    });

    expect(result.company_id).toBe(7);
    expect(await listCompanies(dataProvider)).toHaveLength(1);
  });

  it("leaves the contact without a company when nothing was typed", async () => {
    const { transform, dataProvider } = await setup();

    const result = await transform({ ...contact, [COMPANY_DRAFT_SOURCE]: " " });

    expect(result.company_id).toBeUndefined();
    expect(await listCompanies(dataProvider)).toHaveLength(0);
  });
});
