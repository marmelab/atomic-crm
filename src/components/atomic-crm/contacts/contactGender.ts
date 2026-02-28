import { Mars, NonBinary, Venus } from "lucide-react";

import type { ContactGender } from "../types";

export const contactGender: ContactGender[] = [
  { value: "male", label: "On/Jego", icon: Mars },
  { value: "female", label: "Ona/Jej", icon: Venus },
  { value: "nonbinary", label: "Oni/Ich", icon: NonBinary },
];
