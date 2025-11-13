import { Translate, useTimeout } from "ra-core";
import { Spinner } from "./spinner";

export const Loading = (props: LoadingProps) => {
  const {
    loadingPrimary = "ra.page.loading",
    loadingSecondary = "ra.message.loading",
    delay = 1000,
    ...rest
  } = props;
  const oneSecondHasPassed = useTimeout(delay);
  return oneSecondHasPassed ? (
    <div className="flex flex-col justify-center items-center h-full" {...rest}>
      <div className="text-center font-sans color-muted pt-1 pb-1">
        <Spinner size="large" className="width-9 height-9" />
        <h5 className="mt-3 text-2xl text-secondary-foreground">
          <Translate i18nKey={loadingPrimary}>{loadingPrimary}</Translate>
        </h5>
        <p className="text-primary">
          <Translate i18nKey={loadingSecondary}>{loadingSecondary}</Translate>
        </p>
      </div>
    </div>
  ) : null;
};

export interface LoadingProps {
  loadingPrimary?: string;
  loadingSecondary?: string;
  delay?: number;
}
