/* eslint-disable import/no-anonymous-default-export */
import * as React from 'react';
import {
    FilterList,
    FilterLiveSearch,
    FilterListItem,
    useGetIdentity,
    useGetList,
} from 'react-admin';
import { Box, Chip } from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import SchoolIcon from '@mui/icons-material/School';
import CodeIcon from '@mui/icons-material/Code';
import WorkIcon from '@mui/icons-material/Work';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import { ProgrammingLanguage } from '../types';

export const CandidateListFilter = () => {
    const { identity } = useGetIdentity();
    const { data: tags } = useGetList('tags', {
        pagination: { page: 1, perPage: 10 },
        sort: { field: 'name', order: 'ASC' },
    });
    const [selectedLanguages, setSelectedLanguages] = React.useState<ProgrammingLanguage[]>([]);
    const [selectedTags, setSelectedTags] = React.useState<string[]>([]);

    const handleLanguageToggle = (language: ProgrammingLanguage) => {
        setSelectedLanguages(prevSelected => 
            prevSelected.includes(language)
                ? prevSelected.filter(lang => lang !== language)
                : [...prevSelected, language]
        );
    };

    const handleTagToggle = (tagId: string) => {
        setSelectedTags(prevSelected => 
            prevSelected.includes(tagId)
                ? prevSelected.filter(id => id !== tagId)
                : [...prevSelected, tagId]
        );
    };

    const programmingLanguagesFilter = 
        selectedLanguages.length > 0
            ? { 'programming_languages@contains': selectedLanguages }
            : {};

    const tagsFilter = 
        selectedTags.length > 0
            ? { 'tags@cs': `{${selectedTags.join(',')}}` }
            : {};

    return (
        <Box width="13em" minWidth="13em" order={-1} mr={2} mt={5}>
            <FilterLiveSearch
                hiddenLabel
                sx={{
                    display: 'block',
                    '& .MuiFilledInput-root': { width: '100%' },
                }}
                placeholder="Search name, skills, etc."
            />

            <FilterList label="Hiring Stage" icon={<TrendingUpIcon />}>
                <FilterListItem
                    label="New"
                    value={{ hiring_stage: 'New' }}
                />
                <FilterListItem
                    label="Screening"
                    value={{ hiring_stage: 'Screening' }}
                />
                <FilterListItem
                    label="Interview"
                    value={{ hiring_stage: 'Interview' }}
                />
                <FilterListItem
                    label="Technical"
                    value={{ hiring_stage: 'Technical' }}
                />
                <FilterListItem
                    label="Offer"
                    value={{ hiring_stage: 'Offer' }}
                />
            </FilterList>

            <FilterList label="Experience" icon={<WorkIcon />}>
                <FilterListItem
                    label="Junior (0-2 years)"
                    value={{ 'working_years@lte': 2 }}
                />
                <FilterListItem
                    label="Mid (3-5 years)"
                    value={{ 'working_years@gte': 3, 'working_years@lte': 5 }}
                />
                <FilterListItem
                    label="Senior (6+ years)"
                    value={{ 'working_years@gte': 6 }}
                />
            </FilterList>

            <FilterList label="Education" icon={<SchoolIcon />}>
                <FilterListItem
                    label="High School"
                    value={{ education_level: 'high_school' }}
                />
                <FilterListItem
                    label="Bachelor's"
                    value={{ education_level: 'bachelors' }}
                />
                <FilterListItem
                    label="Master's"
                    value={{ education_level: 'masters' }}
                />
                <FilterListItem
                    label="PhD"
                    value={{ education_level: 'phd' }}
                />
            </FilterList>

            <FilterList label="Programming" icon={<CodeIcon />}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, padding: '0 1rem' }}>
                    {Object.values(ProgrammingLanguage).map((lang: ProgrammingLanguage) => (
                        <Chip
                            key={lang}
                            label={lang}
                            size="small"
                            onClick={() => handleLanguageToggle(lang)}
                            color={selectedLanguages.includes(lang) ? "primary" : "default"}
                            style={{ 
                                cursor: 'pointer', 
                                margin: '2px',
                                border: `1px solid ${selectedLanguages.includes(lang) ? '#1976d2' : '#e0e0e0'}`,
                            }}
                        />
                    ))}
                </Box>
                {selectedLanguages.length > 0 && (
                    <FilterListItem
                        label={`${selectedLanguages.length} selected`}
                        value={programmingLanguagesFilter}
                    />
                )}
            </FilterList>

            <FilterList label="Availability" icon={<AccessTimeIcon />}>
                <FilterListItem
                    label="Immediate"
                    value={{ availability_status: 'Immediately' }}
                />
                <FilterListItem
                    label="Two Weeks"
                    value={{ availability_status: 'Two Weeks' }}
                />
                <FilterListItem
                    label="One Month"
                    value={{ availability_status: 'One Month' }}
                />
                <FilterListItem
                    label="Three Months"
                    value={{ availability_status: 'Three Months' }}
                />
            </FilterList>

            <FilterList label="Tags" icon={<LocalOfferIcon />}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, padding: '0 1rem' }}>
                    {tags &&
                        tags.map(tag => (
                            <Chip
                                key={tag.id}
                                label={tag.name}
                                size="small"
                                onClick={() => handleTagToggle(tag.id)}
                                color={selectedTags.includes(tag.id) ? "primary" : "default"}
                                style={{
                                    backgroundColor: selectedTags.includes(tag.id) ? undefined : tag.color,
                                    border: `1px solid ${selectedTags.includes(tag.id) ? '#1976d2' : '#757575'}`,
                                    cursor: 'pointer',
                                    margin: '2px'
                                }}
                            />
                        ))}
                </Box>
                {selectedTags.length > 0 && (
                    <FilterListItem
                        label={`${selectedTags.length} selected`}
                        value={tagsFilter}
                    />
                )}
            </FilterList>

            <FilterList
                label="Recruiter"
                icon={<SupervisorAccountIcon />}
            >
                <FilterListItem 
                    label="My Candidates" 
                    value={{ sales_id: identity?.id }} 
                />
            </FilterList>
        </Box>
    );
};
