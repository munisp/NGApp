import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import Layout from './components/Layout';
import LoadingSpinner from './components/LoadingSpinner';

const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Wallet = lazy(() => import('./pages/Wallet'));
const SendMoney = lazy(() => import('./pages/SendMoney'));
const ReceiveMoney = lazy(() => import('./pages/ReceiveMoney'));
const Transactions = lazy(() => import('./pages/Transactions'));
const ExchangeRates = lazy(() => import('./pages/ExchangeRates'));
const Airtime = lazy(() => import('./pages/Airtime'));
const BillPayment = lazy(() => import('./pages/BillPayment'));
const VirtualAccount = lazy(() => import('./pages/VirtualAccount'));
const Cards = lazy(() => import('./pages/Cards'));
const KYC = lazy(() => import('./pages/KYC'));
const Settings = lazy(() => import('./pages/Settings'));
const Profile = lazy(() => import('./pages/Profile'));
const Support = lazy(() => import('./pages/Support'));

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="wallet" element={<Wallet />} />
          <Route path="send" element={<SendMoney />} />
          <Route path="receive" element={<ReceiveMoney />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="exchange-rates" element={<ExchangeRates />} />
          <Route path="airtime" element={<Airtime />} />
          <Route path="bills" element={<BillPayment />} />
          <Route path="virtual-account" element={<VirtualAccount />} />
          <Route path="cards" element={<Cards />} />
          <Route path="kyc" element={<KYC />} />
          <Route path="settings" element={<Settings />} />
          <Route path="profile" element={<Profile />} />
          <Route path="support" element={<Support />} />
        </Route>
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

export default App;
