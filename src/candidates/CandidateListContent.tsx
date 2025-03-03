/* eslint-disable import/no-anonymous-default-export */
import type { Theme } from '@mui/material';
import {
    Checkbox,
    List,
    ListItem,
    ListItemAvatar,
    ListItemButton,
    ListItemIcon,
    ListItemSecondaryAction,
    ListItemText,
    Typography,
    useMediaQuery,
} from '@mui/material';
import { formatRelative } from 'date-fns';
import {
    RecordContextProvider,
    ReferenceField,
    SimpleListLoading,
    TextField,
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
    const now = Date.now();

    return (
        <>
            <List dense>
                {candidates.map(candidate => (
                    <RecordContextProvider key={candidate.id} value={candidate}>
                        <ListItem disablePadding>
                            <ListItemButton
                                component={Link}
                                to={`/candidates/${candidate.id}/show`}
                            >
                                <ListItemIcon sx={{ minWidth: '2.5em' }}>
                                    <Checkbox
                                        edge="start"
                                        checked={selectedIds.includes(
                                            candidate.id
                                        )}
                                        tabIndex={-1}
                                        disableRipple
                                        onClick={e => {
                                            e.stopPropagation();
                                            onToggleItem(candidate.id);
                                        }}
                                    />
                                </ListItemIcon>
                                <ListItemAvatar>
                                    <Avatar />
                                </ListItemAvatar>
                                <ListItemText
                                    primary={`${candidate.first_name} ${candidate.last_name ?? ''}`}
                                    secondary={
                                        <>
                                            {candidate.full_name}
                                            {candidate.working_years && ` • ${candidate.working_years} years exp`}
                                            {candidate.education_level && ` • ${candidate.education_level}`}
                                            &nbsp;&nbsp;
                                            <TagsList />
                                            {(candidate.programming_languages && candidate.programming_languages.length > 0) && 
                                                ` • ${candidate.programming_languages.join(', ')}`}
                                        </>
                                    }
                                />
                                <ListItemSecondaryAction
                                    sx={{
                                        top: '10px',
                                        transform: 'none',
                                    }}
                                >
                                    <Typography
                                        variant="body2"
                                        color="textSecondary"
                                    >
                                        {!isSmall && 'Stage: '}
                                        {candidate.hiring_stage}{' '}
                                        <Status status={candidate.status} />
                                    </Typography>
                                </ListItemSecondaryAction>
                            </ListItemButton>
                        </ListItem>
                    </RecordContextProvider>
                ))}

                {candidates.length === 0 && (
                    <ListItem>
                        <ListItemText primary="No candidates found" />
                    </ListItem>
                )}
            </List>
        </>
    );
};
