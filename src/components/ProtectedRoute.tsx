import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';

interface ProtectedRouteProps {
  children: ReactNode;
  // Role-based protection (簡素化)
  minRole?: UserRole;
  // Redirect options
  redirectTo?: string;
}

export default function ProtectedRoute({ 
  children,
  minRole,
  redirectTo = "/user-switch",
}: ProtectedRouteProps) {
  const { isAuthenticated, currentUser } = useAuth();

  // Authentication check
  if (!isAuthenticated || !currentUser) {
    return <Navigate to={redirectTo} replace />;
  }

  // Role check (簡素化)
  if (minRole && currentUser.role !== 'president') {
    if (minRole === 'admin' && currentUser.role !== 'admin') {
      return (
        <div className="flex h-screen items-center justify-center bg-gray-50">
          <div className="text-center p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">アクセス権限がありません</h2>
            <p className="text-gray-600 mb-4">管理者権限が必要です</p>
            <button
              onClick={() => window.history.back()}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              戻る
            </button>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}