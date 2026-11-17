import { config } from "../root/config";

export const disableEmailPasswordAuthentication =
  config.disableEmailPasswordAuthentication === true;

export const googleWorkplaceDomain: string | undefined =
  config.googleWorkplaceDomain;
