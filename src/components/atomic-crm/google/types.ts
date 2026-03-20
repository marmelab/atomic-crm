export interface GooglePreferences {
  showCalendarOnDashboard: boolean;
  showEmailsOnContact: boolean;
  showCalendarOnContact: boolean;
  syncContacts: boolean;
}

export const defaultGooglePreferences: GooglePreferences = {
  showCalendarOnDashboard: true,
  showEmailsOnContact: true,
  showCalendarOnContact: true,
  syncContacts: false,
};

export interface GoogleConnectionStatus {
  connected: boolean;
  email: string | null;
  scopes: string[];
  preferences: GooglePreferences;
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  attendees: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
  }>;
  htmlLink?: string;
  status?: string;
  location?: string;
  organizer?: { email: string; displayName?: string; self?: boolean };
}

export interface GoogleEmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  internalDate: string;
}
