import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import '@/styles/auth.css';
// styles for global.css
// import '@/styles/global.css';

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function LoginPage() {
  const { user, signIn, signUp, resetPassword, loading, demoLogin } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [submitting, setSubmitting] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === 'forgot') {
        const { error } = await resetPassword(email);
        if (error) throw error;
        toast({ title: 'Check your email', description: 'Password reset link has been sent.' });
        setMode('login');
      } else if (mode === 'signup') {
        const { error } = await signUp(email, password);
        if (error) throw error;
        setSignupSuccess(true);
        toast({ title: 'Account created!', description: 'Please check your email to confirm your account. Click the link in the confirmation email to complete signup.' });
      } else {
        // Try Supabase authentication first
        const { error } = await signIn(email, password);
        if (error) {
          // If Supabase is not configured, show proper error
          if (error.message.includes('Invalid API key') || error.message.includes('Missing environment variable')) {
            toast({
              title: 'Supabase Not Configured',
              description: 'Please set up VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in your .env file, or use demo mode.',
              variant: 'destructive'
            });
          } else {
            // Show actual authentication error
            throw error;
          }
        }
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Authentication failed', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary text-primary-foreground font-bold text-xl mb-4">
            HR
          </div>
          <h1 className="text-2xl font-bold text-foreground">TalentAI</h1>
          <p className="text-muted-foreground mt-1">AI-Powered Applicant Tracking System</p>
        </div>

        <Card className="auth-card">
          <CardHeader className="auth-card-header">
            <CardTitle>
              {mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Reset Password'}
            </CardTitle>
            <CardDescription>
              {mode === 'login'
                ? 'Enter your credentials to access the HR portal'
                : mode === 'signup'
                  ? 'Create your HR account to get started'
                  : 'Enter your email to receive a reset link'}
            </CardDescription>
          </CardHeader>
          <CardContent className="auth-card-content">
            {signupSuccess ? (
              <div className="space-y-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm font-medium text-green-800 mb-2">✓ Account created successfully!</p>
                  <p className="text-sm text-green-700">A confirmation email has been sent to <strong>{email}</strong></p>
                </div>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                  <p className="text-sm font-medium text-blue-800">Next steps:</p>
                  <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                    <li>Check your email inbox</li>
                    <li>Click the "Confirm your email" link</li>
                    <li>You'll be automatically logged in</li>
                  </ol>
                </div>
                <Button
                  onClick={() => {
                    setSignupSuccess(false);
                    setMode('login');
                    setEmail('');
                    setPassword('');
                  }}
                  variant="outline"
                  className="w-full"
                >
                  Back to Sign In
                </Button>
              </div>
            ) : (
              <>
                <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
                  <input type="text" name="fakeusernameremembered" style={{ display: "none" }} />
                  <input type="password" name="fakepasswordremembered" style={{ display: "none" }} />
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="text"
                      placeholder="Enter your mail"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      autoComplete="off"
                      readOnly
                      onFocus={e => e.target.removeAttribute('readonly')}
                      required
                    />
                  </div>
                  {mode !== 'forgot' && (
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        name="user_email"
                        type="password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        autoComplete="new-password"
                        readOnly
                        onFocus={e => e.target.removeAttribute('readonly')}
                        required
                        minLength={6}
                      />
                    </div>
                  )}
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting
                      ? 'Please wait...'
                      : mode === 'login'
                        ? 'Sign In'
                        : mode === 'signup'
                          ? 'Create Account'
                          : 'Send Reset Link'}
                  </Button>
                </form>

                <div className="mt-4 text-center text-sm space-y-2">
                  {mode === 'login' && (
                    <>
                      <button onClick={() => setMode('forgot')} className="text-primary hover:underline block w-full">
                        Forgot password?
                      </button>
                      <p className="text-muted-foreground">
                        Don't have an account?{' '}
                        <button onClick={() => setMode('signup')} className="text-primary hover:underline">
                          Sign up
                        </button>
                      </p>

                    </>
                  )}
                  {mode !== 'login' && (
                    <button onClick={() => setMode('login')} className="text-primary hover:underline">
                      Back to sign in
                    </button>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
