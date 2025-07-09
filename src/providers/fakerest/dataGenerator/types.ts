import {
    Company,
    Contact,
    ContactNote,
    Engagement,
    EngagementNote,
    Sale,
    Tag,
    Task,
} from '../../../types';

export interface Db {
    companies: Required<Company>[];
    contacts: Required<Contact>[];
    contactNotes: ContactNote[];
    engagements: Engagement[];
    engagementNotes: EngagementNote[];
    sales: Sale[];
    tags: Tag[];
    tasks: Task[];
}
