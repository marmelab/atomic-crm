export const IN_FILTER_REGEX =
    /^\([A-Za-zÀ-ÖØ-öø-ÿ0-9-]+(,[A-Za-zÀ-ÖØ-öø-ÿ0-9-]+)*\)$/i;

export function transformInFilter(value: any) {
    if (value === '()') {
        return [];
    }

    if (typeof value !== 'string' || !value.match(IN_FILTER_REGEX)) {
        throw new Error(
            `Invalid '@in' filter value, expected a string matching '${IN_FILTER_REGEX.source}', got: ${value}`
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
