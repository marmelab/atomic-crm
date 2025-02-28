import { SvgIconComponent } from '@mui/icons-material';
import { Identifier, RaRecord } from 'react-admin';
import {
    COMPANY_CREATED,
    CONTACT_CREATED,
    CONTACT_NOTE_CREATED,
    DEAL_CREATED,
    DEAL_NOTE_CREATED,
} from './consts';

export type SignUpData = {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
};

export type SalesFormData = {
    avatar: string;
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    administrator: boolean;
    disabled: boolean;
};

export type Sale = {
    first_name: string;
    last_name: string;
    administrator: boolean;
    avatar?: RAFile;
    disabled?: boolean;
    user_id: string;

    /**
     * This is a copy of the user's email, to make it easier to handle by react admin
     * DO NOT UPDATE this field directly, it should be updated by the backend
     */
    email: string;

    /**
     * This is used by the fake rest provider to store the password
     * DO NOT USE this field in your code besides the fake rest provider
     * @deprecated
     */
    password?: string;
} & Pick<RaRecord, 'id'>;

export type Company = {
    name: string;
    logo: RAFile;
    sector: string;
    size: 1 | 10 | 50 | 250 | 500;
    linkedin_url: string;
    website: string;
    phone_number: string;
    address: string;
    zipcode: string;
    city: string;
    stateAbbr: string;
    sales_id: Identifier;
    created_at: string;
    description: string;
    revenue: string;
    tax_identifier: string;
    country: string;
    context_links?: string[];
    nb_contacts?: number;
    nb_deals?: number;
} & Pick<RaRecord, 'id'>;

export type EmailAndType = {
    email: string;
    type: 'Work' | 'Home' | 'Other';
};

export type PhoneNumberAndType = {
    number: string;
    type: 'Work' | 'Home' | 'Other';
};

export type Contact = {
    first_name: string;
    last_name: string;
    title: string;
    company_id: Identifier;
    email_jsonb: EmailAndType[];
    avatar?: Partial<RAFile>;
    linkedin_url?: string | null;
    first_seen: string;
    last_seen: string;
    has_newsletter: Boolean;
    tags: Identifier[];
    gender: string;
    sales_id: Identifier;
    status: string;
    background: string;
    phone_jsonb: PhoneNumberAndType[];

    nb_tasks?: number;
    company_name?: string;
} & Pick<RaRecord, 'id'>;

export type ContactNote = {
    contact_id: Identifier;
    text: string;
    date: string;
    sales_id: Identifier;
    status: string;
    attachments?: AttachmentNote[];
} & Pick<RaRecord, 'id'>;

export type Deal = {
    name: string;
    company_id: Identifier;
    contact_ids: Identifier[];
    category: string;
    stage: string;
    description: string;
    amount: number;
    created_at: string;
    updated_at: string;
    archived_at?: string;
    expected_closing_date: string;
    sales_id: Identifier;
    index: number;
} & Pick<RaRecord, 'id'>;

export type DealNote = {
    deal_id: Identifier;
    text: string;
    date: string;
    sales_id: Identifier;
    attachments?: AttachmentNote[];

    // This is defined for compatibility with `ContactNote`
    status?: undefined;
} & Pick<RaRecord, 'id'>;

export type Tag = {
    name: string;
    color: string;
} & Pick<RaRecord, 'id'>;

export type Task = {
    contact_id: Identifier;
    type: string;
    text: string;
    due_date: string;
    done_date?: string | null;
    sales_id?: Identifier;
} & Pick<RaRecord, 'id'>;

export type ActivityCompanyCreated = {
    type: typeof COMPANY_CREATED;
    company_id: Identifier;
    company: Company;
    sales_id: Identifier;
    date: string;
};

export type ActivityContactCreated = {
    type: typeof CONTACT_CREATED;
    company_id: Identifier;
    sales_id?: Identifier;
    contact: Contact;
    date: string;
};

