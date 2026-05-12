import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { Loader2, CheckCircle, Clock, XCircle, Trophy, Video } from 'lucide-react';
import toast from 'react-hot-toast';
import { PaymentStatus, QualificationStage, ReviewStatus, SubmissionStatus, Submission } from '../types';
import VideoUploadModal from '../components/VideoUploadModal';

type UserRegistration = {
  id: string;
  event_id: string;
  payment_status: PaymentStatus;
  upload_enabled: boolean;
  submission_status: SubmissionStatus;
  review_status: ReviewStatus;
  qualification_stage: QualificationStage;
  qualification_notes: string | null;
  review_notes: string | null;
  payment_review_notes: string | null;
  event_title: string;
  event_category: string;
  sub_category: string | null;
  submissions?: Submission[];
  requires_video_submission?: boolean;
  verified_success_message?: string;
};

function getReviewLabel(status: ReviewStatus) {
  switch (status) {
    case 'selected':
      return 'Selected';
    case 'eliminated':
      return 'Eliminated';
    default:
      return 'Under Review';
  }
}

function getQualificationLabel(stage: QualificationStage) {
  switch (stage) {
    case 'round_1_qualified':
      return 'Qualified for Round 1';
    case 'round_2_qualified':
      return 'Qualified for Round 2';
    case 'semifinal':
      return 'Qualified for Semifinal';
    case 'final':
      return 'Qualified for Final';
    case 'winner':
      return 'WINNER 🏆';
    case 'eliminated':
      return 'Eliminated';
    default:
      return 'Awaiting Selection';
  }
}

function getNextRound(stage: QualificationStage): { id: QualificationStage; name: string } | null {
  switch (stage) {
    case 'not_started': return { id: 'round_1_qualified', name: 'Round 1' };
    case 'round_1_qualified': return { id: 'round_2_qualified', name: 'Round 2' };
    case 'round_2_qualified': return { id: 'semifinal', name: 'Semifinal' };
    case 'semifinal': return { id: 'final', name: 'Final' };
    default: return null;
  }
}

