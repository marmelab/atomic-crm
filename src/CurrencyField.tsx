import {
    TextFieldProps,
    useRecordContext,
    sanitizeFieldRestProps,
} from 'react-admin';

import { Typography } from '@mui/material';

export const CurrencyField = (props: TextFieldProps) => {
    const record = useRecordContext();

    const { className, emptyText, ...rest } = props;

    if (!record) return null;
    const val = record[props.source];

    if (val === null || val === undefined) return null;

    const formatted = val.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        currencyDisplay: 'narrowSymbol',
    });

    return (
        <Typography
            component="span"
            variant="body2"
            className={className}
            {...sanitizeFieldRestProps(rest)}
        >
            {formatted}
        </Typography>
    );
};
