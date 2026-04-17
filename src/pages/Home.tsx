import { motion } from 'motion/react';
import Hero from '../components/Hero';
import EventCard from '../components/EventCard';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, Music, Zap, Palette, Loader2 } from 'lucide-react';
import { useEvents } from '../hooks/useAwsData';

/**
 * Hardcoded "About The Event" section.
 */
const ABOUT_EVENT = {
  title: 'UNSCRIPTX 2026:',
  subtitle: 'Where Talent Meets Opportunity',
  body: "UNSCRIPTX is the premier annual cultural festival uniting creatives, technologists, and innovators globally. It's a three-day celebration blending technology, art, dance, and music into a single spectacular dimension. Prepare to break the norms, go UNSCRIPTX, and witness history in the making."
};

/**
 * Hardcoded "About the College" section.
 */
const ABOUT_COLLEGE = {
  title: 'A Legacy of ',
  subtitle: 'Excellence',
  body: 'Founded on the principles of innovation and integrity, our institution has been at the forefront of quality education for decades. We believe in nurturing raw talent and providing a dynamic environment where ideas flourish.',
  image_url: 'https://picsum.photos/seed/college/800/400',
  metadata: {
    highlight_one_value: 'A++',
    highlight_one_label: 'NAAC Grade',
    highlight_two_value: 'Top 10',
    highlight_two_label: 'State Rank'
  }
};

/**
 * Hardcoded universal guidelines — isolated from API.
 */
const GENERAL_RULES = [
  'All participants must carry a valid college ID card at all times during the event.',
  'Registration is mandatory for all events. Spot registrations are subject to availability.',
  'Any form of malpractice, plagiarism, or misconduct will result in immediate disqualification.',
  'The decision of the judges and organizing committee will be final and binding.',
  'Participants must report to the event venue at least 15 minutes before the scheduled time.',
  'Use of any prohibited substances on the campus is strictly forbidden.',
  'The organizing committee reserves the right to modify event schedules without prior notice.',
  'All participants must adhere to the code of conduct and maintain decorum throughout the fest.',
];

/**
 * Hardcoded Organizing Committee.
 */
const COMMITTEE_MEMBERS = [
  { id: 1, name: 'Dr. Salur Srikant Patnaik', role: 'Dean of School of Technology, IFIM College', image_url: '/Srikanth.jpeg' },
  { id: 2, name: 'Dr. Vishal', role: 'Head of the Department School of Technology, IFIM', image_url: '/vishalai.jpeg' },
  { id: 3, name: 'Dr. Sunethra', role: 'Assistant Professor, IFIM College', image_url: '/sunethra.jpeg' },
];

/**
 * Hardcoded "Why Join" Section.
 */
const WHY_JOIN = {
  title: "[Why wait for the future] when you can create it?",
  body: "UNSCRIPTX is more than just a fest. It's a platform where creativity meets competition, and passion meets performance. Join thousands of students in the biggest celebration of talent.",
  image_url: "/music.png",
  features: [
    { id: 'f1', title: 'Musical Nights', color: 'text-fest-primary' },
    { id: 'f2', title: 'High Energy', color: 'text-fest-accent' },
    { id: 'f3', title: 'Star Guests', color: 'text-fest-primary' },
    { id: 'f4', title: 'Artistic Souls', color: 'text-white' },
  ]
};

