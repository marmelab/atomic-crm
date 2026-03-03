import { InputProps } from "ra-core";
import { ReactNode } from "react";

export const WrapperField = ({
  children,
}: InputProps & { children: ReactNode }) => children;
