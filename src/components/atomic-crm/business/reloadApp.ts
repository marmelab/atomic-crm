/**
 * Reloads the app on its home screen. Used after the current business changed
 * (created, switched, deleted): every cached record belonged to the previous
 * one. The app routes with the URL hash, so the hash is reset before reloading.
 */
export const reloadApp = (): void => {
  window.location.hash = "#/";
  window.location.reload();
};
