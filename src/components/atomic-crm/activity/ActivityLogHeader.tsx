import { useIsMobile } from "@/hooks/use-mobile";
import { RelativeDate } from "../misc/RelativeDate";
import type { Activity } from "../types";
import { useActivityLogContext } from "./ActivityLogContext";

export const ActivityLogHeader = ({
  activity,
  avatar,
  children,
}: {
  activity: Activity;
  avatar: React.ReactNode;
  children: React.ReactNode;
}) => {
  const context = useActivityLogContext();
  const isMobile = useIsMobile();

  return (
    <div className="p-0 w-full">
      <div className="flex flex-row space-x-1 items-center w-full">
        <div>{avatar}</div>

        <div className="text-sm text-muted-foreground flex-grow">
          {children}
          {isMobile ? (
            <>
              &nbsp;at <RelativeDate date={activity.date} />
            </>
          ) : null}
        </div>
        {context === "company" && !isMobile && (
          <span className="text-muted-foreground text-sm">
            <RelativeDate date={activity.date} />
          </span>
        )}
      </div>
    </div>
  );
};
