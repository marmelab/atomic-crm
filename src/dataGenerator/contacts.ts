import { faker } from "@faker-js/faker";

import { randomDate, weightedBoolean } from "./utils";
import { Db } from "./types";
import { Contact } from "../types";

const genders = ["male", "female"];
const status = ["cold", "cold", "cold", "warm", "warm", "hot", "in-contract"];
const maxContacts = {
	1: 1,
	10: 4,
	50: 12,
	250: 25,
	500: 50,
};

export const generateContacts = (db: Db): Contact[] => {
	const nbAvailblePictures = 223;
	let numberOfContacts = 0;

	return Array.from(Array(500).keys()).map((id) => {
		const has_avatar =
			weightedBoolean(25) && numberOfContacts < nbAvailblePictures;
		const gender = faker.helpers.arrayElement(genders);
		const first_name = faker.person.firstName(gender as any);
		const last_name = faker.person.lastName();
		const email = faker.internet.email({
			firstName: first_name,
			lastName: last_name,
		});
		const avatar = has_avatar
			? "https://marmelab.com/posters/avatar-" +
			  (223 - numberOfContacts) +
			  ".jpeg"
			: undefined;
		const title = faker.company.buzzAdjective();

		if (has_avatar) {
			numberOfContacts++;
		}

		// choose company with people left to know
		let company;
		do {
			company = faker.helpers.arrayElement(db.companies);
		} while (company.nb_contacts >= maxContacts[company.size]);
		company.nb_contacts++;

		const first_seen = randomDate(new Date(company.created_at)).toISOString();
		const last_seen = first_seen;

		return {
			id,
			first_name,
			last_name,
			gender,
			title: title.charAt(0).toUpperCase() + title.substr(1),
			company_id: company.id,
			email,
			phone_number1: faker.phone.number(),
			phone_number2: faker.phone.number(),
			background: faker.lorem.sentence(),
			acquisition: faker.helpers.arrayElement(["inbound", "outbound"]),
			avatar,
			first_seen: first_seen,
			last_seen: last_seen,
			has_newsletter: weightedBoolean(30),
			status: faker.helpers.arrayElement(status),
			tags: faker.helpers
				.arrayElements(db.tags, faker.helpers.arrayElement([0, 0, 0, 1, 1, 2]))
				.map((tag) => tag.id), // finalize
			sales_id: company.sales_id,
			nb_notes: 0,
		};
	});
};
