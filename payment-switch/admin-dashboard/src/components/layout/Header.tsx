import React, { useState } from 'react';
import {
  Bell,
  Search,
  Menu,
  Sun,
  Moon,
  ChevronDown,
  Settings,
  User,
  LogOut,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeaderProps {
  title: string;
  onMenuClick: () => void;
  notifications?: number;
}

export function Header({ title, onMenuClick, notifications = 0 }: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 lg:px-6">
      {/* Left section */}
      <div className="flex items-center">
        <button
          onClick={onMenuClick}
          className="mr-4 rounded-lg p-2 text-gray-500 hover:bg-gray-100 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      </div>

      {/* Center section - Search */}
      <div className="hidden flex-1 max-w-xl mx-8 lg:block">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search transactions, participants, alerts..."
            className="w-full rounded-lg border border-gray-300 bg-gray-50 py-2 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-gray-300 bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center space-x-2">
        {/* Help */}
        <button className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
          <HelpCircle className="h-5 w-5" />
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          >
            <Bell className="h-5 w-5" />
            {notifications > 0 && (
              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs font-semibold text-white">
                {notifications > 9 ? '9+' : notifications}
              </span>
            )}
          </button>

          {/* Notifications dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 rounded-lg border border-gray-200 bg-white shadow-lg">
              <div className="border-b border-gray-200 px-4 py-3">
                <h3 className="font-semibold text-gray-900">Notifications</h3>
              </div>
              <div className="max-h-96 overflow-y-auto">
                <NotificationItem
                  title="High-risk transaction detected"
                  message="Transaction #TXN-12345 flagged for review"
                  time="2 min ago"
                  type="alert"
                />
                <NotificationItem
                  title="Settlement window closed"
                  message="Window #SW-789 ready for approval"
                  time="15 min ago"
                  type="settlement"
                />
                <NotificationItem
                  title="New participant onboarded"
                  message="FirstBank Nigeria is now active"
                  time="1 hour ago"
                  type="participant"
                />
              </div>
              <div className="border-t border-gray-200 px-4 py-3">
                <button className="text-sm font-medium text-primary-600 hover:text-primary-700">
                  View all notifications
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center rounded-lg p-2 text-gray-700 hover:bg-gray-100"
          >
            <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center">
              <span className="text-sm font-medium text-white">AD</span>
            </div>
            <ChevronDown className="ml-1 h-4 w-4 text-gray-500" />
          </button>

          {/* User dropdown */}
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 rounded-lg border border-gray-200 bg-white shadow-lg">
              <div className="border-b border-gray-200 px-4 py-3">
                <p className="font-medium text-gray-900">Admin User</p>
                <p className="text-sm text-gray-500">admin@payment-switch.com</p>
              </div>
              <div className="py-1">
                <UserMenuItem icon={<User className="h-4 w-4" />} label="Profile" />
                <UserMenuItem icon={<Settings className="h-4 w-4" />} label="Settings" />
              </div>
              <div className="border-t border-gray-200 py-1">
                <UserMenuItem
                  icon={<LogOut className="h-4 w-4" />}
                  label="Sign out"
                  danger
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

interface NotificationItemProps {
  title: string;
  message: string;
  time: string;
  type: 'alert' | 'settlement' | 'participant' | 'system';
}

function NotificationItem({ title, message, time, type }: NotificationItemProps) {
  const typeColors = {
    alert: 'bg-red-100 text-red-600',
    settlement: 'bg-blue-100 text-blue-600',
    participant: 'bg-green-100 text-green-600',
    system: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="flex items-start px-4 py-3 hover:bg-gray-50 cursor-pointer">
      <div className={cn('rounded-full p-2', typeColors[type])}>
        <Bell className="h-4 w-4" />
      </div>
      <div className="ml-3 flex-1">
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <p className="text-sm text-gray-500">{message}</p>
        <p className="mt-1 text-xs text-gray-400">{time}</p>
      </div>
    </div>
  );
}

interface UserMenuItemProps {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
}

function UserMenuItem({ icon, label, danger }: UserMenuItemProps) {
  return (
    <button
      className={cn(
        'flex w-full items-center px-4 py-2 text-sm',
        danger
          ? 'text-red-600 hover:bg-red-50'
          : 'text-gray-700 hover:bg-gray-50'
      )}
    >
      {icon}
      <span className="ml-3">{label}</span>
    </button>
  );
}
