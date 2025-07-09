import { Draggable } from '@hello-pangea/dnd';
import { Box, Card, Typography } from '@mui/material';
import { ReferenceField, useRedirect } from 'react-admin';
import { CompanyAvatar } from '../companies/CompanyAvatar';
import { Engagement } from '../types';

export const EngagementCard = ({ engagement, index }: { engagement: Engagement; index: number }) => {
    if (!engagement) return null;

    return (
        <Draggable draggableId={String(engagement.id)} index={index}>
            {(provided, snapshot) => (
                <EngagementCardContent
                    provided={provided}
                    snapshot={snapshot}
                    engagement={engagement}
                />
            )}
        </Draggable>
    );
};

export const EngagementCardContent = ({
    provided,
    snapshot,
    engagement,
}: {
    provided?: any;
    snapshot?: any;
    engagement: Engagement;
}) => {
    console.log('EngagementCardContent engagement:', engagement);
    const redirect = useRedirect();
    const handleClick = () => {
        redirect(`/engagements/${engagement.id}/show`, undefined, undefined, undefined, {
            _scrollToTop: false,
        });
    };

    return (
        <Box
            sx={{ marginBottom: 1, cursor: 'pointer' }}
            {...provided?.draggableProps}
            {...provided?.dragHandleProps}
            ref={provided?.innerRef}
            onClick={handleClick}
        >
            <Card
                style={{
                    opacity: snapshot?.isDragging ? 0.9 : 1,
                    transform: snapshot?.isDragging ? 'rotate(-2deg)' : '',
                }}
                elevation={snapshot?.isDragging ? 3 : 1}
            >
                <Box padding={1} display="flex">
                    <ReferenceField
                        source="company_id"
                        record={engagement}
                        reference="companies"
                        link={false}
                    >
                        <CompanyAvatar width={20} height={20} />
                    </ReferenceField>
                    <Box sx={{ marginLeft: 1 }}>
                        <Typography variant="body2" gutterBottom>
                            {engagement.name}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                            {engagement.resultCount} Result{engagement.resultCount === 1 ? '' : 's'}
                            {engagement.category ? `, ${engagement.category}` : ''}
                        </Typography>
                    </Box>
                </Box>
            </Card>
        </Box>
    );
};
