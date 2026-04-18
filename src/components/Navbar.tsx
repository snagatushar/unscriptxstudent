import { useState, useEffect, memo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, LogOut, User, LayoutDashboard, ChevronDown } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useAuth } from '../contexts/AuthContext';

const navLinks = [
  { name: 'Home', path: '/' },
  { name: 'Events', path: '/events' },
  { name: 'About', path: '/about' },
  { name: 'Contact', path: '/contact' },
];

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const { user, profile, signOut, isLoading } = useAuth();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsOpen(false);
    setIsProfileOpen(false);
  }, [location.pathname]);

  const showRegisteredEventsShortcut = !!profile && profile.role === 'user';
  const isAdminArea =
    location.pathname === '/admin/login' ||
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/payments') ||
    location.pathname.startsWith('/content');

  const hideAuthActionsOnPage = location.pathname === '/login';

  if (isAdminArea) {
    return null;
  }

  const showUserActions = !isLoading && !!user;
  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Profile';
  const showDashboardShortcut = !!profile && profile.role !== 'user';

  return (
    <nav className={cn(
      "fixed top-0 left-0 right-0 z-50 transition-all duration-300 px-6 py-4",
      scrolled ? "glass py-3" : "bg-transparent"
    )}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link to="/" className="group flex items-center justify-center">
          <img
            src="/logo.png"
            alt="UNSCRIPTX Logo"
            width="160"
            height="80"
            fetchPriority="high"
            loading="eager"
            decoding="async"
            className="w-40 h-20 object-contain filter invert contrast-125 mix-blend-screen drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]"
          />
        </Link>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              to={link.path}
              className="relative group text-sm font-medium uppercase tracking-widest text-white/80 hover:text-white transition-colors"
            >
              {link.name}
              <motion.span
                className="absolute -bottom-1 left-0 w-0 h-0.5 bg-fest-primary transition-all group-hover:w-full"
                initial={false}
                animate={{ width: location.pathname === link.path ? '100%' : '0%' }}
              />
            </Link>
          ))}

          {showRegisteredEventsShortcut && (
            <Link
              to="/dashboard"
              className="relative group text-sm font-medium uppercase tracking-widest text-white/80 hover:text-white transition-colors"
            >
              Registered Events
              <motion.span
                className="absolute -bottom-1 left-0 w-0 h-0.5 bg-fest-primary transition-all group-hover:w-full"
                initial={false}
                animate={{ width: location.pathname === '/dashboard' ? '100%' : '0%' }}
              />
            </Link>
          )}


          {hideAuthActionsOnPage ? null : showUserActions ? (
            <div className="relative">
              <button
                onClick={() => setIsProfileOpen((current) => !current)}
                className="flex items-center gap-3 px-4 py-2 bg-fest-primary hover:bg-fest-primary-light text-fest-dark text-sm font-bold rounded-full transition-all glow-primary"
              >
                <span className="w-8 h-8 rounded-full bg-fest-dark text-fest-primary flex items-center justify-center">
                  <User size={16} />
                </span>
                <span className="max-w-32 truncate">{displayName}</span>
                <ChevronDown size={16} />
              </button>

              {isProfileOpen && (
                <div className="absolute right-0 top-full mt-3 w-64 rounded-3xl border border-white/10 bg-[#111]/95 backdrop-blur-xl shadow-2xl p-4">
                  <div className="px-2 pb-3 border-b border-white/10">
                    <div className="font-bold text-white">{displayName}</div>
                    <div className="text-xs text-white/45 mt-1">{user?.email}</div>
                  </div>

                  <div className="pt-3 space-y-2">
                    {showDashboardShortcut && (

                      <div className="space-y-1">
                        {profile?.role === 'admin' && (
                          <Link
                            to="/admin"
                            className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-white/5 text-white/80 text-sm font-medium transition-colors"
                          >
                            <LayoutDashboard size={16} /> System Admin
                          </Link>
                        )}
                        {(profile?.role === 'admin' || profile?.role === 'content_reviewer' || profile?.role === 'payment_reviewer') && (
                          <>
                            <Link
                              to="/content"
                              className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-white/5 text-white/80 text-sm font-medium transition-colors"
                            >
                              <LayoutDashboard size={16} /> Judging Dashboard
                            </Link>
                            <Link
                              to="/payments"
                              className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-white/5 text-white/80 text-sm font-medium transition-colors"
                            >
                              <LayoutDashboard size={16} /> Payment Review
                            </Link>
                          </>
                        )}
                      </div>
                    )}
                    <button
                      onClick={async () => {
                        setIsProfileOpen(false);
                        await signOut();
                      }}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-red-500/10 text-red-300 text-sm font-medium transition-colors"
                    >
                      <LogOut size={16} /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className="px-6 py-2 bg-fest-primary hover:bg-fest-primary-light text-fest-dark text-sm font-bold uppercase tracking-widest rounded-full transition-all glow-primary"
            >
              Login/Signup
            </Link>
          )}
        </div>

        {/* Mobile Toggle */}
        <button className="md:hidden text-white" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-full left-0 right-0 glass border-t-0 p-6 flex flex-col gap-6 md:hidden"
          >
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.path}
                onClick={() => setIsOpen(false)}
                className="text-lg font-display font-medium text-white/90"
              >
                {link.name}
              </Link>
            ))}

            {showRegisteredEventsShortcut && (
              <Link
                to="/dashboard"
                onClick={() => setIsOpen(false)}
                className="text-lg font-display font-medium text-white/90"
              >
                Registered Events
              </Link>
            )}


            {hideAuthActionsOnPage ? null : showUserActions ? (
              <div className="flex flex-col gap-4">
                <div className="glass rounded-2xl p-4 text-center">
                  <div className="text-sm font-bold text-white">{displayName}</div>
                  <div className="text-xs text-white/40 mt-1">{user?.email}</div>
                </div>
                {showDashboardShortcut && (
                  <div className="space-y-2">
                    {profile?.role === 'admin' && (
                      <Link
                        to="/admin"
                        onClick={() => setIsOpen(false)}
                        className="w-full py-3 flex justify-center items-center gap-2 bg-fest-primary text-center text-fest-dark font-bold uppercase tracking-widest rounded-xl"
                      >
                        <LayoutDashboard size={18} /> System Admin
                      </Link>
                    )}
                    {(profile?.role === 'admin' || profile?.role === 'content_reviewer' || profile?.role === 'payment_reviewer') && (
                      <>
                        <Link
                          to="/content"
                          onClick={() => setIsOpen(false)}
                          className="w-full py-3 flex justify-center items-center gap-2 bg-fest-primary text-center text-fest-dark font-bold uppercase tracking-widest rounded-xl"
                        >
                          <User size={18} /> Judging Dashboard
                        </Link>
                        <Link
                          to="/payments"
                          onClick={() => setIsOpen(false)}
                          className="w-full py-3 flex justify-center items-center gap-2 bg-fest-primary text-center text-fest-dark font-bold uppercase tracking-widest rounded-xl"
                        >
                          <LayoutDashboard size={18} /> Payment Review
                        </Link>
                      </>
                    )}
                  </div>
                )}
                <button
                  onClick={() => { signOut(); setIsOpen(false); }}
                  className="w-full py-3 flex justify-center items-center gap-2 glass text-white font-bold uppercase tracking-widest rounded-xl text-sm"
                >
                  <LogOut size={16} /> Logout
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                onClick={() => setIsOpen(false)}
                className="w-full py-3 bg-fest-primary text-center text-fest-dark font-bold uppercase tracking-widest rounded-xl"
              >
                Login/Signup
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default memo(Navbar);
