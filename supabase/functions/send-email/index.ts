import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

interface MeetEventData {
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  meetLink: string;
  calendarEventId?: string;
}

// Email template processing
function processTemplate(template: string, variables: Record<string, any>): string {
  let processed = template;

  // Replace simple variables
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    processed = processed.replace(regex, String(value || ''));
  });

  // Handle conditional blocks
  const conditionalRegex = /{{#if\s+(\w+)}}([\s\S]*?)(?:{{else}}([\s\S]*?))?{{\/if}}/g;
  processed = processed.replace(conditionalRegex, (match, variable, truthyContent, falsyContent = '') => {
    return variables[variable] ? truthyContent : falsyContent;
  });

  return processed;
}

// Google Meet invitation handler
async function handleMeetInvitation(requestBody: any, supabase: any, resendApiKey?: string) {
  const { recipients, subject, data } = requestBody;
  const meetEvent: MeetEventData = data.meetEvent;
  
  const startDateTime = new Date(meetEvent.startTime);
  const endDateTime = new Date(meetEvent.endTime);
  
  const emailBody = `
    <h2>🎯 会議招待</h2>
    <p><strong>${meetEvent.title}</strong></p>
    
    <h3>📅 日時</h3>
    <p>${startDateTime.toLocaleDateString('ja-JP', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      weekday: 'long'
    })} ${startDateTime.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit'
    })} - ${endDateTime.toLocaleTimeString('ja-JP', {
      hour: '2-digit', 
      minute: '2-digit'
    })}</p>
    
    ${meetEvent.description ? `<h3>📝 詳細</h3><p>${meetEvent.description}</p>` : ''}
    
    <h3>🔗 参加方法</h3>
    <p><a href="${meetEvent.meetLink}" style="background-color: #1a73e8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Google Meetに参加</a></p>
    <p>リンク: <a href="${meetEvent.meetLink}">${meetEvent.meetLink}</a></p>
    
    <hr>
    <p><small>このメールは自動送信されています。</small></p>
  `;

  // Send to multiple recipients
  const results = [];
  for (const recipient of recipients) {
    try {
      if (!resendApiKey) {
        // Development mode
        console.log('=== Google Meet招待メール（開発モード） ===');
        console.log('To:', recipient);
        console.log('Subject:', subject);
        console.log('Meeting:', meetEvent.title);
        console.log('Start:', startDateTime);
        console.log('Meet Link:', meetEvent.meetLink);
        console.log('==========================================');
        results.push({ recipient, success: true, messageId: `dev-meet-${Date.now()}` });
      } else {
        // Production mode
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'スケジュール管理システム <noreply@company.com>',
            to: [recipient],
            subject,
            html: emailBody,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          results.push({ recipient, success: true, messageId: result.id });
        } else {
          results.push({ recipient, success: false, error: await response.text() });
        }
      }
    } catch (error) {
      results.push({ recipient, success: false, error: error.message });
    }
  }

  return new Response(JSON.stringify({
    success: true,
    type: 'meet_invitation',
    results
  }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200
  });
}

// Google Meet reminder handler
async function handleMeetReminder(requestBody: any, supabase: any, resendApiKey?: string) {
  const { recipients, subject, data } = requestBody;
  const { meetEvent, minutesBefore } = data;
  
  const startDateTime = new Date(meetEvent.startTime);
  
  const emailBody = `
    <h2>⏰ 会議リマインダー</h2>
    <p><strong>${meetEvent.title}</strong>の開始まで${minutesBefore}分です。</p>
    
    <h3>📅 開始時刻</h3>
    <p>${startDateTime.toLocaleString('ja-JP')}</p>
    
    <h3>🔗 参加</h3>
    <p><a href="${meetEvent.meetLink}" style="background-color: #1a73e8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Google Meetに参加</a></p>
    
    <hr>
    <p><small>このメールは自動送信されています。</small></p>
  `;

  // Send to multiple recipients
  const results = [];
  for (const recipient of recipients) {
    try {
      if (!resendApiKey) {
        console.log('=== Google Meetリマインダー（開発モード） ===');
        console.log('To:', recipient);
        console.log('Meeting:', meetEvent.title);
        console.log('Minutes before:', minutesBefore);
        console.log('Meet Link:', meetEvent.meetLink);
        console.log('=========================================');
        results.push({ recipient, success: true, messageId: `dev-reminder-${Date.now()}` });
      } else {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'スケジュール管理システム <noreply@company.com>',
            to: [recipient],
            subject,
            html: emailBody,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          results.push({ recipient, success: true, messageId: result.id });
        } else {
          results.push({ recipient, success: false, error: await response.text() });
        }
      }
    } catch (error) {
      results.push({ recipient, success: false, error: error.message });
    }
  }

  return new Response(JSON.stringify({
    success: true,
    type: 'meet_reminder', 
    results
  }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200
  });
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    
    // For development/testing, we'll just log the email
    const isDevelopment = !resendApiKey;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const requestBody = await req.json();
    
    // Google Meet invitation handling
    if (requestBody.type === 'meet_invitation') {
      return await handleMeetInvitation(requestBody, supabase, resendApiKey);
    }
    
    // Google Meet reminder handling  
    if (requestBody.type === 'meet_reminder') {
      return await handleMeetReminder(requestBody, supabase, resendApiKey);
    }
    
    // Legacy email template handling
    const { 
      to, 
      templateName, 
      variables, 
      from = 'noreply@company.com',
      fromName = 'スケジュール管理システム',
      replyTo
    } = requestBody;

    // Fetch email template
    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .select('*')
      .eq('name', templateName)
      .eq('is_active', true)
      .single();

    if (templateError || !template) {
      throw new Error(`Email template '${templateName}' not found`);
    }

    // Process template with variables
    const subject = processTemplate(template.subject, variables);
    const bodyHtml = processTemplate(template.body_html, variables);
    const bodyText = processTemplate(template.body_text, variables);

    let messageId: string;

    if (isDevelopment) {
      // In development, just log the email
      console.log('=== Email Debug ===');
      console.log('To:', to);
      console.log('From:', `${fromName} <${from}>`);
      console.log('Subject:', subject);
      console.log('Template:', templateName);
      console.log('Variables:', variables);
      console.log('Body Text:', bodyText);
      console.log('==================');
      
      messageId = `dev-${Date.now()}`;
    } else {
      // Production: Send via Resend API
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${fromName} <${from}>`,
          to: [to],
          subject,
          html: bodyHtml,
          text: bodyText,
          reply_to: replyTo,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to send email: ${error}`);
      }

      const result = await response.json();
      messageId = result.id;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId,
        subject,
        bodyText // Return for logging purposes
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error in send-email function:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});