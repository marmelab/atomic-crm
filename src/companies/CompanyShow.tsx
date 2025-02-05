import AddCircle from '@mui/icons-material/AddCircleOutline';
import {
    Box,
    Button,
    Card,
    CardContent,
    List,
    ListItem,
    ListItemAvatar,
    ListItemButton,
    ListItemSecondaryAction,
    ListItemText,
    Stack,
    Typography,
} from '@mui/material';
import { formatDistance } from 'date-fns';
import {
    RecordContextProvider,
    ReferenceManyField,
    ShowBase,
    SortButton,
    TabbedShowLayout,
    useListContext,
    useRecordContext,
    useShowContext,
    List as RaList,
    Datagrid,
    TextField,
    BooleanField,
    TopToolbar,
    ExportButton,
    Button as RaButton,
    useRefresh,
    ReferenceField,
} from 'react-admin';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';

import { Avatar } from '../contacts/Avatar';
import { TagsList } from '../contacts/TagsList';
import { findDealLabel } from '../deals/deal';
import { Status } from '../misc/Status';
import { useConfigurationContext } from '../root/ConfigurationContext';
import { Company, Contact, Deal } from '../types';
import { CompanyAside } from './CompanyAside';
import { CompanyAvatar } from './CompanyAvatar';

import { Location } from '../types';
import { CurrencyField } from '../CurrencyField';

export const CompanyShow = () => (
    <ShowBase>
        <CompanyShowContent />
    </ShowBase>
);

