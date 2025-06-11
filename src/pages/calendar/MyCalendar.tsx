import { useState, useEffect } from 'react';
import { format, addDays, startOfWeek, startOfMonth, endOfMonth, getDay, isToday, isSameMonth, eachDayOfInterval } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus, Video, AlertTriangle, Link as LinkIcon } from 'lucide-react';
import { useCalendar } from '../../contexts/CalendarContext';
import { useAuth } from '../../contexts/AuthContext';
import { mockUsers } from '../../data/mockData';
import { Schedule, User } from '../../types';
import { supabase } from '../../lib/supabase';
import ReservationModal from '../../components/ReservationModal';
import { getMeetingTypeDisplay, getMeetingTypeStyles } from '../../utils/googleMeet';

export default function MyCalendar() {
  const { currentUser } = useAuth();
  const { 
    currentDate, 
    view, 
    visibleUsers,
    setView, 
    goToNextPeriod, 
    goToPreviousPeriod, 
    goToToday,
    toggleUserVisibility,
    getSchedulesForDateRange,
    addSchedule,
    updateSchedule,
    refreshSchedules
  } = useCalendar();

  const [selectedUsers, setSelectedUsers] = useState<string[]>(
    visibleUsers.length > 0 ? visibleUsers : []
  );
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedParticipant, setSelectedParticipant] = useState<string | null>(null);

  // Load users from Supabase
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('name_kana');  // あいうえお順でソート
      
      if (error) {
        console.error('Error fetching users:', error);
        // mockUsersもあいうえお順でソート
        const sortedMockUsers = [...mockUsers].sort((a, b) => 
          (a.nameKana || a.name).localeCompare(b.nameKana || b.name, 'ja', { sensitivity: 'base', numeric: true })
        );
        setUsers(sortedMockUsers);
      } else {
        const convertedUsers: User[] = data?.map(u => ({
          id: u.id,
          employeeId: u.employee_id,
          name: u.name,
          nameKana: u.name_kana,
          email: u.email,
          phone: u.phone,
          department: u.department,
          role: u.role,
          defaultWorkDays: u.default_work_days || []
        })) || [];
        
        // フロントエンドでも念のためあいうえお順でソート
        const sortedUsers = convertedUsers.sort((a, b) => 
          (a.nameKana || a.name).localeCompare(b.nameKana || b.name, 'ja')
        );
        setUsers(sortedUsers);
        
        // 初回読み込み時、保存されていない場合は全ユーザーを選択
        if (visibleUsers.length === 0) {
          const allUserIds = convertedUsers.map(u => u.id);
          setSelectedUsers(allUserIds);
          // 全ユーザーをvisibleUsersに設定
          allUserIds.forEach(id => toggleUserVisibility(id));
        }
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers(mockUsers);
    } finally {
      setLoading(false);
    }
  };

  // Get dates based on view
  const getDatesForView = () => {
    switch (view) {
      case 'day':
        return [currentDate];
      case 'week':
        const startDate = startOfWeek(currentDate, { weekStartsOn: 1 });
        return Array.from({ length: 7 }, (_, i) => addDays(startDate, i));
      case 'month':
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        const startDateMonth = startOfWeek(monthStart, { weekStartsOn: 1 });
        const endDateMonth = addDays(startOfWeek(addDays(monthEnd, 6), { weekStartsOn: 1 }), 6);
        return eachDayOfInterval({ start: startDateMonth, end: endDateMonth });
      default:
        return [];
    }
  };

  const days = getDatesForView();
  
  // Get schedules for the current period
  const schedules = days.length > 0 ? getSchedulesForDateRange(
    days[0],
    addDays(days[days.length - 1], 1)
  ) : [];

  const toggleUser = (userId: string) => {
    setSelectedUsers(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
    toggleUserVisibility(userId);
  };

  const toggleAllUsers = () => {
    if (selectedUsers.length === users.length) {
      setSelectedUsers([]);
      // すべてのユーザーを非表示
      users.forEach(user => {
        if (visibleUsers.includes(user.id)) {
          toggleUserVisibility(user.id);
        }
      });
    } else {
      const allUserIds = users.map(user => user.id);
      setSelectedUsers(allUserIds);
      // すべてのユーザーを表示
      allUserIds.forEach(id => {
        if (!visibleUsers.includes(id)) {
          toggleUserVisibility(id);
        }
      });
    }
  };

  // Handle cell click to create new schedule with pre-filled date and participant
  const handleCellClick = (date: Date, userId?: string) => {
    setSelectedDate(date);
    setSelectedParticipant(userId || null);
    setEditingSchedule(null);
    setIsModalOpen(true);
  };

  const getUserSchedulesForDay = (userId: string, date: Date) => {
    return schedules.filter(schedule => 
      (schedule.participants.includes(userId) || schedule.createdBy === userId) &&
      new Date(schedule.startTime).toDateString() === date.toDateString()
    );
  };

  // 重複スケジュールをチェックする関数
  const hasConflictingSchedules = (schedule: Schedule, allSchedules: Schedule[]) => {
    const scheduleStart = new Date(schedule.startTime);
    const scheduleEnd = new Date(schedule.endTime);
    
    return allSchedules.some(otherSchedule => {
      if (otherSchedule.id === schedule.id) return false;
      
      const otherStart = new Date(otherSchedule.startTime);
      const otherEnd = new Date(otherSchedule.endTime);
      
      // 参加者が重複しているかチェック
      const hasCommonParticipants = schedule.participants.some(participant =>
        otherSchedule.participants.includes(participant)
      );
      
      if (!hasCommonParticipants) return false;
      
      // 時間が重複しているかチェック
      return (scheduleStart < otherEnd && scheduleEnd > otherStart);
    });
  };

  // Render calendar based on view
  const renderCalendarContent = () => {
    if (view === 'month') {
      return renderMonthView();
    } else {
      return renderWeekDayView();
    }
  };

  const renderMonthView = () => {
    const weeks = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }

    return (
      <div className="bg-white">
        {/* Month header */}
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {['月', '火', '水', '木', '金', '土', '日'].map((day, i) => (
            <div key={i} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
              {day}
            </div>
          ))}
        </div>
        
        {/* Month body */}
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 border-b border-gray-200">
            {week.map((date, dayIndex) => {
              const isCurrentMonth = isSameMonth(date, currentDate);
              const daySchedules = selectedUsers.flatMap(userId => 
                getUserSchedulesForDay(userId, date)
              );
              
              return (
                <div 
                  key={dayIndex} 
                  className={`min-h-[120px] p-2 border-r border-gray-200 ${
                    !isCurrentMonth ? 'bg-gray-50 text-gray-400' : 'bg-white'
                  }`}
                >
                  <div className={`text-sm font-medium mb-1 ${
                    isToday(date) ? 'bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center' : ''
                  }`}>
                    {format(date, 'd')}
                  </div>
                  <div className="space-y-1">
                    {daySchedules.slice(0, 3).map(schedule => {
                      const user = users.find(u => 
                        schedule.participants.includes(u.id) || schedule.createdBy === u.id
                      );
                      const hasConflict = hasConflictingSchedules(schedule, schedules);
                      return (
                        <div 
                          key={schedule.id}
                          onClick={() => {
                            setEditingSchedule(schedule);
                            setIsModalOpen(true);
                          }}
                          className={`text-xs px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-80
                            ${schedule.type === '会議' ? 'bg-blue-100 text-blue-800' : 
                              schedule.type === 'オンライン商談' ? 'bg-purple-100 text-purple-800' : 
                              schedule.type === '来訪' ? 'bg-amber-100 text-amber-800' : 
                              schedule.type === '工事' ? 'bg-emerald-100 text-emerald-800' : 
                              schedule.type === '外出' ? 'bg-yellow-100 text-yellow-800' : 
                              schedule.type === 'サンプル作成' ? 'bg-purple-100 text-purple-800' : 
                              schedule.type === 'CAD・マーキング' ? 'bg-purple-100 text-purple-800' : 
                              schedule.type === 'サンプル裁断' ? 'bg-purple-100 text-purple-800' : 
                              schedule.type === 'サンプル縫製' ? 'bg-purple-100 text-purple-800' : 
                              schedule.type === 'サンプル内職' ? 'bg-purple-100 text-purple-800' : 
                              schedule.type === 'プレス' ? 'bg-purple-100 text-purple-800' : 
                              schedule.type === '仕上げ・梱包' ? 'bg-purple-100 text-purple-800' : 
                              'bg-gray-100 text-gray-800'}`}
                          title={`${user?.name}: ${schedule.title}${schedule.equipment?.length > 0 ? ` [${schedule.equipment.map(eq => eq.name).join(', ')}]` : ''}${schedule.meetLink ? ' (Google Meet)' : ''}${hasConflict ? ' ⚠️ 重複あり' : ''}`}
                        >
                          <div className="flex items-center space-x-1">
                            {hasConflict && (
                              <AlertTriangle className="h-3 w-3 flex-shrink-0 text-red-600" />
                            )}
                            {schedule.meetLink && (
                              <Video className="h-3 w-3 flex-shrink-0" />
                            )}
                            <span className="truncate">
                              {schedule.title}
                              {schedule.equipment?.length > 0 && (
                                <span className="text-xs opacity-75 ml-1">
                                  [{schedule.equipment.map(eq => eq.name).join(', ')}]
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {daySchedules.length > 3 && (
                      <div className="text-xs text-gray-500">
                        +{daySchedules.length - 3}件
                      </div>
                    )}
                    {daySchedules.length >= 10 && (
                      <div className="text-xs text-red-600 font-medium">
                        <AlertTriangle className="h-3 w-3 inline mr-1" />
                        上限達成
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  const renderWeekDayView = () => {
    return (
      <div className="bg-white">
        {/* Week/Day header */}
        <div className={`grid ${view === 'day' ? 'grid-cols-1' : 'grid-cols-7'} border-b border-gray-200 bg-gray-50`}>
          {days.map((date, i) => (
            <div key={i} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div className="flex flex-col items-center">
                <span>{format(date, view === 'day' ? 'yyyy年M月d日 EEEE' : 'EEEE', { locale: ja })}</span>
                {view !== 'day' && (
                  <span className={`mt-1 text-sm ${isToday(date) ? 'bg-blue-100 text-blue-800 rounded-full w-7 h-7 flex items-center justify-center' : ''}`}>
                    {format(date, 'd')}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Week/Day body */}
        <div className="divide-y divide-gray-200">
          {selectedUsers.map(userId => {
            const user = users.find(u => u.id === userId);
            if (!user) return null;
            return (
              <div key={userId} className="divide-y divide-gray-200">
                <div className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {user.name}
                </div>
                <div className={`grid ${view === 'day' ? 'grid-cols-1' : 'grid-cols-7'} divide-x divide-gray-200`}>
                  {days.map((date, i) => {
                    const userSchedules = getUserSchedulesForDay(userId, date);
                    return (
                      <div key={i} className="min-h-[100px] px-2 py-2 text-sm text-gray-900 relative group">
                        <button
                          onClick={() => handleCellClick(date, userId)}
                          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-blue-100 rounded-full p-1 hover:bg-blue-200"
                        >
                          <Plus className="h-4 w-4 text-blue-600" />
                        </button>
                        {userSchedules.map(schedule => {
                          const hasConflict = hasConflictingSchedules(schedule, schedules);
                          return (
                            <div 
                              key={schedule.id}
                              onClick={() => {
                                setEditingSchedule(schedule);
                                setIsModalOpen(true);
                              }}
                              className={`mb-1 px-2 py-1 rounded text-xs cursor-pointer hover:opacity-80
                                ${schedule.type === '会議' ? 'bg-blue-100 text-blue-800' : 
                                  schedule.type === 'オンライン商談' ? 'bg-purple-100 text-purple-800' : 
                                  schedule.type === '来訪' ? 'bg-amber-100 text-amber-800' : 
                                  schedule.type === '工事' ? 'bg-emerald-100 text-emerald-800' : 
                                  schedule.type === '外出' ? 'bg-yellow-100 text-yellow-800' : 
                                  schedule.type === 'サンプル作成' ? 'bg-purple-100 text-purple-800' : 
                                  schedule.type === 'CAD・マーキング' ? 'bg-purple-100 text-purple-800' : 
                                  schedule.type === 'サンプル裁断' ? 'bg-purple-100 text-purple-800' : 
                                  schedule.type === 'サンプル縫製' ? 'bg-purple-100 text-purple-800' : 
                                  schedule.type === 'サンプル内職' ? 'bg-purple-100 text-purple-800' : 
                                  schedule.type === 'プレス' ? 'bg-purple-100 text-purple-800' : 
                                  schedule.type === '仕上げ・梱包' ? 'bg-purple-100 text-purple-800' : 
                                  'bg-gray-100 text-gray-800'}`}
                            >
                              <div className="font-medium flex items-center justify-between">
                                <div className="flex items-center space-x-1">
                                  {hasConflict && (
                                    <AlertTriangle className="h-3 w-3 flex-shrink-0 text-red-600" />
                                  )}
                                  <span>{format(schedule.startTime, 'HH:mm')}-{format(schedule.endTime, 'HH:mm')}</span>
                                </div>
                                {schedule.meetLink && (
                                  <div className="flex items-center space-x-1">
                                    <Video className="h-3 w-3" />
                                    {schedule.meetingType && (
                                      <span className={`px-1 py-0.5 rounded text-xs ${getMeetingTypeStyles(schedule.meetingType)}`}>
                                        {getMeetingTypeDisplay(schedule.meetingType)}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="truncate">
                                  {schedule.title}
                                  {schedule.equipment?.length > 0 && (
                                    <span className="text-xs opacity-75 ml-1">
                                      [{schedule.equipment.map(eq => eq.name).join(', ')}]
                                    </span>
                                  )}
                                </span>
                                {schedule.meetLink && (
                                  <a 
                                    href={schedule.meetLink} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="ml-1 text-blue-600 hover:text-blue-800"
                                    title="Google Meetに参加"
                                  >
                                    <LinkIcon className="h-3 w-3" />
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold text-gray-900">マイカレンダー</h1>
        <button
          onClick={() => {
            setEditingSchedule(null);
            setSelectedDate(null);
            setSelectedParticipant(null);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Plus className="h-5 w-5 mr-1" />
          予定作成
        </button>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
          <div className="flex items-center justify-between flex-wrap sm:flex-nowrap">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                {format(currentDate, 'yyyy年M月', { locale: ja })}
              </h3>
            </div>
            <div className="flex items-center space-x-3">
              <div className="inline-flex shadow-sm rounded-md">
                <button
                  type="button"
                  onClick={() => setView('day')}
                  className={`relative inline-flex items-center px-4 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium ${
                    view === 'day' ? 'text-blue-600 z-10 bg-blue-50' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  日
                </button>
                <button
                  type="button"
                  onClick={() => setView('week')}
                  className={`relative inline-flex items-center px-4 py-2 border-t border-b border-gray-300 bg-white text-sm font-medium ${
                    view === 'week' ? 'text-blue-600 z-10 bg-blue-50' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  週
                </button>
                <button
                  type="button"
                  onClick={() => setView('month')}
                  className={`relative inline-flex items-center px-4 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium ${
                    view === 'month' ? 'text-blue-600 z-10 bg-blue-50' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  月
                </button>
              </div>
              <div className="inline-flex rounded-md shadow-sm">
                <button
                  type="button"
                  onClick={goToPreviousPeriod}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                >
                  <span className="sr-only">前へ</span>
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={goToToday}
                  className="relative inline-flex items-center px-4 py-2 border-t border-b border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  今日
                </button>
                <button
                  type="button"
                  onClick={goToNextPeriod}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                >
                  <span className="sr-only">次へ</span>
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-1">
          {/* Left sidebar - User selection */}
          <div className="w-60 border-r border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center mb-3">
              <input
                id="select-all"
                name="select-all"
                type="checkbox"
                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                checked={selectedUsers.length === users.length && users.length > 0}
                onChange={toggleAllUsers}
              />
              <label htmlFor="select-all" className="ml-2 block text-sm text-gray-900 font-semibold">
                全員を表示
              </label>
            </div>
            <div className="space-y-2 max-h-[calc(100vh-250px)] overflow-auto">
              {loading ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                </div>
              ) : (
                // Sort users: selected users first, then unselected users, both groups sorted by Japanese alphabetical order
                [...users]
                  .sort((a, b) => {
                    const aSelected = selectedUsers.includes(a.id);
                    const bSelected = selectedUsers.includes(b.id);
                    
                    // If one is selected and other is not, selected comes first
                    if (aSelected && !bSelected) return -1;
                    if (!aSelected && bSelected) return 1;
                    
                    // If both have same selection status, sort by name in Japanese alphabetical order
                    const aName = a.nameKana || a.name;
                    const bName = b.nameKana || b.name;
                    return aName.localeCompare(bName, 'ja', { sensitivity: 'base', numeric: true });
                  })
                  .map(user => (
                    <div key={user.id} className="flex items-center">
                      <input
                        id={`user-${user.id}`}
                        name={`user-${user.id}`}
                        type="checkbox"
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                        checked={selectedUsers.includes(user.id)}
                        onChange={() => toggleUser(user.id)}
                      />
                      <label htmlFor={`user-${user.id}`} className="ml-2 block text-sm text-gray-700">
                        {user.name}
                        <span className="ml-1 text-xs text-gray-500">({user.department})</span>
                      </label>
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* Main calendar content */}
          <div className="flex-1 overflow-auto">
            {renderCalendarContent()}
          </div>
        </div>
      </div>
      
      {/* Schedule Creation Modal */}
      <ReservationModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingSchedule(null);
          setSelectedDate(null);
          setSelectedParticipant(null);
        }}
        onSubmit={async (scheduleData) => {
          try {
            console.log('MyCalendar onSubmit called with:', scheduleData);
            console.log('Current user:', currentUser);
            console.log('Editing schedule:', editingSchedule);
            
            // 削除処理
            if (scheduleData._delete && editingSchedule) {
              try {
                const { error } = await supabase
                  .from('schedules')
                  .delete()
                  .eq('id', editingSchedule.id);
                
                if (error) throw error;
                
                // 成功時はCalendarContextのrefreshSchedulesを使用してデータを更新
                await refreshSchedules();
                return;
              } catch (error) {
                console.error('Error deleting schedule:', error);
                alert('スケジュールの削除に失敗しました');
                return;
              }
            }
            
            if (editingSchedule) {
              // Update existing schedule using CalendarContext
              const updatedSchedule = {
                ...editingSchedule,
                ...scheduleData,
                id: editingSchedule.id,
                createdAt: editingSchedule.createdAt,
                createdBy: editingSchedule.createdBy,
                updatedBy: currentUser?.id,
                updatedAt: new Date()
              };
              console.log('Updating schedule:', updatedSchedule);
              updateSchedule(updatedSchedule);
            } else {
              // Create new schedule using CalendarContext
              const scheduleToCreate = {
                ...scheduleData,
                createdBy: currentUser?.id
              };
              console.log('Creating schedule:', scheduleToCreate);
              
              const success = await addSchedule(scheduleToCreate);
              console.log('addSchedule result:', success);
              
              if (!success) {
                console.error('addSchedule returned false');
                return; // addSchedule already shows error messages
              }
            }
          } catch (error) {
            console.error('Error saving schedule - Full error object:', error);
            console.error('Error message:', error?.message);
            console.error('Error stack:', error?.stack);
            alert(`スケジュールの保存に失敗しました: ${error?.message || 'Unknown error'}`);
          }
        }}
        selectedDate={selectedDate}
        selectedParticipant={selectedParticipant}
        type="general"
        editingSchedule={editingSchedule}
      />
    </div>
  );
}