export const getCurrentDate = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
};

export const formatNoteDate = (dateString: string) => {
  const date = new Date(dateString);
  date.setSeconds(0);
  date.setMilliseconds(0);
  return date.toISOString();
};
