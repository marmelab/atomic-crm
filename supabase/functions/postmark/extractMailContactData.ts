/**
 * Extracts the first name, last name, email, and domain from a mail contact.
 *
 * Example:
 *   "ToFull": [
 *     {
 *       "Email": "firstname.lastname@marmelab.com",
 *       "Name": "Firstname Lastname"
 *     }
 *   ]
 *
 * Return Value:
 *  {
 *    firstName: "Firstname",
 *    lastName: "Lastname",
 *    email: "firstname.lastname@marmelab.com",
 *    domain: "marmelab.com"
 * }
 *
 */
export const extractMailContactData = (
    ToFull: {
        Email: string;
        Name: string;
    }[]
) => {
    // We only support one recipient for now
    const contact = ToFull[0];

    const domain = contact.Email.split('@').at(-1);
    const fullName = contact.Name;
    let firstName = '';
    let lastName = fullName;
    if (fullName && fullName.includes(' ')) {
        const parts = fullName.split(' ');
        firstName = parts[0];
        lastName = parts.slice(1).join(' ');
    }
    return { firstName, lastName, email: contact.Email, domain };
};
