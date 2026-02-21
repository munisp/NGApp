import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Provider } from 'react-redux';
import { store } from './store';
import { UPIPayment } from './features/upi/UPIPayment';
import { MultiCurrencyWallet } from './features/multi-currency/MultiCurrencyWallet';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <Router>
          <div className="min-h-screen bg-gray-100">
            <Routes>
              <Route path="/payments/upi" element={<UPIPayment amount={1000} currency="INR" recipientUPI="test@upi" onSuccess={() => {}} onError={() => {}} />} />
              <Route path="/wallet" element={<MultiCurrencyWallet />} />
            </Routes>
          </div>
        </Router>
      </Provider>
    </QueryClientProvider>
  );
};
