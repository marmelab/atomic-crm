import * as React from 'react';
import { CreateBase, Form, Toolbar, useGetIdentity } from 'react-admin';
import { Card, CardContent, Box } from '@mui/material';

import { CandidateInputs } from './CandidateInputs';
import { Candidate } from '../types';

export const CandidateCreate = () => {
    const { identity } = useGetIdentity();
    const today = new Date().toISOString();

    return (
        <CreateBase
            redirect="show"
            transform={(data: Candidate) => ({
                first_name: data.first_name,
                last_name: data.last_name,
                emails: data.emails,
                phones: data.phone_numbers,
                availability_status: data.availability_status,
                working_years: data.working_years,
                education_level: data.education_level,
                created_at: today,
                updated_at: today,
                last_seen: today,
                hiring_stage: 'New',
                tags: [],
                status: 'active',
                programming_languages: data.programming_languages || [],
                ai_skills: data.ai_skills || [],
                languages: data.languages || [],
                education_jsonb: data.education_jsonb || [],
                work_experience_jsonb: data.work_experience_jsonb || [],
            })}
        >
            <Box mt={2} display="flex">
                <Box flex="1">
                    <Form defaultValues={{ 
                        sales_id: identity?.id,
                        availability_status: 'Immediately',
                        working_years: 0,
                        education_level: 'bachelors',
                    }}>
                        <Card>
                            <CardContent>
                                <CandidateInputs />
                            </CardContent>
                            <Toolbar />
                        </Card>
                    </Form>
                </Box>
            </Box>
        </CreateBase>
    );
};
