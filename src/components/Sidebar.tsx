import { Link, useLocation } from 'react-router-dom';
import { Calendar, Car, DoorOpen, Clock, Users, Settings, Building2, Box } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  onClose?: () => void;
}

export default function Sidebar({ onClose }: SidebarProps) {
  const location = useLocation();
  const { currentUser, logout } = useAuth();
  
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'president';

  const navigation = [
    { name: 'ダッシュボード', href: '/', icon: <Building2 className="h-6 w-6" /> },
    { name: 'カレンダー', href: '/calendar/my', icon: <Calendar className="h-6 w-6" /> },
    { name: '車両予約', href: '/calendar/vehicle', icon: <Car className="h-6 w-6" /> },
    { name: '会議室予約', href: '/calendar/room', icon: <DoorOpen className="h-6 w-6" /> },
    { name: 'サンプル予約', href: '/calendar/sample', icon: <Box className="h-6 w-6" /> },
    { name: '休暇申請', href: '/leave', icon: <Clock className="h-6 w-6" /> },
  ];

  const adminNavigation = [
    { name: 'ユーザー管理', href: '/admin/users', icon: <Users className="h-6 w-6" /> },
    { name: 'グループ管理', href: '/admin/groups', icon: <Users className="h-6 w-6" /> },
    { name: '設備管理', href: '/admin/equipment', icon: <Settings className="h-6 w-6" /> },
  ];

  const handleLinkClick = () => {
    if (onClose) onClose();
  };

  return (
    <div className="flex flex-col h-0 flex-1 bg-white border-r border-gray-200">
      <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
        <div className="flex items-center flex-shrink-0 px-4">
          <span className="text-2xl font-bold text-blue-600">スケジュール</span>
        </div>
        <nav className="mt-5 flex-1 px-2 bg-white space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href || 
                            (item.href !== '/' && location.pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={handleLinkClick}
                className={`
                  group flex items-center px-2 py-2 text-sm font-medium rounded-md
                  ${isActive
                    ? 'bg-blue-100 text-blue-900'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                `}
              >
                <div className={`mr-3 ${isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'}`}>
                  {item.icon}
                </div>
                {item.name}
              </Link>
            );
          })}

          {isAdmin && (
            <div className="pt-6">
              <div className="px-3 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                管理者メニュー
              </div>
              {adminNavigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={handleLinkClick}
                    className={`
                      group flex items-center px-2 py-2 text-sm font-medium rounded-md
                      ${isActive
                        ? 'bg-blue-100 text-blue-900'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                    `}
                  >
                    <div className={`mr-3 ${isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'}`}>
                      {item.icon}
                    </div>
                    {item.name}
                  </Link>
                );
              })}
            </div>
          )}
        </nav>
      </div>
      <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
        <div className="flex items-center">
          <div>
            <div className="text-sm font-medium text-gray-700">{currentUser?.name}</div>
            <div className="text-xs text-gray-500">{currentUser?.department}</div>
          </div>
        </div>
      </div>
    </div>
  );
}