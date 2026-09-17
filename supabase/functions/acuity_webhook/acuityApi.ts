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
  // Present on both the single-appointment and list responses. Optional so
  // every existing caller and fixture keeps compiling; reconciliation is
  // the only consumer that needs them.
  id?: number | string;
  canceled?: boolean;
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
    id: data.id,
    canceled: Boolean(data.canceled),
  };
};

// The list endpoint, for periodic reconciliation. A webhook answers "what
// just changed"; this answers "what is true", which is the question a
// missed event makes unanswerable any other way.
//
// Returns null on any failure rather than an empty array — an empty array
// would read as "Acuity has no bookings" and could cancel real calls.
export const fetchAcuityAppointments = async (
  params: {
    minDate: string;
    maxDate?: string;
    canceled?: boolean;
    max?: number;
  },
  credentials: { userId: string; apiKey: string },
): Promise<AcuityAppointmentDetails[] | null> => {
  const auth = btoa(`${credentials.userId}:${credentials.apiKey}`);
  const query = new URLSearchParams({
    minDate: params.minDate,
    max: String(params.max ?? 200),
    direction: "ASC",
  });
  if (params.maxDate) query.set("maxDate", params.maxDate);
  if (params.canceled !== undefined)
    query.set("canceled", String(params.canceled));

  let response: Response;
  try {
    response = await fetch(
      `https://acuityscheduling.com/api/v1/appointments?${query.toString()}`,
      { headers: { Authorization: `Basic ${auth}` } },
    );
  } catch (error) {
    console.error(
      "acuity: appointment list network error",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
  if (!response.ok) {
    console.error(
      `acuity: appointment list failed with status ${response.status}`,
    );
    return null;
  }

  const rows = await response.json();
  if (!Array.isArray(rows)) return null;
  return rows.map((data: Record<string, unknown>) => ({
    email: String(data.email ?? ""),
    firstName: String(data.firstName ?? ""),
    lastName: String(data.lastName ?? ""),
    datetime: String(data.datetime ?? ""),
    appointmentTypeID: Number(data.appointmentTypeID),
    id: data.id as number | string | undefined,
    canceled: Boolean(data.canceled),
  }));
};
