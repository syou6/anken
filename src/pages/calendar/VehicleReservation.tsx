import { useState, useEffect } from 'react';
import { format, addDays, startOfWeek, startOfMonth, endOfMonth, isToday, isSameMonth, eachDayOfInterval } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Car } from 'lucide-react';
import { useCalendar } from '../../contexts/CalendarContext';
import { mockVehicles } from '../../data/mockData';
import { Vehicle } from '../../types';
import { supabase } from '../../lib/supabase';
import ReservationModal from '../../components/ReservationModal';

export default function VehicleReservation() {
  const { 
    currentDate, 
    view, 
    setView, 
    goToNextPeriod, 
    goToPreviousPeriod, 
    goToToday,
    getSchedulesForEquipment,
    addSchedule,
    refreshSchedules
  } = useCalendar();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<{ id: string; type: 'vehicle' } | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  // Load vehicles and users from Supabase
  useEffect(() => {
    fetchVehicles();
    fetchUsers();
  }, []);

  const fetchVehicles = async () => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .order('name');
      
      if (error) {
        console.error('Error fetching vehicles:', error);
        setVehicles(mockVehicles);
      } else {
        const convertedVehicles = data?.map(v => ({
          id: v.id,
          name: v.name,
          licensePlate: v.license_plate,
          type: v.type,
          createdBy: v.created_by
        })) || [];
        setVehicles(convertedVehicles);
      }
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      setVehicles(mockVehicles);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, employee_id')
        .order('name');
      
      if (error) {
        console.error('Error fetching users:', error);
      } else {
        setUsers(data || []);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
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

  const dates = getDatesForView();

  const [vehicleSchedules, setVehicleSchedules] = useState<any[]>([]);
  
  // Load vehicle schedules
  useEffect(() => {
    fetchVehicleSchedules();
  }, [currentDate, view]);
  
  const fetchVehicleSchedules = async () => {
    try {
      if (dates.length === 0) return;
      
      const startDateStr = format(dates[0], 'yyyy-MM-dd');
      const endDateStr = format(dates[dates.length - 1], 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .gte('start_time', `${startDateStr}T00:00:00.000Z`)
        .lte('start_time', `${endDateStr}T23:59:59.999Z`)
        .order('start_time');
        
      if (error) {
        console.error('Error fetching vehicle schedules:', error);
      } else {
        setVehicleSchedules(data || []);
      }
    } catch (error) {
      console.error('Error fetching vehicle schedules:', error);
    }
  };
  
  const getVehicleSchedulesForDay = (vehicleId: string, date: Date) => {
    return vehicleSchedules
      .filter(schedule => {
        const scheduleDate = new Date(schedule.start_time);
        return scheduleDate.toDateString() === date.toDateString() &&
               schedule.equipment?.some((eq: any) => eq.id === vehicleId && eq.type === 'vehicle');
      })
      .map(schedule => ({
        ...schedule,
        startTime: new Date(schedule.start_time),
        endTime: new Date(schedule.end_time)
      }));
  };

  // 参加者名を取得する関数
  const getParticipantNames = (participantIds: string[]) => {
    if (!participantIds || participantIds.length === 0) return '';
    
    const names = participantIds
      .map(id => users.find(user => user.id === id)?.name)
      .filter(Boolean)
      .join(', ');
    
    return names;
  };

  const handleCellClick = (vehicle: { id: string }, date: Date) => {
    setSelectedVehicle({ id: vehicle.id, type: 'vehicle' });
    setSelectedDate(date);
    setIsModalOpen(true);
  };

  const handleReservationSubmit = async (scheduleData: any) => {
    try {
      // Save schedule to Supabase
      const { error } = await supabase
        .from('schedules')
        .insert([{
          type: scheduleData.type,
          title: scheduleData.title,
          details: scheduleData.details,
          start_time: scheduleData.startTime?.toISOString(),
          end_time: scheduleData.endTime?.toISOString(),
          is_all_day: scheduleData.isAllDay,
          participants: scheduleData.participants,
          equipment: scheduleData.equipment,
          reminders: scheduleData.reminders,
          meet_link: scheduleData.meetLink,
          meeting_type: scheduleData.meetingType,
          created_by: scheduleData.createdBy
        }]);
        
      if (error) throw error;
      
      // Refresh the schedules to show new data
      await refreshSchedules();
      await fetchVehicleSchedules();
    } catch (error) {
      console.error('Error saving vehicle reservation:', error);
      alert('車両予約の保存に失敗しました');
    }
  };

  // Render calendar content based on view
  const renderCalendarContent = () => {
    if (view === 'month') {
      return renderMonthView();
    } else {
      return renderTableView();
    }
  };

  const renderTableView = () => {
    return (
      <div className="overflow-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                車両
              </th>
              {dates.map((date, i) => (
                <th key={i} scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex flex-col items-center">
                    <span>{format(date, view === 'day' ? 'yyyy年M月d日 EEEE' : 'EEEE', { locale: ja })}</span>
                    {view !== 'day' && (
                      <span className={`mt-1 text-sm ${isToday(date) ? 'bg-blue-100 text-blue-800 rounded-full w-7 h-7 flex items-center justify-center' : ''}`}>
                        {format(date, 'd')}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {vehicles.map((vehicle) => (
              <tr key={vehicle.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                      <Car className="h-6 w-6 text-amber-600" />
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{vehicle.name}</div>
                      <div className="text-xs text-gray-500">{vehicle.licensePlate}</div>
                    </div>
                  </div>
                </td>
                {dates.map((date, i) => {
                  const schedules = getVehicleSchedulesForDay(vehicle.id, date);
                  return (
                    <td key={i} className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 relative group border border-gray-100">
                      <button
                        onClick={() => handleCellClick(vehicle, date)}
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-amber-100 rounded-full p-1"
                      >
                        <Plus className="h-4 w-4 text-amber-600" />
                      </button>
                      <div className={view === 'day' ? 'min-h-[120px]' : 'min-h-[80px]'}>
                        {schedules.map(schedule => (
                          <div 
                            key={schedule.id} 
                            className="mb-1 px-2 py-1 rounded text-xs bg-amber-100 text-amber-800 border-l-4 border-amber-500 cursor-pointer hover:bg-amber-200"
                            onClick={() => {
                              // TODO: Open schedule edit modal
                            }}
                          >
                            <div className="font-medium">{format(schedule.startTime, 'HH:mm')}-{format(schedule.endTime, 'HH:mm')}</div>
                            <div className="truncate">{schedule.title}</div>
                            <div className="text-xs text-amber-600">
                              {getParticipantNames(schedule.participants || [])}
                            </div>
                            {schedule.details && (
                              <div className="text-xs text-amber-500 truncate">{schedule.details}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderMonthView = () => {
    const weeks = [];
    for (let i = 0; i < dates.length; i += 7) {
      weeks.push(dates.slice(i, i + 7));
    }

    return (
      <div className="overflow-auto">
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
              const daySchedules = vehicles.flatMap(vehicle => 
                getVehicleSchedulesForDay(vehicle.id, date)
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
                      const vehicle = vehicles.find(v => 
                        schedule.equipment?.some((eq: any) => eq.id === v.id && eq.type === 'vehicle')
                      );
                      return (
                        <div 
                          key={schedule.id}
                          onClick={() => {
                            // TODO: Open schedule edit modal
                          }}
                          className="text-xs px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-80 bg-amber-100 text-amber-800"
                          title={`${vehicle?.name}: ${schedule.title} [${getParticipantNames(schedule.participants || [])}]`}
                        >
                          <div className="flex items-center space-x-1">
                            <Car className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{schedule.title}</span>
                          </div>
                          <div className="text-xs text-amber-600 truncate mt-1">
                            {getParticipantNames(schedule.participants || [])}
                          </div>
                        </div>
                      );
                    })}
                    {daySchedules.length > 3 && (
                      <div className="text-xs text-gray-500">
                        +{daySchedules.length - 3}件
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

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold text-gray-900">車両予約</h1>
        <button
          onClick={() => {
            setSelectedVehicle(null);
            setSelectedDate(null);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
        >
          <Plus className="h-5 w-5 mr-1" />
          予約作成
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

        {renderCalendarContent()}
      </div>

      <ReservationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleReservationSubmit}
        selectedDate={selectedDate || undefined}
        selectedEquipment={selectedVehicle || undefined}
        type="vehicle"
      />
    </div>
  );
}