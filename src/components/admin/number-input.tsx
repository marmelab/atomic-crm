import * as React from 'react';
import { useEffect, useState } from 'react';
import {
    FieldTitle,
    type InputProps,
    useInput,
    useResourceContext,
} from 'ra-core';
import { FormControl, FormField, FormLabel } from '@/components/admin/form';
import { Input } from '@/components/ui/input';
import { FormError } from '@/components/admin/form';
import { InputHelperText } from '@/components/admin/input-helper-text';
import { cn } from '@/lib/utils';

export const NumberInput = (props: NumberInputProps) => {
    const {
        label,
        source,
        className,
        resource: resourceProp,
        validate: _validateProp,
        format: _formatProp,
        parse = convertStringToNumber,
        onFocus,
        labelInline,
        ...rest
    } = props;
    const resource = useResourceContext({ resource: resourceProp });

    const { id, field, isRequired } = useInput(props);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        const numberValue = parse(value);

        setValue(value);
        field.onChange(numberValue ?? 0);
    };

    const [value, setValue] = useState<string | undefined>(
        field.value?.toString() ?? ''
    );

    const hasFocus = React.useRef(false);

    const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
        onFocus?.(event);
        hasFocus.current = true;
    };

    const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
        field.onBlur?.(event);
        hasFocus.current = false;
        setValue(field.value?.toString() ?? '');
    };

    useEffect(() => {
        if (!hasFocus.current) {
            setValue(field.value?.toString() ?? '');
        }
    }, [field.value]);

    return (
        <FormField
            id={id}
            className={cn(
                className,
                'w-full',
                labelInline && 'md:flex md:items-start md:gap-4'
            )}
            name={field.name}
        >
            {label !== false && (
                <FormLabel className={cn(labelInline && 'md:pt-2 md:min-w-32')}>
                    <FieldTitle
                        label={label}
                        source={source}
                        resource={resource}
                        isRequired={isRequired}
                    />
                </FormLabel>
            )}
            <div className={cn(labelInline && 'md:flex-1')}>
                <FormControl>
                    <Input
                        {...rest}
                        {...field}
                        type="number"
                        value={value}
                        onChange={handleChange}
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                    />
                </FormControl>
                <InputHelperText helperText={props.helperText} />
                <FormError />
            </div>
        </FormField>
    );
};

export interface NumberInputProps
    extends InputProps,
        Omit<
            React.ComponentProps<'input'>,
            'defaultValue' | 'onBlur' | 'onChange' | 'type'
        > {
    parse?: (value: string) => number;
    labelInline?: boolean;
}

const convertStringToNumber = (value?: string | null) => {
    if (value == null || value === '') {
        return null;
    }
    const float = parseFloat(value);

    return isNaN(float) ? 0 : float;
};
