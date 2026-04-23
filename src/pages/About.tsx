import { motion } from 'motion/react';
import { Sparkles, Target, Users, Download } from 'lucide-react';

/**
 * Static About page — all content is hardcoded (no Supabase egress).
 * To update text or images, edit the constants below.
 */

const HERO = {
  title: 'ABOUT',
  subtitle: 'UNSCRIPTX',
  body: 'We are more than just a festival; we are a movement of creative expression and unbridled talent.',
};

const CARDS = [
  { icon: Target, title: 'Our Mission', text: 'To provide a platform for students to showcase their unique talents and break free from traditional scripts.', color: 'text-fest-accent' },
  { icon: Users, title: 'Our Community', text: 'A diverse group of artists, performers, and tech enthusiasts coming together to celebrate creativity.', color: 'text-fest-primary' },
  { icon: Sparkles, title: 'Our Vision', text: 'To become the benchmark for college cultural festivals, fostering innovation and artistic growth.', color: 'text-fest-accent' },
];

const STORY = {
  title: 'The Story Behind The',
  subtitle: 'UNSCRIPTX',
  body: "Founded in 2026, UNSCRIPTX began as a small gathering of passionate students who wanted something different. They wanted a space where the unexpected was celebrated and where every voice could be heard.",
  secondary_body: "",
  image_url: "/about 1.jpeg",
};

export default function About() {
  return (
    <main className="pt-32 pb-24 px-6 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <header className="mb-20 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-8xl font-display font-extrabold tracking-tighter mb-6 uppercase"
          >
            {HERO.title} <span className="text-fest-primary text-glow-primary">{HERO.subtitle}</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-white/50 text-lg max-w-2xl mx-auto mb-10"
          >
            {HERO.body}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex justify-center mt-8"
          >
            <a
              href="/UnscripTX_Brochure.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-8 py-4 bg-fest-primary text-fest-dark font-black uppercase tracking-[0.2em] text-sm rounded-full hover:bg-fest-primary-light transition-all glow-primary hover:scale-105"
            >
              <Download size={20} />
              Open Event Brochure
            </a>
          </motion.div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
          {CARDS.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              viewport={{ once: true }}
              className="glass p-10 rounded-[3rem] text-center"
            >
              <div className={`w-16 h-16 rounded-2xl glass flex items-center justify-center mx-auto mb-8 ${item.color}`}>
                <item.icon size={32} />
              </div>
              <h3 className="text-2xl font-display font-bold mb-4 uppercase tracking-widest">{item.title}</h3>
              <p className="text-white/60 leading-relaxed">{item.text}</p>
            </motion.div>
          ))}
        </div>

        <div className="glass p-12 md:p-20 rounded-[4rem] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-fest-primary/10 blur-[100px] -z-10" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl md:text-6xl font-display font-extrabold tracking-tighter mb-8">
                {STORY.title} <span className="text-fest-accent italic">{STORY.subtitle}</span>
              </h2>
              <p className="text-white/60 text-lg mb-6 leading-relaxed whitespace-pre-wrap">
                {STORY.body}
              </p>
              <p className="text-white/60 text-lg leading-relaxed whitespace-pre-wrap">
                {STORY.secondary_body}
              </p>
            </div>
            <div className="rounded-[2rem] overflow-hidden border border-white/10 glow-primary relative">
              <img src={STORY.image_url} alt="Fest History" className="w-full h-full object-cover opacity-80 mix-blend-screen mix-blend-luminosity" referrerPolicy="no-referrer" />
              <div className="absolute inset-0 bg-fest-primary/20 mix-blend-overlay"></div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
