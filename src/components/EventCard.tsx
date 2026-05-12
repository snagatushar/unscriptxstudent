import { memo } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { ArrowRight, Trophy, Users } from 'lucide-react';
import { DatabaseEvent } from '../types';

interface EventCardProps {
  event: DatabaseEvent;
  index: number;
  key?: string | number;
}

export default memo(function EventCard({ event, index }: EventCardProps) {
  return (
    <motion.div
      whileHover={{ y: -10 }}
      className="group relative bg-fest-card rounded-3xl overflow-hidden border border-white/10 hover:border-fest-primary/50 transition-all duration-500 flex flex-col"
    >
      <div className="relative aspect-[4/5] overflow-hidden shrink-0 bg-black/90">
        {event.image_url ? (
          <motion.img
            whileHover={{ scale: 1.1 }}
            transition={{ duration: 0.6 }}
            src={event.image_url}
            alt={event.title}
            className="w-full h-full object-cover object-center transition-all duration-500"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-fest-primary/20 via-fest-accent/10 to-fest-primary-dark/20 flex items-center justify-center">
            <span className="text-2xl font-display font-bold text-white/15 uppercase tracking-widest">{event.category}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-fest-card via-transparent to-transparent opacity-60 z-20" />
        <div className="absolute top-4 right-4 px-3 py-1 bg-fest-accent/90 backdrop-blur-md rounded-full text-[10px] font-bold text-fest-dark uppercase tracking-widest z-30">
          {event.category}
        </div>
      </div>

      <div className="p-6 flex flex-col flex-1">
        <h3 className="text-2xl font-display font-bold mb-3 group-hover:text-fest-accent transition-colors">{event.title}</h3>
        <p className="text-white/60 text-sm mb-6 line-clamp-2 flex-1">{event.description}</p>



        <Link
          to={`/events/${event.id}`}
          className="flex items-center justify-center w-full py-3 px-6 bg-fest-primary/10 text-fest-primary rounded-2xl hover:bg-fest-primary hover:text-fest-dark transition-all duration-300 font-bold uppercase tracking-widest text-xs"
        >
          View & Register
          <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>

      <div className="absolute -inset-px bg-gradient-to-br from-fest-primary/20 via-transparent to-fest-primary-dark/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none -z-10" />
    </motion.div>
  );
});
