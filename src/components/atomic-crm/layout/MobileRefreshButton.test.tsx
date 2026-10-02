import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { I18nContextProvider } from "ra-core";
import { render } from "vitest-browser-react";

import { testI18nProvider } from "../providers/commons/i18nProvider";
import { MobileRefreshButton } from "./MobileRefreshButton";

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
      <MobileRefreshButton />
    </I18nContextProvider>
  </QueryClientProvider>
);

describe("MobileRefreshButton", () => {
  beforeEach(() => {
    fetchCount = 0;
  });

  it("refetches the data when tapped", async () => {
    const screen = await render(<Fixture />);
    await expect.element(screen.getByText("fetches: 1")).toBeInTheDocument();

    await screen.getByRole("button", { name: "Refresh" }).click();

    await expect.element(screen.getByText("fetches: 2")).toBeInTheDocument();
  });
});
