const CONTAINS_FILTER_REGEX = /^\{[a-z0-9-]+(,[a-z0-9-]+)*\}$/i;

export function transformContainsFilter(value: any) {
    if (typeof value !== 'string' || !value.match(CONTAINS_FILTER_REGEX)) {
        throw new Error(
            `Invalid '@cs' filter value, expected a string matching '\\{[a-z0-9-]+(,[a-z0-9-]+)*\\}', got: ${value}`
        );
    }

    return value
        .slice(1, -1)
        .split(',')
        .map((v: string) => {
            const parsedFloat = Number.parseFloat(v);
            if (!Number.isNaN(parsedFloat)) {
                return parsedFloat;
            }
            return v;
        });
}
