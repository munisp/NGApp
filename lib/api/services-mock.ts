// Mock services for development - replace with real API calls later

// ===== Auth Service =====
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  phone: string;
  first_name: string;
  last_name: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

export interface User {
  id: string;
  email: string;
  phone: string;
  first_name: string;
  last_name: string;
  kyc_status: 'pending' | 'verified' | 'rejected';
  created_at: string;
}

export const authService = {
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    // Mock implementation
    return {
      access_token: 'mock_token',
      refresh_token: 'mock_refresh',
      user: {
        id: '1',
        email: data.email,
        phone: '+234',
        first_name: 'John',
        last_name: 'Doe',
        kyc_status: 'verified',
        created_at: new Date().toISOString(),
      },
    };
  },

  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    // Mock implementation
    return {
      access_token: 'mock_token',
      refresh_token: 'mock_refresh',
      user: {
        id: '1',
        email: data.email,
        phone: data.phone,
        first_name: data.first_name,
        last_name: data.last_name,
        kyc_status: 'pending',
        created_at: new Date().toISOString(),
      },
    };
  },

  verifyOTP: async (code: string): Promise<void> => {
    // Mock implementation
  },

  requestOTP: async (): Promise<void> => {
    // Mock implementation
  },

  logout: async (): Promise<void> => {
    // Mock implementation
  },
};

// ===== Account Service =====
export interface Account {
  id: string;
  user_id: string;
  account_number: string;
  account_type: 'checking' | 'savings' | 'wallet';
  balance: number;
  currency: string;
  status: 'active' | 'suspended' | 'closed';
  created_at: string;
}

export interface Transaction {
  id: string;
  account_id: string;
  type: 'deposit' | 'withdrawal' | 'transfer';
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  description: string;
  created_at: string;
}

export const accountService = {
  getAccounts: async (): Promise<Account[]> => {
    // Mock implementation
    return [
      {
        id: '1',
        user_id: '1',
        account_number: '1234567890',
        account_type: 'checking',
        balance: 5000,
        currency: 'USD',
        status: 'active',
        created_at: new Date().toISOString(),
      },
      {
        id: '2',
        user_id: '1',
        account_number: '0987654321',
        account_type: 'savings',
        balance: 10000,
        currency: 'USD',
        status: 'active',
        created_at: new Date().toISOString(),
      },
    ];
  },

  getAccount: async (id: string): Promise<Account> => {
    // Mock implementation
    return {
      id,
      user_id: '1',
      account_number: '1234567890',
      account_type: 'checking',
      balance: 5000,
      currency: 'USD',
      status: 'active',
      created_at: new Date().toISOString(),
    };
  },

  getTransactions: async (accountId: string, limit = 50): Promise<Transaction[]> => {
    // Mock implementation
    return [
      {
        id: '1',
        account_id: accountId,
        type: 'deposit',
        amount: 1000,
        currency: 'USD',
        status: 'completed',
        description: 'Salary deposit',
        created_at: new Date().toISOString(),
      },
      {
        id: '2',
        account_id: accountId,
        type: 'withdrawal',
        amount: 500,
        currency: 'USD',
        status: 'completed',
        description: 'ATM withdrawal',
        created_at: new Date().toISOString(),
      },
    ];
  },

  createAccount: async (type: string): Promise<Account> => {
    // Mock implementation
    return {
      id: '3',
      user_id: '1',
      account_number: '1111222233',
      account_type: type as 'checking' | 'savings' | 'wallet',
      balance: 0,
      currency: 'USD',
      status: 'active',
      created_at: new Date().toISOString(),
    };
  },
};

// ===== Payment Service =====
export interface PaymentMethod {
  id: string;
  user_id: string;
  type: 'card' | 'bank_account' | 'mobile_money';
  provider: string;
  last_four: string;
  is_default: boolean;
  status: 'active' | 'inactive';
}

export interface SendMoneyRequest {
  recipient_id?: string;
  recipient_account?: string;
  amount: number;
  currency: string;
  payment_method_id: string;
  description?: string;
}

export interface Payment {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  type: 'send' | 'receive';
  description: string;
  created_at: string;
}

export interface PaymentRequest {
  from_account_id: string;
  to_account_id?: string;
  to_phone?: string;
  to_email?: string;
  amount: number;
  currency: string;
  description?: string;
}

