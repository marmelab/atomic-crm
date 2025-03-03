import { random, name, internet, date } from 'faker/locale/en_US';
import { Db } from './types';
import { Candidate, ProgrammingLanguage, AITechnology, Language, LanguageProficiency } from '../../../types';

const programmingLanguages = Object.values(ProgrammingLanguage);
const aiTechnologies = Object.values(AITechnology);
const languages = Object.values(Language);
const proficiencyLevels = Object.values(LanguageProficiency);

export const generateCandidates = (db: Db, nb = 100): Candidate[] => {
    const candidates: Candidate[] = [];
    const today = new Date().toISOString();

    for (let i = 0; i < nb; i++) {
        const id = i + 1;
        const first_name = name.firstName();
        const last_name = name.lastName();
        const working_years = random.number({ min: 0, max: 20 });

        candidates.push({
            id,
            first_name,
            last_name,
            gender: random.arrayElement(['male', 'female', 'other']),
            title: name.jobTitle(),
            emails: [
                {
                    email: internet.email(first_name, last_name),
                    type: 'Work'
                }
            ],
            phone_numbers: [
                {
                    number: random.phoneNumber(),
                    type: 'Work'
                }
            ],
            linkedin_url: `https://linkedin.com/in/${first_name.toLowerCase()}-${last_name.toLowerCase()}`,
            working_years,
            education_level: random.arrayElement(['high_school', 'bachelors', 'masters', 'phd']),
            education_jsonb: [],
            work_experience_jsonb: [],
            programming_languages: random.arrayElements(programmingLanguages, random.number({ min: 1, max: 5 })),
            ai_skills: random.arrayElements(aiTechnologies, random.number({ min: 0, max: 3 }))
                .map(technology => ({
                    technology,
                    yearsOfExperience: random.number({ min: 1, max: working_years })
                })),
            languages: random.arrayElements(languages, random.number({ min: 1, max: 3 }))
                .map(language => ({
                    language,
                    proficiency: random.arrayElement(proficiencyLevels)
                })),
            availability_status: random.arrayElement(['Immediately', 'Two Weeks', 'One Month', 'Three Months']),
            availability_date: date.future().toISOString(),
            current_salary: random.number({ min: 40000, max: 200000 }),
            salary_expectation_min: random.number({ min: 50000, max: 150000 }),
            salary_expectation_max: random.number({ min: 150000, max: 250000 }),
            willing_to_relocate: random.boolean(),
            preferred_locations: random.arrayElements(['New York', 'San Francisco', 'London', 'Berlin'], random.number({ min: 1, max: 3 })),
            english_level: random.arrayElement(['Elementary', 'Intermediate', 'Advanced', 'Native']),
            remote_preference: random.arrayElement(['Remote', 'Hybrid', 'On-site', 'Flexible']),
            source: random.arrayElement(['LinkedIn', 'Indeed', 'Referral', 'Direct']),
            contacted: random.boolean(),
            created_at: today,
            updated_at: today,
            last_seen: date.recent().toISOString(),
            hiring_stage: random.arrayElement(['New', 'Screening', 'Interview', 'Technical', 'Offer']),
            status: 'active',
            background: random.words(50),
            sales_id: random.arrayElement(db.sales).id,
            tags: random.arrayElements(db.tags, random.number({ min: 0, max: 3 })).map(tag => tag.id),
        });
    }

    return candidates;
}; 