export type ActivityContactNoteCreated = {
    type: typeof CONTACT_NOTE_CREATED;
    sales_id?: Identifier;
    contactNote: ContactNote;
    date: string;
};

export type ActivityDealCreated = {
    type: typeof DEAL_CREATED;
    company_id: Identifier;
    sales_id?: Identifier;
    deal: Deal;
    date: string;
};

export type ActivityDealNoteCreated = {
    type: typeof DEAL_NOTE_CREATED;
    sales_id?: Identifier;
    dealNote: DealNote;
    date: string;
};

export type Activity = RaRecord &
    (
        | ActivityCompanyCreated
        | ActivityContactCreated
        | ActivityContactNoteCreated
        | ActivityDealCreated
        | ActivityDealNoteCreated
    );

export interface RAFile {
    src: string;
    title: string;
    path?: string;
    rawFile: File;
    type?: string;
}

export type AttachmentNote = RAFile;
export interface DealStage {
    value: string;
    label: string;
}

export interface NoteStatus {
    value: string;
    label: string;
    color: string;
}

export interface ContactGender {
    value: string;
    label: string;
    icon: SvgIconComponent;
}

// Changes to add a candidate type  ==========================================
// Start changes

export type EducationEntry = {
    institution: string;
    degree: string;
    field_of_study: string;
    start_date: string;
    end_date: string | null; // null if currently studying
    description?: string;
};

export type WorkExperienceEntry = {
    company: string;
    position: string;
    start_date: string;
    end_date: string | null; // null if current position
    description: string;
    location?: string;
};

export type Skill = {
    name: string;
    level: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
    years_experience?: number;
};

export type AvailabilityStatus = 'Immediately' | 'Two Weeks' | 'One Month' | 'Three Months' | 'Custom';

export type Candidate = {
    // Base information (similar to Contact)
    first_name: string;
    last_name: string;
    title: string; // Job title
    email_jsonb: EmailAndType[];
    phone_jsonb: PhoneNumberAndType[];
    avatar?: Partial<RAFile>;
    linkedin_url?: string | null;
    gender: string;
    sales_id: Identifier; // Recruiter ID
    status: string; // Application status
    background: string; // General notes
    
    last_seen: string;
    // Resume-specific information
    resume: RAFile; // The actual resume file
    cover_letter?: RAFile;
    
    // Education and Experience
    education_jsonb: EducationEntry[];
    work_experience_jsonb: WorkExperienceEntry[];
    
    // Skills and qualifications
    skills: Skill[];
    certifications?: string[]; // List of certifications
    languages?: { language: string; proficiency: string }[];
    
    // Availability and expectations
    availability_status: AvailabilityStatus;
    availability_date?: string; // Specific date if custom
    salary_expectation_min?: number;
    salary_expectation_max?: number;
    salary_currency?: string; // USD, EUR, etc.
    willing_to_relocate: boolean;
    preferred_locations?: string[];
    
    // Job matching
    job_types?: ('Full-time' | 'Part-time' | 'Contract' | 'Temporary' | 'Internship')[];
    remote_preference?: 'Remote' | 'Hybrid' | 'On-site' | 'Flexible';
    
    // Application tracking
    source: string; // Where the candidate was sourced from
    applied_jobs?: Identifier[]; // Jobs the candidate has applied to
    interview_history?: {
        date: string;
        job_id: Identifier;
        interviewer_id: Identifier;
        notes: string;
        status: string;
    }[];
    
    // Metadata
    created_at: string;
    updated_at: string;
    last_contact_date?: string;
    
    // References
    references?: {
        name: string;
        company: string;
        position: string;
        email: string;
        phone?: string;
        relationship: string;
    }[];
    
    // Additional fields for compatibility
    company_id?: Identifier; // If associated with a company
    tags?: Identifier[]; // Tags for categorization
    nb_tasks?: number;
} & Pick<RaRecord, 'id'>;

// End changes