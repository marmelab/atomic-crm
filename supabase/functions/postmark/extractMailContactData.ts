import { parse } from "tldts";

const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

export function extractCompanyName(domain: string) {
  if (!domain) return "";
  let name = domain.split(".").at(-2) || domain;

  const parseResult = parse(domain);
  if (parseResult.domainWithoutSuffix) {
    name = parseResult.domainWithoutSuffix;
  }

  const humanizedName = name
    .replace(/[-_]+/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  return humanizedName;
}

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
  return ToFull.map((contact) => ({
    ...contact,
    Email: (contact.Email || "").toLowerCase(),
  })).map((contact) => {
    const domain = (contact.Email.split("@").at(-1) || "").toLowerCase();
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
    const companyName = extractCompanyName(domain);
    const website = `https://${domain}`;

    return {
      firstName: capitalize(firstName),
      lastName: capitalize(lastName),
      email: contact.Email,
      domain,
      companyName,
      website,
    };
  });
};
