import { Droppable } from '@hello-pangea/dnd';
import { Box, Stack, Typography } from '@mui/material';

import { Engagement } from '../types';
import { EngagementCard } from './EngagementCard';
import { useConfigurationContext } from '../root/ConfigurationContext';
import { findEngagementLabel } from './engagement';

export const EngagementColumn = ({ stage, engagements }: { stage: string; engagements: Engagement[] }) => {
    const totalResultCount = engagements.reduce((sum, engagement) => sum + engagement.resultCount, 0);

    const { engagementStages } = useConfigurationContext();
    return (
        <Box
            sx={{
                flex: 1,
                paddingTop: '8px',
                paddingBottom: '16px',
                bgcolor: '#eaeaee',
                '&:first-of-type': {
                    paddingLeft: '5px',
                    borderTopLeftRadius: 5,
                },
                '&:last-of-type': {
                    paddingRight: '5px',
                    borderTopRightRadius: 5,
                },
            }}
        >
            <Stack alignItems="center">
                <Typography variant="subtitle1">
                    {findEngagementLabel(engagementStages, stage)}
                </Typography>
                <Typography
                    variant="subtitle1"
                    color="text.secondary"
                    fontSize="small"
                >
                    {totalResultCount} Result{totalResultCount === 1 ? '' : 's'}
                </Typography>
            </Stack>
            <Droppable droppableId={stage}>
                {(droppableProvided, snapshot) => (
                    <Box
                        ref={droppableProvided.innerRef}
                        {...droppableProvided.droppableProps}
                        className={
                            snapshot.isDraggingOver ? ' isDraggingOver' : ''
                        }
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            borderRadius: 1,
                            padding: '5px',
                            '&.isDraggingOver': {
                                bgcolor: '#dadadf',
                            },
                        }}
                    >
                        {engagements.map((engagement, index) => (
                            <EngagementCard key={engagement.id} engagement={engagement} index={index} />
                        ))}
                        {droppableProvided.placeholder}
                    </Box>
                )}
            </Droppable>
        </Box>
    );
};
