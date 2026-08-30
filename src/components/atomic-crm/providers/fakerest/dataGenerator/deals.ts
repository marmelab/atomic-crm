import { datatype, lorem, random } from "faker/locale/en_US";

import { defaultDealStages } from "../../../root/defaultConfiguration";
import { LIVING_EXAMPLE_OFFER } from "../../../deals/opportunityConstants";
import type { Deal } from "../../../types";
import type { Db } from "./types";
import { randomDate, weightedBoolean } from "./utils";

// Every generated opportunity is for the one offer this proof slice models.
const activeStages = defaultDealStages
  .filter((stage) => stage.value !== "won")
  .map((stage) => stage.value);

const sources = [
  "instagram",
  "referral",
  "podcast",
  "workshop",
  "substack",
  "google",
  "other",
] as const;

const entryPaths = ["instagram_conversation", "sales_page", "other"] as const;

export const generateDeals = (db: Db): Deal[] => {
  const deals = Array.from(Array(24).keys()).map((id) => {
    const contact = random.arrayElement(db.contacts);
    // Mostly active-pipeline opportunities, with a handful already Won so
    // the "Won leaves the board but stays in the contact's history" behavior
    // has real generated data to exercise beyond the two named fixtures.
    const stage = weightedBoolean(20)
      ? "won"
      : random.arrayElement(activeStages);
    const created_at = randomDate(new Date(contact.first_seen)).toISOString();
    const expected_closing_date = randomDate(new Date(created_at))
      .toISOString()
      .split("T")[0];

    return {
      id,
      name: `${contact.first_name} ${contact.last_name} — The Living Example`,
      contact_id: contact.id,
      offer: LIVING_EXAMPLE_OFFER,
      stage,
      source: random.arrayElement(sources),
      entry_path: random.arrayElement(entryPaths),
      description: lorem.paragraphs(datatype.number({ min: 1, max: 2 })),
      amount: 4000,
      created_at,
      updated_at: randomDate(new Date(created_at)).toISOString(),
      expected_closing_date,
      sales_id: contact.sales_id!,
      index: 0,
    } as Deal;
  });
  // compute index based on stage, active stages only (won is excluded from
  // the board so its ordering doesn't matter)
  activeStages.forEach((stage) => {
    deals
      .filter((deal) => deal.stage === stage)
      .forEach((deal, index) => {
        deals[deal.id].index = index;
      });
  });
  return deals;
};
