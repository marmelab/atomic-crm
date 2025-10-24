import { useIsMobile } from "@/hooks/use-mobile";

const DENSE_NAVBAR_HEIGHT = 48;
const DENSE_NAVBAR_HEIGHT_MOBILE = 64;

export default function useAppBarHeight(): number {
  const isMobile = useIsMobile();
  return isMobile ? DENSE_NAVBAR_HEIGHT_MOBILE : DENSE_NAVBAR_HEIGHT;
}
