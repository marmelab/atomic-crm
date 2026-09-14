import {
  address,
  company,
  datatype,
  internet,
  lorem,
  phone,
  random,
} from "faker/locale/en_US";

import { randomDate } from "./utils";
import { choiceLabels } from "./choices";
import type { Company, CompanySize, RAFile } from "../../../types";
import type { Db } from "./types";

const sizes = [50, 100, 250, 500, 1000];

const regex = /\W+/;

export const generateCompanies = (db: Db, size = 55): Required<Company>[] => {
  return Array.from(Array(size).keys()).map((id) => {
    const name = company.companyName();
    return {
      id,
      name: name,
      logo: {
        title: lorem.text(1),
        src: `https://marmelab.com/react-admin-crm/logos/${id}.png`,
      } as RAFile,
      sector: random.arrayElement(choiceLabels.company_sector),
      size: random.arrayElement(sizes) as CompanySize,
      nb_sites: datatype.number({ min: 1, max: 12 }),
      linkedin_url: `https://www.linkedin.com/company/${name
        .toLowerCase()
        .replace(regex, "_")}`,
      website: internet.url(),
      phone_number: phone.phoneNumber(),
      address: address.streetAddress(),
      zipcode: address.zipCode(),
      city: address.city(),
      state_abbr: address.stateAbbr(),
      nb_contacts: 0,
      nb_deals: 0,
      // at least 1/3rd of companies for Jane Doe
      sales_id: datatype.number(2) === 0 ? 0 : random.arrayElement(db.sales).id,
      created_at: randomDate().toISOString(),
      description: lorem.paragraph(),
      revenue: random.arrayElement(["$1M", "$10M", "$100M", "$1B"]),
      tax_identifier: random.alphaNumeric(10),
      country: random.arrayElement(["USA", "France", "UK"]),
      context_links: [],
    };
  });
};
