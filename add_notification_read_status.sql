-- Add read status to notification_logs table
ALTER TABLE notification_logs 
ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_notification_logs_is_read ON notification_logs(is_read);

-- Update RLS policies for notification_logs
DROP POLICY IF EXISTS "Users can insert their own notification logs" ON notification_logs;
DROP POLICY IF EXISTS "Users can view their own notification logs" ON notification_logs;
DROP POLICY IF EXISTS "Service role can manage all notification logs" ON notification_logs;

-- Allow users to insert their own notification logs
CREATE POLICY "Users can insert their own notification logs" 
  ON notification_logs 
  FOR INSERT 
  USING (auth.uid()::text = user_id::text);

-- Allow users to view their own notification logs
CREATE POLICY "Users can view their own notification logs" 
  ON notification_logs 
  FOR SELECT 
  USING (auth.uid()::text = user_id::text);

-- Allow users to update their own notification logs (for marking as read)
CREATE POLICY "Users can update their own notification logs" 
  ON notification_logs 
  FOR UPDATE 
  USING (auth.uid()::text = user_id::text);

-- Allow service role to manage all notification logs
CREATE POLICY "Service role can manage all notification logs" 
  ON notification_logs 
  FOR ALL 
  USING (auth.role() = 'service_role');