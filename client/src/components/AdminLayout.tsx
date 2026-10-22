import React from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, Users, UserPlus, Settings, ShieldCheck, LogOut, PlusSquare } from 'lucide-react';
import './AdminLayout.css';

const AdminLayout = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar glass-card">
        <div className="sidebar-header">
          <h2 className="text-gradient">VoteX Admin</h2>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/admin" end className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
            <LayoutDashboard size={20}/> Dashboard
          </NavLink>
          <NavLink to="/admin/create-election" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
            <PlusSquare size={20}/> Create Election
          </NavLink>
          <NavLink to="/admin/candidates" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
            <Users size={20}/> Candidates
          </NavLink>
          <NavLink to="/admin/voters" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
            <UserPlus size={20}/> Voters
          </NavLink>
          <NavLink to="/admin/room-settings" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
            <Settings size={20}/> Room Settings
          </NavLink>
          <NavLink to="/admin/audit" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
            <ShieldCheck size={20}/> Audit Log
          </NavLink>
        </nav>
        <div className="sidebar-footer">
          <p className="admin-email">{user?.login_id}</p>
          <button onClick={handleLogout} className="btn btn-secondary logout-btn">
            <LogOut size={18}/> Logout
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