export default function Home() {
  const { events, loading: eventsLoading } = useEvents();

  const parseTitle = (raw: string | null | undefined) => {
    const text = raw ? raw.replace(/\[|\]/g, '') : "Why wait for the future when you can create it?";
    return <span className="text-fest-accent text-glow-accent">{text}</span>;
  };

  return (
    <main>
      <Hero />

      {/* About Section */}
      <section className="py-16 md:py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-fest-accent font-display font-bold uppercase tracking-widest mb-4">About The Event</h2>
            <h3 className="text-4xl md:text-5xl font-display font-extrabold tracking-tighter mb-8">
              {ABOUT_EVENT.title} <br /> <span className="text-white/80">{ABOUT_EVENT.subtitle}</span>
            </h3>
            <p className="text-white/60 text-lg leading-relaxed">
              {ABOUT_EVENT.body}
            </p>
          </motion.div>
        </div>
      </section>

      {/* About the College Section */}
      <section className="py-20 px-6 bg-black/50 border-y border-white/5">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex-1"
          >
            <div className="w-full aspect-video rounded-[2rem] overflow-hidden border-4 border-white/10 relative">
              <div className="absolute inset-0 bg-fest-primary/20 mix-blend-overlay"></div>
              <img src={ABOUT_COLLEGE.image_url} alt="College Campus" className="w-full h-full object-cover" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex-1"
          >
            <h2 className="text-fest-accent font-display font-bold uppercase tracking-widest mb-4">About the College</h2>
            <h3 className="text-4xl md:text-5xl font-display font-extrabold tracking-tighter mb-6">
              {ABOUT_COLLEGE.title}<span className="text-fest-accent italic">{ABOUT_COLLEGE.subtitle}</span>
            </h3>
            <p className="text-white/60 text-lg leading-relaxed mb-6">
              {ABOUT_COLLEGE.body}
            </p>
            <div className="flex items-center gap-4 text-sm font-bold uppercase tracking-widest text-white/50">
              <div><span className="text-fest-primary text-xl md:text-2xl mr-2">{ABOUT_COLLEGE.metadata.highlight_one_value}</span> {ABOUT_COLLEGE.metadata.highlight_one_label}</div>
              <div className="w-1 h-1 bg-white/20 rounded-full"></div>
              <div><span className="text-fest-primary text-xl md:text-2xl mr-2">{ABOUT_COLLEGE.metadata.highlight_two_value}</span> {ABOUT_COLLEGE.metadata.highlight_two_label}</div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* { About the School of Technology Section
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex-1 order-2 md:order-1"
          >
            <h2 className="text-fest-accent font-display font-bold uppercase tracking-widest mb-4">About School of Technology</h2>
            <h3 className="text-4xl md:text-5xl font-display font-extrabold tracking-tighter mb-6">
              {aboutSchool?.title}<span className="text-fest-accent italic">{aboutSchool?.subtitle}</span>
            </h3>
            <p className="text-white/60 text-lg leading-relaxed mb-6">
              {aboutSchool?.body}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex-1 order-1 md:order-2"
          >
            <div className="w-full aspect-video rounded-[2rem] overflow-hidden border-4 border-white/10 relative">
              <div className="absolute inset-0 bg-fest-primary/20 mix-blend-overlay"></div>
              <img src={aboutSchool?.image_url || 'https://picsum.photos/seed/tech/800/400'} alt="School of Technology" className="w-full h-full object-cover" />
            </div>
          </motion.div>
        </div>
      </section> } */}

      {/* Featured Events */}
      <section className="py-16 md:py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 md:mb-16 gap-6">
            <div>
              <h2 className="text-fest-accent font-display font-bold uppercase tracking-widest mb-4 text-xs md:text-sm">Featured Highlights</h2>
              <h3 className="text-4xl md:text-6xl font-display font-extrabold tracking-tighter">Experience the <span className="text-white italic">Magic</span></h3>
            </div>
            <Link to="/events" className="flex items-center gap-2 text-fest-accent font-bold uppercase tracking-widest text-sm hover:gap-4 transition-all">
              View All Events <ArrowRight size={20} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {eventsLoading ? (
              <div className="col-span-full flex justify-center py-20">
                <Loader2 className="animate-spin text-fest-primary" size={48} />
              </div>
            ) : events.length > 0 ? (
              events.slice(0, 3).map((event, i) => (
                <EventCard key={event.id} event={event} index={i} />
              ))
            ) : (
              <div className="col-span-full text-center py-10 glass rounded-3xl">
                <p className="text-white/40 font-bold uppercase tracking-widest text-sm">No events announced yet.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Universal Rules Section */}
      <section className="py-16 md:py-24 px-6 relative overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="glass rounded-[2rem] md:rounded-[3rem] p-8 md:p-20 relative overflow-hidden border border-white/5">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-fest-primary to-transparent opacity-30" />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-16">
              <div className="lg:col-span-1">
                <h2 className="text-fest-accent font-display font-bold uppercase tracking-widest mb-4 text-xs md:text-sm">The Playbook</h2>
                <h3 className="text-3xl md:text-5xl font-display font-extrabold tracking-tighter mb-6 uppercase">Universal <br /><span className="text-fest-accent text-glow-accent">Guidelines</span></h3>
                <p className="text-white/40 leading-relaxed text-sm md:text-lg">
                  To ensure a fair and spectacular experience for everyone, please adhere to these core festival regulations.
                </p>
              </div>

              <div className="lg:col-span-2 space-y-4">
                {GENERAL_RULES.map((rule, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    viewport={{ once: true }}
                    className="flex gap-6 p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/5 transition-colors group"
                  >
                    <span className="text-2xl font-display font-black text-white/10 group-hover:text-fest-primary transition-colors">
                      {(index + 1).toString().padStart(2, '0')}
                    </span>
                    <p className="text-white/70 text-sm md:text-base leading-relaxed pt-1">
                      {rule}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Organizing Committee Section */}
      <section className="py-24 px-6 relative overflow-hidden bg-white/5">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="mb-16"
          >
            <h2 className="text-fest-accent font-display font-bold uppercase tracking-widest mb-4">The Architects</h2>
            <h3 className="text-4xl md:text-7xl font-display font-extrabold tracking-tighter">Organizing <span className="text-white italic">Committee</span></h3>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12">
            {COMMITTEE_MEMBERS.length > 0 ? (
              COMMITTEE_MEMBERS.map((member, i) => (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  viewport={{ once: true }}
                  className="group"
                >
                  <div className="relative mb-6 mx-auto w-40 h-40 md:w-56 md:h-56">
                    <div className="absolute inset-0 bg-fest-primary/20 rounded-full blur-2xl group-hover:bg-fest-primary/40 transition-all -z-10" />
                    <div className="w-full h-full rounded-full border-2 border-white/10 p-2 group-hover:border-fest-primary/50 transition-all">
                      <img
                        src={member.image_url}
                        alt={member.name}
                        className="w-full h-full object-cover rounded-full transition-all duration-500"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </div>
                  <h4 className="text-xl md:text-2xl font-display font-bold text-white group-hover:text-fest-primary transition-colors">{member.name}</h4>
                  <p className="text-white/40 text-xs md:text-sm uppercase tracking-[0.2em] font-bold mt-2">{member.role}</p>
                </motion.div>
              ))
            ) : (
              // No registrations via API yet
              <div className="col-span-full py-16 text-center glass rounded-3xl border border-dashed border-white/5">
                <p className="text-white/20 font-bold uppercase tracking-widest text-xs">No entries found</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Why Join Section */}
      <section className="py-24 px-6 relative">
        <div className="max-w-7xl mx-auto glass rounded-[3rem] p-12 md:p-24 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-96 h-96 bg-fest-primary/10 blur-[100px] -z-10" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/5 blur-[100px] -z-10" />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl md:text-6xl font-display font-extrabold tracking-tighter mb-8 leading-tight">
                {parseTitle(WHY_JOIN.title)}
              </h2>
              <p className="text-white/60 text-lg mb-12 leading-relaxed">
                {WHY_JOIN.body}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[
                  { icon: Music, title: WHY_JOIN.features[0].title, color: WHY_JOIN.features[0].color },
                  { icon: Zap, title: WHY_JOIN.features[1].title, color: WHY_JOIN.features[1].color },
                  { icon: Sparkles, title: WHY_JOIN.features[2].title, color: WHY_JOIN.features[2].color },
                  { icon: Palette, title: WHY_JOIN.features[3].title, color: WHY_JOIN.features[3].color },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl glass flex items-center justify-center ${item.color}`}>
                      <item.icon size={24} />
                    </div>
                    <span className="font-display font-bold uppercase tracking-widest text-sm">{item.title}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 border-2 border-dashed border-white/10 rounded-full"
              />
              <img
                src={WHY_JOIN.image_url}
                alt="Fest Crowd"
                className="rounded-full w-full aspect-square object-cover border-8 border-white/5"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Event Management Team Section */}
      {/*
      <section className="py-24 px-6 relative overflow-hidden bg-black/30 border-y border-white/5">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-fest-primary/20 to-transparent" />
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-16 md:gap-24">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex-1 space-y-8"
          >
            <div>
              <h2 className="text-fest-accent font-display font-bold uppercase tracking-[0.3em] mb-4 text-xs md:text-sm">
                {EVENT_TEAM.subtitle}
              </h2>
              <h3 className="text-4xl md:text-7xl font-display font-extrabold tracking-tighter leading-tight">
                {EVENT_TEAM.title}
              </h3>
            </div>
            <p className="text-white/50 text-lg md:text-xl leading-relaxed max-w-xl">
              {EVENT_TEAM.body}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9, rotate: -2 }}
            whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
            viewport={{ once: true }}
            className="flex-1 relative group"
          >
            <div className="absolute -inset-4 bg-fest-primary/10 rounded-[3rem] blur-3xl group-hover:bg-fest-primary/20 transition-all duration-700" />
            <div className="absolute top-0 right-0 w-20 h-20 border-t-4 border-r-4 border-fest-primary/30 rounded-tr-[3rem] -mr-4 -mt-4" />
            <div className="absolute bottom-0 left-0 w-20 h-20 border-b-4 border-l-4 border-fest-primary/30 rounded-bl-[3rem] -ml-4 -mb-4" />

            <div className="relative glass rounded-[2.5rem] p-3 border border-white/10 overflow-hidden shadow-2xl">
              <img
                src={EVENT_TEAM.image_url}
                alt="Event Management Team"
                className="w-full aspect-[4/3] object-cover rounded-[1.8rem] shadow-inner"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-black/80 to-transparent flex items-end justify-center pb-8">
                <span className="text-fest-primary text-xs font-black uppercase tracking-[0.4em] text-shadow-glow">
                  UNSCRIPTX 2026 STAFF
                </span>
              </div>
            </div>
          </motion.div>
        </div>
        <div className="absolute bottom-0 right-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      </section>
      */}

      {/* CTA Section */}
      <section className="py-20 md:py-32 px-6 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto"
        >
          <h2 className="text-4xl md:text-8xl font-display font-extrabold tracking-tighter mb-10 md:mb-12 uppercase">
            READY TO <span className="text-fest-primary text-glow-primary">SHINE?</span>
          </h2>
          <Link
            to="/login"
            className="inline-block px-16 py-6 bg-fest-primary text-fest-dark font-black uppercase tracking-[0.3em] text-xl rounded-full hover:bg-fest-primary-light transition-colors glow-primary"
          >
            Register Now
          </Link>
        </motion.div>
      </section>
    </main>
  );
}