const CompanyShowContent = () => {
    const { record, isPending } = useShowContext<Company>();
    const location = useLocation();
    const refresh = useRefresh();

    const navigate = useNavigate();

    if (isPending || !record) return null;

    return (
        <Box mt={2} display="flex">
            <Box flex="1">
                <Card>
                    <CardContent>
                        <Box display="flex" mb={1}>
                            <CompanyAvatar />
                            <Typography variant="h5" ml={2} flex="1">
                                {record.name}
                            </Typography>
                        </Box>

                        <TabbedShowLayout
                            sx={{
                                '& .RaTabbedShowLayout-content': { p: 0, m: 0 },
                                '& .MuiStack-root': { p: 0, m: 0 },
                                '& .RaLabeled-label': { p: 0, m: 0 },
                            }}
                            spacing={0}
                            divider={null}
                        >
                            <TabbedShowLayout.Tab
                                label={
                                    !record.nb_contacts
                                        ? 'No Contacts'
                                        : record.nb_contacts === 1
                                          ? '1 Contact'
                                          : `${record.nb_contacts} Contacts`
                                }
                                // path="contacts"
                            >
                                <ReferenceManyField
                                    reference="contacts_summary"
                                    target="company_id"
                                    sort={{ field: 'last_name', order: 'ASC' }}
                                >
                                    <Stack
                                        direction="row"
                                        justifyContent="flex-end"
                                        spacing={2}
                                        mt={1}
                                    >
                                        {!!record.nb_contacts && (
                                            <SortButton
                                                fields={[
                                                    'last_name',
                                                    'first_name',
                                                    'last_seen',
                                                ]}
                                            />
                                        )}
                                        <CreateRelatedContactButton />
                                    </Stack>
                                    <ContactsIterator />
                                </ReferenceManyField>
                            </TabbedShowLayout.Tab>

                            <TabbedShowLayout.Tab
                                label={
                                    !record.nb_locations
                                        ? 'No Locations'
                                        : record.nb_locations === 1
                                          ? '1 Location'
                                          : `${record.nb_locations} Locations`
                                }
                                path="locations"
                            >
                                <RaList<Location>
                                    resource="locations"
                                    filter={{ company_id: record.id }}
                                    disableSyncWithLocation
                                    actions={
                                        <TopToolbar>
                                            <CreateRelatedLocationButton
                                                pathname={location.pathname}
                                            />
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
                                            <CreateRelatedLocationButton
                                                pathname={location.pathname}
                                            />
                                        </Stack>
                                    }
                                >
                                    <Datagrid
                                        bulkActionButtons={false}
                                        rowClick={(
                                            _id: string | number,
                                            _resource: string,
                                            record: any
                                        ) => {
                                            navigate(
                                                `/locations/${record.id}/show`,
                                                {
                                                    state: {
                                                        from: location.pathname,
                                                        redirect_on_save:
                                                            location.pathname,
                                                    },
                                                }
                                            );

                                            refresh();

                                            return false;
                                        }}
                                    >
                                        <TextField source="name" />
                                        <BooleanField source="active" />
                                    </Datagrid>
                                </RaList>
                            </TabbedShowLayout.Tab>

                            <TabbedShowLayout.Tab
                                label="Product Fees"
                                path="product_fees"
                            >
                                <Typography variant="h6" ml={1} mt={2} flex="1">
                                    Agent Fees (materials)
                                </Typography>
                                <Typography
                                    variant="caption"
                                    mb={0}
                                    ml={1}
                                    flex="1"
                                    color="grey"
                                >
                                    Overrides company-level agent fee;
                                    overridden by commodity-level fee with the
                                    same material
                                </Typography>

                                <RaList
                                    resource="company_material_fees"
                                    filter={{ company_id: record.id }}
                                    disableSyncWithLocation
                                    actions={
                                        <TopToolbar>
                                            <CreateRelatedMaterialFeeButton
                                                pathname={location.pathname}
                                            />
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
                                            <CreateRelatedMaterialFeeButton
                                                pathname={location.pathname}
                                            />
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

                                        <CurrencyField
                                            source="fee"
                                            label="Fee ($/mt)"
                                        />
                                    </Datagrid>
                                </RaList>

                                <Typography
                                    variant="h6"
                                    ml={1}
                                    mt={0}
                                    mb={0}
                                    flex="1"
                                >
                                    Agent Fees (commodities)
                                </Typography>
                                <Typography
                                    variant="caption"
                                    mb={0}
                                    ml={1}
                                    flex="1"
                                    color="grey"
                                >
                                    Overrides company-level agent fee and
                                    material-level fees
                                </Typography>

                                <RaList
                                    resource="company_commodity_fees"
                                    filter={{ company_id: record.id }}
                                    disableSyncWithLocation
                                    actions={
                                        <TopToolbar>
                                            <CreateRelatedCommodityFeeButton
                                                pathname={location.pathname}
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
                                                <CreateRelatedCommodityFeeButton
                                                    pathname={location.pathname}
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

                                        <CurrencyField
                                            source="fee"
                                            label="Fee ($/mt)"
                                        />
                                    </Datagrid>
                                </RaList>
                            </TabbedShowLayout.Tab>

                            {record.nb_deals ? (
                                <TabbedShowLayout.Tab
                                    label={
                                        record.nb_deals === 1
                                            ? '1 deal'
                                            : `${record.nb_deals} deals`
                                    }
                                    path="deals"
                                >
                                    <ReferenceManyField
                                        reference="deals"
                                        target="company_id"
                                        sort={{ field: 'name', order: 'ASC' }}
                                    >
                                        <DealsIterator />
                                    </ReferenceManyField>
                                </TabbedShowLayout.Tab>
                            ) : null}
                        </TabbedShowLayout>
                    </CardContent>
                </Card>
            </Box>
            <CompanyAside />
        </Box>
    );
};

const ContactsIterator = () => {
    const location = useLocation();
    const { data: contacts, error, isPending } = useListContext<Contact>();

    if (isPending || error) return null;

    const now = Date.now();
    return (
        <List dense sx={{ pt: 0 }}>
            {contacts.map(contact => (
                <RecordContextProvider key={contact.id} value={contact}>
                    <ListItem disablePadding>
                        <ListItemButton
                            component={RouterLink}
                            to={`/contacts/${contact.id}/show`}
                            state={{ from: location.pathname }}
                        >
                            <ListItemAvatar>
                                <Avatar />
                            </ListItemAvatar>
                            <ListItemText
                                primary={`${contact.first_name} ${contact.last_name}`}
                                secondary={
                                    <>
                                        {contact.title}
                                        {contact.nb_tasks
                                            ? ` - ${contact.nb_tasks} task${
                                                  contact.nb_tasks > 1
                                                      ? 's'
                                                      : ''
                                              }`
                                            : ''}
                                        &nbsp; &nbsp;
                                        <TagsList />
                                    </>
                                }
                            />
                            {contact.last_seen && (
                                <ListItemSecondaryAction>
                                    <Typography
                                        variant="body2"
                                        color="textSecondary"
                                        component="span"
                                    >
                                        last activity{' '}
                                        {formatDistance(contact.last_seen, now)}{' '}
                                        ago <Status status={contact.status} />
                                    </Typography>
                                </ListItemSecondaryAction>
                            )}
                        </ListItemButton>
                    </ListItem>
                </RecordContextProvider>
            ))}
        </List>
    );
};

const CreateRelatedContactButton = () => {
    const company = useRecordContext<Company>();
    return (
        <Button
            component={RouterLink}
            to="/contacts/create"
            state={company ? { record: { company_id: company.id } } : undefined}
            color="primary"
            size="small"
            startIcon={<AddCircle />}
        >
            Add contact
        </Button>
    );
};

const CreateRelatedLocationButton = (props: { pathname: string }) => {
    const { pathname } = props;
    const company = useRecordContext<Company>();

    const state = pathname
        ? {
              from: pathname,
              redirect_on_save: pathname,
              record: { company_id: company?.id },
          }
        : undefined;

    return (
        <RaButton
            component={RouterLink}
            to="/locations/create"
            state={state}
            label="Add location"
        >
            <AddCircle />
        </RaButton>
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
        <RaButton
            component={RouterLink}
            to="/company_material_fees/create"
            state={state}
            label="Add Material Fee"
        >
            <AddCircle />
        </RaButton>
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
        <RaButton
            component={RouterLink}
            to="/company_commodity_fees/create"
            state={state}
            label="Add Commodity Fee"
        >
            <AddCircle />
        </RaButton>
    );
};

const DealsIterator = () => {
    const { data: deals, error, isPending } = useListContext<Deal>();
    const { dealStages } = useConfigurationContext();
    if (isPending || error) return null;

    const now = Date.now();
    return (
        <Box>
            <List dense>
                {deals.map(deal => (
                    <ListItem disablePadding key={deal.id}>
                        <ListItemButton
                            component={RouterLink}
                            to={`/deals/${deal.id}/show`}
                        >
                            <ListItemText
                                primary={deal.name}
                                secondary={
                                    <>
                                        {findDealLabel(dealStages, deal.stage)},{' '}
                                        {deal.amount.toLocaleString('en-US', {
                                            notation: 'compact',
                                            style: 'currency',
                                            currency: 'USD',
                                            currencyDisplay: 'narrowSymbol',
                                            minimumSignificantDigits: 3,
                                        })}
                                        {deal.category
                                            ? `, ${deal.category}`
                                            : ''}
                                    </>
                                }
                            />
                            <ListItemSecondaryAction>
                                <Typography
                                    variant="body2"
                                    color="textSecondary"
                                    component="span"
                                >
                                    last activity{' '}
                                    {formatDistance(deal.updated_at, now)} ago{' '}
                                </Typography>
                            </ListItemSecondaryAction>
                        </ListItemButton>
                    </ListItem>
                ))}
            </List>
        </Box>
    );
};
