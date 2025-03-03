/* eslint-disable import/no-anonymous-default-export */
import type { Theme } from '@mui/material';
import {
    Box,
    Button,
    Card,
    CardContent,
    Checkbox,
    Chip,
    Grid,
    Paper,
    Stack,
    Typography,
    useMediaQuery,
} from '@mui/material';
import {
    RecordContextProvider,
    SimpleListLoading,
    useListContext,
} from 'react-admin';
import { Link } from 'react-router-dom';

import { Status } from '../misc/Status';
import { Candidate } from '../types';
import { Avatar } from './Avatar';
import { TagsList } from './TagsList';

export const CandidateListContent = () => {
    const {
        data: candidates,
        error,
        isPending,
        onToggleItem,
        selectedIds,
    } = useListContext<Candidate>();
    const isSmall = useMediaQuery((theme: Theme) =>
        theme.breakpoints.down('md')
    );
    if (isPending) {
        return <SimpleListLoading hasLeftAvatarOrIcon hasSecondaryText />;
    }
    if (error) {
        return null;
    }

    return (
        <Box p={2}>
            <Grid container spacing={2}>
                {candidates.map(candidate => (
                    <RecordContextProvider key={candidate.id} value={candidate}>
                        <Grid item xs={12}>
                            <CandidateCard 
                                candidate={candidate}
                                isSelected={selectedIds.includes(candidate.id)}
                                onToggleSelect={() => onToggleItem(candidate.id)}
                                isSmall={isSmall}
                            />
                        </Grid>
                    </RecordContextProvider>
                ))}

                {candidates.length === 0 && (
                    <Grid item xs={12}>
                        <Paper sx={{ p: 2 }}>
                            <Typography variant="body1">No candidates found</Typography>
                        </Paper>
                    </Grid>
                )}
            </Grid>
        </Box>
    );
};

const CandidateCard = ({ 
    candidate, 
    isSelected, 
    onToggleSelect,
    isSmall 
}: { 
    candidate: Candidate; 
    isSelected: boolean;
    onToggleSelect: () => void;
    isSmall: boolean;
}) => {
    const fullName = `${candidate.first_name} ${candidate.last_name ?? ''}`;
    
    return (
        <Card 
            variant="outlined" 
            sx={{ 
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                '&:hover': {
                    boxShadow: 3
                }
            }}
        >
            <Box 
                position="absolute" 
                top={8} 
                left={8} 
                onClick={(e) => {
                    e.stopPropagation();
                    onToggleSelect();
                }}
            >
                <Checkbox checked={isSelected} />
            </Box>
            
            <CardContent sx={{ flexGrow: 1 }}>
                <Grid container spacing={2}>
                    <Grid item xs={12} md={3}>
                        <Stack direction="row" spacing={2} alignItems="flex-start">
                            <Avatar sx={{ width: 64, height: 64 }} />
                            <Box flexGrow={1}>
                                <Typography variant="h6" component="h2">
                                    {fullName}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {candidate.working_years && `${candidate.working_years} yrs of exp.`}
                                    {candidate.education_level && ` • ${candidate.education_level}`}
                                    {candidate.title && ` • ${candidate.title}`}
                                </Typography>
                                <Stack direction="row" spacing={1} alignItems="center" mt={0.5}>
                                    <Status status={candidate.status} />
                                    <Typography variant="body2" color="text.secondary">
                                        Stage: {candidate.hiring_stage}
                                    </Typography>
                                </Stack>
                            </Box>
                        </Stack>
                        
                        <Box mt={2}>
                            <TagsList />
                        </Box>
                    </Grid>
                    
                    <Grid item xs={12} md={5}>
                        {candidate.background && (
                            <Typography variant="body2" color="text.secondary"
                                sx={{
                                    display: '-webkit-box',
                                    WebkitBoxOrient: 'vertical',
                                    WebkitLineClamp: 4,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    height: '100%'
                                }}
                            >
                                {candidate.background}
                            </Typography>
                        )}
                    </Grid>
                    
                    <Grid item xs={12} md={4}>
                        <Stack spacing={2} height="100%">
                            {candidate.programming_languages && candidate.programming_languages.length > 0 && (
                                <Box>
                                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                        Programming Languages:
                                    </Typography>
                                    <Box display="flex" flexWrap="wrap" gap={1}>
                                        {candidate.programming_languages.map(lang => (
                                            <Chip 
                                                key={lang} 
                                                label={lang} 
                                                size="small" 
                                                sx={{ backgroundColor: '#e0e0e0' }}
                                            />
                                        ))}
                                    </Box>
                                </Box>
                            )}
                            
                            {candidate.ai_skills && candidate.ai_skills.length > 0 && (
                                <Box>
                                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                        AI Skills:
                                    </Typography>
                                    <Box display="flex" flexWrap="wrap" gap={1}>
                                        {candidate.ai_skills.map(skill => (
                                            <Chip 
                                                key={skill.technology} 
                                                label={`${skill.technology} (${skill.yearsOfExperience}y)`} 
                                                size="small"
                                                sx={{ backgroundColor: '#e0e0e0' }}
                                            />
                                        ))}
                                    </Box>
                                </Box>
                            )}
                            
                            <Box sx={{ mt: 'auto', pt: 1 }}>
                                <Button 
                                    variant="contained" 
                                    fullWidth
                                    component={Link}
                                    to={`/candidates/${candidate.id}/show`}
                                    color="primary"
                                >
                                    View Candidate
                                </Button>
                            </Box>
                        </Stack>
                    </Grid>
                </Grid>
            </CardContent>
        </Card>
    );
};
