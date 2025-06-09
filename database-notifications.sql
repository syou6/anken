-- Notification System Database Schema

-- Notification preferences table
CREATE TABLE notification_preferences (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  -- Email notification settings
  email_enabled BOOLEAN DEFAULT TRUE,
  email_schedule_created BOOLEAN DEFAULT TRUE,
  email_schedule_updated BOOLEAN DEFAULT TRUE,
  email_schedule_deleted BOOLEAN DEFAULT TRUE,
  email_schedule_reminder BOOLEAN DEFAULT TRUE,
  email_leave_request BOOLEAN DEFAULT TRUE,
  email_leave_approval BOOLEAN DEFAULT TRUE,
  -- Push notification settings
  push_enabled BOOLEAN DEFAULT FALSE,
  push_schedule_created BOOLEAN DEFAULT TRUE,
  push_schedule_updated BOOLEAN DEFAULT TRUE,
  push_schedule_deleted BOOLEAN DEFAULT TRUE,
  push_schedule_reminder BOOLEAN DEFAULT TRUE,
  push_leave_request BOOLEAN DEFAULT TRUE,
  push_leave_approval BOOLEAN DEFAULT TRUE,
  -- Browser notification subscription
  push_subscription JSONB,
  -- Reminder time preferences (in minutes before event)
  default_reminder_time INTEGER DEFAULT 15,
  -- Quiet hours (no notifications during these times)
  quiet_hours_enabled BOOLEAN DEFAULT FALSE,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Email templates table
CREATE TABLE email_templates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  subject VARCHAR(500) NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT NOT NULL,
  variables JSONB DEFAULT '[]', -- List of available variables for this template
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notification logs table
CREATE TABLE notification_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL, -- 'email' or 'push'
  category VARCHAR(50) NOT NULL, -- 'schedule_created', 'schedule_reminder', etc.
  subject VARCHAR(500),
  content TEXT,
  metadata JSONB DEFAULT '{}', -- Additional data like schedule_id, etc.
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scheduled notifications table (for reminders)
CREATE TABLE scheduled_notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  reminder_time INTEGER NOT NULL, -- Minutes before event
  notification_type VARCHAR(20) NOT NULL CHECK (notification_type IN ('email', 'push', 'both')),
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  notification_log_id UUID REFERENCES notification_logs(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_notification_preferences_user_id ON notification_preferences(user_id);
CREATE INDEX idx_notification_logs_user_id ON notification_logs(user_id);
CREATE INDEX idx_notification_logs_status ON notification_logs(status);
CREATE INDEX idx_notification_logs_created_at ON notification_logs(created_at);
CREATE INDEX idx_scheduled_notifications_schedule_id ON scheduled_notifications(schedule_id);
CREATE INDEX idx_scheduled_notifications_user_id ON scheduled_notifications(user_id);
CREATE INDEX idx_scheduled_notifications_scheduled_for ON scheduled_notifications(scheduled_for);
CREATE INDEX idx_scheduled_notifications_status ON scheduled_notifications(status);

-- Enable RLS
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own notification preferences" 
  ON notification_preferences 
  FOR ALL 
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Admins can view all email templates" 
  ON email_templates 
  FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage email templates" 
  ON email_templates 
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id::text = auth.uid()::text 
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Users can view their own notification logs" 
  ON notification_logs 
  FOR SELECT 
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "System can manage notification logs" 
  ON notification_logs 
  FOR ALL 
  USING (auth.role() = 'service_role');

CREATE POLICY "Users can view their own scheduled notifications" 
  ON scheduled_notifications 
  FOR SELECT 
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "System can manage scheduled notifications" 
  ON scheduled_notifications 
  FOR ALL 
  USING (auth.role() = 'service_role');

-- Triggers for updated_at
CREATE TRIGGER update_notification_preferences_updated_at 
  BEFORE UPDATE ON notification_preferences 
  FOR EACH ROW 
  EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_email_templates_updated_at 
  BEFORE UPDATE ON email_templates 
  FOR EACH ROW 
  EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_scheduled_notifications_updated_at 
  BEFORE UPDATE ON scheduled_notifications 
  FOR EACH ROW 
  EXECUTE PROCEDURE update_updated_at_column();

-- Insert default email templates
INSERT INTO email_templates (name, subject, body_html, body_text, variables) VALUES
(
  'schedule_created',
  '新しいスケジュールが作成されました: {{title}}',
  '<h2>新しいスケジュールが作成されました</h2>
<p>こんにちは {{userName}} 様</p>
<p>以下のスケジュールが作成されました：</p>
<div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
  <h3 style="margin: 0 0 10px 0;">{{title}}</h3>
  <p><strong>日時:</strong> {{startTime}} - {{endTime}}</p>
  <p><strong>種別:</strong> {{type}}</p>
  {{#if location}}<p><strong>場所:</strong> {{location}}</p>{{/if}}
  {{#if details}}<p><strong>詳細:</strong> {{details}}</p>{{/if}}
  {{#if meetLink}}<p><strong>オンライン会議:</strong> <a href="{{meetLink}}">会議に参加</a></p>{{/if}}
</div>
<p>カレンダーでスケジュールを確認: <a href="{{calendarLink}}">カレンダーを開く</a></p>',
  '新しいスケジュールが作成されました

こんにちは {{userName}} 様

以下のスケジュールが作成されました：

タイトル: {{title}}
日時: {{startTime}} - {{endTime}}
種別: {{type}}
{{#if location}}場所: {{location}}{{/if}}
{{#if details}}詳細: {{details}}{{/if}}
{{#if meetLink}}オンライン会議: {{meetLink}}{{/if}}

カレンダーでスケジュールを確認: {{calendarLink}}',
  '["userName", "title", "startTime", "endTime", "type", "location", "details", "meetLink", "calendarLink"]'::jsonb
),
(
  'schedule_updated',
  'スケジュールが更新されました: {{title}}',
  '<h2>スケジュールが更新されました</h2>
<p>こんにちは {{userName}} 様</p>
<p>以下のスケジュールが更新されました：</p>
<div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
  <h3 style="margin: 0 0 10px 0;">{{title}}</h3>
  <p><strong>新しい日時:</strong> {{startTime}} - {{endTime}}</p>
  <p><strong>種別:</strong> {{type}}</p>
  {{#if location}}<p><strong>場所:</strong> {{location}}</p>{{/if}}
  {{#if details}}<p><strong>詳細:</strong> {{details}}</p>{{/if}}
  {{#if meetLink}}<p><strong>オンライン会議:</strong> <a href="{{meetLink}}">会議に参加</a></p>{{/if}}
</div>
<p><strong>変更内容:</strong></p>
<ul>{{changes}}</ul>
<p>カレンダーでスケジュールを確認: <a href="{{calendarLink}}">カレンダーを開く</a></p>',
  'スケジュールが更新されました

こんにちは {{userName}} 様

以下のスケジュールが更新されました：

タイトル: {{title}}
新しい日時: {{startTime}} - {{endTime}}
種別: {{type}}
{{#if location}}場所: {{location}}{{/if}}
{{#if details}}詳細: {{details}}{{/if}}
{{#if meetLink}}オンライン会議: {{meetLink}}{{/if}}

変更内容:
{{changes}}

カレンダーでスケジュールを確認: {{calendarLink}}',
  '["userName", "title", "startTime", "endTime", "type", "location", "details", "meetLink", "changes", "calendarLink"]'::jsonb
),
(
  'schedule_deleted',
  'スケジュールが削除されました: {{title}}',
  '<h2>スケジュールが削除されました</h2>
<p>こんにちは {{userName}} 様</p>
<p>以下のスケジュールが削除されました：</p>
<div style="background-color: #fee2e2; padding: 20px; border-radius: 8px; margin: 20px 0;">
  <h3 style="margin: 0 0 10px 0; text-decoration: line-through;">{{title}}</h3>
  <p><strong>日時:</strong> {{startTime}} - {{endTime}}</p>
  <p><strong>種別:</strong> {{type}}</p>
  {{#if deletedBy}}<p><strong>削除者:</strong> {{deletedBy}}</p>{{/if}}
  {{#if reason}}<p><strong>理由:</strong> {{reason}}</p>{{/if}}
</div>',
  'スケジュールが削除されました

こんにちは {{userName}} 様

以下のスケジュールが削除されました：

タイトル: {{title}}
日時: {{startTime}} - {{endTime}}
種別: {{type}}
{{#if deletedBy}}削除者: {{deletedBy}}{{/if}}
{{#if reason}}理由: {{reason}}{{/if}}',
  '["userName", "title", "startTime", "endTime", "type", "deletedBy", "reason"]'::jsonb
),
(
  'schedule_reminder',
  'リマインダー: {{title}} - {{timeUntilEvent}}後',
  '<h2>スケジュールリマインダー</h2>
<p>こんにちは {{userName}} 様</p>
<p><strong>{{timeUntilEvent}}後</strong>に以下のスケジュールが始まります：</p>
<div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
  <h3 style="margin: 0 0 10px 0;">{{title}}</h3>
  <p><strong>日時:</strong> {{startTime}} - {{endTime}}</p>
  <p><strong>種別:</strong> {{type}}</p>
  {{#if location}}<p><strong>場所:</strong> {{location}}</p>{{/if}}
  {{#if details}}<p><strong>詳細:</strong> {{details}}</p>{{/if}}
  {{#if meetLink}}<p><strong>オンライン会議:</strong> <a href="{{meetLink}}" style="background-color: #3b82f6; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; display: inline-block;">会議に参加</a></p>{{/if}}
  {{#if participants}}<p><strong>参加者:</strong> {{participants}}</p>{{/if}}
</div>
<p>カレンダーでスケジュールを確認: <a href="{{calendarLink}}">カレンダーを開く</a></p>',
  'スケジュールリマインダー

こんにちは {{userName}} 様

{{timeUntilEvent}}後に以下のスケジュールが始まります：

タイトル: {{title}}
日時: {{startTime}} - {{endTime}}
種別: {{type}}
{{#if location}}場所: {{location}}{{/if}}
{{#if details}}詳細: {{details}}{{/if}}
{{#if meetLink}}オンライン会議: {{meetLink}}{{/if}}
{{#if participants}}参加者: {{participants}}{{/if}}

カレンダーでスケジュールを確認: {{calendarLink}}',
  '["userName", "title", "startTime", "endTime", "type", "location", "details", "meetLink", "participants", "timeUntilEvent", "calendarLink"]'::jsonb
),
(
  'leave_request_submitted',
  '休暇申請が提出されました',
  '<h2>休暇申請が提出されました</h2>
<p>こんにちは {{approverName}} 様</p>
<p>以下の休暇申請が提出されました：</p>
<div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
  <p><strong>申請者:</strong> {{requesterName}}</p>
  <p><strong>種別:</strong> {{leaveType}}</p>
  <p><strong>日付:</strong> {{leaveDate}}</p>
  <p><strong>理由:</strong> {{reason}}</p>
</div>
<p><a href="{{approvalLink}}" style="background-color: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">承認する</a> <a href="{{rejectLink}}" style="background-color: #ef4444; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block; margin-left: 10px;">却下する</a></p>',
  '休暇申請が提出されました

こんにちは {{approverName}} 様

以下の休暇申請が提出されました：

申請者: {{requesterName}}
種別: {{leaveType}}
日付: {{leaveDate}}
理由: {{reason}}

承認する: {{approvalLink}}
却下する: {{rejectLink}}',
  '["approverName", "requesterName", "leaveType", "leaveDate", "reason", "approvalLink", "rejectLink"]'::jsonb
),
(
  'leave_request_approved',
  '休暇申請が承認されました',
  '<h2>休暇申請が承認されました</h2>
<p>こんにちは {{requesterName}} 様</p>
<p>あなたの休暇申請が承認されました：</p>
<div style="background-color: #d1fae5; padding: 20px; border-radius: 8px; margin: 20px 0;">
  <p><strong>種別:</strong> {{leaveType}}</p>
  <p><strong>日付:</strong> {{leaveDate}}</p>
  <p><strong>承認者:</strong> {{approverName}}</p>
  {{#if comments}}<p><strong>コメント:</strong> {{comments}}</p>{{/if}}
</div>',
  '休暇申請が承認されました

こんにちは {{requesterName}} 様

あなたの休暇申請が承認されました：

種別: {{leaveType}}
日付: {{leaveDate}}
承認者: {{approverName}}
{{#if comments}}コメント: {{comments}}{{/if}}',
  '["requesterName", "leaveType", "leaveDate", "approverName", "comments"]'::jsonb
),
(
  'leave_request_rejected',
  '休暇申請が却下されました',
  '<h2>休暇申請が却下されました</h2>
<p>こんにちは {{requesterName}} 様</p>
<p>残念ながら、あなたの休暇申請が却下されました：</p>
<div style="background-color: #fee2e2; padding: 20px; border-radius: 8px; margin: 20px 0;">
  <p><strong>種別:</strong> {{leaveType}}</p>
  <p><strong>日付:</strong> {{leaveDate}}</p>
  <p><strong>却下者:</strong> {{rejecterName}}</p>
  {{#if reason}}<p><strong>理由:</strong> {{reason}}</p>{{/if}}
</div>
<p>ご不明な点がありましたら、上司にお問い合わせください。</p>',
  '休暇申請が却下されました

こんにちは {{requesterName}} 様

残念ながら、あなたの休暇申請が却下されました：

種別: {{leaveType}}
日付: {{leaveDate}}
却下者: {{rejecterName}}
{{#if reason}}理由: {{reason}}{{/if}}

ご不明な点がありましたら、上司にお問い合わせください。',
  '["requesterName", "leaveType", "leaveDate", "rejecterName", "reason"]'::jsonb
);

-- Function to create default notification preferences for new users
CREATE OR REPLACE FUNCTION create_default_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create notification preferences when a new user is created
CREATE TRIGGER create_notification_preferences_for_new_user
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION create_default_notification_preferences();

-- Function to schedule notifications when a schedule is created or updated
CREATE OR REPLACE FUNCTION schedule_reminder_notifications()
RETURNS TRIGGER AS $$
DECLARE
  participant_id UUID;
  reminder JSONB;
  reminder_time INTEGER;
  reminder_methods TEXT[];
  scheduled_time TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Only process if the schedule has reminders
  IF NEW.reminders IS NOT NULL AND jsonb_array_length(NEW.reminders) > 0 THEN
    -- For each participant
    FOREACH participant_id IN ARRAY NEW.participants LOOP
      -- For each reminder
      FOR reminder IN SELECT * FROM jsonb_array_elements(NEW.reminders) LOOP
        reminder_time := (reminder->>'time')::INTEGER;
        reminder_methods := ARRAY(SELECT jsonb_array_elements_text(reminder->'methods'));
        
        -- Calculate scheduled time (reminder_time minutes before start_time)
        scheduled_time := NEW.start_time - (reminder_time || ' minutes')::INTERVAL;
        
        -- Skip if scheduled time is in the past
        IF scheduled_time > NOW() THEN
          -- Delete existing scheduled notifications for this schedule/user if updating
          IF TG_OP = 'UPDATE' THEN
            DELETE FROM scheduled_notifications 
            WHERE schedule_id = NEW.id AND user_id = participant_id;
          END IF;
          
          -- Create scheduled notification
          INSERT INTO scheduled_notifications (
            schedule_id,
            user_id,
            reminder_time,
            notification_type,
            scheduled_for
          ) VALUES (
            NEW.id,
            participant_id,
            reminder_time,
            CASE 
              WHEN 'email' = ANY(reminder_methods) AND 'push' = ANY(reminder_methods) THEN 'both'
              WHEN 'email' = ANY(reminder_methods) THEN 'email'
              WHEN 'push' = ANY(reminder_methods) THEN 'push'
              ELSE 'email' -- Default to email
            END,
            scheduled_time
          );
        END IF;
      END LOOP;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to schedule notifications when schedules are created or updated
CREATE TRIGGER schedule_notifications_on_schedule_change
AFTER INSERT OR UPDATE ON schedules
FOR EACH ROW
EXECUTE FUNCTION schedule_reminder_notifications();

-- Function to cancel scheduled notifications when a schedule is deleted
CREATE OR REPLACE FUNCTION cancel_scheduled_notifications()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE scheduled_notifications 
  SET status = 'cancelled'
  WHERE schedule_id = OLD.id AND status = 'pending';
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger to cancel notifications when schedules are deleted
CREATE TRIGGER cancel_notifications_on_schedule_delete
BEFORE DELETE ON schedules
FOR EACH ROW
EXECUTE FUNCTION cancel_scheduled_notifications();