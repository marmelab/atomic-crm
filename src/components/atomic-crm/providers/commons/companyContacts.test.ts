import { describe, expect, it } from "vitest";

import type { Db } from "../fakerest/dataGenerator/types";
import { createDataProvider } from "../fakerest/dataProvider";
import type { Contact } from "../../types";

const buildDataProvider = () =>
  createDataProvider({
    db: {
      companies: [{ id: 1, name: "Old Co", nb_contacts: 1 }],
      contacts: [
        {
          id: 1,
          first_name: "Ann",
          last_name: "Lee",
          company_id: 1,
          email_jsonb: [
            { email: "ann@old.example", type: "Home" },
            { email: "ann2@old.example", type: "Work" },
          ],
          phone_jsonb: [],
        },
        {
          id: 2,
          first_name: "Bob",
          last_name: "Ray",
          company_id: null,
          email_jsonb: [],
          phone_jsonb: [],
        },
      ],
    } as unknown as Db,
    latency: 0,
    silent: true,
  });

type TestDataProvider = ReturnType<typeof buildDataProvider>;

const contactsOf = async (dataProvider: TestDataProvider, companyId: number) =>
  (
    await dataProvider.getList<Contact>("contacts", {
      filter: { company_id: companyId },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "id", order: "ASC" },
    })
  ).data;

describe("company saved with its contact list", () => {
  it("saves a company without contacts", async () => {
    const dataProvider = buildDataProvider();

    const { data: company } = await dataProvider.create("companies", {
      data: { name: "Toy Hub", contacts: [] },
    });

    expect(company.name).toBe("Toy Hub");
    expect(await contactsOf(dataProvider, company.id)).toEqual([]);
  });

  it("creates new contacts and reuses existing ones, linked to the new company", async () => {
    const dataProvider = buildDataProvider();

    const { data: company } = await dataProvider.create("companies", {
      data: {
        name: "Toy Hub",
        contacts: [
          { id: 2, first_name: "Bob", last_name: "Ray" },
          {
            first_name: " Cara ",
            last_name: "Diaz",
            mobile: "+91 98765 43210",
            whatsapp_number: "+91 90000 00000",
            email: "Cara@Toys.example",
            is_primary: true,
          },
          { first_name: "Dev", last_name: "Iyer" },
        ],
      },
    });

    const contacts = await contactsOf(dataProvider, company.id);
    expect(contacts.map((c) => c.first_name)).toEqual(["Bob", "Cara", "Dev"]);
    expect(contacts[0].id).toBe(2);
    expect(contacts[1]).toMatchObject({
      is_primary: true,
      whatsapp_number: "+91 90000 00000",
      email_jsonb: [{ email: "cara@toys.example", type: "Work" }],
      phone_jsonb: [{ number: "+91 98765 43210", type: "Work" }],
    });
    const { total } = await dataProvider.getList("contacts", {
      filter: {},
      pagination: { page: 1, perPage: 100 },
      sort: { field: "id", order: "ASC" },
    });
    expect(total).toBe(4);
  });

  it("updates an existing contact's first email only, keeping its other emails", async () => {
    const dataProvider = buildDataProvider();

    await dataProvider.update("companies", {
      id: 1,
      data: {
        name: "Old Co",
        contacts: [
          {
            id: 1,
            first_name: "Ann",
            last_name: "Lee-Shaw",
            email: "ann@new.example",
          },
        ],
      },
      previousData: { id: 1 },
    });

    const { data: ann } = await dataProvider.getOne<Contact>("contacts", {
      id: 1,
    });
    expect(ann.last_name).toBe("Lee-Shaw");
    expect(ann.email_jsonb).toEqual([
      { email: "ann@new.example", type: "Home" },
      { email: "ann2@old.example", type: "Work" },
    ]);
  });

  it("unlinks a removed contact without deleting it, and links it back later", async () => {
    const dataProvider = buildDataProvider();
    const update = (contacts: unknown[]) =>
      dataProvider.update("companies", {
        id: 1,
        data: { name: "Old Co", contacts },
        previousData: { id: 1 },
      });

    await update([]);

    const { data: ann } = await dataProvider.getOne<Contact>("contacts", {
      id: 1,
    });
    expect(ann.company_id).toBeNull();
    expect(await contactsOf(dataProvider, 1)).toEqual([]);

    await update([{ id: 1, first_name: "Ann", last_name: "Lee" }]);

    expect((await contactsOf(dataProvider, 1)).map((c) => c.id)).toEqual([1]);
  });

  it("moves the primary flag from one contact to another", async () => {
    const dataProvider = buildDataProvider();
    const update = (primaryId: number) =>
      dataProvider.update("companies", {
        id: 1,
        data: {
          name: "Old Co",
          contacts: [
            {
              id: 1,
              first_name: "Ann",
              last_name: "Lee",
              is_primary: primaryId === 1,
            },
            {
              id: 2,
              first_name: "Bob",
              last_name: "Ray",
              is_primary: primaryId === 2,
            },
          ],
        },
        previousData: { id: 1 },
      });

    await update(1);
    await update(2);

    const contacts = await contactsOf(dataProvider, 1);
    expect(contacts.filter((c) => c.is_primary).map((c) => c.id)).toEqual([2]);
  });

  it("refuses two primary contacts and leaves the company unsaved", async () => {
    const dataProvider = buildDataProvider();

    await expect(
      dataProvider.create("companies", {
        data: {
          name: "Toy Hub",
          contacts: [
            { first_name: "A", last_name: "A", is_primary: true },
            { first_name: "B", last_name: "B", is_primary: true },
          ],
        },
      }),
    ).rejects.toThrow("only have one primary contact");

    const { total } = await dataProvider.getList("companies", {
      filter: { name: "Toy Hub" },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(total).toBe(0);
  });

  it("refuses the same contact listed twice", async () => {
    const dataProvider = buildDataProvider();

    await expect(
      dataProvider.update("companies", {
        id: 1,
        data: {
          name: "Old Co",
          contacts: [
            { id: 2, first_name: "Bob", last_name: "Ray" },
            { id: 2, first_name: "Bob", last_name: "Ray" },
          ],
        },
        previousData: { id: 1 },
      }),
    ).rejects.toThrow("listed twice");
  });

  it("leaves contacts untouched when a company is saved without a contact list", async () => {
    const dataProvider = buildDataProvider();

    await dataProvider.update("companies", {
      id: 1,
      data: { name: "Renamed Co" },
      previousData: { id: 1 },
    });

    expect((await contactsOf(dataProvider, 1)).map((c) => c.id)).toEqual([1]);
  });
});
