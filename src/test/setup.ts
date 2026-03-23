import "vitest-browser-react";

// MobileAdmin uses PersistQueryClientProvider backed by localStorage.
// Clear it before each test so stale query cache never leaks across tests.
beforeEach(() => {
  localStorage.clear();
});
