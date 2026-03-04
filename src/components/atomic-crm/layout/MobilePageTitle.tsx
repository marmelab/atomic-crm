/**
 * Mobile-only page title component.
 * Shows the page title on mobile where the breadcrumb header is not visible.
 * Hidden on desktop (md and up) where the breadcrumb shows the page name.
 */
export const MobilePageTitle = ({ title }: { title: string }) => (
  <h1 className="text-xl font-semibold tracking-tight md:hidden mb-2">
    {title}
  </h1>
);
