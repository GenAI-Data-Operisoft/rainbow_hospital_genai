'use client';
import React, { useEffect, useState, useRef } from 'react';
import { LogOut, ChevronDown, Clock, Wifi } from 'lucide-react';

const GlobalHeader = ({ user }) => {
  const [lastUpdated, setLastUpdated] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const updateTime = () => setLastUpdated(new Date().toLocaleTimeString());
    updateTime();
    const interval = setInterval(updateTime, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getDisplayUsername = () =>
    user?.['cognito:username'] || user?.username || user?.name || user?.email || 'User';

  const getAvatarInitial = () => getDisplayUsername().charAt(0).toUpperCase();

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30">
      <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-3 min-w-0">
          <img src="/rainbow-logo.svg" alt="Rainbow Hospital" className="h-10 sm:h-12 w-auto flex-shrink-0" />
          <div className="hidden sm:block min-w-0">
            <h1 className="text-base font-semibold text-gray-900 leading-tight truncate">Rainbow Hospital</h1>
            <p className="text-xs text-gray-500">AI Medical Assistant</p>
          </div>
        </div>

        {/* Status + User */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Status pill — hidden on very small screens */}
          <div className="hidden md:flex items-center gap-3 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full text-xs text-gray-600">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-green-500 rounded-full" />
              Online
            </span>
            <span className="text-gray-300">|</span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-gray-400" />
              {lastUpdated || '--'}
            </span>
          </div>

          {/* User dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 p-1 rounded-xl hover:bg-gray-100 transition-colors focus:outline-none"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-sm flex-shrink-0">
                {getAvatarInitial()}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-gray-800 leading-tight max-w-[120px] truncate">{getDisplayUsername()}</p>
                <p className="text-xs text-gray-500 max-w-[120px] truncate">{user?.email || ''}</p>
              </div>
              <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform duration-200 flex-shrink-0 ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-gray-100 z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <p className="text-sm font-semibold text-gray-900 truncate">{getDisplayUsername()}</p>
                  <p className="text-xs text-gray-500 truncate">{user?.email || 'No email'}</p>
                </div>
                <button
                  onClick={() => { window.location.href = '/api/auth/logout'; }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors font-medium"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default GlobalHeader;
