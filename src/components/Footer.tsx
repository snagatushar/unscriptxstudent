import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, Download } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-fest-dark border-t border-white/10 pt-20 pb-10 px-6">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
        <div className="col-span-1 md:col-span-2">
          <Link to="/" className="flex items-center gap-5 group mb-8">
            <img
              src="/logo.png"
              alt="UNSCRIPTX Logo"
              className="w-48 h-24 object-contain filter invert contrast-125 mix-blend-screen drop-shadow-[0_0_15px_rgba(59,130,246,0.2)]"
            />
            <span className="text-4xl font-blowbrush tracking-widest text-white mt-2">
              UN<span className="text-fest-primary">SCRIPTX</span>
            </span>
          </Link>
          <p className="text-white/50 max-w-md mb-8 leading-relaxed">
            The most anticipated college cultural fest is back. Join us for three days of creativity, talent, and pure energy. Break the script and own your moment.
          </p>
          {/* <a
            href="/UnscripTX_Brochure_Updated.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold uppercase tracking-widest text-xs rounded-full transition-all group"
          >
            <Download size={16} className="text-fest-primary group-hover:-translate-y-1 transition-transform" />
            Download Brochure
          </a> */}
        </div>

        <div>
          <h4 className="font-display font-bold uppercase tracking-widest mb-6 text-fest-accent">Quick Links</h4>
          <ul className="flex flex-col gap-4">
            {['Home', 'About', 'Contact', 'Login'].map((link) => (
              <li key={link}>
                <Link
                  to={link === 'Home' ? '/' : `/${link.toLowerCase()}`}
                  className="text-white/60 hover:text-white transition-colors text-sm"
                >
                  {link}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-display font-bold uppercase tracking-widest mb-6 text-fest-primary">Contact Us</h4>
          <ul className="flex flex-col gap-4">
            <li className="flex items-center gap-3 text-white/60 text-sm">
              <Mail size={16} className="text-fest-primary" />
              unscriptx@ifim.edu.in
            </li>
            <li className="flex items-center gap-3 text-white/60 text-sm">
              <Phone size={16} className="text-fest-accent" />
              +91 8660911643
            </li>
            <li className="text-white/40 text-xs mt-4">
              IFIM SCHOOL OF TECHNOLOGY<br />
              Electronic City Phase 1, Bangalore, Karnataka - 560100
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
};

export default memo(Footer);
