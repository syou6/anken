import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { addDays, subDays, startOfWeek, endOfWeek, isSameDay, isWithinInterval } from 'date-fns';
import { Schedule, User } from '../types';
import { mockSchedules } from '../data/mockData';
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
}

const CalendarContext = createContext<CalendarContextType | undefined>(undefined);

export function CalendarProvider({ children }: { children: ReactNode }) {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [view, setView] = useState<'day' | 'week' | 'month'>('week');
  const [schedules, setSchedules] = useState<Schedule[]>(() => {
    const savedSchedules = localStorage.getItem('schedules');
    if (savedSchedules) {
      const parsed = JSON.parse(savedSchedules);
      return parsed.map((schedule: any) => ({
        ...schedule,
        startTime: new Date(schedule.startTime),
        endTime: new Date(schedule.endTime),
        createdAt: new Date(schedule.createdAt),
        updatedAt: schedule.updatedAt ? new Date(schedule.updatedAt) : null
      }));
    }
    return mockSchedules;
  });
  const [visibleUsers, setVisibleUsers] = useState<string[]>(() => {
    const saved = localStorage.getItem('visibleUsers');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('schedules', JSON.stringify(schedules));
  }, [schedules]);

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

    const newSchedule: Schedule = {
      ...scheduleData,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: null,
      updatedBy: null,
    };

    setSchedules(current => [...current, newSchedule]);

    try {
      await sendEmailNotifications(newSchedule);
      await sendPushNotifications(newSchedule);
      return true;
    } catch (error) {
      console.error('Notification error:', error);
      return true;
    }
  }, [schedules, getSchedulesForDate, checkScheduleConflicts]);

  const updateSchedule = useCallback((updatedSchedule: Schedule) => {
    setSchedules(current => 
      current.map(schedule => 
        schedule.id === updatedSchedule.id ? {
          ...updatedSchedule,
          updatedAt: new Date()
        } : schedule
      )
    );
  }, []);

  const deleteSchedule = useCallback((scheduleId: string) => {
    setSchedules(current => current.filter(schedule => schedule.id !== scheduleId));
  }, []);

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
    }}>
      {children}
    </CalendarContext.Provider>
  );
}

async function sendEmailNotifications(schedule: Schedule) {
  console.log('Sending email notifications for schedule:', schedule);
}

async function sendPushNotifications(schedule: Schedule) {
  console.log('Sending push notifications for schedule:', schedule);
}

export function useCalendar() {
  const context = useContext(CalendarContext);
  if (context === undefined) {
    throw new Error('useCalendar must be used within a CalendarProvider');
  }
  return context;
}