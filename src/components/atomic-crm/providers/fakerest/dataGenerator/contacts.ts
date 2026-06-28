import {
  company as fakerCompany,
  internet,
  lorem,
  name,
  phone,
  random,
} from "faker/locale/en_US";

import { defaultNoteStatuses } from "../../../root/defaultConfiguration";
import { contactGender } from "../../../contacts/contactModel";
import type { Company, Contact, OutreachStatus } from "../../../types";
import type { Db } from "./types";
import { randomDate, weightedBoolean } from "./utils";

const outreachStatusOptions: OutreachStatus[] = [
  "not_contacted",
  "not_contacted",
  "not_contacted",
  "queued",
  "emailed",
  "emailed",
  "opened",
  "replied",
  "interested",
  "meeting_booked",
  "bounced",
  "unsubscribed",
];

const campaignOptions = [
  "Texas Founders Q3",
  "Seed SaaS CTOs",
  "Energy Ops Leaders",
];

const maxContacts = {
  1: 1,
  10: 4,
  50: 12,
  250: 25,
  500: 50,
};

const getRandomContactDetailsType = () =>
  random.arrayElement(["Work", "Home", "Other"]) as "Work" | "Home" | "Other";

export const generateContacts = (db: Db, size = 500): Required<Contact>[] => {
  const nbAvailblePictures = 223;
  let numberOfContacts = 0;

  return Array.from(Array(size).keys()).map((id) => {
    const has_avatar =
      weightedBoolean(25) && numberOfContacts < nbAvailblePictures;
    const gender = random.arrayElement(contactGender).value;
    const first_name = name.firstName(gender as any);
    const last_name = name.lastName();
    const email_jsonb = [
      {
        email: internet.email(first_name, last_name),
        type: getRandomContactDetailsType(),
      },
    ];
    const phone_jsonb = [
      {
        number: phone.phoneNumber(),
        type: getRandomContactDetailsType(),
      },
      {
        number: phone.phoneNumber(),
        type: getRandomContactDetailsType(),
      },
    ];
    const avatar = {
      src: has_avatar
        ? "https://marmelab.com/posters/avatar-" +
          (223 - numberOfContacts) +
          ".jpeg"
        : undefined,
    };
    const title = fakerCompany.bsAdjective();

    if (has_avatar) {
      numberOfContacts++;
    }

    // choose company with people left to know
    let company: Company;
    do {
      company = random.arrayElement(db.companies);
    } while ((company.nb_contacts ?? 0) >= maxContacts[company.size]);
    company.nb_contacts = (company.nb_contacts ?? 0) + 1;

    const first_seen = randomDate(new Date(company.created_at)).toISOString();
    const last_seen = first_seen;

    const outreach_status = random.arrayElement(outreachStatusOptions);
    const contacted = outreach_status !== "not_contacted";
    const last_outreach_at = contacted
      ? randomDate(new Date(first_seen)).toISOString()
      : null;
    const last_emailed_at = contacted ? last_outreach_at : null;
    const instantly_campaign = contacted
      ? random.arrayElement(campaignOptions)
      : null;

    return {
      id,
      first_name,
      last_name,
      gender,
      title: title.charAt(0).toUpperCase() + title.substr(1),
      company_id: company.id,
      company_name: company.name,
      email_jsonb,
      phone_jsonb,
      background: lorem.sentence(),
      acquisition: random.arrayElement(["inbound", "outbound"]),
      avatar,
      first_seen: first_seen,
      last_seen: last_seen,
      has_newsletter: weightedBoolean(30),
      status: random.arrayElement(defaultNoteStatuses).value,
      tags: random
        .arrayElements(db.tags, random.arrayElement([0, 0, 0, 1, 1, 2]))
        .map((tag) => tag.id), // finalize
      sales_id: company.sales_id!,
      outreach_status,
      last_emailed_at,
      last_outreach_at,
      instantly_campaign,
      nb_tasks: 0,
      linkedin_url: null,
      company_website: company.website,
      company_linkedin_url: company.linkedin_url,
      company_size: company.size,
      assigned_to_user_id: company.sales_id ?? null,
      created_by_user_id: company.sales_id ?? null,
      last_updated_by_user_id: company.sales_id ?? null,
      research_status: random.arrayElement([
        "new",
        "researching",
        "enriched",
        "verified",
      ]),
      icp_score: random.number({ min: 40, max: 95 }),
      trigger_reason: lorem.sentence(),
      email_verified: weightedBoolean(70),
      ready_for_review: false,
      approved_for_instantly: false,
      reviewed_by_user_id: null,
      review_notes: null,
    };
  });
};
