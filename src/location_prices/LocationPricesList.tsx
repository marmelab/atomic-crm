import { useState, useEffect } from 'react';

import {
    List,
    Datagrid,
    TextField,
    TextFieldProps,
    useRecordContext,
    ListProps,
    BooleanField,
    TopToolbar,
    ExportButton,
    Button,
    useNotify,
    EditBase,
    Toolbar,
    BulkDeleteWithConfirmButton,
    Form,
    RaRecord,
    TextInput,
    useGetIdentity,
    useUnselectAll,
    useStore,
    BulkUpdateWithConfirmButton,
    useRefresh,
    BooleanInput,
} from 'react-admin';

import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningIcon from '@mui/icons-material/Warning';
import ReportIcon from '@mui/icons-material/Report';

import {
    DialogContent,
    Dialog,
    DialogTitle,
    Tooltip,
    Typography,
} from '@mui/material';
import { Card, CardContent, Stack, Divider } from '@mui/material';

import { StandardCSSProperties } from '@mui/system/styleFunctionSx';

import { Link } from 'react-router-dom';
import AddCircle from '@mui/icons-material/AddCircleOutline';

import { CurrencyField } from '../CurrencyField';

import { MaterialEditFields } from '../location_prices/LocationPricesCreate';

import { IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

export const DialogCloseButton = ({
    onClose,
    top = 8,
    right = 8,
    color,
}: {
    onClose: () => void;
    top?: number;
    right?: number;
    color?: string;
}) => {
    return (
        <IconButton
            aria-label="close"
            onClick={onClose}
            sx={{
                position: 'absolute',
                right,
                top,
                color: theme => (color ? color : theme.palette.grey[500]),
            }}
        >
            <CloseIcon />
        </IconButton>
    );
};

const ValueField = (props: TextFieldProps) => {
    const record = useRecordContext();
    if (!record) return null;

    if (record.price_type === 'PERCENT')
        if ((record[props.source] ?? null) !== null)
            return `${record[props.source]}%`;
        else return null;

    return <CurrencyField source={props.source} />;
};

const EditDialog = (props: {
    record: RaRecord | null;
    handleClose: () => void;
}) => {
    const { identity } = useGetIdentity();
    const notify = useNotify();
    const { record, handleClose } = props;

    if (record === null) return null;

    const {
        id,

        location_is_active,
        commodity_is_active,
        material_is_active,
        commodity_name,
        material_name,
    } = record;

    return (
        <Dialog
            open={true}
            onClose={handleClose}
            fullWidth
            maxWidth="md"
            sx={{
                '& .MuiDialog-container': {
                    alignItems: 'flex-start',
                },
            }}
        >
            <EditBase
                resource="location_prices"
                id={id}
                mutationMode="pessimistic"
                mutationOptions={{
                    onSuccess: () => {
                        notify('Record updated');
                        handleClose();
                    },
                    onError: () => {
                        notify('Update failed');
                        return;
                    },
                }}
                queryOptions={{
                    onError: () => {
                        notify(`Error reading record ${id}`);
                        handleClose();
                    },
                }}
                transform={(data: any) => {
                    const ret = { ...data };

                    ret.sales_id = identity?.id;
                    ret.validation_date = new Date().toISOString();

                    return ret;
                }}
            >
                <DialogCloseButton onClose={handleClose} top={13} />
                <DialogTitle
                    sx={{
                        paddingBottom: 0,
                    }}
                >
                    Price update and validation for record #{id}
                </DialogTitle>
                <Form>
                    <DialogContent>
                        <Card>
                            <CardContent>
                                <Stack gap={4} direction="row">
                                    <TextInput source="company_name" disabled />
                                    <TextInput
                                        source="location_name"
                                        disabled
                                        format={v =>
                                            location_is_active
                                                ? v
                                                : `${v} (archived)`
                                        }
                                    />
                                </Stack>

                                <Divider sx={{ marginBottom: '8px' }} />
                                {commodity_is_active === false && (
                                    <div style={{ color: 'red' }}>
                                        Commodity ({commodity_name}) is archived
                                    </div>
                                )}
                                {material_is_active === false && (
                                    <div style={{ color: 'red' }}>
                                        Commodity material ({material_name}) is
                                        archived
                                    </div>
                                )}

                                <MaterialEditFields
                                    active_commodities={false}
                                />
                                <BooleanInput source="active" />
                            </CardContent>
                            <Toolbar />
                        </Card>
                    </DialogContent>
                </Form>
            </EditBase>
        </Dialog>
    );
};

const LastUpdated = (_props: TextFieldProps) => {
    const record = useRecordContext();
    if (!record) return null;
    let validation_date = record.validation_date;

    if (!validation_date) return null;

    validation_date = validation_date.replace('T', ' ').replace(/\.\d+$/, 'Z');

    const dt = new Date(validation_date);
    const age_hh = (Date.now() - dt.getTime()) / 1000 / 60 / 60;

    if (age_hh < 12) {
        return (
            <Tooltip
                title={
                    <span style={{ fontSize: '14px' }}>
                        <div>Last updated within last 12 hours</div>
                        <div>Last update: {dt.toLocaleString()}</div>
                    </span>
                }
            >
                <Typography component="span" variant="body2">
                    <CheckCircleOutlineIcon
                        style={{
                            color: 'green',
                            display: 'inline-flex',
                            verticalAlign: 'middle',
                            lineHeight: 0,
                        }}
                        fontSize="small"
                    />
                </Typography>
            </Tooltip>
        );
    } else if (age_hh < 24) {
        return (
            <Tooltip
                title={
                    <span style={{ fontSize: '14px' }}>
                        <div>Last updated more than 12 hours ago</div>
                        <div>Last update: {dt.toLocaleString()}</div>
                    </span>
                }
            >
                <Typography component="span" variant="body2">
                    <WarningIcon
                        style={{
                            color: 'orange',
                            display: 'inline-flex',
                            verticalAlign: 'middle',
                            lineHeight: 0,
                        }}
                        fontSize="small"
                    />
                </Typography>
            </Tooltip>
        );
    }

    return (
        <Tooltip
            title={
                <span style={{ fontSize: '14px' }}>
                    <div>Last updated more than 24 hours ago</div>
                    <div>Last update: {dt.toLocaleString()}</div>
                </span>
            }
        >
            <Typography component="span" variant="body2">
                <ReportIcon
                    style={{
                        color: 'red',
                        display: 'inline-flex',
                        verticalAlign: 'middle',
                        lineHeight: 0,
                    }}
                    fontSize="small"
                />
            </Typography>
        </Tooltip>
    );
};

export const LocationPricesList = (props: Omit<ListProps, 'children'>) => {
    const {
        sort = { field: 'id', order: 'ASC' },
        perPage = 25,
        ...rest
    } = props;

    const refresh = useRefresh();

    const [editDialog, setEditDialog] = useState<RaRecord | null>(null);

    const handleClose = () => {
        setEditDialog(null);
    };

    return (
        <>
            <List perPage={perPage} sort={sort} {...rest}>
                <Datagrid
                    rowSx={record => {
                        // if (record.location_is_active) return {};

                        const validation_date_str = (
                            record.validation_date ?? ''
                        )
                            .replace('T', ' ')
                            .replace(/\.\d+$/, 'Z');

                        const validation_date = new Date(validation_date_str);

                        const age_hh =
                            (Date.now() - validation_date.getTime()) /
                            1000 /
                            60 /
                            60;

                        const ret: StandardCSSProperties = {};

                        if (age_hh >= 12) ret.backgroundColor = '#FFF9C4';
                        if (!record.active) {
                            ret.textDecoration = 'line-through';
                            ret.color = 'grey';
                        }

                        return ret;
                    }}
                    sx={{
                        '& .MuiTableCell-root': { color: 'unset' },
                        '& .MuiTableRow-root:hover': {
                            backgroundColor: '#E0E0E0',
                        },
                    }}
                    rowClick={(_id, _blankresource, record) => {
                        setEditDialog(record);
                        return false;
                    }}
                    bulkActionButtons={
                        <>
                            <BulkUpdateWithConfirmButton
                                data={{
                                    validation_date: new Date().toISOString(),
                                }}
                                confirmContent="Are you sure you want to mark prices as validated?"
                                label="Confirm prices"
                                mutationOptions={{
                                    onSettled: (
                                        data,
                                        error,
                                        variables,
                                        context
                                    ) => {
                                        refresh();
                                        console.log({
                                            data,
                                            error,
                                            variables,
                                            context,
                                        });
                                    },
                                }}
                            />
                            <BulkDeleteWithConfirmButton mutationMode="pessimistic" />
                        </>
                    }
                >
                    <TextField source="company_name" />
                    <TextField source="location_name" />
                    <BooleanField
                        source="location_is_active"
                        label="Active Location?"
                        sx={{
                            '& .RaBooleanField-falseIcon': { color: 'red' },
                        }}
                    />
                    <TextField source="material_name" />
                    <TextField source="commodity_name" />
                    <TextField source="commodity_grade" />
                    <TextField source="market_type" />
                    <TextField source="price_type" />
                    <ValueField source="price_value" label="Price" />
                    <ValueField
                        source="market_price_fix"
                        label="Fixed Market"
                    />
                    <LastUpdated source="validation_date" label="Up to date?" />
                    <BooleanField
                        source="active"
                        sx={{
                            '& .RaBooleanField-falseIcon': { color: 'red' },
                        }}
                    />
                </Datagrid>
            </List>
            <EditDialog handleClose={handleClose} record={editDialog} />
        </>
    );
};

export const LocationTabPriceList = (props: {
    pathname: string;
    company_id: string | number;
    location_id?: string | number;
}) => {
    const { pathname, company_id, location_id } = props;

    const filter = { company_id, location_id };
    if (filter.location_id === undefined) delete filter.location_id;

    const [savedPath, setSavedPath] = useStore(
        'location_prices.selectedIds.pathname',
        pathname
    );

    const unselectAll = useUnselectAll('location_prices');

    useEffect(
        () => {
            if (savedPath !== pathname) {
                unselectAll();
            }
            setSavedPath(pathname);
        },

        [savedPath, pathname, setSavedPath, unselectAll] // make sure we unselect all when location or company changes or when table loads
    );

    return (
        <LocationPricesList
            resource="location_prices"
            disableSyncWithLocation={true}
            filter={filter}
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
            storeKey={`location_prices:${pathname}`}
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
    location_id?: string | number;
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
