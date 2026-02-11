import type { ComponentType } from "react";
import { Mars, Venus, NonBinary, User, CircleOff } from "lucide-react";

export const genderIconRegistry: Record<
  string,
  ComponentType<{ className?: string }>
> = {
  Mars,
  Venus,
  NonBinary,
  User,
  CircleOff,
};
