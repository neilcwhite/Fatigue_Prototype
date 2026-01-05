import { NextRequest, NextResponse } from 'next/server';

// This API route sends an email notification when a user from a non-approved domain signs up
// You can configure this to use Resend, SendGrid, or any email service

// Admin email to receive notifications
const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || 'admin@thespencergroup.co.uk';

// Optional: Resend API key for sending emails
const RESEND_API_KEY = process.env.RESEND_API_KEY;

interface SignupNotification {
  email: string;
  userId?: string;
  requestedAt: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: SignupNotification = await request.json();
    const { email, userId, requestedAt } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // If Resend is configured, send email via Resend
    if (RESEND_API_KEY) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'HerdWatch <noreply@thespencergroup.co.uk>',
          to: [ADMIN_EMAIL],
          subject: `[Action Required] New Signup Request: ${email}`,
          html: `
            <h2>New Account Signup Request</h2>
            <p>A new user has requested access to HerdWatch:</p>
            <table style="border-collapse: collapse; margin: 20px 0;">
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Email:</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${email}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">User ID:</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${userId || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Requested At:</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${new Date(requestedAt).toLocaleString('en-GB')}</td>
              </tr>
            </table>
            <p>This user's email domain is not in the approved list. To approve their access:</p>
            <ol>
              <li>Log into the Supabase dashboard</li>
              <li>Go to Authentication > Users</li>
              <li>Find the user by email: ${email}</li>
              <li>Edit their metadata to set <code>pending_approval: false</code></li>
            </ol>
            <p style="color: #666; font-size: 12px;">
              This is an automated message from HerdWatch.
            </p>
          `,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Resend API error:', errorData);
        // Don't throw - we still want to return success since the signup worked
      }
    } else {
      // No email service configured - just log the request
      console.log('=== NEW SIGNUP REQUEST (Email service not configured) ===');
      console.log(`Email: ${email}`);
      console.log(`User ID: ${userId}`);
      console.log(`Requested At: ${requestedAt}`);
      console.log('==========================================================');
      console.log('To enable email notifications, set RESEND_API_KEY in your environment variables.');
    }

    return NextResponse.json({
      success: true,
      message: 'Notification processed'
    });

  } catch (error) {
    console.error('Error processing signup notification:', error);
    return NextResponse.json(
      { error: 'Failed to process notification' },
      { status: 500 }
    );
  }
}
