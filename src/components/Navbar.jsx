import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../utils/authStore';
import { api } from '../utils/axios';
import logo from '../images/Logo.png';

export default function Navbar() {
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      logout();
      navigate('/');
    }
  };

  return (
    <header className="bg-white/80 backdrop-blur border-b shadow-sm">
      <div className="container-page p-4 flex justify-between items-center">
        <NavLink to="/" className="flex items-center group">
          <img src={logo} alt="Logo" loading="lazy" className="h-10 w-auto rounded-lg shadow-sm" />
        </NavLink>

        <nav className="flex items-center gap-3">
          {!user ? (
            <>
              <NavLink to="/login" className="btn-secondary">Login</NavLink>
              <NavLink to="/register" className="btn-primary">Register</NavLink>
            </>
          ) : (
            <div className="flex items-center gap-3">
              {/* User Info */}
              <div className="flex items-center gap-2 text-sm">
                <div className="flex flex-col text-right">
                  <span className="font-medium text-gray-800">{user.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${user.role === 'admin' ? 'bg-purple-100 text-[#552e81]' :
                    user.role === 'staff' ? 'bg-purple-100 text-[#552e81]' :
                      'bg-purple-100 text-[#552e81]'
                    }`}>
                    {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                  </span>
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="btn-secondary text-[#552e81] hover:bg-purple-50 hover:border-purple-200"
              >
                Logout
              </button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
