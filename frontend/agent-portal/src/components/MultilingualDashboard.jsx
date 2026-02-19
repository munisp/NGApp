/**
 * Multi-lingual Agent Banking Dashboard
 * Example implementation with Nigerian languages support
 */

import React, { useState } from 'react';
import { TranslationProvider, useTranslation, LanguageSelector } from '../../../shared/useTranslation';

function DashboardContent() {
  const { t, language } = useTranslation('agent_banking');
  const { t: tCommon } = useTranslation('common');
  const { t: tMessages } = useTranslation('messages');
  
  const [balance] = useState(10500.00);
  const [transactions] = useState([
    { id: 1, type: 'deposit', amount: 5000, date: '2025-10-14' },
    { id: 2, type: 'withdrawal', amount: 2000, date: '2025-10-13' },
    { id: 3, type: 'transfer', amount: 1500, date: '2025-10-12' }
  ]);

  return (
    <div className="dashboard">
      {/* Header with Language Selector */}
      <header className="dashboard-header">
        <h1>{t('dashboard')}</h1>
        <div className="header-actions">
          <LanguageSelector className="language-dropdown" />
          <button className="profile-btn">{tCommon('profile')}</button>
        </div>
      </header>

      {/* Balance Card */}
      <div className="balance-card">
        <h2>{t('balance')}</h2>
        <div className="balance-amount">
          ₦{balance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <button className="action-btn deposit">
          <span className="icon">💰</span>
          <span className="text">{t('deposit')}</span>
        </button>
        <button className="action-btn withdrawal">
          <span className="icon">💸</span>
          <span className="text">{t('withdrawal')}</span>
        </button>
        <button className="action-btn transfer">
          <span className="icon">📤</span>
          <span className="text">{t('transfer')}</span>
        </button>
        <button className="action-btn customers">
          <span className="icon">👥</span>
          <span className="text">{t('customers')}</span>
        </button>
      </div>

      {/* Transaction History */}
      <div className="transactions-section">
        <h2>{t('transaction_history')}</h2>
        <table className="transactions-table">
          <thead>
            <tr>
              <th>{tCommon('type')}</th>
              <th>{tCommon('amount')}</th>
              <th>{tCommon('date')}</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map(tx => (
              <tr key={tx.id}>
                <td>{t(tx.type)}</td>
                <td>₦{tx.amount.toLocaleString('en-NG')}</td>
                <td>{tx.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Commission Info */}
      <div className="commission-card">
        <h3>{t('commission')}</h3>
        <p>{tMessages('loading')}</p>
      </div>

      <style jsx>{`
        .dashboard {
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
        }

        .header-actions {
          display: flex;
          gap: 15px;
        }

        .language-dropdown {
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }

        .balance-card {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px;
          border-radius: 12px;
          margin-bottom: 30px;
        }

        .balance-amount {
          font-size: 36px;
          font-weight: bold;
          margin-top: 10px;
        }

        .quick-actions {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin-bottom: 30px;
        }

        .action-btn {
          padding: 20px;
          border: none;
          border-radius: 8px;
          background: white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          cursor: pointer;
          transition: transform 0.2s;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }

        .action-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }

        .action-btn .icon {
          font-size: 32px;
        }

        .action-btn .text {
          font-size: 16px;
          font-weight: 500;
        }

        .transactions-section {
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          margin-bottom: 30px;
        }

        .transactions-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 15px;
        }

        .transactions-table th,
        .transactions-table td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #eee;
        }

        .transactions-table th {
          background: #f8f9fa;
          font-weight: 600;
        }

        .commission-card {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
        }
      `}</style>
    </div>
  );
}

export default function MultilingualDashboard() {
  return (
    <TranslationProvider module="agent_banking" defaultLanguage="en">
      <DashboardContent />
    </TranslationProvider>
  );
}

