import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import { Box, Stack, Typography } from '@mui/material';
import { ResponsiveBar } from '@nivo/bar';
import { format, startOfMonth } from 'date-fns';
import { useMemo } from 'react';
import { useGetList } from 'react-admin';

import { Engagement } from '../types';

const multiplier = {
    opportunity: 0.2,
    'proposal-sent': 0.5,
    'in-negociation': 0.8,
    delayed: 0.3,
};

const threeMonthsAgo = new Date(
    new Date().setMonth(new Date().getMonth() - 6)
).toISOString();

export const EngagementsChart = () => {
    const { data, isPending } = useGetList<Engagement>('engagements', {
        pagination: { perPage: 100, page: 1 },
        sort: {
            field: 'created_at',
            order: 'ASC',
        },
        filter: {
            'created_at@gte': threeMonthsAgo,
        },
    });
    const months = useMemo(() => {
        if (!data) return [];
        const engagementsByMonth = data.reduce((acc, engagement) => {
            const month = startOfMonth(
                engagement.created_at ?? new Date()
            ).toISOString();
            if (!acc[month]) {
                acc[month] = [];
            }
            acc[month].push(engagement);
            return acc;
        }, {} as any);

        const amountByMonth = Object.keys(engagementsByMonth).map(month => {
            return {
                date: format(month, 'MMM'),
                won: engagementsByMonth[month]
                    .filter((engagement: Engagement) => engagement.stage === 'won')
                    .reduce((acc: number, engagement: Engagement) => {
                        acc += engagement.amount;
                        return acc;
                    }, 0),
                pending: engagementsByMonth[month]
                    .filter(
                        (engagement: Engagement) => !['won', 'lost'].includes(engagement.stage)
                    )
                    .reduce((acc: number, engagement: Engagement) => {
                        // @ts-ignore
                        acc += engagement.amount * multiplier[engagement.stage];
                        return acc;
                    }, 0),
                lost: engagementsByMonth[month]
                    .filter((engagement: Engagement) => engagement.stage === 'lost')
                    .reduce((acc: number, engagement: Engagement) => {
                        acc -= engagement.amount;
                        return acc;
                    }, 0),
            };
        });

        return amountByMonth;
    }, [data]);

    if (isPending) return null; // FIXME return skeleton instead
    const range = months.reduce(
        (acc, month) => {
            acc.min = Math.min(acc.min, month.lost);
            acc.max = Math.max(acc.max, month.won + month.pending);
            return acc;
        },
        { min: 0, max: 0 }
    );
    return (
        <Stack>
            <Box display="flex" alignItems="center" mb={1}>
                <Box mr={1} display="flex">
                    <AttachMoneyIcon color="disabled" fontSize="medium" />
                </Box>
                <Typography variant="h5" color="textSecondary">
                    Upcoming Deal Revenue
                </Typography>
            </Box>
            <Box height={400}>
                <ResponsiveBar
                    data={months}
                    indexBy="date"
                    keys={['won', 'pending', 'lost']}
                    colors={['#61cdbb', '#97e3d5', '#e25c3b']}
                    margin={{ top: 30, right: 50, bottom: 30, left: 0 }}
                    padding={0.3}
                    valueScale={{
                        type: 'linear',
                        min: range.min * 1.2,
                        max: range.max * 1.2,
                    }}
                    indexScale={{ type: 'band', round: true }}
                    enableGridX={true}
                    enableGridY={false}
                    enableLabel={false}
                    axisTop={{
                        tickSize: 0,
                        tickPadding: 12,
                    }}
                    axisBottom={{
                        legendPosition: 'middle',
                        legendOffset: 50,
                        tickSize: 0,
                        tickPadding: 12,
                    }}
                    axisLeft={null}
                    axisRight={{
                        format: (v: any) => `${Math.abs(v / 1000)}k`,
                        tickValues: 8,
                    }}
                    markers={
                        [
                            {
                                axis: 'y',
                                value: 0,
                                lineStyle: { strokeOpacity: 0 },
                                textStyle: { fill: '#2ebca6' },
                                legend: 'Won',
                                legendPosition: 'top-left',
                                legendOrientation: 'vertical',
                            },
                            {
                                axis: 'y',
                                value: 0,
                                lineStyle: {
                                    stroke: '#f47560',
                                    strokeWidth: 1,
                                },
                                textStyle: { fill: '#e25c3b' },
                                legend: 'Lost',
                                legendPosition: 'bottom-left',
                                legendOrientation: 'vertical',
                            },
                        ] as any
                    }
                />
            </Box>
        </Stack>
    );
};
