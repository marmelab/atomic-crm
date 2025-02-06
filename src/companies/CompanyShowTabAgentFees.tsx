import { Stack, Typography } from '@mui/material';
import {
    List,
    Datagrid,
    TextField,
    BooleanField,
    TopToolbar,
    ExportButton,
    ReferenceField,
    useRecordContext,
    Button,
} from 'react-admin';

import { Link as RouterLink } from 'react-router-dom';

import AddCircle from '@mui/icons-material/AddCircleOutline';

import { CurrencyField } from '../CurrencyField';

export const TabAgentFees = (props: {
    pathname: string;
    company_id: string | number;
}) => {
    const { pathname, company_id } = props;
    return (
        <>
            <Typography variant="h6" ml={1} mt={2} flex="1">
                Agent Fees (materials)
            </Typography>
            <Typography variant="caption" mb={0} ml={1} flex="1" color="grey">
                Overrides company-level agent fee; overridden by commodity-level
                fee with the same material
            </Typography>

            <List
                resource="company_material_fees"
                filter={{ company_id }}
                disableSyncWithLocation
                actions={
                    <TopToolbar>
                        <CreateRelatedMaterialFeeButton pathname={pathname} />
                        <ExportButton />
                    </TopToolbar>
                }
                empty={
                    <Stack
                        direction="row"
                        justifyContent="flex-end"
                        spacing={2}
                        mt={1}
                    >
                        <CreateRelatedMaterialFeeButton pathname={pathname} />
                    </Stack>
                }
            >
                <Datagrid>
                    <ReferenceField
                        reference="materials"
                        source="material_id"
                        link={false}
                        label="Material Name"
                    >
                        <TextField source="name" />
                    </ReferenceField>

                    <ReferenceField
                        reference="materials"
                        source="material_id"
                        link={false}
                        label="Material Status"
                    >
                        <BooleanField source="active" />
                    </ReferenceField>

                    <CurrencyField source="fee" label="Fee ($/mt)" />
                </Datagrid>
            </List>

            <Typography variant="h6" ml={1} mt={0} mb={0} flex="1">
                Agent Fees (commodities)
            </Typography>
            <Typography variant="caption" mb={0} ml={1} flex="1" color="grey">
                Overrides company-level agent fee and material-level fees
            </Typography>

            <List
                resource="company_commodity_fees"
                filter={{ company_id }}
                disableSyncWithLocation
                actions={
                    <TopToolbar>
                        <CreateRelatedCommodityFeeButton pathname={pathname} />
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
                            <CreateRelatedCommodityFeeButton
                                pathname={pathname}
                            />
                        </Stack>
                        <div>No records</div>
                    </>
                }
            >
                <Datagrid>
                    <ReferenceField
                        reference="commodities"
                        source="commodity_id"
                        link={false}
                        label="Commodity Name"
                    >
                        <TextField source="name" />
                    </ReferenceField>

                    <ReferenceField
                        reference="commodities"
                        source="commodity_id"
                        link={false}
                        label="Commodity Material"
                    >
                        <ReferenceField
                            reference="materials"
                            source="material_id"
                            link={false}
                        >
                            <TextField source="name" />
                        </ReferenceField>
                    </ReferenceField>

                    <ReferenceField
                        reference="commodities"
                        source="commodity_id"
                        link={false}
                        label="Commodity Status"
                    >
                        <BooleanField source="active" />
                    </ReferenceField>

                    <CurrencyField source="fee" label="Fee ($/mt)" />
                </Datagrid>
            </List>
        </>
    );
};

const CreateRelatedMaterialFeeButton = (props: { pathname: string }) => {
    const { pathname } = props;
    const company = useRecordContext();

    const state = pathname
        ? {
              from: pathname,
              redirect_on_save: pathname,
              record: { company_id: company?.id },
          }
        : undefined;

    return (
        <Button
            component={RouterLink}
            to="/company_material_fees/create"
            state={state}
            label="Add Material Fee"
        >
            <AddCircle />
        </Button>
    );
};

const CreateRelatedCommodityFeeButton = (props: { pathname: string }) => {
    const { pathname } = props;
    const company = useRecordContext();

    const state = pathname
        ? {
              from: pathname,
              redirect_on_save: pathname,
              record: { company_id: company?.id },
          }
        : undefined;

    return (
        <Button
            component={RouterLink}
            to="/company_commodity_fees/create"
            state={state}
            label="Add Commodity Fee"
        >
            <AddCircle />
        </Button>
    );
};
