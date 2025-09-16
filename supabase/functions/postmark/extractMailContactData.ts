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
  }[],
) => {
  return ToFull.map((contact) => {
    const domain = contact.Email.split("@").at(-1)!;
    const fullName =
      contact.Name ||
      contact.Email.split("@").slice(0, -1).join(" ").split(".").join(" ");
    let firstName = "";
    let lastName = fullName;
    if (fullName && fullName.includes(" ")) {
      const parts = fullName.split(" ");
      firstName = parts[0];
      lastName = parts.slice(1).join(" ");
    }
    return { firstName, lastName, email: contact.Email, domain };
  });
};
