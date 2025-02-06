import location_prices from '../location_prices';
import { Link } from 'react-router-dom';
import AddCircle from '@mui/icons-material/AddCircleOutline';
import { Stack } from '@mui/material';
import { TopToolbar, ExportButton, Button } from 'react-admin';

const PriceList = location_prices.list;

export const TabSalePrices = (props: {
    pathname: string;
    company_id: string | number;
    location_id: string | number;
}) => {
    const { pathname, company_id, location_id } = props;

    return (
        <PriceList
            resource="location_prices"
            disableSyncWithLocation={true}
            filter={{ company_id, location_id }}
            actions={
                <TopToolbar>
                    <CreateRelatedLocation
                        pathname={pathname}
                        company_id={company_id}
                        location_id={location_id}
                    />
                    <ExportButton />
                </TopToolbar>
            }
            empty={
                <>
                    <Stack
                        direction="row"
                        justifyContent="flex-end"
                        spacing={2}
                        mt={1}
                    >
                        <CreateRelatedLocation
                            pathname={pathname}
                            company_id={company_id}
                            location_id={location_id}
                        />
                    </Stack>
                    <div>No records</div>
                </>
            }
        />
    );
};

const CreateRelatedLocation = (props: {
    pathname: string;
    company_id: string | number;
    location_id: string | number;
}) => {
    const { pathname, company_id, location_id } = props;

    const state = pathname
        ? {
              from: pathname,
              redirect_on_save: pathname,
              record: { company_id: company_id, location_id },
          }
        : undefined;

    return (
        <Button
            component={Link}
            to="/location_prices/create"
            state={state}
            label="Add Sales Price"
        >
            <AddCircle />
        </Button>
    );
};
