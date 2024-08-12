import { extractMailContactData } from '../../../../supabase/functions/postmark/extractMailContactData.js';
import { getExpectedAuthorization } from '../../../../supabase/functions/postmark/getExpectedAuthorization.js';

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
        expect(result).toEqual([
            {
                firstName: 'Firstname',
                lastName: 'Lastname',
                email: 'firstname.lastname@marmelab.com',
                domain: 'marmelab.com',
            },
        ]);
    });

    it('should support extra recipients', () => {
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
        expect(result).toEqual([
            {
                firstName: 'Firstname',
                lastName: 'Lastname',
                email: 'firstname.lastname@marmelab.com',
                domain: 'marmelab.com',
            },
            {
                firstName: 'John',
                lastName: 'Doe',
                email: 'john.doe@marmelab.com',
                domain: 'marmelab.com',
            },
        ]);
    });

    it('should use a single word name as last name', () => {
        const result = extractMailContactData([
            {
                Email: 'name@marmelab.com',
                Name: 'Name',
            },
        ]);
        expect(result).toEqual([
            {
                firstName: '',
                lastName: 'Name',
                email: 'name@marmelab.com',
                domain: 'marmelab.com',
            },
        ]);
    });

    it('should support multi word last name', () => {
        const result = extractMailContactData([
            {
                Email: 'multi.word.name@marmelab.com',
                Name: 'Multi Word Name',
            },
        ]);
        expect(result).toEqual([
            {
                firstName: 'Multi',
                lastName: 'Word Name',
                email: 'multi.word.name@marmelab.com',
                domain: 'marmelab.com',
            },
        ]);
    });

    it('should support multiple @ in email', () => {
        // Because it is allowed by https://www.rfc-editor.org/rfc/rfc5322
        const result = extractMailContactData([
            {
                Email: '"john@doe"@marmelab.com',
                Name: 'John Doe',
            },
        ]);
        expect(result).toEqual([
            {
                firstName: 'John',
                lastName: 'Doe',
                email: '"john@doe"@marmelab.com',
                domain: 'marmelab.com',
            },
        ]);
    });

    it('should use first part of email when Name is empty', () => {
        const result = extractMailContactData([
            {
                Email: 'john.doe@marmelab.com',
                Name: '',
            },
        ]);
        expect(result).toEqual([
            {
                firstName: 'john',
                lastName: 'doe',
                email: 'john.doe@marmelab.com',
                domain: 'marmelab.com',
            },
        ]);
    });

    it('should use first part of email when Name is empty and support single word', () => {
        const result = extractMailContactData([
            {
                Email: 'john@marmelab.com',
                Name: '',
            },
        ]);
        expect(result).toEqual([
            {
                firstName: '',
                lastName: 'john',
                email: 'john@marmelab.com',
                domain: 'marmelab.com',
            },
        ]);
    });

    it('should use first part of email when Name is empty and support multiple words', () => {
        const result = extractMailContactData([
            {
                Email: 'john.doe.multi@marmelab.com',
                Name: '',
            },
        ]);
        expect(result).toEqual([
            {
                firstName: 'john',
                lastName: 'doe multi',
                email: 'john.doe.multi@marmelab.com',
                domain: 'marmelab.com',
            },
        ]);
    });

    it('should support empty Name and multiple @ in email', () => {
        // Because it is allowed by https://www.rfc-editor.org/rfc/rfc5322
        const result = extractMailContactData([
            {
                Email: '"john@doe"@marmelab.com',
                Name: '',
            },
        ]);
        expect(result).toEqual([
            {
                firstName: '"john',
                lastName: 'doe"',
                email: '"john@doe"@marmelab.com',
                domain: 'marmelab.com',
            },
        ]);
    });
});
