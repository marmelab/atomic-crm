import type { Contact } from "../types";
import { GraphContactList } from "../graph/GraphContactList";
import { GraphContactShow } from "../graph/GraphContactShow";
import { ContactCreate } from "./ContactCreate";
import { ContactEdit } from "./ContactEdit";

export default {
  list: GraphContactList,
  show: GraphContactShow,
  edit: ContactEdit,
  create: ContactCreate,
  recordRepresentation: (record: Contact) =>
    record?.first_name + " " + record?.last_name,
};
