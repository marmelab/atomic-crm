import { useTranslate } from "ra-core";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { AddTask } from "./AddTask";
import { TasksListByDueDate } from "./TasksListByDueDate";
import MobileHeader from "../layout/MobileHeader";
import { MobileContent } from "../layout/MobileContent";

export const MyTasksPage = () => {
  const translate = useTranslate();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center">
        <h1 className="text-xl font-semibold flex-1">
          {translate("crm.tasks.my_tasks", { _: "My tasks" })}
        </h1>
        <AddTask display="icon" selectContact />
      </div>
      <Card className="p-4">
        <MyTasksContent />
      </Card>
    </div>
  );
};

MyTasksPage.path = "/my-tasks";

export const MobileMyTasksPage = () => {
  const translate = useTranslate();

  return (
    <>
      <MobileHeader>
        <h1 className="text-xl font-semibold">
          {translate("crm.tasks.my_tasks", { _: "My tasks" })}
        </h1>
        <AddTask display="icon" selectContact />
      </MobileHeader>
      <MobileContent>
        <MyTasksContent />
      </MobileContent>
    </>
  );
};

const MyTasksContent = () => {
  const translate = useTranslate();

  return (
    <Tabs defaultValue="active" className="w-full gap-3">
      <div className="flex items-center">
        <TabsList className="h-8 rounded-full bg-muted/70 p-0.5">
          <TabsTrigger
            value="active"
            className="h-7 flex-none rounded-full px-3 text-xs font-semibold md:px-3.5 md:text-sm"
          >
            {translate("crm.tasks.active", { _: "To do" })}
          </TabsTrigger>
          <TabsTrigger
            value="archived"
            className="h-7 flex-none rounded-full px-3 text-xs font-semibold md:px-3.5 md:text-sm"
          >
            {translate("crm.tasks.archived", { _: "Archived" })}
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="active" className="mt-1">
        <TasksListByDueDate
          keepRecentlyDone={false}
          emptyPlaceholder={
            <p className="text-sm">
              {translate("crm.tasks.empty", {
                _: "Tasks added to your contacts will appear here.",
              })}
            </p>
          }
        />
      </TabsContent>
      <TabsContent value="archived" className="mt-1">
        <TasksListByDueDate
          view="archived"
          emptyPlaceholder={
            <p className="text-sm text-muted-foreground">
              {translate("crm.tasks.empty_archived", {
                _: "No archived tasks yet.",
              })}
            </p>
          }
        />
      </TabsContent>
    </Tabs>
  );
};
