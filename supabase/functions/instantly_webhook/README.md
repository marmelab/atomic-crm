# instantly_webhook

Receives [Instantly](https://instantly.ai) webhook events and updates the CRM:
appends a timestamped `outreach_events` row, advances the contact's
`outreach_status` (forward-only funnel), and applies side effects — replies
also create a contact note, bounces flip the email's verification to
**Invalid**, unsubscribes / wrong-person add a tag.

Unauthenticated at the gateway (`verify_jwt = false`); instead every request
must carry the shared secret header `X-Webhook-Secret`.

## Event handling

| Instantly event | CRM effect |
|---|---|
| `email_sent` | status → Emailed, sets `last_emailed_at` |
| `email_opened` / `email_link_clicked` | status → Opened |
| `reply_received` | status → Replied + a contact note |
| `email_bounced` | status → Bounced + email marked Invalid |
| `lead_interested` | status → Interested |
| `lead_meeting_booked` / `lead_meeting_completed` | status → Meeting booked |
| `lead_closed` | status → Closed |
| `lead_unsubscribed` | status → Unsubscribed + "Unsubscribed" tag |
| `lead_wrong_person` | status → Wrong person + "Wrong person" tag |
| others (`campaign_completed`, …) | acknowledged, no change |

Unmatched leads (no CRM contact for the email) are acknowledged with 200 so
Instantly does not retry.

## Setup (one time)

1. Generate the shared secret and set it:
   ```bash
   npx supabase secrets set INSTANTLY_WEBHOOK_SECRET=$(openssl rand -hex 24)
   ```
   (Note the value — you need it in step 3.)
2. Deploy: `npx supabase functions deploy instantly_webhook`.
3. In Instantly → **Settings → Integrations → Webhooks → Add Webhook**:
   - URL: `https://ujfyhbdlaliwuqqwafwx.supabase.co/functions/v1/instantly_webhook`
   - Add header → `X-Webhook-Secret` = the value from step 1
   - Event type: **All Events**, Campaign: all
