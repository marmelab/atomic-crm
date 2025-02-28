import * as React from 'react';
import {
    EditBase,
    Form,
    SaveButton,
    Toolbar,
    useEditContext,
} from 'react-admin';
import { Card, CardContent, Box } from '@mui/material';

import { CandidateInputs } from './CandidateInputs';
import { CandidateAside } from './CandidateAside';
import { Candidate } from '../types';

export const CandidateEdit = () => (
    <EditBase redirect="show">
        <CandidateEditContent />
    </EditBase>
);

const CandidateEditContent = () => {
    const { isPending, record } = useEditContext<Candidate>();
    if (isPending || !record) return null;
    return (
        <Box mt={2} display="flex">
            <Box flex="1">
                <Form>
                    <Card>
                        <CardContent>
                            <CandidateInputs />
                        </CardContent>
                        <Toolbar>
                            <SaveButton />
                        </Toolbar>
                    </Card>
                </Form>
            </Box>
            <CandidateAside link="show" />
        </Box>
    );
};
