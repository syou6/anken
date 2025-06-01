// User types
export type UserRole = 'employee' | 'admin' | 'president';

export type Department = 
  | '本社（１階）' 
  | '本社（２階）' 
  | '本社（３階）' 
  | '仕上げ・プレス' 
  | 'CAD-CAM' 
  | 'WEB' 
  | '所属なし';

export interface User {
  id: string;
  employeeId: string;
  name: string;
  nameKana: string;
  email: string;
  phone: string;
  department: Department;
  role: UserRole;
  defaultWorkDays: WorkDay[];
}

export interface WorkDay {
  day: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday, 6 = Saturday
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
}

// Group types
export type GroupType = 'department' | 'task' | 'leave';

export interface Group {
  id: string;
  name: string;
  type: GroupType;
  members: string[]; // User IDs
  createdBy: string; // User ID
  createdAt: Date;
}

// Calendar and schedule types
export type ScheduleType = 
  | '15分無料相談' 
  | 'オンライン商談' 
  | '会議' 
  | '来訪' 
  | '工事' 
  | 'その他';

export type RecurrenceType = 
  | 'none' 
  | 'daily' 
  | 'weekly' 
  | 'monthly' 
  | 'yearly' 
  | 'weekday' 
  | 'custom';

export interface Schedule {
  id: string;
  type: ScheduleType;
  title: string;
  details: string;
  startTime: Date;
  endTime: Date;
  isAllDay: boolean;
  recurrence: Recurrence | null;
  participants: string[]; // User IDs
  equipment: Equipment[]; // Equipment IDs and types
  reminders: Reminder[];
  createdBy: string; // User ID
  createdAt: Date;
  updatedBy: string | null; // User ID
  updatedAt: Date | null;
}

export interface Recurrence {
  type: RecurrenceType;
  interval: number;
  endDate: Date | null;
  count: number | null;
  weekdays?: number[]; // 0-6 for Sunday-Saturday
}

export interface Equipment {
  id: string;
  type: 'room' | 'vehicle' | 'sample';
}

export interface Reminder {
  time: number; // Minutes before the event
  methods: ('email' | 'calendar' | 'notification')[];
}

// Room types
export interface Room {
  id: string;
  name: string;
  createdBy: string; // User ID
}

// Vehicle types
export interface Vehicle {
  id: string;
  name: string;
  licensePlate: string;
  type: string; // Car model
  createdBy: string; // User ID
}

// Sample equipment types
export interface SampleEquipment {
  id: string;
  name: string;
  type: 'CAD・マーキング' | 'サンプル裁断' | 'サンプル縫製' | 'サンプル内職' | 'プレス' | '仕上げ・梱包';
}

export interface SampleReservationDetails {
  productionNumber: string;
  productCode: string;
  quantity: number;
  assignedTo: string; // User ID
  order: number;
}

// Leave request types
export type LeaveType = 'vacation' | 'late' | 'early';

export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface LeaveRequest {
  id: string;
  type: LeaveType;
  userId: string;
  date: Date;
  reason: string;
  status: LeaveStatus;
  approvers: {
    userId: string;
    status: LeaveStatus;
    timestamp: Date | null;
  }[];
  createdAt: Date;
}