import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function ConfirmEmailPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleEmailConfirmation = async () => {
      try {
        // Get the hash fragment from the URL (where Supabase stores the token)
        const hashFragment = window.location.hash.slice(1); // Remove #
        
        if (!hashFragment) {
          setError('No confirmation token found');
          setLoading(false);
          return;
        }

        // Supabase auth will automatically handle the hash fragment
        // and create a session from the confirmation token
        const { data, error } = await supabase.auth.getSession();
        
        if (error) throw error;

        if (data.session) {
          toast({
            title: 'Email Confirmed!',
            description: 'Your email has been verified successfully.',
          });
          
          // Redirect to dashboard
          setTimeout(() => {
            navigate('/dashboard');
          }, 1500);
        } else {
          setError('Confirmation failed. Please try signing in again.');
        }
      } catch (err: any) {
        console.error('Email confirmation error:', err);
        setError(err.message || 'Failed to confirm email');
        toast({
          title: 'Confirmation Error',
          description: err.message || 'Failed to confirm your email',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    handleEmailConfirmation();
  }, [navigate, toast]);

  return (
    <div className="auth-container">
      <div className="auth-box">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary text-primary-foreground font-bold text-xl mb-4">
            HR
          </div>
          <h1 className="text-2xl font-bold text-foreground">TalentAI</h1>
          <p className="text-muted-foreground mt-1">Email Confirmation</p>
        </div>

        <Card className="auth-card">
          <CardHeader className="auth-card-header">
            <CardTitle>
              {loading ? 'Confirming Email...' : error ? 'Confirmation Failed' : 'Email Confirmed'}
            </CardTitle>
            <CardDescription>
              {loading
                ? 'Please wait while we verify your email address'
                : error
                ? 'There was an issue confirming your email'
                : 'Your email has been verified successfully'}
            </CardDescription>
          </CardHeader>
          <CardContent className="auth-card-content">
            {loading && (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            )}
            
            {error && (
              <div className="space-y-4">
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
                <button
                  onClick={() => navigate('/login')}
                  className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Back to Sign In
                </button>
              </div>
            )}

            {!loading && !error && (
              <div className="space-y-4 text-center">
                <p className="text-sm text-muted-foreground">Redirecting to dashboard...</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
