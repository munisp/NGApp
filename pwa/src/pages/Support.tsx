import React, { useState } from 'react';

const Support: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState('');

  const faqs = [
    { q: 'How do I send money?', a: 'Go to Send Money, enter recipient details, amount, and confirm the transfer.' },
    { q: 'What are the transfer limits?', a: 'Daily limit is NGN 5,000,000. You can increase this by completing KYC verification.' },
    { q: 'How long do transfers take?', a: 'Domestic transfers are instant. International transfers take 1-3 business days.' },
    { q: 'How do I verify my account?', a: 'Go to KYC Verification in your profile and follow the steps to upload your documents.' },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="page-title">Help & Support</h1>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: '💬', label: 'Live Chat', action: 'chat' },
          { icon: '📧', label: 'Email Us', action: 'email' },
          { icon: '📞', label: 'Call Us', action: 'call' },
          { icon: '📖', label: 'Help Center', action: 'help' },
        ].map((item) => (
          <button
            key={item.action}
            className="card text-center py-6 hover:shadow-md transition-shadow"
          >
            <span className="text-3xl">{item.icon}</span>
            <p className="text-sm font-medium mt-2">{item.label}</p>
          </button>
        ))}
      </div>

      {/* Contact Form */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Send us a message</h2>
        <form className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="input-field"
            >
              <option value="">Select a category</option>
              <option value="transaction">Transaction Issue</option>
              <option value="account">Account Problem</option>
              <option value="kyc">KYC Verification</option>
              <option value="card">Card Issue</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <input type="text" className="input-field" placeholder="Brief description of your issue" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea
              className="input-field"
              rows={4}
              placeholder="Describe your issue in detail..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Attachment (optional)</label>
            <input type="file" className="input-field" />
          </div>
          <button type="submit" className="btn-primary w-full">
            Submit Request
          </button>
        </form>
      </div>

      {/* FAQs */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Frequently Asked Questions</h2>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <details key={i} className="p-4 bg-gray-50 rounded-lg">
              <summary className="font-medium cursor-pointer">{faq.q}</summary>
              <p className="mt-2 text-gray-600">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>

      {/* Contact Info */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Contact Information</h2>
        <div className="space-y-3">
          <div className="flex items-center">
            <span className="text-xl mr-3">📧</span>
            <div>
              <p className="font-medium">Email</p>
              <p className="text-gray-600">support@remittance.com</p>
            </div>
          </div>
          <div className="flex items-center">
            <span className="text-xl mr-3">📞</span>
            <div>
              <p className="font-medium">Phone</p>
              <p className="text-gray-600">+234 800 123 4567</p>
            </div>
          </div>
          <div className="flex items-center">
            <span className="text-xl mr-3">🕐</span>
            <div>
              <p className="font-medium">Hours</p>
              <p className="text-gray-600">24/7 Support Available</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Support;
