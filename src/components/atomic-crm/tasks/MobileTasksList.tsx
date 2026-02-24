import { MobileContent } from "../layout/MobileContent";
import MobileHeader from "../layout/MobileHeader";
import { TasksListContent } from "./TasksListContent";
import { useTranslate } from "ra-core";

export const MobileTasksList = () => {
  const translate = useTranslate();
  return (
    <>
      <MobileHeader>
        <h1 className="text-xl font-semibold">
          {translate("resources.tasks.name", { smart_count: 2, _: "Tasks" })}
        </h1>
      </MobileHeader>
      <MobileContent>
        <TasksListContent />
      </MobileContent>
    </>
  );
};
