import { Db } from "./types";

const tags = [
  { id: 0, name: "football-fan", color: "#424D5B" },
  { id: 1, name: "holiday-card", color: "#535F7D" },
  { id: 2, name: "influencer", color: "#C1050D" },
  { id: 3, name: "manager", color: "#6C5B61" },
  { id: 4, name: "musician", color: "#494582" },
  { id: 5, name: "vip", color: "#765A3A" },
];

export const generateTags = (_: Db) => {
  return [...tags];
};
