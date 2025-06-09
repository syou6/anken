import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  switchUser: (user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const switchUser = (user: User) => {
    console.log('ユーザー切り替え:', user.name);
    setCurrentUser(user);
    setIsAuthenticated(true);
    // ローカルストレージに保存（共有PC対応）
    localStorage.setItem('currentUser', JSON.stringify(user));
  };

  const logout = () => {
    console.log('ログアウト');
    setCurrentUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('currentUser');
  };

  // アプリ起動時にローカルストレージからユーザー情報を復元
  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        setCurrentUser(user);
        setIsAuthenticated(true);
        console.log('保存されたユーザー情報を復元:', user.name);
      } catch (error) {
        console.error('ユーザー情報の復元に失敗:', error);
        localStorage.removeItem('currentUser');
      }
    }
  }, []);

  return (
    <AuthContext.Provider value={{ 
      currentUser,
      isAuthenticated,
      switchUser,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}