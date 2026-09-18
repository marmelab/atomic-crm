import { createContext, useContext } from "react";

import type { PostSaleSetup } from "./postSaleSetup";

// What each Onboarding card is still waiting on, made available to the
// card without threading it through every column.
//
// A card in this column has to answer one question — "what is stopping this
// finishing?" — in one line. The full checklist belongs in the drawer; a
// Kanban card that tries to be a checklist stops being readable at a glance.
export const PostSaleSetupContext = createContext<
  Record<string, PostSaleSetup>
>({});

export const usePostSaleSetup = (
  dealId: string | number,
): PostSaleSetup | null =>
  useContext(PostSaleSetupContext)[String(dealId)] ?? null;
