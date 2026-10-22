import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/auth';

interface AuthContextType {
  user: any;
  loading: boolean;
  login: (type: 'admin'|'voter', data: any) => Promise<void>;
  googleLogin: (idToken: string, roomNumber?: string, role?: 'admin' | 'voter') => Promise<any>;
  unifiedLogin: (data: { identifier: string; authProvider?: string; name?: string; avatar?: string }) => Promise<any>;
  unifiedSelectRole: (data: { identifier: string; role: 'admin' | 'voter'; name?: string; roomNumber?: string }) => Promise<any>;
  unifiedResetRole: (identifier: string) => Promise<any>;
  setUserData: (u: any) => void;
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

  const googleLogin = async (idToken: string, roomNumber?: string, role?: 'admin' | 'voter') => {
    const res = await authApi.googleLogin({ idToken, roomNumber, role });
    if (res.user) {
      const userData = { ...res.user };
      if (userData.role === 'voter' && userData.roomNumber) {
        localStorage.setItem('votex_voter_room', userData.roomNumber);
      }
      setUser(userData);
    }
    return res;
  };

  const unifiedLogin = async (data: { identifier: string; authProvider?: string; name?: string; avatar?: string }) => {
    const res = await authApi.unifiedLogin(data);
    if (!res.needsRoleSelection && res.user) {
      const userData = { ...res.user };
      if (userData.role === 'voter' && userData.roomNumber) {
        localStorage.setItem('votex_voter_room', userData.roomNumber);
      }
      setUser(userData);
    }
    return res;
  };

  const unifiedSelectRole = async (data: { identifier: string; role: 'admin' | 'voter'; name?: string; roomNumber?: string }) => {
    const res = await authApi.unifiedSelectRole(data);
    if (res.user) {
      const userData = { ...res.user };
      if (userData.role === 'voter' && userData.roomNumber) {
        localStorage.setItem('votex_voter_room', userData.roomNumber);
      }
      setUser(userData);
    }
    return res;
  };

  const unifiedResetRole = async (identifier: string) => {
    const res = await authApi.unifiedResetRole({ identifier });
    setUser(null);
    localStorage.removeItem('votex_voter_room');
    return res;
  };

  const setUserData = (u: any) => {
    setUser(u);
  };

  const logout = async () => {
    await authApi.logout();
    localStorage.removeItem('votex_voter_room');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      googleLogin,
      unifiedLogin,
      unifiedSelectRole,
      unifiedResetRole,
      setUserData,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