export default function UserDashboard() {
  const { user } = useAuth();
  const [registrations, setRegistrations] = useState<UserRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadModal, setUploadModal] = useState<{ isOpen: boolean; regId: string; round: QualificationStage; roundName: string; eventTitle: string; subCategory: string }>({
    isOpen: false,
    regId: '',
    round: 'not_started',
    roundName: '',
    eventTitle: '',
    subCategory: '',
  });

  const fetchRegistrations = async () => {
    if (!user) return;
    try {
      const registrations = await api.get<UserRegistration[]>('/api/participant-hub?action=registrations');
      setRegistrations(registrations || []);
    } catch {
      toast.error('Failed to load dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Using the full user object would cause re-fetch every time auth
    // fires any event that rebuilds the User object.
    fetchRegistrations();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="min-h-screen pt-32 flex items-center justify-center">
        <Loader2 className="animate-spin text-fest-primary" size={48} />
      </div>
    );
  }

  return (
    <main className="pt-32 pb-24 px-6 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl md:text-6xl font-display font-extrabold uppercase mb-4 tracking-tighter">
            Registered <span className="text-fest-primary">Events</span>
          </h1>
          <p className="text-white/60 mb-8 md:mb-12 text-sm md:text-lg">
            Track approval status and round results for each event you registered in.
          </p>
        </motion.div>

        {registrations.length === 0 ? (
          <div className="glass p-12 text-center rounded-[3rem]">
            <h3 className="text-2xl font-bold mb-4 opacity-50">No Registered Events Yet</h3>
            <p className="opacity-40 mb-6">You have not registered for any events yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {registrations.map((registration, index) => (
              <motion.div
                key={registration.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.08 }}
                className="glass rounded-3xl p-8 relative overflow-hidden flex flex-col gap-6"
              >
                <div className="absolute top-0 right-0 p-4">
                  <span className="text-[10px] uppercase tracking-widest bg-white/10 px-3 py-1 rounded-full opacity-70">
                    {registration.event_category}
                  </span>
                </div>

                <div>
                  <h3 className="text-xl md:text-2xl font-display font-bold mb-2 pr-16 leading-tight">
                    {registration.event_title}
                    {registration.sub_category && (
                      <span className="block text-fest-primary text-sm font-bold mt-1 tracking-normal">
                         {registration.sub_category}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs uppercase tracking-[0.25em] text-white/35">Event Registration</p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3 bg-black/20 p-3 rounded-2xl">
                    {registration.payment_status === 'approved' ? (
                      <CheckCircle className="text-green-400" size={20} />
                    ) : registration.payment_status === 'rejected' ? (
                      <XCircle className="text-red-400" size={20} />
                    ) : (
                      <Clock className="text-fest-accent" size={20} />
                    )}
                    <div>
                      <div className="text-[10px] uppercase text-white/40 tracking-widest">Approval Status</div>
                      <div className="text-sm font-bold capitalize">{registration.payment_status}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 bg-black/20 p-3 rounded-2xl">
                    {registration.qualification_stage === 'final' ? (
                      <Trophy className="text-fest-primary" size={20} />
                    ) : registration.qualification_stage === 'eliminated' ? (
                      <XCircle className="text-red-400" size={20} />
                    ) : (
                      <CheckCircle className="text-white/60" size={20} />
                    )}
                    <div>
                      <div className="text-[10px] uppercase text-white/40 tracking-widest">Qualified To Next Round</div>
                      <div className="text-sm font-bold">{getQualificationLabel(registration.qualification_stage)}</div>
                    </div>
                  </div>
                </div>

                {registration.qualification_notes && (
                  <div className="rounded-2xl border border-fest-primary/20 bg-fest-primary/5 p-4 text-xs text-white/80">
                    Qualification note: {registration.qualification_notes}
                  </div>
                )}

                {registration.payment_review_notes && (
                  <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4 text-xs text-yellow-100/80">
                    Review note: {registration.payment_review_notes}
                  </div>
                )}

                {registration.review_notes && (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-white/70">
                    Review note: {registration.review_notes}
                  </div>
                )}

                {registration.payment_status === 'approved' && (
                  <div className="space-y-4">
                    {registration.requires_video_submission === false ? (
                      <div className="text-center p-5 border border-green-500/30 rounded-2xl bg-green-500/10 text-sm text-green-100/90 leading-relaxed font-medium">
                        {registration.verified_success_message || "Your registration is approved! Details regarding timings and location are secured."}
                      </div>
                    ) : (
                      (() => {
                        const next = getNextRound(registration.qualification_stage);
                        const hasSubmittedForNext = registration.submissions?.some(s => s.round === next?.id);

                        if (next && !hasSubmittedForNext) {
                          return (
                            <button
                              onClick={() => setUploadModal({
                                isOpen: true,
                                regId: registration.id,
                                round: next.id,
                                roundName: next.name,
                                eventTitle: registration.event_title,
                                subCategory: registration.sub_category || '',
                              })}
                              className="w-full py-4 bg-fest-primary text-fest-dark rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-fest-primary-light transition-all flex items-center justify-center gap-2 glow-primary"
                            >
                              <Video size={18} /> Upload for {next.name}
                            </button>
                          );
                        }

                        if (hasSubmittedForNext) {
                          return (
                            <div className="text-center text-[10px] uppercase tracking-widest text-fest-primary/70 p-4 border border-fest-primary/20 rounded-2xl bg-fest-primary/5 flex flex-col gap-1 items-center">
                              <CheckCircle size={14} /> Submission for {next?.name} Received
                            </div>
                          );
                        }

                        return null;
                      })()
                    )}
                  </div>
                )}

                {registration.payment_status === 'rejected' && (
                  <div className="text-center text-[10px] uppercase tracking-widest text-red-300/80 p-4 border border-red-500/20 rounded-2xl bg-red-500/5">
                    Registration rejected. Please contact the team.
                  </div>
                )}

                {registration.payment_status === 'pending' && (
                  <div className="text-center text-[10px] uppercase tracking-widest text-white/40 p-4 border border-white/5 rounded-2xl">
                    Registration submitted. Wait for approval.
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}

        <VideoUploadModal
          isOpen={uploadModal.isOpen}
          onClose={() => setUploadModal(prev => ({ ...prev, isOpen: false }))}
          registrationId={uploadModal.regId}
          round={uploadModal.round}
          roundName={uploadModal.roundName}
          eventTitle={uploadModal.eventTitle}
          subCategory={uploadModal.subCategory}
          onSuccess={fetchRegistrations}
        />
      </div>
    </main>
  );
}
