export const getNoteContent = (
  subject: string,
  strippedText: string,
) => `${subject}

${strippedText}`;
