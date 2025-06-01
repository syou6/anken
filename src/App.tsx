import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { CalendarProvider } from './contexts/CalendarContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MyCalendar from './pages/calendar/MyCalendar';
import VehicleReservation from './pages/calendar/VehicleReservation';
import RoomReservation from './pages/calendar/RoomReservation';
import SampleReservation from './pages/calendar/SampleReservation';
import LeaveRequests from './pages/leave/LeaveRequests';
import AdminUsers from './pages/admin/AdminUsers';
import AdminGroups from './pages/admin/AdminGroups';
import AdminEquipment from './pages/admin/AdminEquipment';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

function App() {
  return (
    <Router>
      <AuthProvider>
        <CalendarProvider>
          <Toaster position="top-right" />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="calendar">
                <Route index element={<Navigate to="/calendar/my\" replace />} />
                <Route path="my" element={<MyCalendar />} />
                <Route path="vehicle" element={<VehicleReservation />} />
                <Route path="room" element={<RoomReservation />} />
                <Route path="sample" element={<SampleReservation />} />
              </Route>
              <Route path="leave" element={<LeaveRequests />} />
              <Route path="admin">
                <Route path="users" element={<AdminUsers />} />
                <Route path="groups" element={<AdminGroups />} />
                <Route path="equipment" element={<AdminEquipment />} />
              </Route>
            </Route>
          </Routes>
        </CalendarProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;