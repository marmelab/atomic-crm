import { MobileContent } from "../layout/MobileContent";
import MobileHeader from "../layout/MobileHeader";
import { TasksListContent } from "./TasksListContent";

export const MobileTasksList = () => (
  <>
    <MobileHeader>
      <h1 className="text-xl font-semibold">Tasks</h1>
    </MobileHeader>
    <MobileContent>
      <TasksListContent />
    </MobileContent>
  </>
);
