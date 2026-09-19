import { PublicApplicationLayout } from "./PublicApplicationLayout";

// What a visitor sees when the form cannot load.
//
// Previously: nothing at all, indefinitely. The page rendered null while
// its context promise stayed unresolved, so somebody who had been sent an
// application link sat looking at a blank screen with no way to tell
// whether it was broken, slow, or their own connection.
//
// No technical detail. A visitor cannot act on a database error, it is not
// theirs to see, and a public page is the wrong place to describe our
// infrastructure. What they CAN act on is trying again.
export const ApplicationUnavailableNotice = ({
  onRetry,
}: {
  onRetry: () => void;
}) => (
  <PublicApplicationLayout
    title="Apply"
    orientation="This form didn't load just now."
  >
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-white/50 text-center">
        It's usually a connection hiccup. Try again, and if it keeps happening,
        reply to the message that brought you here and Leif will sort it out.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="text-sm underline text-white/80 hover:text-white"
      >
        Try again
      </button>
    </div>
  </PublicApplicationLayout>
);
