import { useMemo } from "react";
import {
  NumberInput,
  type NumberInputProps,
} from "@/components/admin/number-input";

import { fromMinor, getMinorDigits, toMinor } from "./money";

interface MoneyInputProps extends Omit<NumberInputProps, "parse" | "format"> {
  currency: string;
}

/**
 * Edits an amount stored in minor units (kopecks) while people type whole
 * currency units with decimals (hryvnias).
 *
 * NumberInput parses twice: once itself, from the typed text, then react-hook
 * form's useInput parses the result again before storing it. The text becomes
 * a number of hryvnias; only the second pass, which receives a number, turns
 * it into kopecks.
 */
export const MoneyInput = ({ currency, ...props }: MoneyInputProps) => {
  const step = useMemo(() => 10 ** -getMinorDigits(currency), [currency]);

  const parse = (value: string | number | null) => {
    if (value == null || value === "") return null;
    if (typeof value === "number") return toMinor(value, currency);
    const major = parseFloat(value);
    return isNaN(major) ? 0 : major;
  };

  const format = (value: number | null | undefined) =>
    value == null ? value : fromMinor(value, currency);

  return (
    <NumberInput
      {...props}
      step={step}
      min={0}
      parse={parse as NumberInputProps["parse"]}
      format={format}
    />
  );
};
