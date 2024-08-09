import { getExpectedAuthorization } from '../../../../supabase/functions/postmark/getExpectedAuthorization.js';
import { extractMailContactData } from '../../../../supabase/functions/postmark/extractMailContactData.js';

describe('getExpectedAuthorization', () => {
    it('should return the expected Authorization header from provided user and password', () => {
        const result = getExpectedAuthorization('testuser', 'testpwd');
        expect(result).toBe('Basic dGVzdHVzZXI6dGVzdHB3ZA==');
    });
});

describe('extractMailContactData', () => {
    it('should extract data from a single mail contact with a full name', () => {
        const result = extractMailContactData([
            {
                Email: 'firstname.lastname@marmelab.com',
                Name: 'Firstname Lastname',
            },
        ]);
        expect(result).toEqual({
            firstName: 'Firstname',
            lastName: 'Lastname',
            email: 'firstname.lastname@marmelab.com',
            domain: 'marmelab.com',
        });
    });

    it('should ignore extra recipients', () => {
        const result = extractMailContactData([
            {
                Email: 'firstname.lastname@marmelab.com',
                Name: 'Firstname Lastname',
            },
            {
                Email: 'john.doe@marmelab.com',
                Name: 'John Doe',
            },
        ]);
        expect(result).toEqual({
            firstName: 'Firstname',
            lastName: 'Lastname',
            email: 'firstname.lastname@marmelab.com',
            domain: 'marmelab.com',
        });
    });

    it('should use a single word name as last name', () => {
        const result = extractMailContactData([
            {
                Email: 'name@marmelab.com',
                Name: 'Name',
            },
        ]);
        expect(result).toEqual({
            firstName: '',
            lastName: 'Name',
            email: 'name@marmelab.com',
            domain: 'marmelab.com',
        });
    });

    it('should support multi word last name', () => {
        const result = extractMailContactData([
            {
                Email: 'multi.word.name@marmelab.com',
                Name: 'Multi Word Name',
            },
        ]);
        expect(result).toEqual({
            firstName: 'Multi',
            lastName: 'Word Name',
            email: 'multi.word.name@marmelab.com',
            domain: 'marmelab.com',
        });
    });
});
