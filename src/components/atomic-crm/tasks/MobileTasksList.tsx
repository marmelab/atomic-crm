import { MobileContent } from "../layout/MobileContent";
import MobileHeader from "../layout/MobileHeader";
import { AddTask } from "./AddTask";
import { TasksListContent } from "./TasksListContent";
import { useTranslate } from "ra-core";

// Manual Task UX repair: mirrors desktop Dashboard's TasksList.tsx, which
// already has this icon button next to its header — mobile had no way to
// create a Task at all from this global (cross-contact) surface. No single
// Contact context here, so selectContact matches the desktop usage too.
export const MobileTasksList = () => {
  const translate = useTranslate();
  return (
    <>
      <MobileHeader>
        <h1 className="text-xl font-semibold">
          {translate("resources.tasks.name", { smart_count: 2 })}
        </h1>
        <AddTask display="icon" selectContact />
      </MobileHeader>
      <MobileContent>
        <TasksListContent />
      </MobileContent>
    </>
  );
};
