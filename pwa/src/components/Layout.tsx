import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const navigation = [
    { name: 'Dashboard', href: '/', icon: 'home' },
    { name: 'Wallet', href: '/wallet', icon: 'wallet' },
    { name: 'Send Money', href: '/send', icon: 'send' },
    { name: 'Receive Money', href: '/receive', icon: 'download' },
    { name: 'Transactions', href: '/transactions', icon: 'list' },
    { name: 'Exchange Rates', href: '/exchange-rates', icon: 'trending-up' },
    { name: 'Airtime & Data', href: '/airtime', icon: 'phone' },
    { name: 'Bill Payment', href: '/bills', icon: 'file-text' },
    { name: 'Virtual Account', href: '/virtual-account', icon: 'credit-card' },
    { name: 'Cards', href: '/cards', icon: 'credit-card' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-40 lg:hidden ${sidebarOpen ? '' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white">
          <div className="flex h-16 items-center justify-between px-4 border-b">
            <span className="text-xl font-bold text-blue-600">Remittance</span>
            <button onClick={() => setSidebarOpen(false)} className="text-gray-500">
              <span className="sr-only">Close sidebar</span>
              &times;
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto py-4">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center px-4 py-2 text-sm font-medium ${
                  location.pathname === item.href
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                {item.name}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r">
          <div className="flex h-16 items-center px-4 border-b">
            <span className="text-xl font-bold text-blue-600">Remittance</span>
          </div>
          <nav className="flex-1 overflow-y-auto py-4">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center px-4 py-2 text-sm font-medium ${
                  location.pathname === item.href
                    ? 'bg-blue-50 text-blue-600 border-r-2 border-blue-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {item.name}
              </Link>
            ))}
          </nav>
          <div className="border-t p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-700">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="mt-4 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-10 flex h-16 bg-white border-b lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="px-4 text-gray-500 focus:outline-none"
          >
            <span className="sr-only">Open sidebar</span>
            &#9776;
          </button>
          <div className="flex flex-1 items-center justify-center">
            <span className="text-xl font-bold text-blue-600">Remittance</span>
          </div>
          <div className="w-14" />
        </div>

        {/* Page content */}
        <main className="py-6">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
