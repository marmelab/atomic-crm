import { useTimeout } from "ra-core";
import type { ReactNode } from "react";

import { ListPlaceholder } from "./ListPlaceholder.tsx";

export const SimpleListLoading = (props: SimpleListLoadingProps) => {
  const {
    className,
    hasLeftAvatarOrIcon,
    hasRightAvatarOrIcon,
    hasSecondaryText,
    hasTertiaryText,
    nbFakeLines = 5,
    ...rest
  } = props;

  const oneSecondHasPassed = useTimeout(1000);

  return oneSecondHasPassed ? (
    <ul className={className} {...rest}>
      {times(nbFakeLines, (key) => (
        <li key={key} className="flex items-center space-x-3 p-3">
          {hasLeftAvatarOrIcon && (
            <div className="w-10 h-10 bg-gray-300 rounded-full flex-shrink-0">
              &nbsp;
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="mb-1">
              <ListPlaceholder className="w-1/3 inline-block mb-1" />
              {hasTertiaryText && (
                <span className="float-right opacity-55 min-w-[10vw]">
                  <ListPlaceholder />
                </span>
              )}
            </div>
            {hasSecondaryText && <ListPlaceholder className="w-1/4" />}
          </div>
          {hasRightAvatarOrIcon && (
            <div className="w-10 h-10 bg-gray-300 rounded-full flex-shrink-0">
              &nbsp;
            </div>
          )}
        </li>
      ))}
    </ul>
  ) : null;
};

const times = (nbChildren: number, fn: (key: number) => ReactNode) =>
  Array.from({ length: nbChildren }, (_, key) => fn(key));

export interface SimpleListLoadingProps {
  className?: string;
  hasLeftAvatarOrIcon?: boolean;
  hasRightAvatarOrIcon?: boolean;
  hasSecondaryText?: boolean;
  hasTertiaryText?: boolean;
  nbFakeLines?: number;
}
