import { DragDropContext, OnDragEndResponder } from '@hello-pangea/dnd';
import { Box } from '@mui/material';
import isEqual from 'lodash/isEqual';
import { useEffect, useState } from 'react';
import { DataProvider, useDataProvider, useListContext } from 'react-admin';

import { Engagement } from '../types';
import { EngagementColumn } from './EngagementColumn';
import { EngagementsByStage, getEngagementsByStage } from './stages';
import { useConfigurationContext } from '../root/ConfigurationContext';

export const EngagementListContent = () => {
    const { engagementStages } = useConfigurationContext();
    const { data: unorderedEngagements, isPending, refetch } = useListContext<Engagement>();
    const dataProvider = useDataProvider();

    if (unorderedEngagements) {
        console.log('EngagementListContent unorderedEngagements:', unorderedEngagements);
    }

    const [engagementsByStage, setEngagementsByStage] = useState<EngagementsByStage>(
        getEngagementsByStage([], engagementStages)
    );

    useEffect(() => {
        if (unorderedEngagements) {
            const newEngagementsByStage = getEngagementsByStage(unorderedEngagements, engagementStages);
            if (!isEqual(newEngagementsByStage, engagementsByStage)) {
                setEngagementsByStage(newEngagementsByStage);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [unorderedEngagements]);

    if (isPending) return null;

    const onDragEnd: OnDragEndResponder = result => {
        const { destination, source } = result;

        if (!destination) {
            return;
        }

        if (
            destination.droppableId === source.droppableId &&
            destination.index === source.index
        ) {
            return;
        }

        const sourceStage = source.droppableId;
        const destinationStage = destination.droppableId;
        const sourceEngagement = engagementsByStage[sourceStage][source.index]!;
        const destinationEngagement = engagementsByStage[destinationStage][
            destination.index
        ] ?? {
            stage: destinationStage,
            index: undefined, // undefined if dropped after the last item
        };

        // compute local state change synchronously
        setEngagementsByStage(
            updateEngagementStageLocal(
                sourceEngagement,
                { stage: sourceStage, index: source.index },
                { stage: destinationStage, index: destination.index },
                engagementsByStage
            )
        );

        // persist the changes
        updateEngagementStage(sourceEngagement, destinationEngagement, dataProvider).then(() => {
            refetch();
        });
    };

    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <Box display="flex">
                {engagementStages.map(stage => (
                    <EngagementColumn
                        stage={stage.value}
                        engagements={engagementsByStage[stage.value]}
                        key={stage.value}
                    />
                ))}
            </Box>
        </DragDropContext>
    );
};

const updateEngagementStageLocal = (
    sourceEngagement: Engagement,
    source: { stage: string; index: number },
    destination: {
        stage: string;
        index?: number; // undefined if dropped after the last item
    },
    engagementsByStage: EngagementsByStage
) => {
    if (source.stage === destination.stage) {
        // moving engagement inside the same column
        const column = engagementsByStage[source.stage];
        column.splice(source.index, 1);
        column.splice(destination.index ?? column.length + 1, 0, sourceEngagement);
        return {
            ...engagementsByStage,
            [destination.stage]: column,
        };
    } else {
        // moving engagement across columns
        const sourceColumn = engagementsByStage[source.stage];
        const destinationColumn = engagementsByStage[destination.stage];
        sourceColumn.splice(source.index, 1);
        destinationColumn.splice(
            destination.index ?? destinationColumn.length + 1,
            0,
            sourceEngagement
        );
        return {
            ...engagementsByStage,
            [source.stage]: sourceColumn,
            [destination.stage]: destinationColumn,
        };
    }
};

const updateEngagementStage = async (
    source: Engagement,
    destination: {
        stage: string;
        index?: number; // undefined if dropped after the last item
    },
    dataProvider: DataProvider
) => {
    if (source.stage === destination.stage) {
        // moving engagement inside the same column
        // Fetch all the engagements in this stage (because the list may be filtered, but we need to update even non-filtered engagements)
        const { data: columnEngagements } = await dataProvider.getList('engagements', {
            sort: { field: 'index', order: 'ASC' },
            pagination: { page: 1, perPage: 100 },
            filter: { stage: source.stage },
        });
        const destinationIndex = destination.index ?? columnEngagements.length + 1;

        if (source.index > destinationIndex) {
            // engagement moved up, eg
            // dest   src
            //  <------
            // [4, 7, 23, 5]
            await Promise.all([
                // for all engagements between destinationIndex and source.index, increase the index
                ...columnEngagements
                    .filter(
                        engagement =>
                            engagement.index >= destinationIndex &&
                            engagement.index < source.index
                    )
                    .map(engagement =>
                        dataProvider.update('engagements', {
                            id: engagement.id,
                            data: { index: engagement.index + 1 },
                            previousData: engagement,
                        })
                    ),
                // for the engagement that was moved, update its index
                dataProvider.update('engagements', {
                    id: source.id,
                    data: { index: destinationIndex },
                    previousData: source,
                }),
            ]);
        } else {
            // engagement moved down, e.g
            // src   dest
            //  ------>
            // [4, 7, 23, 5]
            await Promise.all([
                // for all engagements between source.index and destinationIndex, decrease the index
                ...columnEngagements
                    .filter(
                        engagement =>
                            engagement.index <= destinationIndex &&
                            engagement.index > source.index
                    )
                    .map(engagement =>
                        dataProvider.update('engagements', {
                            id: engagement.id,
                            data: { index: engagement.index - 1 },
                            previousData: engagement,
                        })
                    ),
                // for the engagement that was moved, update its index
                dataProvider.update('engagements', {
                    id: source.id,
                    data: { index: destinationIndex },
                    previousData: source,
                }),
            ]);
        }
    } else {
        // moving engagement across columns
        // Fetch all the engagements in both stages (because the list may be filtered, but we need to update even non-filtered engagements)
        const [{ data: sourceEngagements }, { data: destinationEngagements }] =
            await Promise.all([
                dataProvider.getList('engagements', {
                    sort: { field: 'index', order: 'ASC' },
                    pagination: { page: 1, perPage: 100 },
                    filter: { stage: source.stage },
                }),
                dataProvider.getList('engagements', {
                    sort: { field: 'index', order: 'ASC' },
                    pagination: { page: 1, perPage: 100 },
                    filter: { stage: destination.stage },
                }),
            ]);
        const destinationIndex =
            destination.index ?? destinationEngagements.length + 1;

        await Promise.all([
            // decrease index on the engagements after the source index in the source columns
            ...sourceEngagements
                .filter(engagement => engagement.index > source.index)
                .map(engagement =>
                    dataProvider.update('engagements', {
                        id: engagement.id,
                        data: { index: engagement.index - 1 },
                        previousData: engagement,
                    })
                ),
            // increase index on the engagements after the destination index in the destination columns
            ...destinationEngagements
                .filter(engagement => engagement.index >= destinationIndex)
                .map(engagement =>
                    dataProvider.update('engagements', {
                        id: engagement.id,
                        data: { index: engagement.index + 1 },
                        previousData: engagement,
                    })
                ),
            // change the dragged engagement to take the destination index and column
            dataProvider.update('engagements', {
                id: source.id,
                data: {
                    index: destinationIndex,
                    stage: destination.stage,
                },
                previousData: source,
            }),
        ]);
    }
};
