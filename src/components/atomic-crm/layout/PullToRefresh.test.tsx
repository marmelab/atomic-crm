import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { render } from "vitest-browser-react";

import { PullToRefresh } from "./PullToRefresh";

const touchEvent = (type: string, target: Element, clientYs: number[]) => {
  const touches = clientYs.map(
    (clientY, identifier) =>
      new Touch({ identifier, target, clientX: 0, clientY }),
  );
  return new TouchEvent(type, {
    bubbles: true,
    cancelable: true,
    touches: type === "touchend" ? [] : touches,
    changedTouches: touches,
  });
};

const pull = (target: Element, toY: number) => {
  target.dispatchEvent(touchEvent("touchstart", target, [0]));
  target.dispatchEvent(touchEvent("touchmove", target, [toY]));
};

const release = (target: Element, atY: number) => {
  target.dispatchEvent(touchEvent("touchend", target, [atY]));
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

const Fixture = ({ children }: { children?: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    <FetchCounter />
    <PullToRefresh />
    {children}
  </QueryClientProvider>
);

describe("PullToRefresh", () => {
  beforeEach(() => {
    fetchCount = 0;
  });

  it("shows the refresh indicator while the user pulls down from the top of the page", async () => {
    const screen = await render(<Fixture />);
    await expect.element(screen.getByText("fetches: 1")).toBeInTheDocument();

    pull(document.body, 200);

    await expect
      .element(screen.getByTestId("pull-to-refresh"))
      .toBeInTheDocument();
  });

  it("hides the refresh indicator again when the pull is released short of the trigger distance", async () => {
    const screen = await render(<Fixture />);
    await expect.element(screen.getByText("fetches: 1")).toBeInTheDocument();

    pull(document.body, 20);
    release(document.body, 20);

    await expect
      .element(screen.getByTestId("pull-to-refresh"))
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

  it("hides the refresh indicator and disarms the gesture when a second finger joins the pull", async () => {
    const screen = await render(<Fixture />);
    await expect.element(screen.getByText("fetches: 1")).toBeInTheDocument();

    pull(document.body, 200);
    // A second finger lands: the gesture is no longer a pull-to-refresh.
    document.body.dispatchEvent(
      touchEvent("touchstart", document.body, [200, 200]),
    );
    release(document.body, 200);

    await expect
      .element(screen.getByTestId("pull-to-refresh"))
      .not.toBeInTheDocument();
    await expect.element(screen.getByText("fetches: 1")).toBeInTheDocument();
  });

  it("scrolls instead of refreshing when the pull starts inside an already scrolled area", async () => {
    const screen = await render(
      <Fixture>
        <div
          data-testid="scroller"
          style={{ height: "50px", overflowY: "auto" }}
        >
          <div style={{ height: "500px" }}>tall content</div>
        </div>
      </Fixture>,
    );
    await expect.element(screen.getByText("fetches: 1")).toBeInTheDocument();
    const scroller = screen.getByTestId("scroller").element();
    scroller.scrollTop = 100;

    pull(scroller.firstElementChild!, 200);
    release(scroller.firstElementChild!, 200);

    await expect
      .element(screen.getByTestId("pull-to-refresh"))
      .not.toBeInTheDocument();
    await expect.element(screen.getByText("fetches: 1")).toBeInTheDocument();
  });

  it("ignores a pull started inside an overlay portalled out of the page", async () => {
    const screen = await render(
      <Fixture>
        {/* Shape of a Radix dropdown menu / select: portalled popper, own scrolling. */}
        <div data-radix-popper-content-wrapper="">
          <div role="menu" data-testid="menu">
            <div role="menuitem">Archive</div>
          </div>
        </div>
      </Fixture>,
    );
    await expect.element(screen.getByText("fetches: 1")).toBeInTheDocument();
    const menu = screen.getByTestId("menu").element();

    pull(menu, 200);
    release(menu, 200);

    await expect
      .element(screen.getByTestId("pull-to-refresh"))
      .not.toBeInTheDocument();
    await expect.element(screen.getByText("fetches: 1")).toBeInTheDocument();
  });
});
