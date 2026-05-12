import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Loader2, IndianRupee } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { DatabaseEvent, QualificationStage } from '../types';
import { HARDCODED_EVENTS } from '../hooks/useAwsData';

type PublicEventResult = {
  participant_name: string;
  team_name: string | null;
  qualification_stage: QualificationStage;
};

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [event, setEvent] = useState<DatabaseEvent | null>(null);
  const [results, setResults] = useState<PublicEventResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    
    // Find event instantly from hardcoded data instead of API call
    const foundEvent = HARDCODED_EVENTS.find((e) => e.id === id);
    
    if (foundEvent) {
      setEvent({
        ...foundEvent,
        entry_fee: Number(foundEvent.entry_fee || 0),
        rules: foundEvent.rules || [],
      });
    }
    
    // Results are empty for now since this is the fresh student db
    setResults([]);
    setLoading(false);
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-fest-primary" size={48} />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6">
        <h1 className="text-4xl font-display font-bold">Event not found</h1>
        <Link to="/events" className="px-8 py-3 bg-fest-primary rounded-full font-bold uppercase tracking-widest">
          Back to Events
        </Link>
      </div>
    );
  }

  const qualifiedResults = results.filter((entry) => entry.qualification_stage !== 'eliminated');
  const eliminatedResults = results.filter((entry) => entry.qualification_stage === 'eliminated');

  return (
    <main className="pt-24 pb-24 px-6 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-white/40 hover:text-white transition-colors mb-12 uppercase tracking-widest text-xs font-bold"
        >
          <ArrowLeft size={16} /> Back
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-16 items-start">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6 md:space-y-8"
          >
            <div className="relative aspect-video rounded-2xl md:rounded-[2rem] overflow-hidden border border-white/10 glow-primary">
              {event.image_url ? (
                <img
                  src={event.image_url}
                  alt={event.title}
                  className="w-full h-full object-cover object-center"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-fest-primary/20 via-fest-accent/10 to-fest-primary-dark/20 flex items-center justify-center">
                  <span className="text-4xl font-display font-bold text-white/20 uppercase tracking-widest">{event.category}</span>
                </div>
              )}
              <div className="absolute top-4 left-4 md:top-6 md:left-6 px-3 py-1.5 md:px-4 md:py-2 bg-fest-primary text-fest-dark rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest">
                {event.category}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:gap-4">
              {/* Removed Entry Fee */}
            </div>
          </motion.div>



          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-8 md:space-y-12"
          >
            <div>
              <h1 className="text-4xl md:text-7xl font-display font-extrabold tracking-tighter mb-4 md:mb-6 uppercase">
                {event.title}
              </h1>
              <p className="text-white/60 text-base md:text-lg leading-relaxed whitespace-pre-line">{event.description}</p>
            </div>



            {event.rules && event.rules.length > 0 && (
              <div className="space-y-4 md:space-y-6">
                <h3 className="text-2xl md:text-3xl font-display font-bold text-fest-primary uppercase tracking-wider">Event Rules</h3>
                <ul className="space-y-3 md:space-y-4">
                  {event.rules.map((rule, index) => (
                    <motion.li
                      key={index}
                      initial={{ opacity: 0, x: 20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.1 }}
                      className="flex gap-3 md:gap-4 text-white/70 bg-white/5 p-4 md:p-5 rounded-xl md:rounded-2xl border border-white/5 text-base md:text-lg leading-relaxed"
                    >
                      <span className="text-fest-primary font-bold">{(index + 1).toString().padStart(2, '0')}</span>
                      <span>{rule}</span>
                    </motion.li>
                  ))}
                </ul>
              </div>
            )}

            <Link
              to={`/register/${event.id}`}
              className="block w-full py-4 md:py-6 bg-fest-primary text-fest-dark text-center font-black uppercase tracking-[0.2em] md:tracking-[0.3em] text-lg md:text-xl rounded-xl md:rounded-2xl hover:scale-[1.02] transition-transform glow-primary"
            >
              {user ? 'Register' : 'Login to Register'}
            </Link>

            {(qualifiedResults.length > 0 || eliminatedResults.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass p-6 rounded-3xl border border-green-500/10">
                  <h3 className="text-lg font-bold uppercase tracking-widest text-green-400 mb-4">Qualified</h3>
                  <div className="space-y-3">
                    {qualifiedResults.length > 0 ? (
                      qualifiedResults.map((entry, index) => (
                        <div key={`${entry.participant_name}-${index}`} className="rounded-2xl bg-white/5 p-4">
                          <div className="font-bold">{entry.participant_name}</div>
                          <div className="text-xs text-white/45 mt-1 uppercase tracking-widest">
                            {entry.qualification_stage.replaceAll('_', ' ')}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-white/35">No qualified names published yet.</div>
                    )}
                  </div>
                </div>

                <div className="glass p-6 rounded-3xl border border-red-500/10">
                  <h3 className="text-lg font-bold uppercase tracking-widest text-red-400 mb-4">Eliminated</h3>
                  <div className="space-y-3">
                    {eliminatedResults.length > 0 ? (
                      eliminatedResults.map((entry, index) => (
                        <div key={`${entry.participant_name}-${index}`} className="rounded-2xl bg-white/5 p-4">
                          <div className="font-bold">{entry.participant_name}</div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-white/35">No eliminated names published yet.</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </main>
  );
}
