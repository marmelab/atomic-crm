// The CRM persists its react-query cache in localStorage and restores it on
// mount: start each test empty, so it can't restore the previous test's data.
beforeEach(() => {
  localStorage.clear();
});
