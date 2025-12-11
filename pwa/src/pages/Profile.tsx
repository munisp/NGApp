import React from 'react';
import { useAuthStore } from '../stores/authStore';

const Profile: React.FC = () => {
  const { user } = useAuthStore();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="page-title">My Profile</h1>

      {/* Profile Header */}
      <div className="card text-center">
        <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center text-white text-3xl font-bold mx-auto">
          {user?.firstName?.[0]}{user?.lastName?.[0]}
        </div>
        <h2 className="text-xl font-semibold mt-4">{user?.firstName} {user?.lastName}</h2>
        <p className="text-gray-500">{user?.email}</p>
        <div className="flex justify-center gap-2 mt-4">
          <span className={`px-3 py-1 rounded-full text-sm ${
            user?.kycStatus === 'verified' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
          }`}>
            {user?.kycStatus === 'verified' ? 'Verified' : 'Pending Verification'}
          </span>
        </div>
      </div>

      {/* Personal Information */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Personal Information</h2>
          <button className="text-blue-600 text-sm font-medium">Edit</button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-500">First Name</label>
              <p className="font-medium">{user?.firstName || 'John'}</p>
            </div>
            <div>
              <label className="block text-sm text-gray-500">Last Name</label>
              <p className="font-medium">{user?.lastName || 'Doe'}</p>
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-500">Email Address</label>
            <p className="font-medium">{user?.email || 'john.doe@example.com'}</p>
          </div>
          <div>
            <label className="block text-sm text-gray-500">Phone Number</label>
            <p className="font-medium">{user?.phone || '+234 801 234 5678'}</p>
          </div>
          <div>
            <label className="block text-sm text-gray-500">Date of Birth</label>
            <p className="font-medium">January 15, 1990</p>
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Address</h2>
          <button className="text-blue-600 text-sm font-medium">Edit</button>
        </div>
        <div className="space-y-2">
          <p className="font-medium">123 Main Street</p>
          <p className="text-gray-600">Victoria Island</p>
          <p className="text-gray-600">Lagos, Nigeria</p>
        </div>
      </div>

      {/* Linked Accounts */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Linked Accounts</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                🏦
              </div>
              <div className="ml-3">
                <p className="font-medium">GTBank</p>
                <p className="text-sm text-gray-500">****4532</p>
              </div>
            </div>
            <button className="text-red-600 text-sm">Remove</button>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                🏦
              </div>
              <div className="ml-3">
                <p className="font-medium">Access Bank</p>
                <p className="text-sm text-gray-500">****8901</p>
              </div>
            </div>
            <button className="text-red-600 text-sm">Remove</button>
          </div>
          <button className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-blue-600 font-medium hover:border-blue-500">
            + Link New Account
          </button>
        </div>
      </div>

      {/* Account Stats */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Account Statistics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-blue-600">156</p>
            <p className="text-sm text-gray-500">Transactions</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-green-600">NGN 2.5M</p>
            <p className="text-sm text-gray-500">Total Sent</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-purple-600">NGN 1.8M</p>
            <p className="text-sm text-gray-500">Total Received</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-orange-600">12</p>
            <p className="text-sm text-gray-500">Beneficiaries</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
