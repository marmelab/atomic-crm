import { Box } from '@mui/material';
import { GroupByFilter } from '../GroupByFilter';
import { ListBaseProps } from 'react-admin';

export const LocationPricesAside = (props: {
    filter?: ListBaseProps['filter'];
}) => {
    return (
        <>
            <Box sx={{ maxWidth: '350px', width: '350px' }}>
                <GroupByFilter
                    source="material_name"
                    source_id="material_id"
                    label="material_name"
                    filter={props.filter}
                />
            </Box>
            <Box sx={{ maxWidth: '550px', width: '550px' }}>
                <GroupByFilter
                    source="commodity_name"
                    source_id="commodity_id"
                    label="commodity_name"
                    filter={props.filter}
                />
            </Box>
        </>
    );
};
