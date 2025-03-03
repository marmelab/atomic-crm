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
                {Object.values(ProgrammingLanguage).map((lang: ProgrammingLanguage) => (
                    <FilterListItem
                        key={lang}
                        label={lang}
                        value={{ 'programming_languages@contains': lang }}
                    />
                ))}
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
                {tags &&
                    tags.map(tag => (
                        <FilterListItem
                            key={tag.id}
                            label={
                                <Chip
                                    label={tag.name}
                                    size="small"
                                    style={{
                                        backgroundColor: tag.color,
                                        border: 0,
                                        cursor: 'pointer',
                                    }}
                                />
                            }
                            value={{ 'tags@cs': `{${tag.id}}` }}
                        />
                    ))}
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
