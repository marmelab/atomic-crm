import {
  ResourceContextProvider,
  ShowBase,
  useDataProvider,
  type DataProvider,
} from "ra-core";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { buildContact, StoryWrapper } from "@/test/StoryWrapper";
import { ContactAside } from "./ContactAside";
import { ContactShow } from "./ContactShow";
import { MobileSuccess } from "./ContactShow.mobile.stories";

const mockIsMobile = vi.hoisted(() => vi.fn(() => true));
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: mockIsMobile,
}));

describe("ContactShow", () => {
  beforeEach(() => {
    mockIsMobile.mockReturnValue(true);
  });

  it("renders a safe zero-task label before nb_tasks is available", async () => {
    const screen = await render(<MobileSuccess />);

    await expect
      .element(screen.getByRole("tab", { name: "0 tasks" }))
      .toBeVisible();
    await expect
      .poll(
        () => screen.container.textContent?.includes("%{smart_count}") ?? false,
      )
      .toBe(false);
    await expect
      .poll(() => screen.container.textContent?.includes("||||") ?? false)
      .toBe(false);
  });

  it("updates the contact status from the aside", async () => {
    mockIsMobile.mockReturnValue(false);

    let dataProvider: DataProvider | null = null;
    const contact = buildContact({ status: "warm" });

    const DataProviderListener = () => {
      dataProvider = useDataProvider();
      return null;
    };

    const screen = await render(
      <StoryWrapper data={{ contacts: [contact] }}>
        <DataProviderListener />
        <ResourceContextProvider value="contacts">
          <ShowBase id={contact.id}>
            <ContactAside />
          </ShowBase>
        </ResourceContextProvider>
      </StoryWrapper>,
    );

    await expect
      .element(screen.getByRole("combobox"))
      .toHaveTextContent("Warm");

    await screen.getByRole("combobox").click();
    await screen.getByRole("option", { name: /hot/i }).click();

    await expect
      .poll(async () => {
        const { data } = await dataProvider!.getOne("contacts", {
          id: contact.id,
        });
        return data.status;
      })
      .toBe("hot");

    await expect.element(screen.getByRole("combobox")).toHaveTextContent("Hot");
  });

  it("hides the deals section on mobile, where deals are not available", async () => {
    mockIsMobile.mockReturnValue(true);
    const contact = buildContact();

    const screen = await render(
      <StoryWrapper data={{ contacts: [contact] }}>
        <ResourceContextProvider value="contacts">
          <ShowBase id={contact.id}>
            <ContactAside />
          </ShowBase>
        </ResourceContextProvider>
      </StoryWrapper>,
    );

    await expect
      .element(screen.getByRole("button", { name: /add task/i }))
      .toBeInTheDocument();
    expect(screen.getByRole("link", { name: /add deal/i }).query()).toBeNull();
  });

  it("creates a deal attached to the contact from the contact show screen", async () => {
    mockIsMobile.mockReturnValue(false);
    page.viewport(1600, 900);

    const createMock = vi
      .fn()
      .mockImplementation(async (_resource: string, params: any) => ({
        data: { id: 1, ...params.data },
      }));

    const screen = await render(
      <StoryWrapper
        silent
        data={{
          companies: [{ id: 1, name: "Acme" }] as any,
          contacts: [buildContact({ id: 1, company_id: 1 })],
        }}
        dataProvider={{ create: createMock }}
      >
        <ContactShow resource="contacts" id={1} />
      </StoryWrapper>,
    );

    await screen.getByRole("link", { name: /add deal/i }).click();

    // The deal form opens with the contact already attached
    await expect.element(screen.getByText("Ada Lovelace")).toBeVisible();

    await screen.getByLabelText(/^name/i).fill("Website redesign");
    await screen.getByRole("button", { name: /^save$/i }).click();

    await expect
      .poll(() => createMock.mock.calls)
      .toEqual([
        [
          "deals",
          expect.objectContaining({
            data: expect.objectContaining({
              name: "Website redesign",
              contact_ids: [1],
              company_id: 1,
            }),
          }),
        ],
      ]);
  });

  it("lists the deals the contact is attached to, ignoring the others", async () => {
    mockIsMobile.mockReturnValue(false);
    page.viewport(1600, 900);

    const screen = await render(
      <StoryWrapper
        silent
        data={{
          companies: [{ id: 1, name: "Acme" }] as any,
          contacts: [buildContact({ id: 333, company_id: 1 })],
          deals: [
            {
              id: 1,
              name: "Website redesign",
              company_id: 1,
              // The contact is one of several attached to the deal
              contact_ids: [333, 440, 370],
              stage: "opportunity",
              amount: 15000,
              index: 0,
              sales_id: 0,
              expected_closing_date: "2026-09-01",
              updated_at: "2026-07-30T10:00:00.000Z",
            },
            {
              id: 2,
              name: "Someone else's deal",
              company_id: 1,
              contact_ids: [2],
              stage: "opportunity",
              amount: 500,
              index: 1,
              sales_id: 0,
              expected_closing_date: "2026-09-01",
              updated_at: "2026-07-30T10:00:00.000Z",
            },
          ] as any,
        }}
      >
        <ContactShow resource="contacts" id={333} />
      </StoryWrapper>,
    );

    await expect
      .element(screen.getByRole("link", { name: /website redesign/i }))
      .toBeVisible();
    await expect
      .poll(
        () =>
          screen.container.textContent?.includes("Someone else's deal") ??
          false,
      )
      .toBe(false);
  });
});
