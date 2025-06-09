import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { SecurityProvider } from './contexts/SecurityContext';
import { CalendarProvider } from './contexts/CalendarContext';
import { schedulerService } from './services/schedulerService';
import { setupNotificationHandlers } from './utils/notifications';
import UserSwitch from './pages/UserSwitch';
import Dashboard from './pages/Dashboard';
import MyCalendar from './pages/calendar/MyCalendar';
import VehicleReservation from './pages/calendar/VehicleReservation';
import RoomReservation from './pages/calendar/RoomReservation';
import SampleReservation from './pages/calendar/SampleReservation';
import LeaveRequests from './pages/leave/LeaveRequests';
import AdminUsers from './pages/admin/AdminUsers';
import AdminGroups from './pages/admin/AdminGroups';
import AdminEquipment from './pages/admin/AdminEquipment';
import NotificationSettings from './pages/settings/NotificationSettings';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

function App() {
  useEffect(() => {
    // Start the notification scheduler
    // Temporarily disabled until scheduled_notifications table is created
    // schedulerService.start();
    
    // Setup notification click handlers
    setupNotificationHandlers();
    
    // Cleanup on unmount
    return () => {
      // schedulerService.stop();
    };
  }, []);

  return (
    <Router>
      <AuthProvider>
        <SecurityProvider>
          <CalendarProvider>
            <Toaster position="top-right" />
            <Routes>
              <Route path="/user-switch" element={<UserSwitch />} />
              <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route index element={<Dashboard />} />
                <Route path="calendar">
                  <Route index element={<Navigate to="/calendar/my" replace />} />
                  <Route path="my" element={<MyCalendar />} />
                  <Route path="vehicle" element={<VehicleReservation />} />
                  <Route path="room" element={<RoomReservation />} />
                  <Route path="sample" element={<SampleReservation />} />
                </Route>
                <Route path="leave" element={<LeaveRequests />} />
                <Route path="settings">
                  <Route path="notifications" element={<NotificationSettings />} />
                </Route>
                <Route path="admin">
                  <Route 
                    path="users" 
                    element={
                      <ProtectedRoute minRole="admin">
                        <AdminUsers />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="groups" 
                    element={
                      <ProtectedRoute minRole="admin">
                        <AdminGroups />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="equipment" 
                    element={
                      <ProtectedRoute minRole="admin">
                        <AdminEquipment />
                      </ProtectedRoute>
                    } 
                  />
                </Route>
              </Route>
            </Routes>
          </CalendarProvider>
        </SecurityProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;