import { Mars, NonBinary, Venus } from "lucide-react";

import type { ContactGender } from "../types";

export const contactGenderDefaultLabels: Record<string, string> = {
  male: "He/Him",
  female: "She/Her",
  nonbinary: "They/Them",
};

export const contactGender: ContactGender[] = [
  { value: "male", label: "crm.contacts.inputs.genders.male", icon: Mars },
  { value: "female", label: "crm.contacts.inputs.genders.female", icon: Venus },
  {
    value: "nonbinary",
    label: "crm.contacts.inputs.genders.nonbinary",
    icon: NonBinary,
  },
];
