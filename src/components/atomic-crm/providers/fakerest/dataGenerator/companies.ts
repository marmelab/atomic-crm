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
import { defaultCompanySectors } from "../../../root/defaultConfiguration";
import type { Company, RAFile } from "../../../types";
import type { Db } from "./types";

const sizes = [1, 10, 50, 250, 500];

const regex = /\W+/;
const companySizeMap: Record<(typeof sizes)[number], string> = {
  1: "1-5",
  10: "6-20",
  50: "21-50",
  250: "50+",
  500: "50+",
};
const techMaturityChoices = ["Paper", "Basic Digital", "Automated"] as const;

export const generateCompanies = (db: Db, size = 55): Required<Company>[] => {
  return Array.from(Array(size).keys()).map((id) => {
    const name = company.companyName();
    const generatedSize = random.arrayElement(sizes) as
      | 1
      | 10
      | 50
      | 250
      | 500;
    const city = address.city();
    const generatedCompany: Required<Company> = {
      id,
      name: name,
      logo: {
        title: lorem.text(1),
        src: `https://marmelab.com/react-admin-crm/logos/${id}.png`,
      } as RAFile,
      sector: random.arrayElement(defaultCompanySectors).value,
      size: generatedSize,
      linkedin_url: `https://www.linkedin.com/company/${name
        .toLowerCase()
        .replace(regex, "_")}`,
      website: internet.url(),
      phone_number: phone.phoneNumber(),
      address: address.streetAddress(),
      zipcode: address.zipCode(),
      city,
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
      trade_type_id: null,
      service_area: `${city} area`,
      company_size: companySizeMap[generatedSize],
      tech_maturity: random.arrayElement(techMaturityChoices),
      metadata: {},
    };

    return generatedCompany;
  });
};
