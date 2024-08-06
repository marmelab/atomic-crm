const IN_FILTER_REGEX = /^\([a-z0-9-]+(,[a-z0-9-]+)*\)$/i;

export function transformInFilter(value: any) {
    if (typeof value !== 'string' || !value.match(IN_FILTER_REGEX)) {
        throw new Error(
            `Invalid '@in' filter value, expected a string matching '(\\d+(,\\d)*)', got: ${value}`
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
