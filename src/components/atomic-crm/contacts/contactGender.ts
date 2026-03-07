import { Mars, NonBinary, Venus } from "lucide-react";

import type { ContactGender } from "../types";

export const contactGender: ContactGender[] = [
  { value: "male", label: "Homme", icon: Mars },
  { value: "female", label: "Femme", icon: Venus },
  { value: "nonbinary", label: "Autre", icon: NonBinary },
];
