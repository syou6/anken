import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { addDays, subDays, startOfWeek, endOfWeek, isSameDay, isWithinInterval } from 'date-fns';
import { Schedule, User } from '../types';
import { mockSchedules } from '../data/mockData';
import { supabase } from '../lib/supabase';
import { notificationService } from '../services/notificationService';
import toast from 'react-hot-toast';

interface CalendarContextType {
  currentDate: Date;
  view: 'day' | 'week' | 'month';
  schedules: Schedule[];
  visibleUsers: string[];
  setCurrentDate: (date: Date) => void;
  setView: (view: 'day' | 'week' | 'month') => void;
  goToNextPeriod: () => void;
  goToPreviousPeriod: () => void;
  goToToday: () => void;
  toggleUserVisibility: (userId: string) => void;
  addSchedule: (schedule: Omit<Schedule, 'id' | 'createdAt' | 'updatedAt' | 'updatedBy'>) => Promise<boolean>;
  updateSchedule: (schedule: Schedule) => void;
  deleteSchedule: (scheduleId: string) => void;
  getSchedulesForDate: (date: Date) => Schedule[];
  getSchedulesForDateRange: (startDate: Date, endDate: Date) => Schedule[];
  getSchedulesForUser: (userId: string) => Schedule[];
  getSchedulesForEquipment: (equipmentId: string, type: 'room' | 'vehicle' | 'sample') => Schedule[];
  checkScheduleConflicts: (startTime: Date, endTime: Date, participants: string[], equipment: { id: string, type: string }[]) => { hasConflicts: boolean, conflicts: Schedule[] };
  refreshSchedules: () => Promise<void>;
}

const CalendarContext = createContext<CalendarContextType | undefined>(undefined);

