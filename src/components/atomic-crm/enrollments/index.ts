import { ClientList } from "./ClientList";
import { ClientShow } from "./ClientShow";
import { ClientEdit } from "./ClientEdit";

// Registered under the "enrollments" resource name (matches the table), but
// presented to the owner as "Clients" — see enrollmentConstants.ts / the
// englishCrmMessages.ts resources.enrollments.name translation.
export default {
  list: ClientList,
  show: ClientShow,
  edit: ClientEdit,
};
