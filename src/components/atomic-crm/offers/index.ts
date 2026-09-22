import { OfferCreate } from "./OfferCreate";
import { OfferEdit } from "./OfferEdit";
import { OfferList } from "./OfferList";
import { OfferShow } from "./OfferShow";

export default {
  list: OfferList,
  show: OfferShow,
  create: OfferCreate,
  edit: OfferEdit,
  recordRepresentation: "name",
};
