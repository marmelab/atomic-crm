import { MobileContent } from "../layout/MobileContent";
import { MobilePageTitle } from "../layout/MobilePageTitle";
import { TasksListContent } from "./TasksListContent";

export const MobileTasksList = () => (
  <MobileContent>
    <MobilePageTitle title="Promemoria" />
    <TasksListContent />
  </MobileContent>
);
