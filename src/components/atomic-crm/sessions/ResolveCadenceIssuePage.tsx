import { useNavigate, useParams } from "react-router";

import { CadenceResolutionModal } from "./CadenceResolutionModal";

// Resolution UX correction: this route is now a thin wrapper around the
// ONE shared CadenceResolutionModal, never a separate full-page
// implementation — a resolve_client_session_cadence Task (Dashboard/
// Contact page/mobile list — see taskActionDestination.ts) still
// navigates here, but what renders is the same modal ClientShow opens
// locally, over whatever page was already loaded. Closing it (X, Escape,
// overlay click) navigates back in history — landing wherever Leif
// actually came from (typically the Dashboard) rather than a dead end.
export const ResolveCadenceIssuePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <CadenceResolutionModal
      cadenceIssueId={id ?? null}
      onOpenChange={(open) => {
        if (!open) navigate(-1);
      }}
    />
  );
};

ResolveCadenceIssuePage.path = "/client-session-cadence/:id/resolve";
