-- Seed data for Band CRM
-- Adds default quote template and sample data

-- Insert default quote template
INSERT INTO quote_templates (name, body_html, is_default) VALUES (
  'Default Quote Template',
  '<div style="font-family: sans-serif; max-width: 700px; margin: 0 auto; padding: 32px;">
    <h1 style="font-size: 28px; margin-bottom: 4px;">Performance Quote</h1>
    <p style="color: #666;">Quote for {{gig_name}}</p>
    <hr/>
    
    <h2 style="font-size: 18px; margin-top: 24px;">Event Details</h2>
    <table style="width: 100%; margin-top: 12px;">
      <tr><td style="padding: 4px 0;"><strong>Client:</strong></td><td>{{company_name}}</td></tr>
      <tr><td style="padding: 4px 0;"><strong>Venue:</strong></td><td>{{venue_name}}</td></tr>
      <tr><td style="padding: 4px 0;"><strong>Address:</strong></td><td>{{venue_address}}, {{venue_city}}</td></tr>
      <tr><td style="padding: 4px 0;"><strong>Date:</strong></td><td>{{performance_date}}</td></tr>
      <tr><td style="padding: 4px 0;"><strong>Time:</strong></td><td>{{start_time}} – {{end_time}}</td></tr>
      <tr><td style="padding: 4px 0;"><strong>Sets:</strong></td><td>{{set_count}}</td></tr>
    </table>
    
    <h2 style="font-size: 18px; margin-top: 24px;">Pricing</h2>
    <table style="width: 100%; margin-top: 12px; border-collapse: collapse;">
      <tr style="border-bottom: 1px solid #ddd;">
        <td style="padding: 8px 0;"><strong>Performance Fee</strong></td>
        <td style="text-align: right;"><strong>{{fee}}</strong></td>
      </tr>
      <tr style="border-bottom: 1px solid #ddd;">
        <td style="padding: 8px 0;">Deposit Required (50%)</td>
        <td style="text-align: right;">{{deposit}}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #666;">Balance Due on Night</td>
        <td style="text-align: right; color: #666;">Remaining 50%</td>
      </tr>
    </table>
    
    <h2 style="font-size: 18px; margin-top: 24px;">Terms</h2>
    <ul style="color: #666; font-size: 14px; line-height: 1.6;">
      <li>Deposit required to secure booking</li>
      <li>Balance payable on the night of performance</li>
      <li>Cancellation within 14 days: deposit non-refundable</li>
      <li>We provide our own PA system and lighting</li>
      <li>Load-in time: 1 hour before performance</li>
    </ul>
    
    <p style="margin-top: 32px; color: #666; font-size: 14px;">
      This quote is valid for 14 days from the date of issue.
    </p>
    
    <p style="margin-top: 24px;">
      We look forward to performing for you!
    </p>
  </div>',
  true
) ON CONFLICT DO NOTHING;

-- Add comment
COMMENT ON TABLE quote_templates IS 'Default quote template added via seed data';
