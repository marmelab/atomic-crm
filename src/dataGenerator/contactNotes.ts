import { faker } from "@faker-js/faker";

import { Db } from './types';
import { ContactNote } from '../types';
import { randomDate } from './utils';

const type = ['Email', 'Call', 'Call', 'Call', 'Call', 'Meeting', 'Reminder'];
const status = ['cold', 'cold', 'cold', 'warm', 'warm', 'hot', 'in-contract'];

export const generateContactNotes = (db: Db): ContactNote[] => {
    return Array.from(Array(1200).keys()).map(id => {
        const contact = faker.helpers.arrayElement(db.contacts);
        const date = randomDate(new Date(contact.first_seen)).toISOString();
        contact.nb_notes++;
        contact.last_seen = date > contact.last_seen ? date : contact.last_seen;
        return {
					id,
					contact_id: contact.id,
					type: faker.helpers.arrayElement(type),
					text: faker.lorem.paragraphs(
						faker.number.int({ min: 1, max: 4 })
					),
					date,
					sales_id: contact.sales_id,
					status: faker.helpers.arrayElement(status),
				};
    });
};