export function CalendarProvider({ children }: { children: ReactNode }) {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [view, setView] = useState<'day' | 'week' | 'month'>('week');
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [visibleUsers, setVisibleUsers] = useState<string[]>(() => {
    const saved = localStorage.getItem('visibleUsers');
    return saved ? JSON.parse(saved) : [];
  });

  // Supabaseからスケジュールを読み込む
  const fetchSchedules = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .order('start_time');

      if (error) {
        console.error('Failed to fetch schedules from Supabase:', error);
        // エラーの場合はモックデータを使用
        console.warn('Using mock data for schedules');
        setSchedules(mockSchedules);
      } else if (data) {
        const convertedSchedules: Schedule[] = data.map(schedule => ({
          id: schedule.id,
          type: schedule.type,
          title: schedule.title,
          details: schedule.details || '',
          startTime: new Date(schedule.start_time),
          endTime: new Date(schedule.end_time),
          isAllDay: schedule.is_all_day,
          recurrence: schedule.recurrence,
          participants: schedule.participants || [],
          equipment: schedule.equipment || [],
          reminders: schedule.reminders || [],
          meetLink: schedule.meet_link,
          meetingType: schedule.meeting_type || 'in-person',
          createdBy: schedule.created_by,
          createdAt: new Date(schedule.created_at),
          updatedBy: schedule.updated_by,
          updatedAt: schedule.updated_at ? new Date(schedule.updated_at) : null
        }));
        setSchedules(convertedSchedules);
      }
    } catch (err) {
      console.error('Error fetching schedules:', err);
      console.warn('Using mock data for schedules');
      setSchedules(mockSchedules);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // LocalStorage保存を無効化
  // useEffect(() => {
  //   localStorage.setItem('schedules', JSON.stringify(schedules));
  // }, [schedules]);

  useEffect(() => {
    localStorage.setItem('visibleUsers', JSON.stringify(visibleUsers));
  }, [visibleUsers]);

  const goToNextPeriod = useCallback(() => {
    setCurrentDate(currentDate => {
      switch (view) {
        case 'day':
          return addDays(currentDate, 1);
        case 'week':
          return addDays(currentDate, 7);
        case 'month':
          const nextMonth = new Date(currentDate);
          nextMonth.setMonth(nextMonth.getMonth() + 1);
          return nextMonth;
        default:
          return currentDate;
      }
    });
  }, [view]);

  const goToPreviousPeriod = useCallback(() => {
    setCurrentDate(currentDate => {
      switch (view) {
        case 'day':
          return subDays(currentDate, 1);
        case 'week':
          return subDays(currentDate, 7);
        case 'month':
          const prevMonth = new Date(currentDate);
          prevMonth.setMonth(prevMonth.getMonth() - 1);
          return prevMonth;
        default:
          return currentDate;
      }
    });
  }, [view]);

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  const toggleUserVisibility = useCallback((userId: string) => {
    setVisibleUsers(current => {
      if (current.includes(userId)) {
        return current.filter(id => id !== userId);
      } else {
        return [...current, userId];
      }
    });
  }, []);

  const getSchedulesForDate = useCallback((date: Date): Schedule[] => {
    return schedules.filter(schedule => {
      if (isSameDay(new Date(schedule.startTime), date) || isSameDay(new Date(schedule.endTime), date)) {
        return true;
      }
      
      if (new Date(schedule.startTime) < date && new Date(schedule.endTime) > date) {
        return true;
      }
      
      return false;
    });
  }, [schedules]);

  const getSchedulesForDateRange = useCallback((startDate: Date, endDate: Date): Schedule[] => {
    return schedules.filter(schedule => {
      const scheduleStart = new Date(schedule.startTime);
      const scheduleEnd = new Date(schedule.endTime);
      return (
        isWithinInterval(scheduleStart, { start: startDate, end: endDate }) ||
        isWithinInterval(scheduleEnd, { start: startDate, end: endDate }) ||
        (scheduleStart <= startDate && scheduleEnd >= endDate)
      );
    });
  }, [schedules]);

  const checkScheduleConflicts = useCallback((
    startTime: Date,
    endTime: Date,
    participants: string[],
    equipment: { id: string, type: string }[]
  ) => {
    const conflicts = schedules.filter(schedule => {
      const timeOverlap = (
        (startTime >= schedule.startTime && startTime < schedule.endTime) ||
        (endTime > schedule.startTime && endTime <= schedule.endTime) ||
        (startTime <= schedule.startTime && endTime >= schedule.endTime)
      );

      if (!timeOverlap) return false;

      const participantConflict = participants.some(userId =>
        schedule.participants.includes(userId)
      );

      const equipmentConflict = equipment.some(eq =>
        schedule.equipment.some(schedEq =>
          schedEq.id === eq.id && schedEq.type === eq.type
        )
      );

      return participantConflict || equipmentConflict;
    });

    return {
      hasConflicts: conflicts.length > 0,
      conflicts
    };
  }, [schedules]);

  const addSchedule = useCallback(async (scheduleData: Omit<Schedule, 'id' | 'createdAt' | 'updatedAt' | 'updatedBy'>) => {
    const daySchedules = getSchedulesForDate(scheduleData.startTime);
    if (daySchedules.length >= 10) {
      toast.error('1日の予約上限（10件）に達しています');
      return false;
    }

    const { hasConflicts, conflicts } = checkScheduleConflicts(
      scheduleData.startTime,
      scheduleData.endTime,
      scheduleData.participants,
      scheduleData.equipment
    );

    if (hasConflicts) {
      const proceed = window.confirm(
        '予定が重複しています。続行しますか？\n\n' +
        conflicts.map(c => `${c.title} (${c.participants.length}名)`).join('\n')
      );
      if (!proceed) return false;
    }

    try {
      // データ検証
      console.log('Schedule data before saving:', {
        type: scheduleData.type,
        title: scheduleData.title,
        startTime: scheduleData.startTime,
        endTime: scheduleData.endTime,
        participants: scheduleData.participants,
        createdBy: scheduleData.createdBy
      });

      if (!scheduleData.type || !scheduleData.title || !scheduleData.startTime || !scheduleData.endTime) {
        console.error('Required fields missing:', { 
          type: scheduleData.type, 
          title: scheduleData.title, 
          startTime: scheduleData.startTime, 
          endTime: scheduleData.endTime 
        });
        toast.error('必須フィールドが不足しています');
        return false;
      }

      // Supabaseにデータを保存
      const { data, error } = await supabase
        .from('schedules')
        .insert([{
          type: scheduleData.type,
          title: scheduleData.title,
          details: scheduleData.details || null,
          start_time: scheduleData.startTime.toISOString(),
          end_time: scheduleData.endTime.toISOString(),
          is_all_day: scheduleData.isAllDay || false,
          recurrence: scheduleData.recurrence || null,
          participants: scheduleData.participants || [],
          equipment: scheduleData.equipment || [],
          reminders: scheduleData.reminders || [],
          meet_link: scheduleData.meetLink || null,
          meeting_type: scheduleData.meetingType || 'in-person',
          created_by: scheduleData.createdBy || null,
        }])
        .select()
        .single();

      if (error) {
        console.error('Supabase error details:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Error details:', error.details);
        toast.error(`予約の保存に失敗しました: ${error.message}`);
        return false;
      }

      const newSchedule: Schedule = {
        id: data.id,
        type: data.type,
        title: data.title,
        details: data.details || '',
        startTime: new Date(data.start_time),
        endTime: new Date(data.end_time),
        isAllDay: data.is_all_day,
        recurrence: data.recurrence,
        participants: data.participants || [],
        equipment: data.equipment || [],
        reminders: data.reminders || [],
        meetLink: data.meet_link,
        meetingType: data.meeting_type || 'in-person',
        createdBy: data.created_by,
        createdAt: new Date(data.created_at),
        updatedBy: data.updated_by,
        updatedAt: data.updated_at ? new Date(data.updated_at) : null
      };

      setSchedules(current => [...current, newSchedule]);
      toast.success('予約を作成しました');

      // Send notifications to all participants
      try {
        console.log('=== 通知送信開始 ===');
        console.log('参加者:', newSchedule.participants);
        
        const participantPromises = newSchedule.participants.map(async (participantId) => {
          console.log(`参加者 ${participantId} への通知処理開始`);
          
          // Get participant details
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id, name, email')
            .eq('id', participantId)
            .single();

          if (userError) {
            console.error(`ユーザーデータ取得エラー (${participantId}):`, userError);
            return;
          }

          if (userData) {
            console.log(`ユーザーデータ取得成功:`, userData);
            try {
              await notificationService.notifyScheduleCreated({
                schedule: {
                  id: newSchedule.id,
                  title: newSchedule.title,
                  type: newSchedule.type,
                  startTime: newSchedule.startTime,
                  endTime: newSchedule.endTime,
                  details: newSchedule.details,
                  meetLink: newSchedule.meetLink,
                  participants: newSchedule.participants,
                  location: getLocationFromEquipment(newSchedule.equipment)
                },
                user: {
                  id: userData.id,
                  name: userData.name,
                  email: userData.email
                }
              });
              console.log(`通知送信完了: ${userData.name}`);
            } catch (notifError) {
              console.error(`通知送信エラー (${userData.name}):`, notifError);
            }
          }
        });

        await Promise.all(participantPromises);
        console.log('=== 通知送信完了 ===');
      } catch (error) {
        console.error('Notification error:', error);
      }

      return true;
    } catch (error) {
      console.error('Error creating schedule:', error);
      toast.error('予約の作成中にエラーが発生しました');
      return false;
    }
  }, [schedules, getSchedulesForDate, checkScheduleConflicts]);

  const updateSchedule = useCallback(async (updatedSchedule: Schedule) => {
    try {
      // Get the original schedule for comparison
      const originalSchedule = schedules.find(s => s.id === updatedSchedule.id);
      if (!originalSchedule) return;

      // Update in Supabase
      const { error } = await supabase
        .from('schedules')
        .update({
          type: updatedSchedule.type,
          title: updatedSchedule.title,
          details: updatedSchedule.details || null,
          start_time: updatedSchedule.startTime.toISOString(),
          end_time: updatedSchedule.endTime.toISOString(),
          is_all_day: updatedSchedule.isAllDay || false,
          recurrence: updatedSchedule.recurrence || null,
          participants: updatedSchedule.participants || [],
          equipment: updatedSchedule.equipment || [],
          reminders: updatedSchedule.reminders || [],
          meet_link: updatedSchedule.meetLink || null,
          meeting_type: updatedSchedule.meetingType || 'in-person',
          updated_by: updatedSchedule.updatedBy || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', updatedSchedule.id);

      if (error) {
        console.error('Error updating schedule:', error);
        toast.error('予約の更新に失敗しました');
        return;
      }

      setSchedules(current => 
        current.map(schedule => 
          schedule.id === updatedSchedule.id ? {
            ...updatedSchedule,
            updatedAt: new Date()
          } : schedule
        )
      );
      toast.success('予約を更新しました');

      // Send update notifications
      try {
        // Detect changes
        const changes: string[] = [];
        if (originalSchedule.title !== updatedSchedule.title) {
          changes.push(`タイトル: ${originalSchedule.title} → ${updatedSchedule.title}`);
        }
        if (originalSchedule.startTime.getTime() !== updatedSchedule.startTime.getTime() ||
            originalSchedule.endTime.getTime() !== updatedSchedule.endTime.getTime()) {
          changes.push('日時が変更されました');
        }
        if (originalSchedule.meetLink !== updatedSchedule.meetLink) {
          changes.push('オンライン会議のリンクが変更されました');
        }

        // Notify all participants (including new ones)
        const allParticipants = new Set([...originalSchedule.participants, ...updatedSchedule.participants]);
        const participantPromises = Array.from(allParticipants).map(async (participantId) => {
          const { data: userData } = await supabase
            .from('users')
            .select('id, name, email')
            .eq('id', participantId)
            .single();

          if (userData) {
            await notificationService.notifyScheduleUpdated({
              schedule: {
                id: updatedSchedule.id,
                title: updatedSchedule.title,
                type: updatedSchedule.type,
                startTime: updatedSchedule.startTime,
                endTime: updatedSchedule.endTime,
                details: updatedSchedule.details,
                meetLink: updatedSchedule.meetLink,
                participants: updatedSchedule.participants,
                location: getLocationFromEquipment(updatedSchedule.equipment)
              },
              user: {
                id: userData.id,
                name: userData.name,
                email: userData.email
              },
              changes
            });
          }
        });

        await Promise.all(participantPromises);
      } catch (error) {
        console.error('Notification error:', error);
      }
    } catch (error) {
      console.error('Error updating schedule:', error);
      toast.error('予約の更新中にエラーが発生しました');
    }
  }, [schedules]);

  const deleteSchedule = useCallback(async (scheduleId: string, deletedBy?: string, reason?: string) => {
    try {
      // Get the schedule to be deleted
      const scheduleToDelete = schedules.find(s => s.id === scheduleId);
      if (!scheduleToDelete) return;

      // Delete from Supabase
      const { error } = await supabase
        .from('schedules')
        .delete()
        .eq('id', scheduleId);

      if (error) {
        console.error('Error deleting schedule:', error);
        toast.error('予約の削除に失敗しました');
        return;
      }

      setSchedules(current => current.filter(schedule => schedule.id !== scheduleId));
      toast.success('予約を削除しました');

      // Send deletion notifications
      try {
        const participantPromises = scheduleToDelete.participants.map(async (participantId) => {
          const { data: userData } = await supabase
            .from('users')
            .select('id, name, email')
            .eq('id', participantId)
            .single();

          if (userData) {
            const { data: deletedByUser } = deletedBy ? await supabase
              .from('users')
              .select('name')
              .eq('id', deletedBy)
              .single() : { data: null };

            await notificationService.notifyScheduleDeleted({
              schedule: {
                id: scheduleToDelete.id,
                title: scheduleToDelete.title,
                type: scheduleToDelete.type,
                startTime: scheduleToDelete.startTime,
                endTime: scheduleToDelete.endTime,
                details: scheduleToDelete.details,
                meetLink: scheduleToDelete.meetLink,
                participants: scheduleToDelete.participants,
                location: getLocationFromEquipment(scheduleToDelete.equipment)
              },
              user: {
                id: userData.id,
                name: userData.name,
                email: userData.email
              },
              deletedBy: deletedByUser?.name,
              reason
            });
          }
        });

        await Promise.all(participantPromises);
      } catch (error) {
        console.error('Notification error:', error);
      }
    } catch (error) {
      console.error('Error deleting schedule:', error);
      toast.error('予約の削除中にエラーが発生しました');
    }
  }, [schedules]);

  const getSchedulesForUser = useCallback((userId: string): Schedule[] => {
    return schedules.filter(schedule => 
      schedule.participants.includes(userId) || 
      schedule.createdBy === userId
    );
  }, [schedules]);

  const getSchedulesForEquipment = useCallback((equipmentId: string, type: 'room' | 'vehicle' | 'sample'): Schedule[] => {
    return schedules.filter(schedule => 
      schedule.equipment.some(eq => eq.id === equipmentId && eq.type === type)
    );
  }, [schedules]);

  return (
    <CalendarContext.Provider value={{
      currentDate,
      view,
      schedules,
      visibleUsers,
      setCurrentDate,
      setView,
      goToNextPeriod,
      goToPreviousPeriod,
      goToToday,
      toggleUserVisibility,
      addSchedule,
      updateSchedule,
      deleteSchedule,
      getSchedulesForDate,
      getSchedulesForDateRange,
      getSchedulesForUser,
      getSchedulesForEquipment,
      checkScheduleConflicts,
      refreshSchedules: fetchSchedules,
    }}>
      {children}
    </CalendarContext.Provider>
  );
}

// Helper function to get location from equipment
function getLocationFromEquipment(equipment: any[]): string | undefined {
  if (!equipment || equipment.length === 0) return undefined;
  
  const rooms = equipment.filter(e => e.type === 'room');
  if (rooms.length > 0) {
    return rooms.map(r => r.name).join(', ');
  }
  
  return undefined;
}

export function useCalendar() {
  const context = useContext(CalendarContext);
  if (context === undefined) {
    throw new Error('useCalendar must be used within a CalendarProvider');
  }
  return context;
}