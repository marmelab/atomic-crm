import * as React from 'react';
import { CreateBase, Form, Toolbar, useGetIdentity } from 'react-admin';
import { Card, CardContent, Box } from '@mui/material';

import { CandidateInputs } from './CandidateInputs';
import { Candidate } from '../types';

export const CandidateCreate = () => {
    const { identity } = useGetIdentity();
    return (
        <CreateBase
            redirect="show"
            transform={(data: Candidate) => ({
                ...data,
                first_seen: new Date().toISOString(),
                last_seen: new Date().toISOString(),
                tags: [],
            })}
        >
            <Box mt={2} display="flex">
                <Box flex="1">
                    <Form defaultValues={{ sales_id: identity?.id }}>
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