export interface PaymentResponse {
  id: string;
  status: 'pending' | 'completed' | 'failed';
  transaction_id: string;
}

export const paymentService = {
  getPaymentMethods: async (): Promise<PaymentMethod[]> => {
    // Mock implementation
    return [
      {
        id: '1',
        user_id: '1',
        type: 'card',
        provider: 'Visa',
        last_four: '4242',
        is_default: true,
        status: 'active',
      },
    ];
  },

  addPaymentMethod: async (data: Partial<PaymentMethod>): Promise<PaymentMethod> => {
    // Mock implementation
    return {
      id: '2',
      user_id: '1',
      type: 'card',
      provider: 'Mastercard',
      last_four: '5555',
      is_default: false,
      status: 'active',
      ...data,
    } as PaymentMethod;
  },

  sendMoney: async (data: SendMoneyRequest): Promise<Payment> => {
    // Mock implementation
    return {
      id: '1',
      user_id: '1',
      amount: data.amount,
      currency: data.currency,
      status: 'completed',
      type: 'send',
      description: data.description || 'Payment',
      created_at: new Date().toISOString(),
    };
  },

  getPaymentHistory: async (limit = 50): Promise<Payment[]> => {
    // Mock implementation
    return [
      {
        id: '1',
        user_id: '1',
        amount: 100,
        currency: 'USD',
        status: 'completed',
        type: 'send',
        description: 'Payment to John',
        created_at: new Date().toISOString(),
      },
    ];
  },

  getPayment: async (id: string): Promise<Payment> => {
    // Mock implementation
    return {
      id,
      user_id: '1',
      amount: 100,
      currency: 'USD',
      status: 'completed',
      type: 'send',
      description: 'Payment',
      created_at: new Date().toISOString(),
    };
  },

  sendPayment: async (data: PaymentRequest): Promise<PaymentResponse> => {
    // Mock implementation
    return {
      id: '1',
      status: 'completed',
      transaction_id: 'txn_123',
    };
  },

  getPaymentStatus: async (id: string): Promise<PaymentResponse> => {
    // Mock implementation
    return {
      id,
      status: 'completed',
      transaction_id: 'txn_123',
    };
  },
};

// ===== User Service =====
export interface KYCDocument {
  id: string;
  user_id: string;
  document_type: 'id_card' | 'passport' | 'drivers_license';
  status: 'pending' | 'approved' | 'rejected';
  uploaded_at: string;
}

export interface UploadKYCRequest {
  document_type: string;
  front_image: string; // base64
  back_image?: string; // base64
}

export const userService = {
  getProfile: async (): Promise<User> => {
    // Mock implementation
    return {
      id: '1',
      email: 'user@example.com',
      phone: '+234',
      first_name: 'John',
      last_name: 'Doe',
      kyc_status: 'verified',
      created_at: new Date().toISOString(),
    };
  },

  updateProfile: async (data: Partial<User>): Promise<User> => {
    // Mock implementation
    return {
      id: '1',
      email: 'user@example.com',
      phone: '+234',
      first_name: 'John',
      last_name: 'Doe',
      kyc_status: 'verified',
      created_at: new Date().toISOString(),
      ...data,
    };
  },

  uploadKYC: async (data: UploadKYCRequest): Promise<KYCDocument> => {
    // Mock implementation
    return {
      id: '1',
      user_id: '1',
      document_type: data.document_type as 'id_card' | 'passport' | 'drivers_license',
      status: 'pending',
      uploaded_at: new Date().toISOString(),
    };
  },

  getKYCStatus: async (): Promise<KYCDocument[]> => {
    // Mock implementation
    return [
      {
        id: '1',
        user_id: '1',
        document_type: 'id_card',
        status: 'approved',
        uploaded_at: new Date().toISOString(),
      },
    ];
  },
};

// ===== Notification Service =====
export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  push: boolean;
}

export const notificationService = {
  getPreferences: async (): Promise<NotificationPreferences> => {
    // Mock implementation
    return {
      email: true,
      sms: true,
      push: true,
    };
  },

  updatePreferences: async (data: NotificationPreferences): Promise<void> => {
    // Mock implementation
  },

  registerPushToken: async (token: string): Promise<void> => {
    // Mock implementation
  },
};
