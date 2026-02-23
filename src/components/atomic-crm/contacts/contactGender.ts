import { Mars, NonBinary, Venus } from "lucide-react";

import type { ContactGender } from "../types";

export const contactGender: ContactGender[] = [
  { value: "male", label: "He/Him", icon: Mars },
  { value: "female", label: "She/Her", icon: Venus },
  { value: "nonbinary", label: "They/Them", icon: NonBinary },
];
