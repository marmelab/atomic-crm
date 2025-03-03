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

export interface ProgrammingLanguageSkill {
    language: ProgrammingLanguage;
    level:'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
    yearsOfExperience: number;
}

export enum ProgrammingLanguage {
    JAVASCRIPT = 'JavaScript',
    TYPESCRIPT = 'TypeScript',
    PYTHON = 'Python',
    JAVA = 'Java',
    CSHARP = 'C#',
    CPP = 'C++',
    C = 'C',
    GO = 'Go',
    RUST = 'Rust',
    SWIFT = 'Swift',
    KOTLIN = 'Kotlin',
    PHP = 'PHP',
    RUBY = 'Ruby',
    SQL = 'SQL',
    SCALA = 'Scala',
    R = 'R',
    DART = 'Dart',
    PERL = 'Perl',
    HASKELL = 'Haskell',
    MATLAB = 'MATLAB'
    // Add more languages as needed
}

export enum AITechnology {
    TENSORFLOW = 'TensorFlow',
    PYTORCH = 'PyTorch',
    KERAS = 'Keras',
    SCIKIT_LEARN = 'Scikit-learn',
    OPENCV = 'OpenCV',
    HUGGING_FACE = 'Hugging Face',
    LANGCHAIN = 'LangChain',
    OPENAI_API = 'OpenAI API',
    NLTK = 'NLTK',
    SPACY = 'spaCy',
    PANDAS = 'Pandas',
    NUMPY = 'NumPy',
    MATPLOTLIB = 'Matplotlib',
    RAPIDS = 'RAPIDS',
    TRANSFORMERS = 'Transformers',
    FASTAI = 'Fast.ai',
    MLFLOW = 'MLflow',
    KUBEFLOW = 'Kubeflow',
    VERTEX_AI = 'Vertex AI',
    SAGEMAKER = 'SageMaker'
    // Add more AI technologies as needed
}

export enum Language {
    ENGLISH = 'English',
    SPANISH = 'Spanish',
    FRENCH = 'French',
    GERMAN = 'German',
    CHINESE = 'Chinese',
    JAPANESE = 'Japanese',
    KOREAN = 'Korean',
    RUSSIAN = 'Russian',
    ARABIC = 'Arabic',
    PORTUGUESE = 'Portuguese',
    ITALIAN = 'Italian',
    HINDI = 'Hindi',
    // Add more languages as needed
}

export enum LanguageProficiency {
    ELEMENTARY = 'Elementary',
    LIMITED_WORKING = 'Limited Working',
    PROFESSIONAL_WORKING = 'Professional Working',
    FULL_PROFESSIONAL = 'Full Professional',
    FLUENT = 'Fluent',
    NATIVE = 'Native/Bilingual'
}

export interface AISkill {
    technology: AITechnology;
    yearsOfExperience: number;
}

export type Candidate = {
    // Base information (similar to Contact)
    first_name: string;
    last_name: string;
    contact_time: Date;
    title: string; // Job title
    emails: EmailAndType[];
    phone_numbers: PhoneNumberAndType[];
    avatar?: Partial<RAFile>;
    linkedin_url?: string | null;
    gender: string;
    sales_id: Identifier; // Recruiter ID
    status: string; // Application status   //Action Item - this should be an enum
    background: string; // General notes
    working_years: number;
    position_id: string; //Action Item - Remove
    position_name: string;
    last_seen: string;
    // Resume-specific information
    resume?: RAFile; // The actual resume file
    cover_letter?: RAFile;
    
    // Education and Experience
    education_level: string;  //Action Item - this should be an enum
    education_jsonb: EducationEntry[];
    work_experience_jsonb: WorkExperienceEntry[];
    
    // Skills and qualifications
    skills: Skill[];
    certifications?: string[]; // List of certifications
    languages?: { language: Language; proficiency: LanguageProficiency }[]; 
    programming_languages?: ProgrammingLanguage[];
    ai_skills?: AISkill[];

    // Availability and expectations
    availability_status: AvailabilityStatus;
    availability_date?: string; // Specific date if custom
    current_salary?: number;
    salary_expectation_min?: number;
    salary_expectation_max?: number;
    salary_currency?: string; // USD, EUR, etc.
    willing_to_relocate: boolean;
    preferred_locations?: string[];
    
    // Communication skills
    english_level: string;
    
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
    contacted: boolean;
    
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

    // Hiring Process
    hiring_stage: 'New' | 'Screening' | 'Interview' | 'Technical' | 'Offer' | 'Accepted' | 'Rejected' | 'Withdrawn';
    current_step_due_date?: string; // Next action due date
    rejection_reason?: string;
    offer_details?: {
        offer_date?: string;
        offer_amount: number;
        offer_currency: string;
        benefits: string[];
        bonus_structure?: string;
        equity?: string;
        proposed_start_date?: string;
        offer_expiration_date: string;
        offer_status: 'Draft' | 'Sent' | 'Accepted' | 'Negotiating' | 'Declined';
    };
    background_check?: {
        status: 'Not Started' | 'In Progress' | 'Completed' | 'Failed';
        completion_date?: string;
        notes?: string;
    };
    onboarding_status?: {
        documents_submitted: boolean;
        document_checklist: {
            document_name: string;
            required: boolean;
            received: boolean;
            verification_status?: 'Pending' | 'Verified' | 'Rejected';
        }[];
        start_date?: string;
    };
    internal_notes?: {
        date: string;
        author_id: Identifier;
        content: string;
        category: 'Interview' | 'Salary' | 'Background Check' | 'General';
    }[];
} & Pick<RaRecord, 'id'>;



// End changes

