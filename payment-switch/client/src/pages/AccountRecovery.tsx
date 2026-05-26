import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, Shield, CheckCircle2, AlertCircle, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Account Recovery Page
 * 
 * 3-step flow for users who lost access to their authenticator:
 * 1. Select recovery method (email, SMS, or admin review)
 * 2. Enter recovery code (if email/SMS method)
 * 3. Confirm 2FA reset
 */

type RecoveryStep = 'method' | 'code' | 'success';
type RecoveryMethod = 'email' | 'sms' | 'admin';

export default function AccountRecovery() {
  const [, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();
  
  const [step, setStep] = useState<RecoveryStep>('method');
  const [recoveryMethod, setRecoveryMethod] = useState<RecoveryMethod>('email');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [requestId, setRequestId] = useState<number | null>(null);
  const [displayCode, setDisplayCode] = useState<string | null>(null);

  // tRPC mutations
  const initiateRecovery = trpc.accountRecovery.initiateRecovery.useMutation({
    onSuccess: (data) => {
      setRequestId(data.requestId || null);
      setDisplayCode(data.recoveryCode || null);
      
      if (recoveryMethod === 'email') {
        setStep('code');
        toast.success('Recovery code sent to your email');
      } else if (recoveryMethod === 'sms') {
        setStep('code');
        toast.success('Recovery code sent via SMS');
      } else {
        setStep('success');
        toast.success('Recovery request submitted for admin review');
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to initiate recovery');
    },
  });

  const verifyCode = trpc.accountRecovery.verifyRecoveryCode.useMutation({
    onSuccess: (data) => {
      setRequestId(data.requestId || null);
      completeRecovery.mutate({ requestId: data.requestId! });
    },
    onError: (error) => {
      toast.error(error.message || 'Invalid recovery code');
    },
  });

  const completeRecovery = trpc.accountRecovery.completeRecovery.useMutation({
    onSuccess: () => {
      setStep('success');
      toast.success('2FA has been reset successfully');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to complete recovery');
    },
  });

  const handleInitiateRecovery = () => {
    // Validate phone number for SMS
    if (recoveryMethod === 'sms') {
      if (!phoneNumber.trim()) {
        toast.error('Please enter your phone number');
        return;
      }
      // Basic phone validation
      const cleaned = phoneNumber.replace(/\D/g, '');
      if (cleaned.length < 10) {
        toast.error('Please enter a valid phone number');
        return;
      }
    }
    
    initiateRecovery.mutate({ 
      recoveryMethod,
      phoneNumber: recoveryMethod === 'sms' ? phoneNumber : undefined,
    });
  };

  const handleVerifyCode = () => {
    if (!recoveryCode.trim()) {
      toast.error('Please enter the recovery code');
      return;
    }
    verifyCode.mutate({ recoveryCode: recoveryCode.trim().toUpperCase() });
  };

  const handleGoToSettings = () => {
    setLocation('/settings/2fa');
  };

  const handleBackToLogin = () => {
    setLocation('/');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>
              You must be logged in to recover your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleBackToLogin} className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Account Recovery</h1>
          <p className="text-muted-foreground">
            Regain access to your account if you've lost your authenticator device
          </p>
        </div>

        {/* Step 1: Select Recovery Method */}
        {step === 'method' && (
          <Card>
            <CardHeader>
              <CardTitle>Choose Recovery Method</CardTitle>
              <CardDescription>
                Select how you'd like to recover your account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <RadioGroup value={recoveryMethod} onValueChange={(value) => setRecoveryMethod(value as RecoveryMethod)}>
                <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-accent cursor-pointer">
                  <RadioGroupItem value="email" id="email" className="mt-1" />
                  <Label htmlFor="email" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2 mb-1">
                      <Mail className="h-5 w-5 text-primary" />
                      <span className="font-semibold">Email Recovery</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      We'll send a recovery code to your registered email address. This is the fastest method.
                    </p>
                  </Label>
                </div>

                <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-accent cursor-pointer">
                  <RadioGroupItem value="sms" id="sms" className="mt-1" />
                  <Label htmlFor="sms" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2 mb-1">
                      <Smartphone className="h-5 w-5 text-primary" />
                      <span className="font-semibold">SMS Recovery</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      We'll send a recovery code to your phone via text message. Fast and convenient.
                    </p>
                  </Label>
                </div>

                <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-accent cursor-pointer">
                  <RadioGroupItem value="admin" id="admin" className="mt-1" />
                  <Label htmlFor="admin" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2 mb-1">
                      <Shield className="h-5 w-5 text-primary" />
                      <span className="font-semibold">Admin Review</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Submit a request for admin review. This may take 24-48 hours but provides additional security.
                    </p>
                  </Label>
                </div>
              </RadioGroup>

              {user.email && recoveryMethod === 'email' && (
                <Alert>
                  <Mail className="h-4 w-4" />
                  <AlertDescription>
                    Recovery code will be sent to: <strong>{user.email}</strong>
                  </AlertDescription>
                </Alert>
              )}

              {!user.email && recoveryMethod === 'email' && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No email address on file. Please use SMS or admin review method.
                  </AlertDescription>
                </Alert>
              )}

              {recoveryMethod === 'sms' && (
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Enter your phone number with country code (e.g., +1 for US)
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  onClick={handleBackToLogin}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleInitiateRecovery}
                  disabled={initiateRecovery.isPending || (recoveryMethod === 'email' && !user.email)}
                  className="flex-1"
                >
                  {initiateRecovery.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Enter Recovery Code (Email Method Only) */}
        {step === 'code' && (
          <Card>
            <CardHeader>
              <CardTitle>Enter Recovery Code</CardTitle>
              <CardDescription>
                Check your email for the recovery code we just sent
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {displayCode && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Development Mode:</strong> Your recovery code is: <code className="font-mono font-bold text-lg">{displayCode}</code>
                    <br />
                    <span className="text-xs text-muted-foreground">
                      (In production, this will be sent via email)
                    </span>
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="recoveryCode">Recovery Code</Label>
                <Input
                  id="recoveryCode"
                  placeholder="XXXX-XXXX-XXXX"
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                  maxLength={14}
                  className="text-center text-lg font-mono tracking-wider"
                />
                <p className="text-xs text-muted-foreground">
                  Enter the 12-character code from your email. The code expires in 24 hours.
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => setStep('method')}
                  variant="outline"
                  className="flex-1"
                  disabled={verifyCode.isPending || completeRecovery.isPending}
                >
                  Back
                </Button>
                <Button
                  onClick={handleVerifyCode}
                  disabled={verifyCode.isPending || completeRecovery.isPending || !recoveryCode.trim()}
                  className="flex-1"
                >
                  {(verifyCode.isPending || completeRecovery.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Verify Code
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Success */}
        {step === 'success' && (
          <Card>
            <CardHeader>
              <div className="flex justify-center mb-4">
                <div className="rounded-full bg-green-100 p-3">
                  <CheckCircle2 className="h-12 w-12 text-green-600" />
                </div>
              </div>
              <CardTitle className="text-center">
                {recoveryMethod === 'email' ? '2FA Reset Complete' : 'Request Submitted'}
              </CardTitle>
              <CardDescription className="text-center">
                {recoveryMethod === 'email'
                  ? 'Your two-factor authentication has been successfully reset'
                  : 'Your recovery request has been submitted for admin review'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {recoveryMethod === 'email' ? (
                <>
                  <Alert>
                    <AlertDescription>
                      You can now set up two-factor authentication again from your security settings.
                      We recommend doing this as soon as possible to keep your account secure.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-3">
                    <Button onClick={handleGoToSettings} className="w-full">
                      Go to Security Settings
                    </Button>
                    <Button onClick={handleBackToLogin} variant="outline" className="w-full">
                      Back to Dashboard
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Alert>
                    <AlertDescription>
                      An administrator will review your request within 24-48 hours. You'll receive an email
                      notification once your request has been processed.
                    </AlertDescription>
                  </Alert>

                  <Button onClick={handleBackToLogin} className="w-full">
                    Back to Dashboard
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Help Text */}
        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>
            Need additional help?{' '}
            <a href="mailto:support@example.com" className="text-primary hover:underline">
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
