import type { SortPayload } from "ra-core";
import {
  useResourceContext,
  useGetList,
  useTimeout,
  useCreatePath,
} from "ra-core";
import { CircleX, LoaderCircle } from "lucide-react";

import { Link } from "react-router";

/**
 * Fetch and render the number of records of a given resource
 *
 * Relies on dataProvider.getList() returning a total property
 *
 * @example // Display the number of records in the current resource (based on ResourceContext)
 * <Count />
 *
 * @example // Display the number of posts
 * <Count resource="posts" />
 *
 * @example // Display the number of published posts
 * <Count resource="posts" filter={{ is_published: true }}/>
 *
 * @example // Display the number of posts, with a custom Typography variant
 * <Count resource="posts" variant="h1" />
 *
 * @see ReferenceManyCount for a similar component which fetches the number of records related to the current one
 */
export const Count = (props: CountProps) => {
  const {
    filter,
    sort,
    link,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    resource: resourceFromProps,
    timeout = 1000,
    ...rest
  } = props;
  const resource = useResourceContext(props);
  if (!resource) {
    throw new Error(
      "The Count component must be used inside a ResourceContext or must be passed a resource prop.",
    );
  }
  const oneSecondHasPassed = useTimeout(timeout);
  const createPath = useCreatePath();

  const { total, isPending, error } = useGetList(resource, {
    filter,
    sort,
    pagination: { perPage: 1, page: 1 },
  });

  const body = isPending ? (
    oneSecondHasPassed ? (
      <LoaderCircle className="animate-spin" />
    ) : (
      ""
    )
  ) : error ? (
    <CircleX color="error" />
  ) : (
    total
  );

  return link ? (
    <Link
      to={{
        pathname: createPath({ resource, type: "list" }),
        search: filter ? `filter=${JSON.stringify(filter)}` : undefined,
      }}
      onClick={(e) => e.stopPropagation()}
      {...rest}
    >
      {body}
    </Link>
  ) : (
    <span {...rest}>{body}</span>
  );
};

export interface CountProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filter?: any;
  sort?: SortPayload;
  link?: boolean;
  resource?: string;
  timeout?: number;
}
