import Man2Icon from '@mui/icons-material/Man2';
import WcIcon from '@mui/icons-material/Wc';
import Woman2Icon from '@mui/icons-material/Woman2';

export const defaultLogo = './logos/logo_atomic_crm.svg';

export const defaultTitle = 'Atomic CRM';

export const defaultCompanySectors = [
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

export const defaultEngagementStages = [
    { value: 'results-found', label: 'Results Found' },
    { value: 'engagement-triggered', label: 'Engagement Triggered' },
    { value: 'engagement-active', label: 'Engagement Active' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'risk-accepted', label: 'Risk Accepted' },
    { value: 'triage', label: 'Triage' },
];

export const defaultEngagementPipelineStatuses = ['won'];

export const defaultEngagementCategories = [
    'Other',
    'Copywriting',
    'Print project',
    'UI Design',
    'Website design',
];

export const defaultNoteStatuses = [
    { value: 'cold', label: 'Cold', color: '#7dbde8' },
    { value: 'warm', label: 'Warm', color: '#e8cb7d' },
    { value: 'hot', label: 'Hot', color: '#e88b7d' },
    { value: 'in-contract', label: 'In Contract', color: '#a4e87d' },
];

export const defaultTaskTypes = [
    'None',
    'Email',
    'Demo',
    'Lunch',
    'Meeting',
    'Follow-up',
    'Thank you',
    'Ship',
    'Call',
];

export const defaultContactGender = [
    { value: 'male', label: 'He/Him', icon: Man2Icon },
    { value: 'female', label: 'She/Her', icon: Woman2Icon },
    { value: 'nonbinary', label: 'They/Them', icon: WcIcon },
];
