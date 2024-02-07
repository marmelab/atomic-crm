import { faker } from "@faker-js/faker";
import { add } from "date-fns";

import { Db } from "./types";
import { Deal } from "../types";
import { randomDate } from "./utils";

const type = [
	"Other",
	"Copywriting",
	"Print project",
	"UI Design",
	"Website design",
];
const stages = [
	"opportunity",
	"proposal-sent",
	"in-negociation",
	"won",
	"lost",
	"delayed",
];
//const tags = ["new deal", "upsell", "SAV"];

export const generateDeals = (db: Db): Deal[] => {
	const deals = Array.from(Array(50).keys()).map((id) => {
		const company = faker.helpers.arrayElement(db.companies);
		company.nb_deals++;
		const contacts = faker.helpers.arrayElements(
			db.contacts.filter((contact) => contact.company_id === company.id),
			faker.number.int({ min: 1, max: 3 })
		);
		const lowercaseName = faker.lorem.words();
		const created_at = randomDate(new Date(company.created_at)).toISOString();
		return {
			id,
			name: lowercaseName[0].toUpperCase() + lowercaseName.slice(1),
			company_id: company.id,
			contact_ids: contacts.map((contact) => contact.id),
			type: faker.helpers.arrayElement(type),
			stage: faker.helpers.arrayElement(stages),
			description: faker.lorem.paragraphs(faker.number.int({ min: 1, max: 4 })),
			amount: faker.number.int(1000) * 100,
			created_at: created_at,
			updated_at: randomDate(new Date(created_at)).toISOString(),
			start_at: randomDate(
				new Date(),
				add(new Date(), { months: 6 })
			).toISOString(),
			sales_id: company.sales_id,
			index: 0,
			nb_notes: 0,
		};
	});
	// compute index based on stage
	stages.forEach((stage) => {
		deals
			.filter((deal) => deal.stage === stage)
			.forEach((deal, index) => {
				deals[deal.id].index = index;
			});
	});
	return deals;
};
