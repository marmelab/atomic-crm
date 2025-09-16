import type { Db } from "./types";

const tags = [
  { id: 0, name: "football-fan", color: "#eddcd2" },
  { id: 1, name: "holiday-card", color: "#fff1e6" },
  { id: 2, name: "influencer", color: "#fde2e4" },
  { id: 3, name: "manager", color: "#fad2e1" },
  { id: 4, name: "musician", color: "#c5dedd" },
  { id: 5, name: "vip", color: "#dbe7e4" },
];

export const generateTags = (_: Db) => {
  return [...tags];
};
