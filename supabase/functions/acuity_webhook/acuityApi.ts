// Live Acuity Connection slice. A real Acuity webhook only POSTs
// {action, id, calendarID, appointmentTypeID} — no name/email/time
// (confirmed against Acuity's own public API docs,
// developers.acuityscheduling.com/docs/webhooks). This authenticated
// follow-up call to GET /appointments/:id is REQUIRED to get the fields
// the rest of this function needs. Never fabricates appointment data: if
// credentials are missing or the call fails, this returns null and the
// caller (index.ts) responds with a clear "not configured" error rather
// than guessing.
export type AcuityAppointmentDetails = {
  email: string;
  firstName: string;
  lastName: string;
  datetime: string;
  appointmentTypeID: number;
};

export const fetchAcuityAppointment = async (
  appointmentId: string,
  credentials: { userId: string; apiKey: string },
): Promise<AcuityAppointmentDetails | null> => {
  const auth = btoa(`${credentials.userId}:${credentials.apiKey}`);
  let response: Response;
  try {
    response = await fetch(
      `https://acuityscheduling.com/api/v1/appointments/${encodeURIComponent(appointmentId)}`,
      { headers: { Authorization: `Basic ${auth}` } },
    );
  } catch (error) {
    console.error(
      "acuity_webhook: appointment fetch network error",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
  if (!response.ok) {
    console.error(
      `acuity_webhook: appointment fetch failed with status ${response.status}`,
    );
    return null;
  }
  const data = await response.json();
  return {
    email: String(data.email ?? ""),
    firstName: String(data.firstName ?? ""),
    lastName: String(data.lastName ?? ""),
    datetime: String(data.datetime ?? ""),
    appointmentTypeID: Number(data.appointmentTypeID),
  };
};
