import { motion } from 'motion/react';
import React, { useEffect, useState } from 'react';
import { Mail, Lock, User, ArrowRight } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

const DISPOSABLE_DOMAINS = [
  'temp-mail.org', '10minutemail.com', 'guerrillamail.com', 'mailproweb.com',
  'sharklasers.com', 'dispostable.com', 'getairmail.com', 'tempmail.com',
  'maildrop.cc', 'yopmail.com', 'mailinator.com', 'trashmail.com',
  'tempmail.net', 'temp-mail.io', 'dropmail.me', '10minutemail.net'
];

async function isBlockedEmail(email: string): Promise<boolean> {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return true;
  if (DISPOSABLE_DOMAINS.includes(domain)) return true;
  return false; 
}

function getAuthErrorMessage(err: any) {
  const message = err?.message || '';

  if (message.toLowerCase().includes('failed to fetch')) {
    return 'Could not reach server. Check your internet connection.';
  }

  return message || 'Authentication failed';
}

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, isLoading } = useAuth();
  const nextPath = (location.state as { from?: string } | null)?.from;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gToken = params.get('token');
    const gError = params.get('error');

    if (gToken) {
      localStorage.setItem('unscriptx_token', gToken);
      // Dispatch custom event so AuthContext knows to re-fetch
      window.dispatchEvent(new Event('unscriptx_auth_change'));
      toast.success('Successfully logged in with Google!');
      
      // Clean up URL and navigate
      window.history.replaceState({}, document.title, '/login');
      const target = nextPath && nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/';
      navigate(target, { replace: true });
      return;
    }

    if (gError) {
      toast.error(gError);
      window.history.replaceState({}, document.title, '/login');
    }

    if (isLoading || !user) return;
    const isSafeRedirect = nextPath && nextPath.startsWith('/') && !nextPath.startsWith('//');
    navigate(isSafeRedirect ? nextPath : '/', { replace: true });
  }, [user, isLoading, navigate, nextPath]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const action = isLogin ? 'login' : 'signup';
      if (!isLogin && !name.trim()) throw new Error('Name is required for signup');
      if (!isLogin && await isBlockedEmail(email)) throw new Error('Temporary or disposable emails are not allowed.');

      const response = await fetch(`/api/auth-hub?action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Authentication failed');

      localStorage.setItem('unscriptx_token', data.token);
      
      toast.success(isLogin ? 'Successfully logged in!' : 'Signup successful! Welcome to UNSCRIPTX.');
      if (!isLogin) {
        setIsLogin(true);
      } else {
        // Trigger a reload or context refetch since we rely on token now
        window.location.reload();
      }
    } catch (err: any) {
      toast.error(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="pt-32 pb-24 px-6 min-h-screen flex items-center justify-center relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-fest-primary/10 blur-[120px] -z-10" />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full glass p-8 md:p-12 rounded-[3rem] relative"
      >
        <div className="text-center mb-10">
          <h2 className="text-4xl font-display font-extrabold tracking-tighter mb-2">
            {isLogin ? 'WELCOME BACK' : 'JOIN THE FEST'}
          </h2>
          <p className="text-white/40 text-sm uppercase tracking-widest">
            {isLogin ? 'Login to your account' : 'Create a new account'}
          </p>
        </div>

        <form className="space-y-6" onSubmit={handleAuth}>
          {!isLogin && (
            <div className="relative group">
              <User className="absolute left-0 top-3 text-white/20 group-focus-within:text-fest-primary transition-colors" size={18} />
              <input
                type="text"
                placeholder="Full Name"
                required={!isLogin}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-transparent border-b-2 border-white/10 pl-8 py-3 focus:outline-none focus:border-fest-primary transition-colors text-white placeholder:text-white/20"
              />
            </div>
          )}
          
          <div className="relative group">
            <Mail className="absolute left-0 top-3 text-white/20 group-focus-within:text-fest-primary transition-colors" size={18} />
            <input
              type="email"
              placeholder="Email Address"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-transparent border-b-2 border-white/10 pl-8 py-3 focus:outline-none focus:border-fest-primary transition-colors text-white placeholder:text-white/20"
            />
          </div>

          <div className="relative group">
            <Lock className="absolute left-0 top-3 text-white/20 group-focus-within:text-fest-primary transition-colors" size={18} />
            <input
              type="password"
              placeholder="Password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent border-b-2 border-white/10 pl-8 py-3 focus:outline-none focus:border-fest-primary transition-colors text-white placeholder:text-white/20"
            />
          </div>

          {isLogin && (
            <div className="text-right">
              <button 
                type="button" 
                onClick={async () => {
                  if (!email.trim()) {
                    toast.error('Enter your email address first, then click Forgot Password.');
                    return;
                  }
                  try {
                    const response = await fetch('/api/auth-hub?action=reset-password', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ email: email.trim() })
                    });
                    if (!response.ok) throw new Error('Reset request failed');
                    toast.success('Password reset link sent to your email (simulated)!');
                  } catch (err: any) {
                    toast.error(err.message || 'Could not send reset email.');
                  }
                }}
                className="text-xs text-white/40 hover:text-fest-primary transition-colors uppercase tracking-widest font-bold"
              >
                Forgot Password?
              </button>
            </div>
          )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-fest-primary hover:bg-fest-primary-light text-black font-bold py-4 rounded-xl transition-all duration-300 transform active:scale-[0.98] flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  {isLogin ? 'Log In' : 'Create Account'}
                  <ArrowRight className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>

            <div className="relative my-10">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/5"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-black">
                <span className="bg-[#050B18] px-4 text-white/20">or continue with</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                window.location.href = '/api/auth-hub?action=user-google-login';
              }}
              className="w-full py-4 bg-white/5 border border-white/10 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-white/10 hover:border-white/20 transition-all flex items-center justify-center gap-3 group"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Login with Google
            </button>
        </form>

        <div className="mt-10 text-center relative z-10">
          <p className="text-white/40 text-sm">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
            <button
              onClick={() => setIsLogin(!isLogin)}
              type="button"
              className="text-fest-primary font-bold hover:underline"
            >
              {isLogin ? 'Sign Up' : 'Login'}
            </button>
          </p>
        </div>
      </motion.div>
    </main>
  );
}
