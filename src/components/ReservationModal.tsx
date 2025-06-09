import { useState, useEffect } from 'react';
import { X, Clock, AlertTriangle, Video, VideoOff, Users as UsersIcon, Link } from 'lucide-react';
import { format, addHours, setMinutes, setHours } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Schedule, Equipment } from '../types';
import { mockUsers } from '../data/mockData';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import ParticipantSelector from './ParticipantSelector';
import toast from 'react-hot-toast';
import { 
  generateGoogleMeetLink, 
  supportsMeetLink, 
  getDefaultMeetingType, 
  shouldAutoGenerateMeetLink,
  isValidMeetLink,
  getMeetingTypeDisplay,
  getMeetingTypeStyles
} from '../utils/googleMeet';
import { googleCalendarService } from '../services/googleCalendarService';

interface ReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (schedule: Partial<Schedule>) => void;
  selectedDate?: Date;
  selectedEquipment?: Equipment;
  type: 'room' | 'vehicle' | 'sample' | 'general';
  editingSchedule?: Schedule;
}

export default function ReservationModal({
  isOpen,
  onClose,
  onSubmit,
  selectedDate,
  selectedEquipment,
  type,
  editingSchedule
}: ReservationModalProps) {
  const { currentUser } = useAuth();
  
  // Initialize form data
  const getInitialFormData = () => {
    if (editingSchedule) {
      return {
        ...editingSchedule,
        startTime: new Date(editingSchedule.startTime),
        endTime: new Date(editingSchedule.endTime)
      };
    }
    
    const now = selectedDate || new Date();
    const startTime = setMinutes(setHours(now, 9), 0); // 9:00 AM default
    const endTime = addHours(startTime, 1); // 1 hour default
    
    const scheduleType = type === 'vehicle' ? '外出' : type === 'room' ? '会議' : type === 'sample' ? 'サンプル作成' : '15分無料相談';
    const defaultMeetingType = getDefaultMeetingType(scheduleType);
    
    return {
      type: scheduleType,
      title: '',
      details: '',
      startTime,
      endTime,
      isAllDay: false,
      participants: currentUser ? [currentUser.id] : [],
      equipment: selectedEquipment ? [{ id: selectedEquipment.id, name: selectedEquipment.name, type: selectedEquipment.type }] : [],
      reminders: [{ time: 15, methods: ['email'] }],
      recurrence: null,
      meetingType: defaultMeetingType,
      meetLink: shouldAutoGenerateMeetLink(scheduleType) ? generateGoogleMeetLink('新しい会議', startTime) : ''
    };
  };
  
  const [formData, setFormData] = useState<Partial<Schedule>>(getInitialFormData());
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  const [availableVehicles, setAvailableVehicles] = useState<any[]>([]);
  const [conflictingSchedules, setConflictingSchedules] = useState<Schedule[]>([]);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [creatorUser, setCreatorUser] = useState<any>(null);
  const [updaterUser, setUpdaterUser] = useState<any>(null);
  
  // Load equipment data and user info
  useEffect(() => {
    if (isOpen) {
      loadEquipment();
      if (editingSchedule) {
        setFormData(getInitialFormData());
        loadUserInfo();
      } else {
        // 新規作成時は作成者・編集者情報をクリア
        setCreatorUser(null);
        setUpdaterUser(null);
      }
    }
  }, [isOpen, editingSchedule]);
  
  const loadEquipment = async () => {
    try {
      const [roomsRes, vehiclesRes] = await Promise.all([
        supabase.from('rooms').select('*').order('name'),
        supabase.from('vehicles').select('*').order('name')
      ]);
      
      if (roomsRes.data) setAvailableRooms(roomsRes.data);
      if (vehiclesRes.data) setAvailableVehicles(vehiclesRes.data);
    } catch (error) {
      console.error('Error loading equipment:', error);
    }
  };

  // Load user information for creator and updater
  const loadUserInfo = async () => {
    if (!editingSchedule) return;
    
    try {
      const userIds = [editingSchedule.createdBy, editingSchedule.updatedBy].filter(Boolean);
      if (userIds.length === 0) return;
      
      const { data, error } = await supabase
        .from('users')
        .select('id, name, employee_id')
        .in('id', userIds);
      
      if (error) {
        console.error('Error loading user info:', error);
        return;
      }
      
      const creator = data?.find(u => u.id === editingSchedule.createdBy);
      const updater = data?.find(u => u.id === editingSchedule.updatedBy);
      
      setCreatorUser(creator || null);
      setUpdaterUser(updater || null);
    } catch (error) {
      console.error('Error loading user info:', error);
    }
  };

  // 15-minute interval time options
  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const timeValue = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        options.push(timeValue);
      }
    }
    return options;
  };
  
  const timeOptions = generateTimeOptions();
  
  // Handle meet link generation
  const handleGenerateMeetLink = () => {
    if (formData.title && formData.startTime) {
      const newMeetLink = generateGoogleMeetLink(formData.title, formData.startTime);
      setFormData({ ...formData, meetLink: newMeetLink });
      toast.success('Google Meet リンクが生成されました');
    } else {
      toast.error('タイトルと開始時間を設定してからリンクを生成してください');
    }
  };

  // Handle meeting type change
  const handleMeetingTypeChange = (newMeetingType: 'in-person' | 'online' | 'hybrid') => {
    const updates: Partial<Schedule> = { meetingType: newMeetingType };
    
    // Auto-generate meet link for online meetings
    if (newMeetingType === 'online' && !formData.meetLink && formData.title && formData.startTime) {
      updates.meetLink = generateGoogleMeetLink(formData.title, formData.startTime);
    }
    
    // Clear meet link for in-person meetings
    if (newMeetingType === 'in-person') {
      updates.meetLink = '';
    }
    
    setFormData({ ...formData, ...updates });
  };

  // Handle schedule type change and update meeting options
  const handleScheduleTypeChange = (newType: string) => {
    const supportsMeet = supportsMeetLink(newType);
    const defaultMeetingType = getDefaultMeetingType(newType);
    const shouldAutoGenerate = shouldAutoGenerateMeetLink(newType);
    
    const updates: Partial<Schedule> = {
      type: newType,
      meetingType: defaultMeetingType
    };
    
    if (!supportsMeet) {
      updates.meetLink = '';
      updates.meetingType = 'in-person';
    } else if (shouldAutoGenerate && formData.title && formData.startTime) {
      updates.meetLink = generateGoogleMeetLink(formData.title, formData.startTime);
    }
    
    setFormData({ ...formData, ...updates });
  };
  
  // Check for schedule conflicts
  const checkConflicts = async (scheduleData: Partial<Schedule>) => {
    if (!scheduleData.participants || scheduleData.participants.length === 0) return [];
    
    // 空のparticipantsや無効なUUIDをフィルタリング
    const validParticipants = scheduleData.participants.filter(p => p && p.trim() !== '');
    if (validParticipants.length === 0) return [];
    
    try {
      let query = supabase
        .from('schedules')
        .select('*')
        .overlaps('participants', validParticipants)
        .gte('end_time', scheduleData.startTime?.toISOString())
        .lte('start_time', scheduleData.endTime?.toISOString());
      
      // 編集中のスケジュールがある場合のみ除外
      if (editingSchedule?.id) {
        query = query.neq('id', editingSchedule.id);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error checking conflicts:', error);
      return [];
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Enhanced Validation
    const errors = [];
    
    if (!formData.title?.trim()) {
      errors.push('タイトルを入力してください');
    }
    
    if (!formData.type) {
      errors.push('種別を選択してください');
    }
    
    if (!formData.startTime || !formData.endTime) {
      errors.push('日時を設定してください');
    } else if (formData.startTime >= formData.endTime) {
      errors.push('終了時刻は開始時刻より後に設定してください');
    }
    
    if (!formData.participants || formData.participants.length === 0) {
      errors.push('参加者を選択してください');
    }
    
    // Type-specific validation
    if (type === 'vehicle') {
      if (!formData.equipment || formData.equipment.length === 0) {
        errors.push('車両を選択してください');
      }
    } else if (type === 'room') {
      if (!formData.equipment || formData.equipment.length === 0) {
        errors.push('会議室を選択してください');
      }
    } else if (type === 'sample') {
      if (!formData.assignedTo) {
        errors.push('担当者を選択してください');
      }
      if (!formData.quantity || formData.quantity < 1) {
        errors.push('正しい枚数を入力してください');
      }
    }
    
    if (errors.length > 0) {
      toast.error(errors[0]); // Show first error
      return;
    }
    
    // Check for conflicts
    const conflicts = await checkConflicts(formData);
    if (conflicts.length > 0 && !showConflictModal) {
      setConflictingSchedules(conflicts);
      setShowConflictModal(true);
      return;
    }
    
    // 一時的にGoogle Meet機能を無効化してデバッグ
    console.log('Submitting form data:', formData);
    
    // Submit the schedule
    onSubmit({
      ...formData,
      createdBy: currentUser?.id,
      updatedBy: currentUser?.id
    });
    onClose();
    setShowConflictModal(false);
  };
  
  const handleForceSubmit = () => {
    onSubmit({
      ...formData,
      createdBy: currentUser?.id,
      updatedBy: currentUser?.id
    });
    onClose();
    setShowConflictModal(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
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
          {/* 種別選択 */}
          {type === 'general' && (
            <div>
              <label className="block text-sm font-medium text-gray-700">種別</label>
              <select
                value={formData.type || ''}
                onChange={(e) => handleScheduleTypeChange(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              >
                <option value="15分無料相談">15分無料相談</option>
                <option value="オンライン商談">オンライン商談</option>
                <option value="会議">会議</option>
                <option value="来訪">来訪</option>
                <option value="工事">工事</option>
              </select>
            </div>
          )}
          
          {/* タイトル */}
          {type === 'general' && (
            <div>
              <label className="block text-sm font-medium text-gray-700">タイトル</label>
              <input
                type="text"
                value={formData.title || ''}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              />
            </div>
          )}
          
          {/* 詳細 */}
          {type === 'general' && (
            <div>
              <label className="block text-sm font-medium text-gray-700">詳細</label>
              <textarea
                value={formData.details || ''}
                onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                rows={3}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
          )}
          
          {/* Google Meet連携設定 */}
          {type === 'general' && supportsMeetLink(formData.type || '') && (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                <Video className="h-4 w-4 mr-2" />
                会議設定
              </h4>
              
              {/* 会議形式選択 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">会議形式</label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="meetingType"
                      value="in-person"
                      checked={formData.meetingType === 'in-person'}
                      onChange={(e) => handleMeetingTypeChange(e.target.value as 'in-person')}
                      className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700 flex items-center">
                      <UsersIcon className="h-4 w-4 mr-1" />
                      対面
                    </span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="meetingType"
                      value="online"
                      checked={formData.meetingType === 'online'}
                      onChange={(e) => handleMeetingTypeChange(e.target.value as 'online')}
                      className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700 flex items-center">
                      <Video className="h-4 w-4 mr-1" />
                      オンライン
                    </span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="meetingType"
                      value="hybrid"
                      checked={formData.meetingType === 'hybrid'}
                      onChange={(e) => handleMeetingTypeChange(e.target.value as 'hybrid')}
                      className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700 flex items-center">
                      <Video className="h-4 w-4 mr-1" />
                      <UsersIcon className="h-4 w-4 mr-1" />
                      ハイブリッド
                    </span>
                  </label>
                </div>
              </div>
              
              {/* Google Meet リンク設定 */}
              {(formData.meetingType === 'online' || formData.meetingType === 'hybrid') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Google Meet リンク</label>
                  <div className="flex space-x-2">
                    <input
                      type="url"
                      value={formData.meetLink || ''}
                      onChange={(e) => setFormData({ ...formData, meetLink: e.target.value })}
                      placeholder="https://meet.google.com/..."
                      className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleGenerateMeetLink}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      <Link className="h-4 w-4 mr-1" />
                      生成
                    </button>
                  </div>
                  {formData.meetLink && !isValidMeetLink(formData.meetLink) && (
                    <p className="mt-1 text-sm text-red-600">有効なGoogle Meet URLを入力してください</p>
                  )}
                  {formData.meetLink && isValidMeetLink(formData.meetLink) && (
                    <div className="mt-2 flex items-center">
                      <Link className="h-4 w-4 text-green-600 mr-1" />
                      <a 
                        href={formData.meetLink} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-green-600 hover:text-green-800 underline"
                      >
                        会議に参加する
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* 参加者選択 */}
          {type === 'general' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">参加者</label>
              <ParticipantSelector
                selectedParticipants={formData.participants || []}
                onChange={(participants) => setFormData({ ...formData, participants })}
                showBusinessGroups={true}
                showLeaveGroups={false}
              />
            </div>
          )}
          
          {/* 設備選択 */}
          {(type === 'general' || type === 'room' || type === 'vehicle') && (
            <div>
              <label className="block text-sm font-medium text-gray-700">設備</label>
              <div className="mt-2 space-y-2">
                {/* 会議室 */}
                <div>
                  <label className="block text-sm text-gray-600">会議室</label>
                  <div className="mt-1 space-y-1">
                    {availableRooms.map(room => (
                      <label key={room.id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={(formData.equipment || []).some(eq => eq.id === room.id && eq.type === 'room')}
                          onChange={(e) => {
                            const equipment = formData.equipment || [];
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                equipment: [...equipment, { id: room.id, name: room.name, type: 'room' }]
                              });
                            } else {
                              setFormData({
                                ...formData,
                                equipment: equipment.filter(eq => !(eq.id === room.id && eq.type === 'room'))
                              });
                            }
                          }}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">{room.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                {/* 車両 */}
                <div>
                  <label className="block text-sm text-gray-600">車両</label>
                  <div className="mt-1 space-y-1">
                    {availableVehicles.map(vehicle => (
                      <label key={vehicle.id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={(formData.equipment || []).some(eq => eq.id === vehicle.id && eq.type === 'vehicle')}
                          onChange={(e) => {
                            const equipment = formData.equipment || [];
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                equipment: [...equipment, { id: vehicle.id, name: vehicle.name, type: 'vehicle' }]
                              });
                            } else {
                              setFormData({
                                ...formData,
                                equipment: equipment.filter(eq => !(eq.id === vehicle.id && eq.type === 'vehicle'))
                              });
                            }
                          }}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">{vehicle.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* 車両予約用フォーム */}
          {type === 'vehicle' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">用途</label>
                <select
                  value={formData.type || '外出'}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="外出">外出</option>
                  <option value="営業">営業</option>
                  <option value="配送">配送</option>
                  <option value="出張">出張</option>
                  <option value="その他">その他</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">行き先</label>
                <input
                  type="text"
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="例: 東京駅、取引先A社"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">目的・詳細</label>
                <textarea
                  value={formData.details || ''}
                  onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                  placeholder="例: 納品、打ち合わせ、商談"
                  rows={2}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
            </>
          )}

          {/* 会議室予約用フォーム */}
          {type === 'room' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">会議種別</label>
                <select
                  value={formData.type || '会議'}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="会議">会議</option>
                  <option value="打ち合わせ">打ち合わせ</option>
                  <option value="面接">面接</option>
                  <option value="研修">研修</option>
                  <option value="プレゼン">プレゼン</option>
                  <option value="その他">その他</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">会議名</label>
                <input
                  type="text"
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="例: 月次売上検討会議"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">議題・詳細</label>
                <textarea
                  value={formData.details || ''}
                  onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                  placeholder="例: 売上分析、来月の目標設定"
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">参加者</label>
                <ParticipantSelector
                  selectedParticipants={formData.participants || []}
                  onChange={(participants) => setFormData({ ...formData, participants })}
                  showBusinessGroups={true}
                  showLeaveGroups={false}
                />
              </div>
              
              {/* 会議室予約でのGoogle Meet連携設定 */}
              {supportsMeetLink(formData.type || '') && (
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                    <Video className="h-4 w-4 mr-2" />
                    会議設定
                  </h4>
                  
                  {/* 会議形式選択 */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">会議形式</label>
                    <div className="flex space-x-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="meetingType"
                          value="in-person"
                          checked={formData.meetingType === 'in-person'}
                          onChange={(e) => handleMeetingTypeChange(e.target.value as 'in-person')}
                          className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                        />
                        <span className="ml-2 text-sm text-gray-700 flex items-center">
                          <UsersIcon className="h-4 w-4 mr-1" />
                          対面
                        </span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="meetingType"
                          value="online"
                          checked={formData.meetingType === 'online'}
                          onChange={(e) => handleMeetingTypeChange(e.target.value as 'online')}
                          className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                        />
                        <span className="ml-2 text-sm text-gray-700 flex items-center">
                          <Video className="h-4 w-4 mr-1" />
                          オンライン
                        </span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="meetingType"
                          value="hybrid"
                          checked={formData.meetingType === 'hybrid'}
                          onChange={(e) => handleMeetingTypeChange(e.target.value as 'hybrid')}
                          className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                        />
                        <span className="ml-2 text-sm text-gray-700 flex items-center">
                          <Video className="h-4 w-4 mr-1" />
                          <UsersIcon className="h-4 w-4 mr-1" />
                          ハイブリッド
                        </span>
                      </label>
                    </div>
                  </div>
                  
                  {/* Google Meet リンク設定 */}
                  {(formData.meetingType === 'online' || formData.meetingType === 'hybrid') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Google Meet リンク</label>
                      <div className="flex space-x-2">
                        <input
                          type="url"
                          value={formData.meetLink || ''}
                          onChange={(e) => setFormData({ ...formData, meetLink: e.target.value })}
                          placeholder="https://meet.google.com/..."
                          className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        />
                        <button
                          type="button"
                          onClick={handleGenerateMeetLink}
                          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          <Link className="h-4 w-4 mr-1" />
                          生成
                        </button>
                      </div>
                      {formData.meetLink && !isValidMeetLink(formData.meetLink) && (
                        <p className="mt-1 text-sm text-red-600">有効なGoogle Meet URLを入力してください</p>
                      )}
                      {formData.meetLink && isValidMeetLink(formData.meetLink) && (
                        <div className="mt-2 flex items-center">
                          <Link className="h-4 w-4 text-green-600 mr-1" />
                          <a 
                            href={formData.meetLink} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm text-green-600 hover:text-green-800 underline"
                          >
                            会議に参加する
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* サンプル予約用フォーム */}
          {type === 'sample' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">作業種別</label>
                <select
                  value={formData.type || 'サンプル作成'}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="サンプル作成">サンプル作成</option>
                  <option value="CAD・マーキング">CAD・マーキング</option>
                  <option value="サンプル裁断">サンプル裁断</option>
                  <option value="サンプル縫製">サンプル縫製</option>
                  <option value="サンプル内職">サンプル内職</option>
                  <option value="プレス">プレス</option>
                  <option value="仕上げ・梱包">仕上げ・梱包</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">生産番号</label>
                <input
                  type="text"
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="例: 22186"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  required
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
              <div>
                <label className="block text-sm font-medium text-gray-700">担当者</label>
                <select
                  value={formData.assignedTo || ''}
                  onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="">担当者を選択</option>
                  {mockUsers.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.department})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">備考</label>
                <textarea
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="例: 急ぎ、特殊仕様"
                  rows={2}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
            </>
          )}

          {/* 日時設定（15分単位） */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">日付</label>
              <input
                type="date"
                value={formData.startTime ? format(formData.startTime, 'yyyy-MM-dd') : ''}
                onChange={(e) => {
                  const selectedDate = new Date(e.target.value);
                  const currentStart = formData.startTime || new Date();
                  const currentEnd = formData.endTime || new Date();
                  
                  const newStart = new Date(selectedDate);
                  newStart.setHours(currentStart.getHours(), currentStart.getMinutes());
                  
                  const newEnd = new Date(selectedDate);
                  newEnd.setHours(currentEnd.getHours(), currentEnd.getMinutes());
                  
                  setFormData({ ...formData, startTime: newStart, endTime: newEnd });
                }}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">開始時刻</label>
                <select
                  value={formData.startTime ? format(formData.startTime, 'HH:mm') : ''}
                  onChange={(e) => {
                    const [hours, minutes] = e.target.value.split(':').map(Number);
                    const newStartTime = new Date(formData.startTime || new Date());
                    newStartTime.setHours(hours, minutes, 0, 0);
                    setFormData({ ...formData, startTime: newStartTime });
                  }}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  required
                >
                  {timeOptions.map(time => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">終了時刻</label>
                <select
                  value={formData.endTime ? format(formData.endTime, 'HH:mm') : ''}
                  onChange={(e) => {
                    const [hours, minutes] = e.target.value.split(':').map(Number);
                    const newEndTime = new Date(formData.endTime || new Date());
                    newEndTime.setHours(hours, minutes, 0, 0);
                    setFormData({ ...formData, endTime: newEndTime });
                  }}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  required
                >
                  {timeOptions.map(time => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              checked={formData.isAllDay || false}
              onChange={(e) => setFormData({ ...formData, isAllDay: e.target.checked })}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label className="ml-2 text-sm text-gray-700">終日</label>
          </div>
          
          {/* 繰り返し設定 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">繰り返し</label>
            <div className="space-y-3">
              <div>
                <select
                  value={formData.recurrence?.frequency || 'none'}
                  onChange={(e) => {
                    const frequency = e.target.value;
                    if (frequency === 'none') {
                      setFormData({ ...formData, recurrence: null });
                    } else {
                      setFormData({
                        ...formData,
                        recurrence: {
                          frequency,
                          interval: 1,
                          endType: 'never',
                          endDate: null,
                          count: null,
                          weekdays: []
                        }
                      });
                    }
                  }}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="none">繰り返しなし</option>
                  <option value="daily">毎日</option>
                  <option value="weekly">毎週</option>
                  <option value="monthly">毎月</option>
                  <option value="yearly">毎年</option>
                  <option value="weekdays">平日のみ</option>
                  <option value="custom">カスタム</option>
                </select>
              </div>
              
              {formData.recurrence && formData.recurrence.frequency !== 'none' && formData.recurrence.frequency !== 'weekdays' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600">間隔</label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={formData.recurrence.interval || 1}
                      onChange={(e) => setFormData({
                        ...formData,
                        recurrence: {
                          ...formData.recurrence!,
                          interval: parseInt(e.target.value)
                        }
                      })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs text-gray-600">終了条件</label>
                    <select
                      value={formData.recurrence.endType || 'never'}
                      onChange={(e) => setFormData({
                        ...formData,
                        recurrence: {
                          ...formData.recurrence!,
                          endType: e.target.value as 'never' | 'date' | 'count'
                        }
                      })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    >
                      <option value="never">終了なし</option>
                      <option value="date">終了日</option>
                      <option value="count">回数</option>
                    </select>
                  </div>
                </div>
              )}
              
              {formData.recurrence?.endType === 'date' && (
                <div>
                  <label className="block text-xs text-gray-600">終了日</label>
                  <input
                    type="date"
                    value={formData.recurrence.endDate ? format(new Date(formData.recurrence.endDate), 'yyyy-MM-dd') : ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      recurrence: {
                        ...formData.recurrence!,
                        endDate: new Date(e.target.value)
                      }
                    })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
              )}
              
              {formData.recurrence?.endType === 'count' && (
                <div>
                  <label className="block text-xs text-gray-600">回数</label>
                  <input
                    type="number"
                    min="1"
                    max="999"
                    value={formData.recurrence.count || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      recurrence: {
                        ...formData.recurrence!,
                        count: parseInt(e.target.value)
                      }
                    })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
              )}
              
              {formData.recurrence?.frequency === 'custom' && (
                <div>
                  <label className="block text-xs text-gray-600 mb-2">曜日選択</label>
                  <div className="grid grid-cols-7 gap-1">
                    {['日', '月', '火', '水', '木', '金', '土'].map((day, index) => (
                      <label key={index} className="flex flex-col items-center">
                        <input
                          type="checkbox"
                          checked={formData.recurrence?.weekdays?.includes(index) || false}
                          onChange={(e) => {
                            const weekdays = formData.recurrence?.weekdays || [];
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                recurrence: {
                                  ...formData.recurrence!,
                                  weekdays: [...weekdays, index]
                                }
                              });
                            } else {
                              setFormData({
                                ...formData,
                                recurrence: {
                                  ...formData.recurrence!,
                                  weekdays: weekdays.filter(d => d !== index)
                                }
                              });
                            }
                          }}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-xs text-gray-600 mt-1">{day}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* リマインダー設定 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">リマインダー通知</label>
            <div className="space-y-2">
              <div className="flex items-center space-x-4">
                <select
                  value={formData.reminders?.[0]?.time || 15}
                  onChange={(e) => {
                    const time = parseInt(e.target.value);
                    setFormData({
                      ...formData,
                      reminders: [{ time, methods: formData.reminders?.[0]?.methods || ['email'] }]
                    });
                  }}
                  className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value={5}>5分前</option>
                  <option value={10}>10分前</option>
                  <option value={15}>15分前</option>
                  <option value={30}>30分前</option>
                  <option value={60}>60分前</option>
                </select>
                
                <div className="flex items-center space-x-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.reminders?.[0]?.methods?.includes('email') || false}
                      onChange={(e) => {
                        const methods = formData.reminders?.[0]?.methods || [];
                        const newMethods = e.target.checked 
                          ? [...methods.filter(m => m !== 'email'), 'email']
                          : methods.filter(m => m !== 'email');
                        setFormData({
                          ...formData,
                          reminders: [{ time: formData.reminders?.[0]?.time || 15, methods: newMethods }]
                        });
                      }}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-1 text-sm text-gray-700">メール</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.reminders?.[0]?.methods?.includes('notification') || false}
                      onChange={(e) => {
                        const methods = formData.reminders?.[0]?.methods || [];
                        const newMethods = e.target.checked 
                          ? [...methods.filter(m => m !== 'notification'), 'notification']
                          : methods.filter(m => m !== 'notification');
                        setFormData({
                          ...formData,
                          reminders: [{ time: formData.reminders?.[0]?.time || 15, methods: newMethods }]
                        });
                      }}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-1 text-sm text-gray-700">プッシュ通知</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
          
          {/* 作成者・編集者情報 */}
          {editingSchedule && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">作成・編集履歴</h4>
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                {creatorUser && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">作成者:</span>
                    <span className="text-gray-900">
                      {creatorUser.name} (ID: {creatorUser.employee_id})
                      {editingSchedule.createdAt && (
                        <span className="ml-2 text-gray-500">
                          {format(new Date(editingSchedule.createdAt), 'yyyy/MM/dd HH:mm')}
                        </span>
                      )}
                    </span>
                  </div>
                )}
                {updaterUser && editingSchedule.updatedAt && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">最終編集:</span>
                    <span className="text-gray-900">
                      {updaterUser.name} (ID: {updaterUser.employee_id})
                      <span className="ml-2 text-gray-500">
                        {format(new Date(editingSchedule.updatedAt), 'yyyy/MM/dd HH:mm')}
                      </span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-between items-center pt-4 border-t">
            <div>
              {editingSchedule && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('このスケジュールを削除しますか？')) {
                      // 削除処理をonSubmitの特別なケースとして処理
                      onSubmit({ ...formData, _delete: true });
                      onClose();
                    }
                  }}
                  className="px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  削除
                </button>
              )}
            </div>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                {editingSchedule ? '更新' : '作成'}
              </button>
            </div>
          </div>
        </form>
        
        {/* 重複確認モーダル */}
        {showConflictModal && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <div className="flex items-center mb-4">
                <AlertTriangle className="h-6 w-6 text-yellow-600 mr-2" />
                <h3 className="text-lg font-medium text-gray-900">スケジュールの重複</h3>
              </div>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">以下のスケジュールと重複しています：</p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {conflictingSchedules.map(schedule => {
                    // Handle both camelCase (from state) and snake_case (from database) date formats
                    const startTime = schedule.startTime || schedule.start_time;
                    const endTime = schedule.endTime || schedule.end_time;
                    
                    // Validate dates before formatting
                    const startDate = startTime ? new Date(startTime) : null;
                    const endDate = endTime ? new Date(endTime) : null;
                    
                    if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                      console.error('Invalid date in conflicting schedule:', schedule);
                      return (
                        <div key={schedule.id} className="p-2 bg-red-50 rounded border border-red-200">
                          <div className="font-medium text-red-800">{schedule.title}</div>
                          <div className="text-sm text-red-600">時刻情報が無効です</div>
                        </div>
                      );
                    }
                    
                    return (
                      <div key={schedule.id} className="p-2 bg-red-50 rounded border border-red-200">
                        <div className="font-medium text-red-800">{schedule.title}</div>
                        <div className="text-sm text-red-600">
                          {format(startDate, 'MM/dd HH:mm')} - {format(endDate, 'HH:mm')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowConflictModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleForceSubmit}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
                >
                  重複しても作成
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}