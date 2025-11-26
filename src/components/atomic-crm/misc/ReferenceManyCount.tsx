import {
  ReferenceManyCountBaseProps,
  useTimeout,
  useReferenceManyFieldController,
} from "ra-core";

export const ReferenceManyCount = (
  props: ReferenceManyCountBaseProps & {
    render: (total: number | undefined) => React.ReactNode;
  },
) => {
  const { loading, error, offline, render, timeout = 1000, ...rest } = props;
  const oneSecondHasPassed = useTimeout(timeout);

  const {
    isPaused,
    isPending,
    error: fetchError,
    total,
  } = useReferenceManyFieldController<any, any>({
    ...rest,
    page: 1,
    perPage: 1,
  });
  const shouldRenderLoading =
    isPending && !isPaused && loading !== undefined && loading !== false;
  const shouldRenderOffline =
    isPending && isPaused && offline !== undefined && offline !== false;
  const shouldRenderError =
    !isPending && fetchError && error !== undefined && error !== false;

  return (
    <>
      {shouldRenderLoading
        ? oneSecondHasPassed
          ? loading
          : null
        : shouldRenderOffline
          ? offline
          : shouldRenderError
            ? error
            : render(total)}
    </>
  );
};
