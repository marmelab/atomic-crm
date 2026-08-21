import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { I18nContextProvider } from "ra-core";
import { render } from "vitest-browser-react";

import { testI18nProvider } from "../providers/commons/i18nProvider";
import { PullToRefresh } from "./PullToRefresh";

const touchEvent = (type: string, target: Element, clientY: number) => {
  const touch = new Touch({ identifier: 0, target, clientX: 0, clientY });
  return new TouchEvent(type, {
    bubbles: true,
    cancelable: true,
    touches: type === "touchend" ? [] : [touch],
    changedTouches: [touch],
  });
};

const pull = (target: Element, toY: number) => {
  target.dispatchEvent(touchEvent("touchstart", target, 0));
  target.dispatchEvent(touchEvent("touchmove", target, toY));
};

const release = (target: Element, atY: number) => {
  target.dispatchEvent(touchEvent("touchend", target, atY));
};

/** Displays how many times the query has been fetched from the server. */
const FetchCounter = () => {
  const { data } = useQuery({
    queryKey: ["fetch-count"],
    queryFn: () => ++fetchCount,
    staleTime: Infinity,
  });
  return <p>fetches: {data}</p>;
};

let fetchCount = 0;

const Fixture = () => (
  <QueryClientProvider client={new QueryClient()}>
    <I18nContextProvider value={testI18nProvider}>
      <FetchCounter />
      <PullToRefresh />
    </I18nContextProvider>
  </QueryClientProvider>
);

describe("PullToRefresh", () => {
  beforeEach(() => {
    fetchCount = 0;
  });

  it("shows a refresh button while the user pulls down from the top of the page", async () => {
    const screen = await render(<Fixture />);
    await expect.element(screen.getByText("fetches: 1")).toBeInTheDocument();

    pull(document.body, 200);

    await expect
      .element(screen.getByRole("button", { name: "Refresh" }))
      .toBeInTheDocument();
  });

  it("hides the refresh button again when the pull is released short of the trigger distance", async () => {
    const screen = await render(<Fixture />);
    await expect.element(screen.getByText("fetches: 1")).toBeInTheDocument();

    pull(document.body, 20);
    release(document.body, 20);

    await expect
      .element(screen.getByRole("button", { name: "Refresh" }))
      .not.toBeInTheDocument();
    await expect.element(screen.getByText("fetches: 1")).toBeInTheDocument();
  });

  it("refetches the data when the pull is released past the trigger distance", async () => {
    const screen = await render(<Fixture />);
    await expect.element(screen.getByText("fetches: 1")).toBeInTheDocument();

    pull(document.body, 200);
    release(document.body, 200);

    await expect.element(screen.getByText("fetches: 2")).toBeInTheDocument();
  });

  it("refetches the data when the revealed refresh button is tapped", async () => {
    const screen = await render(<Fixture />);
    await expect.element(screen.getByText("fetches: 1")).toBeInTheDocument();

    pull(document.body, 200);
    await screen.getByRole("button", { name: "Refresh" }).click();

    await expect.element(screen.getByText("fetches: 2")).toBeInTheDocument();
  });

  it("scrolls instead of refreshing when the pull starts inside an already scrolled area", async () => {
    const screen = await render(
      <>
        <Fixture />
        <div
          data-testid="scroller"
          style={{ height: "50px", overflowY: "auto" }}
        >
          <div style={{ height: "500px" }}>tall content</div>
        </div>
      </>,
    );
    await expect.element(screen.getByText("fetches: 1")).toBeInTheDocument();
    const scroller = screen.getByTestId("scroller").element();
    scroller.scrollTop = 100;

    pull(scroller.firstElementChild!, 200);
    release(scroller.firstElementChild!, 200);

    await expect
      .element(screen.getByRole("button", { name: "Refresh" }))
      .not.toBeInTheDocument();
    await expect.element(screen.getByText("fetches: 1")).toBeInTheDocument();
  });
});
