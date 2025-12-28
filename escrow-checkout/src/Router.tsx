import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import { EscrowDetail } from './features/escrow/EscrowDetail';
import { DisputeForm } from './features/dispute/DisputeForm';
import { RefundRequest } from './features/refund/RefundRequest';
import { AgentCashFlow } from './features/agent/AgentCashFlow';
import { MarketplaceSearch } from './features/marketplace/MarketplaceSearch';

// Lazy load less common routes
// const AdminDashboard = lazy(() => import('./features/admin/AdminDashboard'));
// const KYCUpgrade = lazy(() => import('./features/kyc/KYCUpgrade'));
// const SellerStorefront = lazy(() => import('./features/marketplace/SellerStorefront'));

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Main checkout flow (legacy) */}
        <Route path="/" element={<App />} />
        
        {/* Escrow routes */}
        <Route path="/escrow/:escrowId" element={<EscrowDetail />} />
        <Route path="/escrow/:escrowId/pay" element={<App />} />
        <Route path="/escrow/:escrowId/accept" element={<App />} />
        <Route path="/escrow/:escrowId/ship" element={<App />} />
        <Route path="/escrow/:escrowId/track" element={<EscrowDetail />} />
        <Route path="/escrow/:escrowId/confirm" element={<App />} />
        
        {/* Dispute routes */}
        <Route path="/dispute/new" element={<DisputeForm />} />
        <Route path="/dispute/:disputeId" element={<DisputeForm />} />
        
        {/* Refund routes */}
        <Route path="/refund/request" element={<RefundRequest />} />
        <Route path="/refund/:refundId" element={<RefundRequest />} />
        
        {/* Agent cash routes */}
        <Route path="/agent/cash" element={<AgentCashFlow />} />
        <Route path="/agent/cash-in" element={<AgentCashFlow />} />
        <Route path="/agent/cash-out" element={<AgentCashFlow />} />
        
        {/* Marketplace routes */}
        <Route path="/marketplace" element={<MarketplaceSearch />} />
        <Route path="/marketplace/search" element={<MarketplaceSearch />} />
        <Route path="/listing/:listingId" element={<App />} />
        <Route path="/seller/:sellerId" element={<App />} />
        <Route path="/storefront/:sellerId" element={<App />} />
        
        {/* KYC routes */}
        <Route path="/kyc/upgrade" element={<App />} />
        <Route path="/kyc/status" element={<App />} />
        
        {/* Payout routes */}
        <Route path="/payout/:payoutId" element={<App />} />
        
        {/* Admin routes */}
        <Route path="/admin" element={<App />} />
        <Route path="/admin/dashboard" element={<App />} />
        <Route path="/admin/audit/:resourceType/:resourceId" element={<App />} />
        
        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;
