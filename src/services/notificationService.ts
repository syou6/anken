import { supabase } from '../lib/supabase';
import { 
  NotificationPreferences, 
  SendEmailRequest, 
  SendPushRequest,
  EmailServiceResponse,
  PushServiceResponse,
  NotificationCategory,
  ScheduleNotificationData,
  LeaveNotificationData,
  NotificationLog
} from '../types';

// Notification service configuration
const NOTIFICATION_CONFIG = {
  emailService: {
    from: 'noreply@company.com',
    fromName: 'スケジュール管理システム',
    replyTo: 'support@company.com'
  },
  pushService: {
    vapidPublicKey: import.meta.env.VITE_VAPID_PUBLIC_KEY || '',
    vapidPrivateKey: import.meta.env.VITE_VAPID_PRIVATE_KEY || '',
    subject: 'mailto:support@company.com'
  },
  appUrl: import.meta.env.VITE_APP_URL || 'http://localhost:5173'
};

class NotificationService {
  // Get user's notification preferences
  async getUserPreferences(userId: string): Promise<NotificationPreferences | null> {
    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error fetching notification preferences:', error);
        return null;
      }

      return this.mapPreferencesFromDb(data);
    } catch (error) {
      console.error('Error in getUserPreferences:', error);
      return null;
    }
  }

  // Update user's notification preferences
  async updateUserPreferences(
    userId: string, 
    preferences: Partial<NotificationPreferences>
  ): Promise<boolean> {
    try {
      const dbPreferences = this.mapPreferencesToDb(preferences);
      
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: userId,
          ...dbPreferences
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Error updating notification preferences:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in updateUserPreferences:', error);
      return false;
    }
  }

  // Send email notification
  async sendEmail(request: SendEmailRequest): Promise<EmailServiceResponse> {
    try {
      // Call Supabase Edge Function to send email
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          to: request.to,
          templateName: request.templateName,
          variables: request.variables,
          from: NOTIFICATION_CONFIG.emailService.from,
          fromName: NOTIFICATION_CONFIG.emailService.fromName,
          replyTo: NOTIFICATION_CONFIG.emailService.replyTo
        }
      });

      if (error) {
        throw error;
      }

      // Log the email notification
      if (request.userId) {
        await this.logNotification({
          userId: request.userId,
          type: 'email',
          category: this.getNotificationCategory(request.templateName),
          subject: data.subject,
          content: data.bodyText,
          metadata: request.metadata || {},
          status: 'sent',
          sentAt: new Date()
        });
      }

      return {
        success: true,
        messageId: data.messageId
      };
    } catch (error) {
      console.error('Error sending email:', error);
      
      // Log failed notification
      if (request.userId) {
        await this.logNotification({
          userId: request.userId,
          type: 'email',
          category: this.getNotificationCategory(request.templateName),
          metadata: request.metadata || {},
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email'
      };
    }
  }

  // Send push notification
  async sendPush(request: SendPushRequest): Promise<PushServiceResponse> {
    try {
      // Get user's push subscription
      const preferences = await this.getUserPreferences(request.userId);
      
      if (!preferences?.pushEnabled || !preferences.pushSubscription) {
        return {
          success: false,
          error: 'Push notifications not enabled for user'
        };
      }

      // Call Supabase Edge Function to send push notification
      const { data, error } = await supabase.functions.invoke('send-push', {
        body: {
          subscription: preferences.pushSubscription,
          notification: {
            title: request.title,
            body: request.body,
            icon: request.icon || '/icon-192x192.png',
            badge: request.badge || '/badge-72x72.png',
            tag: request.tag,
            data: request.data,
            requireInteraction: request.requireInteraction,
            actions: request.actions
          }
        }
      });

      if (error) {
        throw error;
      }

      // Log the push notification
      await this.logNotification({
        userId: request.userId,
        type: 'push',
        category: this.getCategoryFromData(request.data),
        subject: request.title,
        content: request.body,
        metadata: request.data || {},
        status: 'sent',
        sentAt: new Date()
      });

      return { success: true };
    } catch (error) {
      console.error('Error sending push notification:', error);
      
      // Log failed notification
      await this.logNotification({
        userId: request.userId,
        type: 'push',
        category: this.getCategoryFromData(request.data),
        subject: request.title,
        content: request.body,
        metadata: request.data || {},
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send push notification'
      };
    }
  }

  // Subscribe to push notifications
  async subscribeToPush(userId: string, subscription: PushSubscriptionJSON): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notification_preferences')
        .update({
          push_subscription: subscription,
          push_enabled: true
        })
        .eq('user_id', userId);

      if (error) {
        console.error('Error saving push subscription:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in subscribeToPush:', error);
      return false;
    }
  }

  // Unsubscribe from push notifications
  async unsubscribeFromPush(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notification_preferences')
        .update({
          push_subscription: null,
          push_enabled: false
        })
        .eq('user_id', userId);

      if (error) {
        console.error('Error removing push subscription:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in unsubscribeFromPush:', error);
      return false;
    }
  }

  // Send schedule created notification
  async notifyScheduleCreated(data: ScheduleNotificationData): Promise<void> {
    console.log(`=== notifyScheduleCreated開始: ${data.user.name} ===`);
    
    // Always save notification log (for in-app notifications)
    const notificationSubject = `${data.schedule.title}`;
    const notificationContent = `${this.formatDateTime(data.schedule.startTime)} - ${this.formatDateTime(data.schedule.endTime)}${data.schedule.location ? `\n場所: ${data.schedule.location}` : ''}`;
    
    await this.logNotification({
      userId: data.user.id,
      type: 'email',
      category: 'schedule_created',
      subject: notificationSubject,
      content: notificationContent,
      metadata: { 
        scheduleId: data.schedule.id,
        scheduleTitle: data.schedule.title,
        scheduleType: data.schedule.type,
        startTime: data.schedule.startTime,
        endTime: data.schedule.endTime
      },
      status: 'sent',
      sentAt: new Date(),
      isRead: false
    });
    console.log('通知ログ保存完了');
    
    // Check preferences for email/push notifications
    const preferences = await this.getUserPreferences(data.user.id);
    console.log('ユーザー通知設定:', preferences);
    if (!preferences) {
      console.log('通知設定なし、アプリ内通知のみ');
      return;
    }

    // Check if user wants email notifications for schedule creation
    if (preferences.emailEnabled && preferences.emailScheduleCreated) {
      await this.sendEmail({
        to: data.user.email,
        templateName: 'schedule_created',
        variables: {
          userName: data.user.name,
          title: data.schedule.title,
          startTime: this.formatDateTime(data.schedule.startTime),
          endTime: this.formatDateTime(data.schedule.endTime),
          type: data.schedule.type,
          location: data.schedule.location || '',
          details: data.schedule.details || '',
          meetLink: data.schedule.meetLink || '',
          calendarLink: `${NOTIFICATION_CONFIG.appUrl}/calendar`
        },
        userId: data.user.id,
        metadata: { scheduleId: data.schedule.id }
      });
    }

    // Check if user wants push notifications for schedule creation
    if (preferences.pushEnabled && preferences.pushScheduleCreated) {
      await this.sendPush({
        userId: data.user.id,
        title: '新しいスケジュール',
        body: `${data.schedule.title} - ${this.formatDateTime(data.schedule.startTime)}`,
        tag: `schedule-${data.schedule.id}`,
        data: {
          type: 'schedule_created',
          scheduleId: data.schedule.id
        },
        actions: [
          { action: 'view', title: '詳細を見る' },
          { action: 'dismiss', title: '閉じる' }
        ]
      });
    }
  }

  // Send schedule updated notification
  async notifyScheduleUpdated(data: ScheduleNotificationData): Promise<void> {
    const preferences = await this.getUserPreferences(data.user.id);
    if (!preferences) return;

    // Check if user wants email notifications for schedule updates
    if (preferences.emailEnabled && preferences.emailScheduleUpdated) {
      await this.sendEmail({
        to: data.user.email,
        templateName: 'schedule_updated',
        variables: {
          userName: data.user.name,
          title: data.schedule.title,
          startTime: this.formatDateTime(data.schedule.startTime),
          endTime: this.formatDateTime(data.schedule.endTime),
          type: data.schedule.type,
          location: data.schedule.location || '',
          details: data.schedule.details || '',
          meetLink: data.schedule.meetLink || '',
          changes: data.changes?.join('\n') || '',
          calendarLink: `${NOTIFICATION_CONFIG.appUrl}/calendar`
        },
        userId: data.user.id,
        metadata: { scheduleId: data.schedule.id }
      });
    }

    // Check if user wants push notifications for schedule updates
    if (preferences.pushEnabled && preferences.pushScheduleUpdated) {
      await this.sendPush({
        userId: data.user.id,
        title: 'スケジュールが更新されました',
        body: `${data.schedule.title} - ${this.formatDateTime(data.schedule.startTime)}`,
        tag: `schedule-${data.schedule.id}`,
        data: {
          type: 'schedule_updated',
          scheduleId: data.schedule.id
        }
      });
    }
  }

  // Send schedule deleted notification
  async notifyScheduleDeleted(data: ScheduleNotificationData): Promise<void> {
    const preferences = await this.getUserPreferences(data.user.id);
    if (!preferences) return;

    // Check if user wants email notifications for schedule deletion
    if (preferences.emailEnabled && preferences.emailScheduleDeleted) {
      await this.sendEmail({
        to: data.user.email,
        templateName: 'schedule_deleted',
        variables: {
          userName: data.user.name,
          title: data.schedule.title,
          startTime: this.formatDateTime(data.schedule.startTime),
          endTime: this.formatDateTime(data.schedule.endTime),
          type: data.schedule.type,
          deletedBy: data.deletedBy || '',
          reason: data.reason || ''
        },
        userId: data.user.id,
        metadata: { scheduleId: data.schedule.id }
      });
    }

    // Check if user wants push notifications for schedule deletion
    if (preferences.pushEnabled && preferences.pushScheduleDeleted) {
      await this.sendPush({
        userId: data.user.id,
        title: 'スケジュールが削除されました',
        body: `${data.schedule.title} - ${this.formatDateTime(data.schedule.startTime)}`,
        tag: `schedule-${data.schedule.id}`,
        data: {
          type: 'schedule_deleted',
          scheduleId: data.schedule.id
        }
      });
    }
  }

  // Send schedule reminder notification
  async notifyScheduleReminder(data: ScheduleNotificationData): Promise<void> {
    const preferences = await this.getUserPreferences(data.user.id);
    if (!preferences) return;

    // Check if user wants email reminders
    if (preferences.emailEnabled && preferences.emailScheduleReminder) {
      await this.sendEmail({
        to: data.user.email,
        templateName: 'schedule_reminder',
        variables: {
          userName: data.user.name,
          title: data.schedule.title,
          startTime: this.formatDateTime(data.schedule.startTime),
          endTime: this.formatDateTime(data.schedule.endTime),
          type: data.schedule.type,
          location: data.schedule.location || '',
          details: data.schedule.details || '',
          meetLink: data.schedule.meetLink || '',
          participants: data.schedule.participants.join(', '),
          timeUntilEvent: data.timeUntilEvent || '15分',
          calendarLink: `${NOTIFICATION_CONFIG.appUrl}/calendar`
        },
        userId: data.user.id,
        metadata: { scheduleId: data.schedule.id }
      });
    }

    // Check if user wants push reminders
    if (preferences.pushEnabled && preferences.pushScheduleReminder) {
      await this.sendPush({
        userId: data.user.id,
        title: `リマインダー: ${data.schedule.title}`,
        body: `${data.timeUntilEvent}後に開始されます`,
        tag: `reminder-${data.schedule.id}`,
        data: {
          type: 'schedule_reminder',
          scheduleId: data.schedule.id
        },
        requireInteraction: true,
        actions: [
          { action: 'view', title: '詳細を見る' },
          { action: 'join', title: '参加する' }
        ]
      });
    }
  }

  // Get notification logs for a user
  async getUserNotificationLogs(
    userId: string, 
    limit: number = 50, 
    offset: number = 0
  ): Promise<NotificationLog[]> {
    try {
      const { data, error } = await supabase
        .from('notification_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Error fetching notification logs:', error);
        return [];
      }

      return data.map(this.mapNotificationLogFromDb);
    } catch (error) {
      console.error('Error in getUserNotificationLogs:', error);
      return [];
    }
  }

  // Mark notification as read
  async markNotificationAsRead(notificationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notification_logs')
        .update({
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('id', notificationId);

      if (error) {
        console.error('Error marking notification as read:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in markNotificationAsRead:', error);
      return false;
    }
  }

  // Mark all notifications as read for a user
  async markAllNotificationsAsRead(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notification_logs')
        .update({
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) {
        console.error('Error marking all notifications as read:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in markAllNotificationsAsRead:', error);
      return false;
    }
  }

  // Log notification to database
  async logNotification(log: Omit<NotificationLog, 'id' | 'createdAt'>): Promise<void> {
    try {
      console.log('=== 通知ログ保存開始 ===');
      console.log('ログデータ:', log);
      
      const { data, error } = await supabase
        .from('notification_logs')
        .insert({
          user_id: log.userId,
          type: log.type,
          category: log.category,
          subject: log.subject,
          content: log.content,
          metadata: log.metadata,
          status: log.status,
          error_message: log.errorMessage,
          sent_at: log.sentAt
        })
        .select();

      if (error) {
        console.error('通知ログ保存エラー:', error);
        console.error('エラー詳細:', error.details, error.hint, error.message);
      } else {
        console.log('通知ログ保存成功:', data);
      }
    } catch (error) {
      console.error('Error in logNotification:', error);
    }
  }

  private formatDateTime(date: Date): string {
    return new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tokyo'
    }).format(date);
  }

  private getNotificationCategory(templateName: string): NotificationCategory {
    const categoryMap: Record<string, NotificationCategory> = {
      schedule_created: 'schedule_created',
      schedule_updated: 'schedule_updated',
      schedule_deleted: 'schedule_deleted',
      schedule_reminder: 'schedule_reminder',
      leave_request_submitted: 'leave_request_submitted',
      leave_request_approved: 'leave_request_approved',
      leave_request_rejected: 'leave_request_rejected'
    };

    return categoryMap[templateName] || 'schedule_created';
  }

  private getCategoryFromData(data?: Record<string, any>): NotificationCategory {
    if (!data?.type) return 'schedule_created';
    
    const typeMap: Record<string, NotificationCategory> = {
      schedule_created: 'schedule_created',
      schedule_updated: 'schedule_updated',
      schedule_deleted: 'schedule_deleted',
      schedule_reminder: 'schedule_reminder',
      leave_request: 'leave_request_submitted',
      leave_approved: 'leave_request_approved',
      leave_rejected: 'leave_request_rejected'
    };

    return typeMap[data.type] || 'schedule_created';
  }

  private mapNotificationLogFromDb(data: any): NotificationLog {
    return {
      id: data.id,
      userId: data.user_id,
      type: data.type,
      category: data.category,
      subject: data.subject,
      content: data.content,
      metadata: data.metadata || {},
      status: data.status,
      errorMessage: data.error_message,
      sentAt: data.sent_at ? new Date(data.sent_at) : undefined,
      createdAt: new Date(data.created_at),
      isRead: data.is_read || false,
      readAt: data.read_at ? new Date(data.read_at) : undefined
    };
  }

  private mapPreferencesFromDb(data: any): NotificationPreferences {
    return {
      id: data.id,
      userId: data.user_id,
      emailEnabled: data.email_enabled,
      emailScheduleCreated: data.email_schedule_created,
      emailScheduleUpdated: data.email_schedule_updated,
      emailScheduleDeleted: data.email_schedule_deleted,
      emailScheduleReminder: data.email_schedule_reminder,
      emailLeaveRequest: data.email_leave_request,
      emailLeaveApproval: data.email_leave_approval,
      pushEnabled: data.push_enabled,
      pushScheduleCreated: data.push_schedule_created,
      pushScheduleUpdated: data.push_schedule_updated,
      pushScheduleDeleted: data.push_schedule_deleted,
      pushScheduleReminder: data.push_schedule_reminder,
      pushLeaveRequest: data.push_leave_request,
      pushLeaveApproval: data.push_leave_approval,
      pushSubscription: data.push_subscription,
      defaultReminderTime: data.default_reminder_time,
      quietHoursEnabled: data.quiet_hours_enabled,
      quietHoursStart: data.quiet_hours_start,
      quietHoursEnd: data.quiet_hours_end,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }

  private mapPreferencesToDb(preferences: Partial<NotificationPreferences>): any {
    const dbPreferences: any = {};

    if (preferences.emailEnabled !== undefined) dbPreferences.email_enabled = preferences.emailEnabled;
    if (preferences.emailScheduleCreated !== undefined) dbPreferences.email_schedule_created = preferences.emailScheduleCreated;
    if (preferences.emailScheduleUpdated !== undefined) dbPreferences.email_schedule_updated = preferences.emailScheduleUpdated;
    if (preferences.emailScheduleDeleted !== undefined) dbPreferences.email_schedule_deleted = preferences.emailScheduleDeleted;
    if (preferences.emailScheduleReminder !== undefined) dbPreferences.email_schedule_reminder = preferences.emailScheduleReminder;
    if (preferences.emailLeaveRequest !== undefined) dbPreferences.email_leave_request = preferences.emailLeaveRequest;
    if (preferences.emailLeaveApproval !== undefined) dbPreferences.email_leave_approval = preferences.emailLeaveApproval;
    if (preferences.pushEnabled !== undefined) dbPreferences.push_enabled = preferences.pushEnabled;
    if (preferences.pushScheduleCreated !== undefined) dbPreferences.push_schedule_created = preferences.pushScheduleCreated;
    if (preferences.pushScheduleUpdated !== undefined) dbPreferences.push_schedule_updated = preferences.pushScheduleUpdated;
    if (preferences.pushScheduleDeleted !== undefined) dbPreferences.push_schedule_deleted = preferences.pushScheduleDeleted;
    if (preferences.pushScheduleReminder !== undefined) dbPreferences.push_schedule_reminder = preferences.pushScheduleReminder;
    if (preferences.pushLeaveRequest !== undefined) dbPreferences.push_leave_request = preferences.pushLeaveRequest;
    if (preferences.pushLeaveApproval !== undefined) dbPreferences.push_leave_approval = preferences.pushLeaveApproval;
    if (preferences.pushSubscription !== undefined) dbPreferences.push_subscription = preferences.pushSubscription;
    if (preferences.defaultReminderTime !== undefined) dbPreferences.default_reminder_time = preferences.defaultReminderTime;
    if (preferences.quietHoursEnabled !== undefined) dbPreferences.quiet_hours_enabled = preferences.quietHoursEnabled;
    if (preferences.quietHoursStart !== undefined) dbPreferences.quiet_hours_start = preferences.quietHoursStart;
    if (preferences.quietHoursEnd !== undefined) dbPreferences.quiet_hours_end = preferences.quietHoursEnd;

    return dbPreferences;
  }
}

// Export singleton instance
export const notificationService = new NotificationService();