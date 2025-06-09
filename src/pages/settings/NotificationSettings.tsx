import { useState, useEffect } from 'react';
import { Bell, Mail, Smartphone, Clock, Moon, Check, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { notificationService } from '../../services/notificationService';
import { registerPushNotification, unregisterPushNotification, supportsNotifications } from '../../utils/notifications';
import { NotificationPreferences } from '../../types';
import NotificationTest from '../../components/NotificationTest';
import toast from 'react-hot-toast';

export default function NotificationSettings() {
  const { currentUser } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushSupported] = useState(supportsNotifications());

  // Load user preferences on mount
  useEffect(() => {
    if (currentUser) {
      loadPreferences();
    }
  }, [currentUser]);

  const loadPreferences = async () => {
    if (!currentUser) return;

    setLoading(true);
    try {
      const prefs = await notificationService.getUserPreferences(currentUser.id);
      setPreferences(prefs);
    } catch (error) {
      console.error('Error loading preferences:', error);
      toast.error('通知設定の読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    if (!currentUser || !preferences) return;

    setSaving(true);
    try {
      const success = await notificationService.updateUserPreferences(
        currentUser.id,
        preferences
      );

      if (success) {
        toast.success('通知設定を保存しました');
      } else {
        toast.error('通知設定の保存に失敗しました');
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error('通知設定の保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handlePushToggle = async (enabled: boolean) => {
    if (!currentUser) return;

    if (enabled) {
      // Enable push notifications
      const success = await registerPushNotification(currentUser.id);
      if (success) {
        setPreferences(prev => prev ? { ...prev, pushEnabled: true } : null);
        toast.success('プッシュ通知を有効にしました');
      } else {
        toast.error('プッシュ通知の有効化に失敗しました');
      }
    } else {
      // Disable push notifications
      const success = await unregisterPushNotification(currentUser.id);
      if (success) {
        setPreferences(prev => prev ? { ...prev, pushEnabled: false } : null);
        toast.success('プッシュ通知を無効にしました');
      } else {
        toast.error('プッシュ通知の無効化に失敗しました');
      }
    }
  };

  const updatePreference = (key: keyof NotificationPreferences, value: any) => {
    setPreferences(prev => prev ? { ...prev, [key]: value } : null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">通知設定を読み込めませんでした</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">通知設定</h2>
          <p className="mt-1 text-sm text-gray-600">
            メール通知とプッシュ通知の設定を管理します
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Email Notifications */}
          <div>
            <div className="flex items-center mb-4">
              <Mail className="h-5 w-5 text-gray-400 mr-2" />
              <h3 className="text-lg font-medium text-gray-900">メール通知</h3>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.emailEnabled}
                    onChange={(e) => updatePreference('emailEnabled', e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-3 text-sm font-medium text-gray-700">
                    メール通知を有効にする
                  </span>
                </label>
              </div>

              {preferences.emailEnabled && (
                <div className="ml-6 space-y-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={preferences.emailScheduleCreated}
                      onChange={(e) => updatePreference('emailScheduleCreated', e.target.checked)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-3 text-sm text-gray-700">
                      新しいスケジュールが作成されたとき
                    </span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={preferences.emailScheduleUpdated}
                      onChange={(e) => updatePreference('emailScheduleUpdated', e.target.checked)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-3 text-sm text-gray-700">
                      スケジュールが更新されたとき
                    </span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={preferences.emailScheduleDeleted}
                      onChange={(e) => updatePreference('emailScheduleDeleted', e.target.checked)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-3 text-sm text-gray-700">
                      スケジュールが削除されたとき
                    </span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={preferences.emailScheduleReminder}
                      onChange={(e) => updatePreference('emailScheduleReminder', e.target.checked)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-3 text-sm text-gray-700">
                      スケジュールのリマインダー
                    </span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={preferences.emailLeaveRequest}
                      onChange={(e) => updatePreference('emailLeaveRequest', e.target.checked)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-3 text-sm text-gray-700">
                      休暇申請の通知
                    </span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={preferences.emailLeaveApproval}
                      onChange={(e) => updatePreference('emailLeaveApproval', e.target.checked)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-3 text-sm text-gray-700">
                      休暇申請の承認/却下通知
                    </span>
                  </label>
                </div>
              )}
            </div>
          </div>

          <div className="border-t pt-6">
            {/* Push Notifications */}
            <div className="flex items-center mb-4">
              <Smartphone className="h-5 w-5 text-gray-400 mr-2" />
              <h3 className="text-lg font-medium text-gray-900">プッシュ通知</h3>
            </div>

            {!pushSupported ? (
              <div className="p-4 bg-yellow-50 rounded-md">
                <p className="text-sm text-yellow-800">
                  お使いのブラウザはプッシュ通知に対応していません
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.pushEnabled}
                      onChange={(e) => handlePushToggle(e.target.checked)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-3 text-sm font-medium text-gray-700">
                      プッシュ通知を有効にする
                    </span>
                  </label>
                </div>

                {preferences.pushEnabled && (
                  <div className="ml-6 space-y-3">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={preferences.pushScheduleCreated}
                        onChange={(e) => updatePreference('pushScheduleCreated', e.target.checked)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-3 text-sm text-gray-700">
                        新しいスケジュールが作成されたとき
                      </span>
                    </label>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={preferences.pushScheduleUpdated}
                        onChange={(e) => updatePreference('pushScheduleUpdated', e.target.checked)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-3 text-sm text-gray-700">
                        スケジュールが更新されたとき
                      </span>
                    </label>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={preferences.pushScheduleDeleted}
                        onChange={(e) => updatePreference('pushScheduleDeleted', e.target.checked)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-3 text-sm text-gray-700">
                        スケジュールが削除されたとき
                      </span>
                    </label>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={preferences.pushScheduleReminder}
                        onChange={(e) => updatePreference('pushScheduleReminder', e.target.checked)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-3 text-sm text-gray-700">
                        スケジュールのリマインダー
                      </span>
                    </label>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={preferences.pushLeaveRequest}
                        onChange={(e) => updatePreference('pushLeaveRequest', e.target.checked)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-3 text-sm text-gray-700">
                        休暇申請の通知
                      </span>
                    </label>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={preferences.pushLeaveApproval}
                        onChange={(e) => updatePreference('pushLeaveApproval', e.target.checked)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-3 text-sm text-gray-700">
                        休暇申請の承認/却下通知
                      </span>
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t pt-6">
            {/* Reminder Settings */}
            <div className="flex items-center mb-4">
              <Clock className="h-5 w-5 text-gray-400 mr-2" />
              <h3 className="text-lg font-medium text-gray-900">リマインダー設定</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  デフォルトのリマインダー時間
                </label>
                <select
                  value={preferences.defaultReminderTime}
                  onChange={(e) => updatePreference('defaultReminderTime', parseInt(e.target.value))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value={5}>5分前</option>
                  <option value={10}>10分前</option>
                  <option value={15}>15分前</option>
                  <option value={30}>30分前</option>
                  <option value={60}>1時間前</option>
                  <option value={120}>2時間前</option>
                  <option value={1440}>1日前</option>
                </select>
              </div>
            </div>
          </div>

          <div className="border-t pt-6">
            {/* Quiet Hours */}
            <div className="flex items-center mb-4">
              <Moon className="h-5 w-5 text-gray-400 mr-2" />
              <h3 className="text-lg font-medium text-gray-900">おやすみ時間</h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={preferences.quietHoursEnabled}
                  onChange={(e) => updatePreference('quietHoursEnabled', e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="ml-3 text-sm font-medium text-gray-700">
                  おやすみ時間を有効にする
                </span>
              </div>

              {preferences.quietHoursEnabled && (
                <div className="ml-6 grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      開始時刻
                    </label>
                    <input
                      type="time"
                      value={preferences.quietHoursStart || '22:00'}
                      onChange={(e) => updatePreference('quietHoursStart', e.target.value)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      終了時刻
                    </label>
                    <input
                      type="time"
                      value={preferences.quietHoursEnd || '07:00'}
                      onChange={(e) => updatePreference('quietHoursEnd', e.target.value)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>
                </div>
              )}

              {preferences.quietHoursEnabled && (
                <p className="ml-6 text-sm text-gray-500">
                  この時間帯は通知が送信されません
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button
            onClick={savePreferences}
            disabled={saving}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                保存中...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                設定を保存
              </>
            )}
          </button>
        </div>
      </div>

      <div className="mt-8">
        <NotificationTest />
      </div>
    </div>
  );
}