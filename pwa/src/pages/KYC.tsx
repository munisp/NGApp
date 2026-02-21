import React, { useState } from 'react';

const KYC: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);

  const steps = [
    { id: 1, name: 'Personal Info', status: 'completed' },
    { id: 2, name: 'ID Verification', status: 'current' },
    { id: 3, name: 'Address Proof', status: 'pending' },
    { id: 4, name: 'Selfie', status: 'pending' },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="page-title">KYC Verification</h1>

      {/* Progress */}
      <div className="card">
        <div className="flex items-center justify-between">
          {steps.map((step, i) => (
            <div key={step.id} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                step.status === 'completed' ? 'bg-green-500 text-white' :
                step.status === 'current' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {step.status === 'completed' ? '✓' : step.id}
              </div>
              {i < steps.length - 1 && (
                <div className={`w-12 md:w-24 h-1 mx-2 ${
                  step.status === 'completed' ? 'bg-green-500' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2">
          {steps.map((step) => (
            <p key={step.id} className="text-xs text-gray-500 text-center w-20">{step.name}</p>
          ))}
        </div>
      </div>

      {/* Current Step Content */}
      <div className="card">
        {currentStep === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Personal Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                <input type="text" className="input-field" defaultValue="John" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <input type="text" className="input-field" defaultValue="Doe" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
              <input type="date" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">BVN</label>
              <input type="text" className="input-field" placeholder="11 digit BVN" maxLength={11} />
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">ID Verification</h2>
            <p className="text-gray-600">Upload a valid government-issued ID</p>
            
            <div className="grid grid-cols-2 gap-4">
              {['NIN', 'Passport', 'Driver License', 'Voter Card'].map((type) => (
                <button
                  key={type}
                  className="p-4 border-2 border-gray-200 rounded-lg text-center hover:border-blue-500"
                >
                  <p className="font-medium">{type}</p>
                </button>
              ))}
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <div className="text-4xl mb-2">📄</div>
              <p className="text-gray-600 mb-2">Drag and drop your ID here</p>
              <p className="text-sm text-gray-500">or</p>
              <button className="btn-secondary mt-2">Browse Files</button>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Proof of Address</h2>
            <p className="text-gray-600">Upload a utility bill or bank statement (not older than 3 months)</p>
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <div className="text-4xl mb-2">🏠</div>
              <p className="text-gray-600 mb-2">Upload proof of address</p>
              <button className="btn-secondary mt-2">Browse Files</button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Address</label>
              <textarea className="input-field" rows={3} placeholder="Enter your full address" />
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Selfie Verification</h2>
            <p className="text-gray-600">Take a clear selfie holding your ID</p>
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <div className="text-6xl mb-4">📸</div>
              <p className="text-gray-600 mb-4">Position your face in the frame</p>
              <button className="btn-primary">Take Selfie</button>
            </div>

            <div className="p-4 bg-yellow-50 rounded-lg">
              <h3 className="font-medium text-yellow-800 mb-2">Tips for a good selfie:</h3>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>- Ensure good lighting</li>
                <li>- Hold your ID next to your face</li>
                <li>- Make sure both your face and ID are clearly visible</li>
                <li>- Remove glasses or hats</li>
              </ul>
            </div>
          </div>
        )}

        <div className="flex justify-between mt-6">
          <button
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            className="btn-secondary"
            disabled={currentStep === 1}
          >
            Previous
          </button>
          <button
            onClick={() => setCurrentStep(Math.min(4, currentStep + 1))}
            className="btn-primary"
          >
            {currentStep === 4 ? 'Submit' : 'Continue'}
          </button>
        </div>
      </div>

      {/* Verification Status */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Verification Status</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <div className="flex items-center">
              <span className="text-green-500 mr-2">✓</span>
              <span>Email Verified</span>
            </div>
            <span className="text-sm text-green-600">Completed</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <div className="flex items-center">
              <span className="text-green-500 mr-2">✓</span>
              <span>Phone Verified</span>
            </div>
            <span className="text-sm text-green-600">Completed</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
            <div className="flex items-center">
              <span className="text-yellow-500 mr-2">⏳</span>
              <span>Identity Verification</span>
            </div>
            <span className="text-sm text-yellow-600">In Progress</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KYC;
