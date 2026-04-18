import { HashRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { lazy, Suspense, useEffect, memo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Background from './components/Background';
import Home from './pages/Home';
import ProtectedRoute from './components/ProtectedRoute';

// Lazy load ALL non-critical pages for faster initial load
const Events = lazy(() => import('./pages/Events'));
const EventDetail = lazy(() => import('./pages/EventDetail'));
const Register = lazy(() => import('./pages/Register'));
// const Register = lazy(() => import('./pages/Register'));
const Rules = lazy(() => import('./pages/Rules'));
const About = lazy(() => import('./pages/About'));
const Contact = lazy(() => import('./pages/Contact'));
const Login = lazy(() => import('./pages/Login'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const UserDashboard = lazy(() => import('./pages/UserDashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const PaymentReviewDashboard = lazy(() => import('./pages/PaymentReviewDashboard'));
const ContentReviewDashboard = lazy(() => import('./pages/ContentReviewDashboard'));

function PageLoader() {
  return (
    <div className="fixed inset-0 z-[100] bg-fest-dark flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-fest-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}

// Layout component to handle scroll restoration properly
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function AnimatedRoutes() {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.4, ease: "easeInOut" }}
      >
        <Suspense fallback={<PageLoader />}>
          <Routes location={location}>
            <Route path="/" element={<Home />} />
            <Route path="/events" element={<Events />} />
            <Route path="/events/:id" element={<EventDetail />} />
            <Route path="/register/:eventId" element={<ProtectedRoute><Register /></ProtectedRoute>} />
            <Route path="/rules" element={<Rules />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            
            {/* Protected Dashboards */}
            <Route 
              path="/dashboard" 
              element={<ProtectedRoute allowedRoles={['user', 'admin']}><UserDashboard /></ProtectedRoute>} 
            />
            <Route 
              path="/admin" 
              element={<ProtectedRoute allowedRoles={['admin']} redirectPath="/admin/login"><AdminDashboard /></ProtectedRoute>} 
            />
            <Route 
              path="/payments" 
              element={<ProtectedRoute allowedRoles={['admin', 'payment_reviewer', 'content_reviewer']} redirectPath="/admin/login"><PaymentReviewDashboard /></ProtectedRoute>} 
            />
            <Route 
              path="/content" 
              element={<ProtectedRoute allowedRoles={['admin', 'payment_reviewer', 'content_reviewer']} redirectPath="/admin/login"><ContentReviewDashboard /></ProtectedRoute>} 
            />
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <Router>
      <div className="relative min-h-screen selection:bg-fest-primary selection:text-white overflow-x-hidden">
        <Background />
        <Navbar />
        <ScrollToTop />
        <AnimatedRoutes />
        <Footer />
      </div>
    </Router>
  );
}

