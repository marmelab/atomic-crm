/**
 * This component displays the deals pipeline for the current user.
 * It's currently not used in the application but can be added to the dashboard.
 */

import * as React from 'react';
import { Card, Box } from '@mui/material';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import {
    useGetList,
    SimpleList,
    useGetIdentity,
    Link,
    ReferenceField,
} from 'react-admin';

import { CompanyAvatar } from '../companies/CompanyAvatar';
import { Engagement } from '../types';
import { useConfigurationContext } from '../root/ConfigurationContext';
import { findEngagementLabel } from '../engagements/engagement';

export const DealsPipeline = () => {
    const { identity } = useGetIdentity();
    const { engagementStages, engagementPipelineStatuses } = useConfigurationContext();
    const { data, total, isPending } = useGetList<Engagement>(
        'engagements',
        {
            pagination: { page: 1, perPage: 10 },
            sort: { field: 'last_seen', order: 'DESC' },
            filter: { 'stage@neq': 'lost', sales_id: identity?.id },
        },
        { enabled: Number.isInteger(identity?.id) }
    );

    const getOrderedEngagements = (data?: Engagement[]): Engagement[] | undefined => {
        if (!data) {
            return;
        }
        const engagements: Engagement[] = [];
        engagementStages
            .filter(stage => !engagementPipelineStatuses.includes(stage.value))
            .forEach(stage =>
                data
                    .filter(engagement => engagement.stage === stage.value)
                    .forEach(engagement => engagements.push(engagement))
            );
        return engagements;
    };

    return (
        <>
            <Box display="flex" alignItems="center" marginBottom="1em">
                <Box ml={2} mr={2} display="flex">
                    <MonetizationOnIcon color="disabled" fontSize="large" />
                </Box>
                <Link
                    underline="none"
                    variant="h5"
                    color="textSecondary"
                    to="/engagements"
                >
                    Deals Pipeline
                </Link>
            </Box>
            <Card>
                <SimpleList<Engagement>
                    resource="engagements"
                    linkType="show"
                    data={getOrderedEngagements(data)}
                    total={total}
                    isPending={isPending}
                    primaryText={engagement => engagement.name}
                    secondaryText={engagement =>
                        `${engagement.amount.toLocaleString('en-US', {
                            notation: 'compact',
                            style: 'currency',
                            currency: 'USD',
                            currencyDisplay: 'narrowSymbol',
                            minimumSignificantDigits: 3,
                        })} , ${findEngagementLabel(engagementStages, engagement.stage)}`
                    }
                    leftAvatar={engagement => (
                        <ReferenceField
                            source="company_id"
                            record={engagement}
                            reference="companies"
                            resource="engagements"
                            link={false}
                        >
                            <CompanyAvatar width={20} height={20} />
                        </ReferenceField>
                    )}
                />
            </Card>
        </>
    );
};
