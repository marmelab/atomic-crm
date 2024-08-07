export const CONTAINS_FILTER_REGEX =
    /^\{[A-Za-zÀ-ÖØ-öø-ÿ0-9-]+(,[A-Za-zÀ-ÖØ-öø-ÿ0-9-]+)*\}$/i;

export function transformContainsFilter(value: any) {
    if (value === '{}') {
        return [];
    }

    if (typeof value !== 'string' || !value.match(CONTAINS_FILTER_REGEX)) {
        throw new Error(
            `Invalid '@cs' filter value, expected a string matching '${CONTAINS_FILTER_REGEX.source}', got: ${value}`
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
