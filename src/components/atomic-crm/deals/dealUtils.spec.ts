import { formatISODateString } from "./dealUtils";

describe("formatISODateString", () => {
  it("formats a valid ISO date string correctly", () => {
    const isoDate = "2024-06-15";
    const formattedDate = formatISODateString(isoDate);
    expect(formattedDate).toBe("Jun 15, 2024");
  });

  it("should not shift the date for different timezone", () => {
    const originalTZ = process.env.TZ;
    process.env.TZ = "America/New_York";
    const isoDate = "2024-06-15";
    expect(formatISODateString(isoDate)).toBe("Jun 15, 2024");
    process.env.TZ = "Asia/Tokyo";
    expect(formatISODateString(isoDate)).toBe("Jun 15, 2024");
    process.env.TZ = "UTC";
    expect(formatISODateString(isoDate)).toBe("Jun 15, 2024");
    process.env.TZ = originalTZ; // Reset timezone after test
  });

  it("throw for an invalid date string", () => {
    const invalidDate = "invalid-date";
    expect(() => formatISODateString(invalidDate)).toThrow(
      "Invalid date format. Expected YYYY-MM-DD.",
    );
  });

  it("throw for a date string with wrong format", () => {
    const invalidDate = "15-06-2024";
    expect(() => formatISODateString(invalidDate)).toThrow(
      "Invalid date format. Expected YYYY-MM-DD.",
    );
  });
});
