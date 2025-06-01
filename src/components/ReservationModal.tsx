import { useState } from 'react';
import { X } from 'lucide-react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Schedule, Equipment } from '../types';
import { mockUsers } from '../data/mockData';
import { useAuth } from '../contexts/AuthContext';

interface ReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (schedule: Partial<Schedule>) => void;
  selectedDate?: Date;
  selectedEquipment?: Equipment;
  type: 'room' | 'vehicle' | 'sample';
}

export default function ReservationModal({
  isOpen,
  onClose,
  onSubmit,
  selectedDate,
  selectedEquipment,
  type
}: ReservationModalProps) {
  const { currentUser } = useAuth();
  const [formData, setFormData] = useState<Partial<Schedule>>({
    type: '会議',
    title: '',
    details: '',
    startTime: selectedDate ? new Date(selectedDate) : new Date(),
    endTime: selectedDate ? new Date(selectedDate) : new Date(),
    isAllDay: false,
    participants: currentUser ? [currentUser.id] : [],
    equipment: selectedEquipment ? [selectedEquipment] : [],
    reminders: [{ time: 15, methods: ['email'] }],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            {type === 'room' ? '会議室予約' : 
             type === 'vehicle' ? '車両予約' : 'サンプル予約'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {type === 'sample' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">生産番号</label>
                <input
                  type="text"
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="例: 22186"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">品番</label>
                <input
                  type="text"
                  value={formData.details || ''}
                  onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                  placeholder="例: Acka-424"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">枚数</label>
                <input
                  type="number"
                  min="1"
                  value={formData.quantity || '1'}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">種別</label>
                <select
                  value={formData.type || '会議'}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="会議">会議</option>
                  <option value="オンライン商談">オンライン商談</option>
                  <option value="来訪">来訪</option>
                  <option value="工事">工事</option>
                  <option value="その他">その他</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">タイトル</label>
                <input
                  type="text"
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">詳細</label>
                <textarea
                  value={formData.details || ''}
                  onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">開始時間</label>
              <input
                type="datetime-local"
                value={format(formData.startTime || new Date(), "yyyy-MM-dd'T'HH:mm")}
                onChange={(e) => setFormData({ ...formData, startTime: new Date(e.target.value) })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">終了時間</label>
              <input
                type="datetime-local"
                value={format(formData.endTime || new Date(), "yyyy-MM-dd'T'HH:mm")}
                onChange={(e) => setFormData({ ...formData, endTime: new Date(e.target.value) })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
          </div>

          {type !== 'sample' && (
            <div>
              <label className="block text-sm font-medium text-gray-700">参加者</label>
              <div className="mt-1 grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {mockUsers.map(user => (
                  <div key={user.id} className="flex items-center">
                    <input
                      type="checkbox"
                      id={`user-${user.id}`}
                      checked={formData.participants?.includes(user.id)}
                      onChange={(e) => {
                        const participants = formData.participants || [];
                        if (e.target.checked) {
                          setFormData({ ...formData, participants: [...participants, user.id] });
                        } else {
                          setFormData({
                            ...formData,
                            participants: participants.filter(id => id !== user.id)
                          });
                        }
                      }}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor={`user-${user.id}`} className="ml-2 block text-sm text-gray-900">
                      {user.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">通知</label>
            <div className="mt-1 space-y-2">
              <div className="flex items-center space-x-2">
                <select
                  value={formData.reminders?.[0]?.time || 15}
                  onChange={(e) => setFormData({
                    ...formData,
                    reminders: [{ ...formData.reminders?.[0], time: parseInt(e.target.value) }]
                  })}
                  className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value={5}>5分前</option>
                  <option value={10}>10分前</option>
                  <option value={15}>15分前</option>
                  <option value={30}>30分前</option>
                  <option value={60}>1時間前</option>
                </select>
                <div className="space-x-2">
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.reminders?.[0]?.methods.includes('email')}
                      onChange={(e) => {
                        const methods = formData.reminders?.[0]?.methods || [];
                        if (e.target.checked) {
                          setFormData({
                            ...formData,
                            reminders: [{ ...formData.reminders?.[0], methods: [...methods, 'email'] }]
                          });
                        } else {
                          setFormData({
                            ...formData,
                            reminders: [{
                              ...formData.reminders?.[0],
                              methods: methods.filter(m => m !== 'email')
                            }]
                          });
                        }
                      }}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-900">メール</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.reminders?.[0]?.methods.includes('notification')}
                      onChange={(e) => {
                        const methods = formData.reminders?.[0]?.methods || [];
                        if (e.target.checked) {
                          setFormData({
                            ...formData,
                            reminders: [{ ...formData.reminders?.[0], methods: [...methods, 'notification'] }]
                          });
                        } else {
                          setFormData({
                            ...formData,
                            reminders: [{
                              ...formData.reminders?.[0],
                              methods: methods.filter(m => m !== 'notification')
                            }]
                          });
                        }
                      }}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-900">通知</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white
                ${type === 'room' ? 'bg-emerald-600 hover:bg-emerald-700' :
                  type === 'vehicle' ? 'bg-amber-600 hover:bg-amber-700' :
                  'bg-purple-600 hover:bg-purple-700'}
                focus:outline-none focus:ring-2 focus:ring-offset-2
                ${type === 'room' ? 'focus:ring-emerald-500' :
                  type === 'vehicle' ? 'focus:ring-amber-500' :
                  'focus:ring-purple-500'}`}
            >
              予約する
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}