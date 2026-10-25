import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/auth';

interface AuthContextType {
  user: any;
  loading: boolean;
  login: (type: 'admin'|'voter', data: any) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authApi.getCurrentUser()
      .then(res => {
        const u = res.user;
        if (u && u.role === 'voter' && !u.roomNumber) {
          const savedRoom = localStorage.getItem('votex_voter_room');
          if (savedRoom) u.roomNumber = savedRoom;
        }
        setUser(u);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (type: 'admin'|'voter', data: any) => {
    const res = type === 'admin' ? await authApi.adminLogin(data) : await authApi.voterLogin(data);
    const userData = { ...res.user };
    if (type === 'voter') {
      const room = data.roomNumber || res.user?.roomNumber;
      if (room) {
        userData.roomNumber = room;
        localStorage.setItem('votex_voter_room', room);
      }
    }
    setUser(userData);
  };

  const logout = async () => {
    await authApi.logout();
    localStorage.removeItem('votex_voter_room');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
