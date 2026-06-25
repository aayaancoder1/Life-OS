import { google } from 'googleapis';
import { config } from '../../config/index.js';

// Setup OAuth Client conditionally for robustness
let calendarClient: any = null;

if (
  config.GOOGLE_CLIENT_ID &&
  config.GOOGLE_CLIENT_SECRET &&
  config.GOOGLE_REFRESH_TOKEN
) {
  const oauth2Client = new google.auth.OAuth2(
    config.GOOGLE_CLIENT_ID,
    config.GOOGLE_CLIENT_SECRET,
    config.GOOGLE_REDIRECT_URI || 'http://localhost'
  );

  oauth2Client.setCredentials({
    refresh_token: config.GOOGLE_REFRESH_TOKEN,
  });

  calendarClient = google.calendar({ version: 'v3', auth: oauth2Client });
} else {
  console.warn(
    'WARNING: Google Calendar credentials are missing in environment configuration. Running Action Module in MOCK mode.'
  );
}

export interface CalendarEventPayload {
  title: string;
  description?: string;
  startAt: string; // ISO string
}

export async function createGoogleCalendarEvent(
  payload: CalendarEventPayload
): Promise<string> {
  if (!calendarClient) {
    console.log('[MOCK CALENDAR ACTION] Creating event:', payload);
    return `mock-event-id-${Date.now()}`;
  }

  try {
    const endAt = new Date(new Date(payload.startAt).getTime() + 60 * 60 * 1000).toISOString(); // Default to 1 hour duration

    const response = await calendarClient.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: payload.title,
        description: payload.description || '',
        start: {
          dateTime: payload.startAt,
          timeZone: 'UTC',
        },
        end: {
          dateTime: endAt,
          timeZone: 'UTC',
        },
      },
    });

    const eventId = response.data.id;
    if (!eventId) {
      throw new Error('Google Calendar API returned response without event ID');
    }

    return eventId;
  } catch (error) {
    console.error('Failed to create Google Calendar event:', error);
    throw error;
  }
}
