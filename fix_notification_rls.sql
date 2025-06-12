-- Fix notification_logs RLS policy to allow authenticated users to insert their own logs
DROP POLICY IF EXISTS "System can manage notification logs" ON notification_logs;
DROP POLICY IF EXISTS "Users can view their own notification logs" ON notification_logs;

-- Allow authenticated users to insert their own notification logs
CREATE POLICY "Users can insert their own notification logs" 
  ON notification_logs 
  FOR INSERT 
  USING (auth.uid()::text = user_id::text);

-- Allow authenticated users to view their own notification logs
CREATE POLICY "Users can view their own notification logs" 
  ON notification_logs 
  FOR SELECT 
  USING (auth.uid()::text = user_id::text);

-- Allow service role to manage all notification logs
CREATE POLICY "Service role can manage all notification logs" 
  ON notification_logs 
  FOR ALL 
  USING (auth.role() = 'service_role');