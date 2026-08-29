import { GraphCompanyList } from "../graph/GraphCompanyList";
import { GraphCompanyShow } from "../graph/GraphCompanyShow";
import { CompanyCreate } from "./CompanyCreate";
import { CompanyEdit } from "./CompanyEdit";

export default {
  list: GraphCompanyList,
  create: CompanyCreate,
  edit: CompanyEdit,
  show: GraphCompanyShow,
};
