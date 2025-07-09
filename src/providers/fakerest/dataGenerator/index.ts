/* eslint-disable import/no-anonymous-default-export */
import { generateCompanies } from './companies';
import { generateContactNotes } from './contactNotes';
import { generateContacts } from './contacts';
import { generateEngagementNotes } from './engagementNotes';
import { generateEngagements } from './engagements';
import { finalize } from './finalize';
import { generateSales } from './sales';
import { generateTags } from './tags';
import { generateTasks } from './tasks';
import { Db } from './types';

export default (): Db => {
    const db = {} as Db;
    db.sales = generateSales(db);
    db.tags = generateTags(db);
    db.companies = generateCompanies(db);
    db.contacts = generateContacts(db);
    db.contactNotes = generateContactNotes(db);
    db.engagements = generateEngagements(db);
    db.engagementNotes = generateEngagementNotes(db);
    db.tasks = generateTasks(db);
    finalize(db);

    return db;
};
