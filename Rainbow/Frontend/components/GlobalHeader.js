'use client';
import React, { useEffect, useState, useRef } from 'react';

const GlobalHeader = ({ user }) => {
  const [lastUpdated, setLastUpdated] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Update timestamp every 5 seconds
  useEffect(() => {
    const updateTime = () => setLastUpdated(new Date().toLocaleTimeString());
    updateTime(); // set immediately
    const interval = setInterval(updateTime, 5000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    window.location.href = '/api/auth/logout';
  };

  const getDisplayUsername = () => {
    return (
      user?.['cognito:username'] ||
      user?.username ||
      user?.name ||
      user?.email ||
      'User'
    );
  };

  const getAvatarInitial = () => getDisplayUsername().charAt(0).toUpperCase();

  return (
    <div className="bg-white shadow-sm border-b border-gray-200">
      {/* Main Header */}
      <div className="px-6 py-4 flex justify-between items-center">
        {/* Left side - Logo */}
        <div className="flex items-center space-x-3">
          <img src="/rainbow-logo.svg" alt="Logo" className="w-35 h-20" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Rainbow</h1>
            {/* <p className="text-sm text-gray-500">MedTranscribe</p> */}
          </div>
        </div>
{/* /Op.png  w-30 h-12*/}
        {/* Right side - User Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center space-x-3 focus:outline-none"
          >
            {/* <div className="text-right hidden sm:block">
              <div className="text-sm font-medium text-gray-900">
                {getDisplayUsername()}
              </div>
              <div className="text-xs text-gray-500">
                {user?.email || 'No email'}
              </div>
            </div> */}
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
              {getAvatarInitial()}
            </div>
            <svg
              className={`w-4 h-4 text-gray-600 transition-transform duration-200 ${
                isDropdownOpen ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 z-50">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900">
                  {getDisplayUsername()}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {user?.email || 'No email'}
                </p>
              </div>

              {/* Logout button */}
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 text-sm font-medium transition-colors"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-blue-50 border-t border-blue-100 px-6 py-3 text-sm flex justify-between">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-gray-700">System Status: Online</span>
          </div>
          <div className="text-gray-500">Last updated: {lastUpdated || '--'}</div>
        </div>
      </div>
    </div>
  );
};

export default GlobalHeader;
