import { DataProvider, Identifier } from 'react-admin';
import {
    COMPANY_CREATED,
    CONTACT_CREATED,
    CONTACT_NOTE_CREATED,
    ENGAGEMENT_CREATED,
    ENGAGEMENT_NOTE_CREATED,
} from '../../consts';
import {
    Contact,
    ContactNote,
    Engagement,
    EngagementNote,
    Activity,
    Company,
} from '../../types';

// FIXME: Requires 5 large queries to get the latest activities.
// Replace with a server-side view or a custom API endpoint.
export async function getActivityLog(
    dataProvider: DataProvider,
    companyId?: Identifier,
    salesId?: Identifier
) {
    let companyFilter = {} as any;
    if (companyId) {
        companyFilter.id = companyId;
    } else if (salesId) {
        companyFilter['sales_id@in'] = `(${salesId})`;
    }

    let filter = {} as any;
    if (companyId) {
        filter.company_id = companyId;
    } else if (salesId) {
        filter['sales_id@in'] = `(${salesId})`;
    }

    const [newCompanies, newContactsAndNotes, newDealsAndNotes] =
        await Promise.all([
            getNewCompanies(dataProvider, companyFilter),
            getNewContactsAndNotes(dataProvider, filter),
            getNewDealsAndNotes(dataProvider, filter),
        ]);
    return (
        [...newCompanies, ...newContactsAndNotes, ...newDealsAndNotes]
            // sort by date desc
            .sort((a, b) =>
                a.date && b.date ? a.date.localeCompare(b.date) * -1 : 0
            )
            // limit to 250 activities
            .slice(0, 250)
    );
}

const getNewCompanies = async (
    dataProvider: DataProvider,
    filter: any
): Promise<Activity[]> => {
    const { data: companies } = await dataProvider.getList<Company>(
        'companies',
        {
            filter,
            pagination: { page: 1, perPage: 250 },
            sort: { field: 'created_at', order: 'DESC' },
        }
    );
    return companies.map(company => ({
        id: `company.${company.id}.created`,
        type: COMPANY_CREATED,
        company_id: company.id,
        company,
        sales_id: company.sales_id,
        date: company.created_at,
    }));
};

async function getNewContactsAndNotes(
    dataProvider: DataProvider,
    filter: any
): Promise<Activity[]> {
    const { data: contacts } = await dataProvider.getList<Contact>('contacts', {
        filter,
        pagination: { page: 1, perPage: 250 },
        sort: { field: 'first_seen', order: 'DESC' },
    });

    let recentContactNotesFilter = {} as any;
    if (filter.sales_id) {
        recentContactNotesFilter.sales_id = filter.sales_id;
    }
    if (filter.company_id) {
        // No company_id field in contactNote, filtering by related contacts instead.
        // This filter is only valid if a company has less than 250 contact.
        const contactIds = contacts.map(contact => contact.id).join(',');
        recentContactNotesFilter['contact_id@in'] = `(${contactIds})`;
    }

    const { data: contactNotes } = await dataProvider.getList<ContactNote>(
        'contactNotes',
        {
            filter: recentContactNotesFilter,
            pagination: { page: 1, perPage: 250 },
            sort: { field: 'date', order: 'DESC' },
        }
    );

    const newContacts = contacts.map(contact => ({
        id: `contact.${contact.id}.created`,
        type: CONTACT_CREATED,
        company_id: contact.company_id,
        sales_id: contact.sales_id,
        contact,
        date: contact.first_seen,
    }));

    const newContactNotes = contactNotes.map(contactNote => ({
        id: `contactNote.${contactNote.id}.created`,
        type: CONTACT_NOTE_CREATED,
        sales_id: contactNote.sales_id,
        contactNote,
        date: contactNote.date,
    }));

    return [...newContacts, ...newContactNotes];
}

async function getNewDealsAndNotes(
    dataProvider: DataProvider,
    filter: any
): Promise<Activity[]> {
    const { data: engagements } = await dataProvider.getList<Engagement>('engagements', {
        filter,
        pagination: { page: 1, perPage: 250 },
        sort: { field: 'created_at', order: 'DESC' },
    });

    let recentEngagementNotesFilter = {} as any;
    if (filter.sales_id) {
        recentEngagementNotesFilter.sales_id = filter.sales_id;
    }
    if (filter.company_id) {
        // No company_id field in engagementNote, filtering by related engagements instead.
        // This filter is only valid if an engagement has less than 250 notes.
        const engagementIds = engagements.map(engagement => engagement.id).join(',');
        recentEngagementNotesFilter['engagement_id@in'] = `(${engagementIds})`;
    }

    const { data: engagementNotes } = await dataProvider.getList<EngagementNote>(
        'engagementNotes',
        {
            filter: recentEngagementNotesFilter,
            pagination: { page: 1, perPage: 250 },
            sort: { field: 'date', order: 'DESC' },
        }
    );

    const newEngagements = engagements.map(engagement => ({
        id: `engagement.${engagement.id}.created`,
        type: ENGAGEMENT_CREATED,
        company_id: engagement.company_id,
        sales_id: engagement.sales_id,
        engagement,
        date: engagement.created_at,
    }));

    const newEngagementNotes = engagementNotes.map(engagementNote => ({
        id: `engagementNote.${engagementNote.id}.created`,
        type: ENGAGEMENT_NOTE_CREATED,
        sales_id: engagementNote.sales_id,
        engagementNote,
        date: engagementNote.date,
    }));

    return [...newEngagements, ...newEngagementNotes];
}
