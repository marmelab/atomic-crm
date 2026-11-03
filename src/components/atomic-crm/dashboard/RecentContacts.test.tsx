import { useStore } from "ra-core";
import { useEffect } from "react";
import { render } from "vitest-browser-react";
import { buildContact, StoryWrapper } from "@/test/StoryWrapper";
import { ContactShow } from "../contacts/ContactShow";
import {
  RECENT_CONTACTS_STORE_KEY,
  RECENT_PERIOD,
  type RecentContactView,
} from "../contacts/useRecentContacts";
import { RecentContacts } from "./RecentContacts";

const SeedViews = ({ views }: { views: RecentContactView[] }) => {
  const [, setViews] = useStore<RecentContactView[]>(RECENT_CONTACTS_STORE_KEY);
  useEffect(() => setViews(views), [views, setViews]);
  return null;
};

describe("RecentContacts", () => {
  it("renders nothing until a contact has been viewed", async () => {
    const screen = await render(
      <StoryWrapper data={{ contacts: [buildContact({ id: 1 })] }}>
        <RecentContacts />
      </StoryWrapper>,
    );

    await expect
      .element(screen.getByRole("heading", { name: "Recently Viewed" }))
      .not.toBeInTheDocument();
  });

  it("links to the contacts viewed on this device, latest first", async () => {
    const screen = await render(
      <StoryWrapper
        data={{
          contacts: [
            buildContact({ id: 1, first_name: "Ada", last_name: "Lovelace" }),
            buildContact({ id: 2, first_name: "Alan", last_name: "Turing" }),
          ],
        }}
      >
        <ContactShow resource="contacts" id={1} />
        <ContactShow resource="contacts" id={2} />
        <RecentContacts />
      </StoryWrapper>,
    );

    const list = screen.getByRole("list");
    await expect
      .element(list.getByRole("link", { name: /Alan Turing/ }))
      .toHaveAttribute("href", "/contacts/2/show");
    const links = list.getByRole("link").elements();
    expect(links.map((link) => link.textContent)).toEqual([
      expect.stringContaining("Alan Turing"),
      expect.stringContaining("Ada Lovelace"),
    ]);
  });

  it("ignores contacts deleted since they were viewed", async () => {
    const screen = await render(
      <StoryWrapper
        data={{
          contacts: [
            buildContact({ id: 1, first_name: "Ada", last_name: "Lovelace" }),
          ],
        }}
      >
        <SeedViews
          views={[
            { id: 2, viewedAt: Date.now() },
            { id: 1, viewedAt: Date.now() },
          ]}
        />
        <RecentContacts />
      </StoryWrapper>,
    );

    await expect
      .element(screen.getByRole("link", { name: /Ada Lovelace/ }))
      .toHaveAttribute("href", "/contacts/1/show");
    expect(screen.getByRole("list").getByRole("link").elements()).toHaveLength(
      1,
    );
  });

  it("renders nothing when all recently viewed contacts were deleted", async () => {
    const screen = await render(
      <StoryWrapper data={{ contacts: [buildContact({ id: 1 })] }}>
        <SeedViews views={[{ id: 2, viewedAt: Date.now() }]} />
        <RecentContacts />
        <h1>Dashboard</h1>
      </StoryWrapper>,
    );

    await expect
      .element(screen.getByRole("heading", { name: "Dashboard" }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("heading", { name: "Recently Viewed" }))
      .not.toBeInTheDocument();
  });

  it("forgets contacts viewed more than 24 hours ago", async () => {
    const screen = await render(
      <StoryWrapper data={{ contacts: [buildContact({ id: 1 })] }}>
        <SeedViews
          views={[{ id: 1, viewedAt: Date.now() - RECENT_PERIOD - 1000 }]}
        />
        <RecentContacts />
      </StoryWrapper>,
    );

    await expect
      .element(screen.getByRole("heading", { name: "Recently Viewed" }))
      .not.toBeInTheDocument();
  });
});
