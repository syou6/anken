import { useState } from 'react';
import { Bell, Mail, Calendar, TestTube } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { notificationService } from '../services/notificationService';
import { schedulerService } from '../services/schedulerService';
import { registerPushNotification, showLocalNotification } from '../utils/notifications';
import toast from 'react-hot-toast';

export default function NotificationTest() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);

  const testEmailNotification = async () => {
    if (!currentUser) return;

    setLoading(true);
    try {
      const response = await notificationService.sendEmail({
        to: currentUser.email,
        templateName: 'schedule_reminder',
        variables: {
          userName: currentUser.name,
          title: 'テスト会議',
          startTime: '2024年6月8日 14:00',
          endTime: '2024年6月8日 15:00',
          type: '会議',
          location: '会議室A',
          details: 'これはテスト用の会議です',
          timeUntilEvent: '15分',
          calendarLink: window.location.origin + '/calendar'
        },
        userId: currentUser.id
      });

      if (response.success) {
        toast.success('テストメールを送信しました');
      } else {
        toast.error('メール送信に失敗しました: ' + response.error);
      }
    } catch (error) {
      console.error('Error sending test email:', error);
      toast.error('メール送信中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const testPushNotification = async () => {
    if (!currentUser) return;

    setLoading(true);
    try {
      // First register for push notifications if not already registered
      const registered = await registerPushNotification(currentUser.id);
      
      if (registered) {
        // Send a test push notification
        const response = await notificationService.sendPush({
          userId: currentUser.id,
          title: 'テスト通知',
          body: 'これはプッシュ通知のテストです',
          icon: '/icon-192x192.png',
          badge: '/badge-72x72.png',
          tag: 'test-notification',
          data: {
            type: 'test',
            timestamp: Date.now()
          },
          requireInteraction: false,
          actions: [
            { action: 'view', title: '詳細を見る' },
            { action: 'dismiss', title: '閉じる' }
          ]
        });

        if (response.success) {
          toast.success('テストプッシュ通知を送信しました');
        } else {
          toast.error('プッシュ通知送信に失敗しました: ' + response.error);
        }
      } else {
        toast.error('プッシュ通知の登録に失敗しました');
      }
    } catch (error) {
      console.error('Error sending test push notification:', error);
      toast.error('プッシュ通知送信中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const testLocalNotification = async () => {
    setLoading(true);
    try {
      await showLocalNotification('ローカル通知テスト', {
        body: 'これはブラウザのローカル通知のテストです',
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        tag: 'local-test',
        requireInteraction: false
      });
      toast.success('ローカル通知を表示しました');
    } catch (error) {
      console.error('Error showing local notification:', error);
      toast.error('ローカル通知の表示に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const testScheduleReminder = async () => {
    if (!currentUser) return;

    setLoading(true);
    try {
      // Find a schedule to test with (or create a mock one)
      const mockScheduleId = 'test-schedule-' + Date.now();
      
      const success = await schedulerService.sendTestReminder(mockScheduleId, currentUser.id);
      
      if (success) {
        toast.success('テストリマインダーを送信しました');
      } else {
        toast.error('テストリマインダーの送信に失敗しました');
      }
    } catch (error) {
      console.error('Error sending test reminder:', error);
      toast.error('テストリマインダー送信中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="p-4 bg-yellow-50 rounded-md">
        <p className="text-yellow-800">ログインが必要です</p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center mb-4">
        <TestTube className="h-6 w-6 text-blue-600 mr-2" />
        <h3 className="text-lg font-medium text-gray-900">通知システムテスト</h3>
      </div>
      
      <p className="text-sm text-gray-600 mb-6">
        各種通知機能をテストできます。開発環境では実際のメール送信の代わりにコンソールにログが出力されます。
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <button
          onClick={testEmailNotification}
          disabled={loading}
          className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Mail className="h-5 w-5 mr-2" />
          メール通知テスト
        </button>

        <button
          onClick={testPushNotification}
          disabled={loading}
          className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Bell className="h-5 w-5 mr-2" />
          プッシュ通知テスト
        </button>

        <button
          onClick={testLocalNotification}
          disabled={loading}
          className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Bell className="h-5 w-5 mr-2" />
          ローカル通知テスト
        </button>

        <button
          onClick={testScheduleReminder}
          disabled={loading}
          className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Calendar className="h-5 w-5 mr-2" />
          リマインダーテスト
        </button>
      </div>

      {loading && (
        <div className="mt-4 flex items-center justify-center">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
          <span className="ml-2 text-sm text-gray-600">処理中...</span>
        </div>
      )}
    </div>
  );
}