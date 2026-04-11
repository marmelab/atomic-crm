export const stageColorMap: Record<
  string,
  { border: string; bg: string; text: string }
> = {
  discovery: { border: "#4DC8E8", bg: "#E8F7FC", text: "#1A96BE" },
  "solutions-mapping": { border: "#8B5CF6", bg: "#F5F3FF", text: "#6D28D9" },
  "proposal-under-review": { border: "#F59E0B", bg: "#FFFBEB", text: "#B45309" },
  won: { border: "#22C55E", bg: "#F0FDF4", text: "#15803D" },
  lost: { border: "#EF4444", bg: "#FEF2F2", text: "#B91C1C" },
};
