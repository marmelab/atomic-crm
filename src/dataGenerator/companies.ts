import { faker } from "@faker-js/faker";

import { randomDate } from './utils';

import { Db } from './types';
import { Company } from '../types';

const sectors = [
    'Communication Services',
    'Consumer Discretionary',
    'Consumer Staples',
    'Energy',
    'Financials',
    'Health Care',
    'Industrials',
    'Information Technology',
    'Materials',
    'Real Estate',
    'Utilities',
];

const sizes = [1, 10, 50, 250, 500];

const regex = /\W+/;

export const generateCompanies = (db: Db): Company[] => {
    return Array.from(Array(55).keys()).map(id => {
        const name = faker.company.name();
        return {
					id,
					name: name,
					logo: `./logos/${id}.png`,
					sector: faker.helpers.arrayElement(sectors),
					size: faker.helpers.arrayElement(sizes) as 1 | 10 | 50 | 250 | 500,
					linkedIn: `https://www.linkedin.com/company/${name
						.toLowerCase()
						.replace(regex, "_")}`,
					website: faker.internet.url(),
					phone_number: faker.phone.number(),
					address: faker.location.streetAddress(),
					zipcode: faker.location.zipCode(),
					city: faker.location.city(),
					stateAbbr: faker.location.state({ abbreviated: true }),
					nb_contacts: 0,
					nb_deals: 0,
					// at least 1/3rd of companies for Jane Doe
					sales_id:
						faker.number.int(2) === 0
							? 0
							: faker.helpers.arrayElement(db.sales).id,
					created_at: randomDate().toISOString(),
				};
    });
};
