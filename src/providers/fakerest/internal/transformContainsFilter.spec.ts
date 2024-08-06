// sum.test.js
import { transformContainsFilter } from './transformContainsFilter';

it('should throw an error if the filter is not a string', () => {
    expect(() => transformContainsFilter(1)).toThrow(
        "Invalid '@cs' filter value, expected a string matching '\\{[a-z0-9-]+(,[a-z0-9-]+)*\\}', got: 1"
    );
});

it('should throw an error if the filter does not match pattern', () => {
    expect(() => transformContainsFilter('1,2')).toThrow(
        "Invalid '@cs' filter value, expected a string matching '\\{[a-z0-9-]+(,[a-z0-9-]+)*\\}', got: 1,2"
    );
});

it('should return an array of numbers', () => {
    expect(transformContainsFilter('{1}')).toEqual([1]);
    expect(transformContainsFilter('{1,2,3}')).toEqual([1, 2, 3]);
});

it('should return an array of strings', () => {
    expect(transformContainsFilter('{a}')).toEqual(['a']);
    expect(transformContainsFilter('{a,B,c-d}')).toEqual(['a', 'B', 'c-d']);
});
