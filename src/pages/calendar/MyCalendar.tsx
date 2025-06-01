import { useState } from 'react';
import { format, addDays, startOfWeek, getDay, isToday } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus } from 'lucide-react';
import { useCalendar } from '../../contexts/CalendarContext';
import { mockUsers } from '../../data/mockData';
import { Schedule, User } from '../../types';

export default function MyCalendar() {
  const { 
    currentDate, 
    view, 
    visibleUsers,
    setView, 
    goToNextPeriod, 
    goToPreviousPeriod, 
    goToToday,
    toggleUserVisibility,
    getSchedulesForDateRange
  } = useCalendar();

  const [selectedUsers, setSelectedUsers] = useState<string[]>(
    visibleUsers.length > 0 ? visibleUsers : mockUsers.map(user => user.id)
  );

  // Get start of week (Monday) for the current week
  const startDate = startOfWeek(currentDate, { weekStartsOn: 1 });
  
  // Create array of dates for the week
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startDate, i));
  
  // Get schedules for the current week
  const weekSchedules = getSchedulesForDateRange(
    weekDays[0],
    addDays(weekDays[6], 1)
  );

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
    if (selectedUsers.length === mockUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(mockUsers.map(user => user.id));
    }
  };

  const getUserSchedulesForDay = (userId: string, date: Date) => {
    return weekSchedules.filter(schedule => 
      (schedule.participants.includes(userId) || schedule.createdBy === userId) &&
      new Date(schedule.startTime).toDateString() === date.toDateString()
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold text-gray-900">マイカレンダー</h1>
        <button
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
                checked={selectedUsers.length === mockUsers.length}
                onChange={toggleAllUsers}
              />
              <label htmlFor="select-all" className="ml-2 block text-sm text-gray-900 font-semibold">
                全員を表示
              </label>
            </div>
            <div className="space-y-2 max-h-[calc(100vh-250px)] overflow-auto">
              {mockUsers.map(user => (
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
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Main calendar content */}
          <div className="flex-1 overflow-auto">
            <div className="min-w-full divide-y divide-gray-200">
              {/* Calendar header */}
              <div className="bg-gray-50">
                <div className="grid grid-cols-7 border-b border-gray-200">
                  {weekDays.map((date, i) => (
                    <div key={i} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex flex-col items-center">
                        <span>{format(date, 'EEEE', { locale: ja })}</span>
                        <span className={`mt-1 text-sm ${isToday(date) ? 'bg-blue-100 text-blue-800 rounded-full w-7 h-7 flex items-center justify-center' : ''}`}>
                          {format(date, 'd')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Calendar body */}
              <div className="bg-white divide-y divide-gray-200">
                {selectedUsers.map(userId => {
                  const user = mockUsers.find(u => u.id === userId);
                  return (
                    <div key={userId} className="divide-y divide-gray-200">
                      <div className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {user?.name}
                      </div>
                      <div className="grid grid-cols-7 divide-x divide-gray-200">
                        {weekDays.map((date, i) => {
                          const schedules = getUserSchedulesForDay(userId, date);
                          return (
                            <div key={i} className="min-h-[100px] px-2 py-2 text-sm text-gray-900">
                              {schedules.map(schedule => (
                                <div 
                                  key={schedule.id} 
                                  className={`mb-1 px-2 py-1 rounded text-xs truncate 
                                    ${schedule.type === '会議' ? 'bg-blue-100 text-blue-800' : 
                                      schedule.type === 'オンライン商談' ? 'bg-purple-100 text-purple-800' : 
                                      schedule.type === '来訪' ? 'bg-amber-100 text-amber-800' : 
                                      schedule.type === '工事' ? 'bg-emerald-100 text-emerald-800' : 
                                      'bg-gray-100 text-gray-800'}`}
                                >
                                  <div className="font-medium">{format(schedule.startTime, 'HH:mm')}-{format(schedule.endTime, 'HH:mm')}</div>
                                  <div>{schedule.title}</div>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}