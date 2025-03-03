import * as React from 'react';
import {
    ShowBase,
    TextField,
    ReferenceField,
    useShowContext,
} from 'react-admin';
import { Box, Card, CardContent, Typography, Grid, Chip } from '@mui/material';

import { Avatar } from './Avatar';
import { CandidateAside } from './CandidateAside';
import { Candidate } from '../types';

export const CandidateShow = () => (
    <ShowBase>
        <CandidateShowContent />
    </ShowBase>
);

const CandidateShowContent = () => {
    const { record, isPending } = useShowContext<Candidate>();
    if (isPending || !record) return null;

    return (
        <Box mt={2} mb={2} display="flex">
            <Box flex="1">
                <Card>
                    <CardContent>
                        <Box display="flex">
                            <Avatar />
                            <Box ml={2} flex="1">
                                <Typography variant="h5">
                                    {record.first_name} {record.last_name}
                                </Typography>
                                <Typography variant="body2">
                                    {record.title}
                                </Typography>
                                <Typography variant="body2" color="textSecondary">
                                    {record.working_years} years of experience • {record.education_level}
                                </Typography>
                            </Box>
                        </Box>

                        <Grid container spacing={2} sx={{ mt: 2 }}>
                            {record.programming_languages && (
                                <Grid item xs={12}>
                                    <Typography variant="subtitle2">Programming Languages</Typography>
                                    <Box display="flex" gap={1} flexWrap="wrap">
                                        {record.programming_languages.map(lang => (
                                            <Chip key={lang} label={lang} size="small" />
                                        ))}
                                    </Box>
                                </Grid>
                            )}

                            {record.ai_skills && record.ai_skills.length > 0 && (
                                <Grid item xs={12}>
                                    <Typography variant="subtitle2">AI Technologies</Typography>
                                    <Box display="flex" gap={1} flexWrap="wrap">
                                        {record.ai_skills.map(skill => (
                                            <Chip 
                                                key={skill.technology} 
                                                label={`${skill.technology} (${skill.yearsOfExperience}y)`}
                                                size="small" 
                                            />
                                        ))}
                                    </Box>
                                </Grid>
                            )}

                            {record.languages && record.languages.length > 0 && (
                                <Grid item xs={12}>
                                    <Typography variant="subtitle2">Languages</Typography>
                                    <Box display="flex" gap={1} flexWrap="wrap">
                                        {record.languages.map(lang => (
                                            <Chip 
                                                key={lang.language} 
                                                label={`${lang.language} (${lang.proficiency})`}
                                                size="small" 
                                            />
                                        ))}
                                    </Box>
                                </Grid>
                            )}
                        </Grid>

                        {record.background && (
                            <Box mt={2}>
                                <Typography variant="subtitle2">Background</Typography>
                                <Typography variant="body2">{record.background}</Typography>
                            </Box>
                        )}
                    </CardContent>
                </Card>
            </Box>
            <CandidateAside />
        </Box>
    );
};
