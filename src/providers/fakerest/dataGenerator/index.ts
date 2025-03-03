/* eslint-disable import/no-anonymous-default-export */
import { generateCompanies } from './companies';
import { generateContacts } from './contacts';
import { generateContactNotes } from './contactNotes';
import { generateDeals } from './deals';
import { generateDealNotes } from './dealNotes';
import { generateSales } from './sales';
import { generateTags } from './tags';
import { generateTasks } from './tasks';
import { generateCandidates } from './candidates';
import { Db } from './types';

export const generateDb = (): Db => {
    const db = {} as Db;
    db.sales = generateSales();
    db.tags = generateTags(db);
    db.companies = generateCompanies(db);
    db.contacts = generateContacts(db);
    db.contactNotes = generateContactNotes(db);
    db.deals = generateDeals(db);
    db.dealNotes = generateDealNotes(db);
    db.tasks = generateTasks(db);
    db.candidates = generateCandidates(db);
    return db;
};

export type { Db };
