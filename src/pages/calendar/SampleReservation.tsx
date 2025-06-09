import { useState, useEffect } from 'react';
import { format, addDays, startOfWeek, startOfMonth, endOfMonth, isToday, isSameMonth, eachDayOfInterval } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Box, ArrowDownUp, X, ArrowUp, ArrowDown, FileSpreadsheet } from 'lucide-react';
import { useCalendar } from '../../contexts/CalendarContext';
import { mockSampleEquipment } from '../../data/mockData';
import { SampleEquipment } from '../../types';
import { supabase } from '../../lib/supabase';
import ReservationModal from '../../components/ReservationModal';
import * as XLSX from 'xlsx';

export default function SampleReservation() {
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
  const [selectedEquipment, setSelectedEquipment] = useState<{ id: string; type: 'sample' } | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [sampleEquipment, setSampleEquipment] = useState<SampleEquipment[]>([]);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [selectedDateForOrder, setSelectedDateForOrder] = useState<Date | null>(null);
  const [selectedEquipmentForOrder, setSelectedEquipmentForOrder] = useState<string | null>(null);

  // Load sample equipment from Supabase or fallback to mockSampleEquipment
  useEffect(() => {
    fetchSampleEquipment();
  }, []);

  const fetchSampleEquipment = async () => {
    try {
      const { data, error } = await supabase
        .from('sample_equipment')
        .select('*')
        .order('name');
      
      if (error) {
        console.error('Error fetching sample equipment:', error);
        setSampleEquipment(mockSampleEquipment);
      } else {
        setSampleEquipment(data || []);
      }
    } catch (error) {
      console.error('Error fetching sample equipment:', error);
      setSampleEquipment(mockSampleEquipment);
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

  const [sampleSchedules, setSampleSchedules] = useState<any[]>([]);
  
  // Load sample schedules
  useEffect(() => {
    fetchSampleSchedules();
  }, [currentDate, view]);
  
  const fetchSampleSchedules = async () => {
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
        console.error('Error fetching sample schedules:', error);
      } else {
        setSampleSchedules(data || []);
      }
    } catch (error) {
      console.error('Error fetching sample schedules:', error);
    }
  };
  
  const getSampleSchedulesForDay = (equipmentId: string, date: Date) => {
    return sampleSchedules
      .filter(schedule => {
        const scheduleDate = new Date(schedule.start_time);
        return scheduleDate.toDateString() === date.toDateString() &&
               schedule.equipment?.some((eq: any) => eq.id === equipmentId && eq.type === 'sample');
      })
      .map(schedule => ({
        ...schedule,
        startTime: new Date(schedule.start_time),
        endTime: new Date(schedule.end_time)
      }));
  };

  const handleCellClick = (equipment: { id: string }, date: Date) => {
    setSelectedEquipment({ id: equipment.id, type: 'sample' });
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
          created_by: scheduleData.createdBy,
          quantity: scheduleData.quantity,
          assigned_to: scheduleData.assignedTo,
          notes: scheduleData.notes
        }]);
        
      if (error) throw error;
      
      // Refresh the schedules to show new data
      await refreshSchedules();
      await fetchSampleSchedules();
    } catch (error) {
      console.error('Error saving sample reservation:', error);
      alert('サンプル予約の保存に失敗しました');
    }
  };

  // Sort orders modal component
  const SortOrderModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    const [orders, setOrders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Load orders for the selected date and equipment
    useEffect(() => {
      if (isOpen && selectedDateForOrder && selectedEquipmentForOrder) {
        loadOrders();
      }
    }, [isOpen, selectedDateForOrder, selectedEquipmentForOrder]);

    const loadOrders = async () => {
      if (!selectedDateForOrder || !selectedEquipmentForOrder) return;
      
      setIsLoading(true);
      try {
        const startDate = format(selectedDateForOrder, 'yyyy-MM-dd');
        const { data, error } = await supabase
          .from('schedules')
          .select('*')
          .gte('start_time', `${startDate}T00:00:00.000Z`)
          .lte('start_time', `${startDate}T23:59:59.999Z`)
          .order('start_time');
          
        if (error) throw error;
        
        // Filter for sample schedules with the selected equipment
        const filteredOrders = (data || []).filter(schedule => 
          schedule.equipment?.some((eq: any) => eq.id === selectedEquipmentForOrder && eq.type === 'sample')
        );
        
        setOrders(filteredOrders.map((order, index) => ({ ...order, order: index + 1 })));
      } catch (error) {
        console.error('Error loading orders:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const moveOrder = (index: number, direction: 'up' | 'down') => {
      const newOrders = [...orders];
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      
      if (newIndex < 0 || newIndex >= newOrders.length) return;
      
      [newOrders[index], newOrders[newIndex]] = [newOrders[newIndex], newOrders[index]];
      newOrders[index].order = index + 1;
      newOrders[newIndex].order = newIndex + 1;
      
      setOrders(newOrders);
    };

    const saveOrder = async () => {
      try {
        setIsLoading(true);
        
        // Update each order with new sequence
        const updatePromises = orders.map((order, index) =>
          supabase
            .from('schedules')
            .update({ order: index + 1 })
            .eq('id', order.id)
        );
        
        await Promise.all(updatePromises);
        alert('順序を更新しました');
        onClose();
      } catch (error) {
        console.error('Error saving order:', error);
        alert('順序の更新に失敗しました');
      } finally {
        setIsLoading(false);
      }
    };

    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">作業順序調整</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
              <X className="h-6 w-6" />
            </button>
          </div>
          
          {isLoading ? (
            <div className="text-center py-4">読み込み中...</div>
          ) : (
            <>
              <div className="space-y-2 mb-4">
                {orders.map((order, index) => (
                  <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">{order.order}. {order.title}</div>
                      <div className="text-sm text-gray-500">{order.details}</div>
                    </div>
                    <div className="flex flex-col space-y-1">
                      <button
                        onClick={() => moveOrder(index, 'up')}
                        disabled={index === 0}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => moveOrder(index, 'down')}
                        disabled={index === orders.length - 1}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={saveOrder}
                  disabled={isLoading}
                  className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
                >
                  保存
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  // Export to Excel function
  const exportToExcel = () => {
    try {
      // Prepare data for export
      const exportData: any[] = [];
      
      dates.forEach(date => {
        sampleEquipment.forEach(equipment => {
          const schedules = getSampleSchedulesForDay(equipment.id, date);
          schedules.forEach((schedule, index) => {
            exportData.push({
              '日付': format(date, 'yyyy/MM/dd', { locale: ja }),
              '曜日': format(date, 'EEEE', { locale: ja }),
              '設備': equipment.name,
              '種別': equipment.type,
              '順序': index + 1,
              '作業内容': schedule.title,
              '詳細': schedule.details,
              '開始時間': format(schedule.startTime, 'HH:mm'),
              '終了時間': format(schedule.endTime, 'HH:mm'),
              '枚数': schedule.quantity || '',
              '担当者': schedule.assigned_to || '',
              '備考': schedule.notes || ''
            });
          });
        });
      });

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      
      // Auto-size columns
      const colWidths = [
        { wch: 12 }, // 日付
        { wch: 8 },  // 曜日
        { wch: 15 }, // 設備
        { wch: 15 }, // 種別
        { wch: 6 },  // 順序
        { wch: 20 }, // 作業内容
        { wch: 25 }, // 詳細
        { wch: 8 },  // 開始時間
        { wch: 8 },  // 終了時間
        { wch: 6 },  // 枚数
        { wch: 10 }, // 担当者
        { wch: 15 }  // 備考
      ];
      ws['!cols'] = colWidths;
      
      XLSX.utils.book_append_sheet(wb, ws, 'サンプル予約');
      
      // Generate filename with current date
      const filename = `サンプル予約_${format(new Date(), 'yyyyMMdd')}.xlsx`;
      
      // Save file
      XLSX.writeFile(wb, filename);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Excelファイルの出力に失敗しました');
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
                設備
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
            {sampleEquipment.map((equipment) => (
              <tr key={equipment.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                      <Box className="h-6 w-6 text-purple-600" />
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{equipment.name}</div>
                      <div className="text-xs text-gray-500">{equipment.type}</div>
                    </div>
                  </div>
                </td>
                {dates.map((date, i) => {
                  const schedules = getSampleSchedulesForDay(equipment.id, date);
                  return (
                    <td key={i} className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 relative group border border-gray-100">
                      <button
                        onClick={() => handleCellClick(equipment, date)}
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-purple-100 rounded-full p-1"
                      >
                        <Plus className="h-4 w-4 text-purple-600" />
                      </button>
                      {schedules.length > 0 && (
                        <button
                          onClick={() => {
                            setSelectedDateForOrder(date);
                            setSelectedEquipmentForOrder(equipment.id);
                            setIsOrderModalOpen(true);
                          }}
                          className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-yellow-100 rounded-full p-1"
                          title="作業順序調整"
                        >
                          <ArrowDownUp className="h-4 w-4 text-yellow-600" />
                        </button>
                      )}
                      <div className={view === 'day' ? 'min-h-[120px]' : 'min-h-[80px]'}>
                        {schedules.map((schedule, index) => (
                          <div 
                            key={schedule.id} 
                            className="mb-1 px-2 py-1 rounded text-xs bg-purple-100 text-purple-800 border-l-4 border-purple-500 cursor-pointer hover:bg-purple-200"
                            onClick={() => {
                              // TODO: Open schedule edit modal
                            }}
                          >
                            <div className="font-medium flex items-center justify-between">
                              <span>{index + 1}. {format(schedule.startTime, 'HH:mm')}-{format(schedule.endTime, 'HH:mm')}</span>
                              {schedule.quantity && (
                                <span className="bg-purple-200 text-purple-800 px-1 rounded text-xs">
                                  {schedule.quantity}枚
                                </span>
                              )}
                            </div>
                            <div className="truncate">{schedule.title}</div>
                            <div className="text-xs text-purple-600">{schedule.details}</div>
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
              const daySchedules = sampleEquipment.flatMap(equipment => 
                getSampleSchedulesForDay(equipment.id, date)
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
                      const equipment = sampleEquipment.find(e => 
                        schedule.equipment?.some((eq: any) => eq.id === e.id && eq.type === 'sample')
                      );
                      return (
                        <div 
                          key={schedule.id}
                          onClick={() => {
                            // TODO: Open schedule edit modal
                          }}
                          className="text-xs px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-80 bg-purple-100 text-purple-800"
                          title={`${equipment?.name}: ${schedule.title}`}
                        >
                          <div className="flex items-center space-x-1">
                            <Box className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{schedule.title}</span>
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
        <h1 className="text-2xl font-semibold text-gray-900">サンプル予約</h1>
        <div className="flex space-x-2">
          <button
            onClick={exportToExcel}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
          >
            <FileSpreadsheet className="h-5 w-5 mr-1" />
            Excel出力
          </button>
          <button
            onClick={() => {
              setSelectedEquipment(null);
              setSelectedDate(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
          >
            <Plus className="h-5 w-5 mr-1" />
            予約作成
          </button>
        </div>
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
        selectedEquipment={selectedEquipment || undefined}
        type="sample"
      />

      <SortOrderModal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
      />
    </div>
  );
}