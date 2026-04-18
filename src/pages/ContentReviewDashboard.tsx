import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../lib/api';
import { Loader2, CheckCircle2, XCircle, Search, Video, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

import { QualificationStage, Submission } from '../types';
import { logAdminAction } from '../lib/audit';
import { getEventDriveFiles } from '../lib/drive';

type ContentReview = {
  id: string;
  user_id: string;
  event_id: string;
  participant_name: string | null;
  email: string | null;
  team_name: string | null;
  review_status: 'not_started' | 'selected' | 'eliminated';
  qualification_stage: QualificationStage;
  review_notes: string | null;
  submission_status: 'locked' | 'ready' | 'submitted';
  created_at: string;
  participant_user: {
    email: string;
    full_name: string | null;
  } | null;
  events: {
    title: string;
    category: string;
  };
  submissions: (Submission & { 
    internal_reviews: { score: number; judge_remarks: string }[] | null 
  })[];
};

const STAGE_ORDER: QualificationStage[] = [
  'not_started',
  'round_1_qualified',
  'round_2_qualified',
  'semifinal',
  'final',
  'winner'
];

function isRoundPast(currentStage: QualificationStage, roundToCheck: string): boolean {
  const currentIndex = STAGE_ORDER.indexOf(currentStage);
  const checkIndex = STAGE_ORDER.indexOf(roundToCheck as QualificationStage);
  
  if (currentIndex === -1 || checkIndex === -1) return false;
  return currentIndex > checkIndex;
}

function VideoPreview({ submission, eventTitle }: { submission: Submission; eventTitle: string }) {
  return (
    <div className="w-full rounded-xl bg-black/60 border border-white/10 p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-fest-primary/10 border border-fest-primary/20 flex items-center justify-center shrink-0">
        <Video size={18} className="text-fest-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold text-white/70">Video Submitted</div>
        <div className="text-[10px] text-white/30 mt-0.5 truncate">ID: {submission.video_path || submission.video_url || 'N/A'}</div>
        <div className="text-[10px] text-white/30">{new Date(submission.created_at).toLocaleString()}</div>
      </div>
      <a
        href={`https://drive.google.com/file/d/${submission.video_path || submission.video_url}/view`}
        target="_blank"
        rel="noopener noreferrer"
        className="px-3 py-2 bg-fest-primary/10 text-fest-primary hover:bg-fest-primary hover:text-fest-dark rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border border-fest-primary/20 shrink-0"
      >
        View on Drive
      </a>
    </div>
  );
}

export default function ContentReviewDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'pending' | 'reviewed' | 'drive'>('pending');
  const [submissions, setSubmissions] = useState<ContentReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [loadingDrive, setLoadingDrive] = useState(false);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [scores, setScores] = useState<Record<string, number>>({});
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [savingScoreId, setSavingScoreId] = useState<string | null>(null);

  useEffect(() => {
    void fetchSubmissions(true);
  }, [activeTab]);

  const fetchSubmissions = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const rowsData = await api.get<any[]>('/api/admin?resource=content_review_data');
      
      const rows = rowsData.map(reg => ({
        ...reg,
        participant_user: { full_name: reg.participant_user_name, email: reg.participant_user_email },
        events: { id: reg.event_id, title: reg.event_title, category: reg.event_category },
        submissions: reg.submissions || []
      })) as ContentReview[];

      setSubmissions(rows || []);
      
      const existingNotes: Record<string, string> = {};
      const existingScores: Record<string, number> = {};
      rows?.forEach((reg: any) => {
        reg.submissions?.forEach((s: any) => {
          if (s.internal_reviews && s.internal_reviews[0]) {
            existingScores[s.id] = s.internal_reviews[0].score || 0;
            existingNotes[s.id] = s.internal_reviews[0].judge_remarks || '';
          }
        });
      });
      setNotes(existingNotes);
      setScores(existingScores);
    } catch (err: any) {
      toast.error('Failed to load submissions.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDriveFiles = async (eventTitle: string) => {
    setLoadingDrive(true);
    try {
      const { files } = await getEventDriveFiles(eventTitle);
      setDriveFiles(files);
    } catch (err: any) {
      toast.error(err.message || 'Failed to sync with Google Drive.');
    } finally {
      setLoadingDrive(false);
    }
  };

  const selectedEvent = selectedEventId ? submissions.find(s => s.event_id === selectedEventId)?.events : null;

  useEffect(() => {
    if (activeTab === 'drive' && selectedEvent) {
      fetchDriveFiles(selectedEvent.title);
    }
  }, [activeTab, selectedEventId]);

  const saveReviewData = async (submissionId: string) => {
    setSavingScoreId(submissionId);
    try {
      await api.post('/api/admin', {
        action: 'upsert',
        table: 'internal_reviews',
        conflict_target: 'submission_id',
        record: {
          submission_id: submissionId,
          score: scores[submissionId] || 0,
          judge_remarks: notes[submissionId] || '',
          updated_at: new Date().toISOString()
        }
      });
      
      if (user) {
        const reg = submissions.find(r => r.submissions.some(s => s.id === submissionId));
        if (reg) {
          await logAdminAction(user.id, 'SITE_CONTENT_UPDATE', submissionId, {
            student: reg.participant_name || reg.participant_user?.full_name || 'Anonymous',
            event: reg.events.title,
            score: scores[submissionId] || 0,
            notes: 'Saved internal score/remarks'
          });
        }
      }

      toast.success('Internal review saved.');
    } catch (err: any) {
      toast.error('Failed to save review.');
    } finally {
      setSavingScoreId(null);
    }
  };

  const handleDecision = async (registrationId: string, currentRoundId: QualificationStage, decision: 'selected' | 'eliminated') => {
    setActionLoading(registrationId);
    try {
      const updatePayload: any = {
        content_reviewed_by: user?.id || null,
        content_reviewed_at: new Date().toISOString(),
      };

      if (decision === 'selected') {
        updatePayload.qualification_stage = currentRoundId;
        updatePayload.review_status = 'selected';
      } else {
        updatePayload.qualification_stage = 'eliminated';
        updatePayload.review_status = 'eliminated';
      }

      await api.post('/api/admin', {
        action: 'update',
        table: 'registrations',
        id: registrationId,
        record: updatePayload
      });

      if (user) {
        const reg = submissions.find(r => r.id === registrationId);
        if (reg) {
          await logAdminAction(
            user.id, 
            decision === 'selected' ? 'JUDGE_PROMOTE' : 'JUDGE_ELIMINATE', 
            registrationId, 
            {
              student: reg.participant_name || reg.participant_user?.full_name || 'Anonymous',
              event: reg.events.title,
              round: currentRoundId,
              decision: decision
            }
          );
        }
      }

      toast.success(`Participant ${decision === 'selected' ? 'promoted' : 'eliminated'}.`);
      fetchSubmissions();
    } catch (err: any) {
      toast.error('Action failed.');
    } finally {
      setActionLoading(null);
    }
  };

  const eventGroups = submissions.reduce((acc, reg) => {
    const eid = reg.event_id;
    if (!acc[eid]) {
      acc[eid] = {
        id: eid,
        title: reg.events.title,
        category: reg.events.category,
        count: 0,
        pending: 0
      };
    }
    acc[eid].count++;
    
    const isPending = reg.qualification_stage !== 'eliminated' && reg.qualification_stage !== 'winner' && 
             reg.submissions.some(s => {
               if (s.round === 'round_1_qualified' && reg.qualification_stage === 'not_started') return true;
               if (s.round === 'round_2_qualified' && reg.qualification_stage === 'round_1_qualified') return true;
               if (s.round === 'semifinal' && reg.qualification_stage === 'round_2_qualified') return true;
               if (s.round === 'final' && reg.qualification_stage === 'semifinal') return true;
               return false;
             });
    
    if (isPending) acc[eid].pending++;
    return acc;
  }, {} as Record<string, any>);

  const eventList = Object.values(eventGroups).filter(e => 
    e.title.toLowerCase().includes(search.toLowerCase())
  );

  const currentEventSubmissions = submissions.filter(s => s.event_id === selectedEventId).filter((reg: any) => {
    const participant = reg.participant_name || reg.participant_user?.full_name || reg.participant_user?.email || '';
    const matchesSearch = participant.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;

    if (activeTab === 'pending') {
      return reg.qualification_stage !== 'eliminated' && reg.qualification_stage !== 'winner' && 
             reg.submissions.some((s: any) => {
               if (s.round === 'round_1_qualified' && reg.qualification_stage === 'not_started') return true;
               if (s.round === 'round_2_qualified' && reg.qualification_stage === 'round_1_qualified') return true;
               if (s.round === 'semifinal' && reg.qualification_stage === 'round_2_qualified') return true;
               if (s.round === 'final' && reg.qualification_stage === 'semifinal') return true;
               return false;
             });
    } else {
      return reg.qualification_stage === 'eliminated' || reg.qualification_stage === 'winner' || (reg.qualification_stage !== 'not_started');
    }
  });

  return (
    <main className="pt-32 pb-24 px-6 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl md:text-6xl font-display font-extrabold tracking-tighter">
              {selectedEvent ? selectedEvent.title : 'Content'} <span className="text-fest-primary">Review</span>
            </h1>
            <p className="text-white/50 text-lg mt-2">
              {selectedEvent ? `Reviewing submissions for ${selectedEvent.title}` : 'Manage event submissions and decide round status.'}
            </p>
          </div>
          
          {selectedEventId && (
            <button 
              onClick={() => setSelectedEventId(null)}
              className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 text-sm font-bold transition-all flex items-center gap-2"
            >
              ← Back to Events
            </button>
          )}
        </header>

        <div className="flex flex-col md:flex-row justify-between gap-6 px-1 mb-8">
          {selectedEventId ? (
            <div className="flex bg-white/5 rounded-full p-1 border border-white/10 w-fit">
              <button
                onClick={() => setActiveTab('pending')}
                className={`px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'pending' ? 'bg-fest-primary text-fest-dark glow-primary' : 'text-white/60 hover:text-white'}`}
              >
                Needs Review
              </button>
              <button
                onClick={() => setActiveTab('reviewed')}
                className={`px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'reviewed' ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'}`}
              >
                Process
              </button>
              <button
                onClick={() => setActiveTab('drive')}
                className={`px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'drive' ? 'bg-indigo-500 text-white glow-indigo' : 'text-white/60 hover:text-white'}`}
              >
                Direct Drive
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-white/40 text-xs uppercase tracking-widest font-bold">
              <div className="w-2 h-2 rounded-full bg-fest-primary animate-pulse" />
              {eventList.length} Active Events
            </div>
          )}

          <div className="relative w-full md:w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={16} />
            <input
              type="text"
              placeholder={selectedEventId ? "Search participants..." : "Search events..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-fest-primary transition-colors"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-fest-primary" size={48} />
          </div>
        ) : !selectedEventId ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {eventList.map((evt) => (
              <motion.div
                key={evt.id}
                whileHover={{ scale: 1.02, y: -5 }}
                onClick={() => setSelectedEventId(evt.id)}
                className="glass p-8 rounded-[2.5rem] cursor-pointer group border border-white/5 hover:border-fest-primary/30 transition-all relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-fest-primary/5 blur-3xl -z-10 group-hover:bg-fest-primary/10 transition-colors" />
                <span className="text-[10px] uppercase tracking-widest text-fest-primary bg-fest-primary/10 px-3 py-1 rounded-full mb-4 inline-block font-bold">
                  {evt.category}
                </span>
                <h3 className="text-2xl font-bold font-display mb-6 group-hover:text-fest-primary transition-colors">{evt.title}</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-3xl font-black">{evt.count}</div>
                    <div className="text-[10px] uppercase text-white/30 tracking-widest mt-1">Total Registrations</div>
                  </div>
                  {evt.pending > 0 && (
                    <div className="text-right">
                      <div className="text-3xl font-black text-fest-primary">{evt.pending}</div>
                      <div className="text-[10px] uppercase text-fest-primary/50 tracking-widest mt-1">To Review</div>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        ) : activeTab === 'drive' ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4 px-2">
              <h4 className="text-indigo-400 font-bold uppercase tracking-[0.2em] text-sm">Drive Folder Contents</h4>
              <button 
                onClick={() => selectedEvent && fetchDriveFiles(selectedEvent.title)}
                disabled={loadingDrive}
                className="text-[10px] font-bold uppercase tracking-widest text-white/30 hover:text-indigo-400 transition-colors disabled:opacity-20"
              >
                {loadingDrive ? 'Syncing...' : 'Force Refresh'}
              </button>
            </div>
            {loadingDrive ? (
              <div className="py-20 flex flex-col items-center gap-4 text-white/20">
                <Loader2 className="animate-spin" size={32} />
                <span className="text-[10px] uppercase font-bold tracking-[0.3em]">Talking to Google...</span>
              </div>
            ) : driveFiles.length === 0 ? (
              <div className="glass p-20 text-center rounded-[3rem] border-white/5 opacity-50">
                No videos found in Drive for this event.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                 {driveFiles.map((file) => {
                   const isLinked = submissions.some(s => s.submissions.some(sub => sub.video_path === file.id));
                   return (
                    <motion.div
                      key={file.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="glass p-5 rounded-3xl border-white/5 hover:border-indigo-500/30 transition-all flex flex-col gap-4 relative overflow-hidden group"
                    >
                      <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         {isLinked ? <CheckCircle2 className="text-green-500" size={16} /> : <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />}
                      </div>
                      <div className="overflow-hidden rounded-xl border border-white/10 bg-black/60 p-6 flex items-center justify-center">
                         <a
                           href={`https://drive.google.com/file/d/${file.id}/view`}
                           target="_blank"
                           rel="noopener noreferrer"
                           className="px-4 py-2 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border border-indigo-500/20"
                         >
                           View on Drive
                         </a>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest line-clamp-1">{file.name}</div>
                        <div className="flex justify-between items-center text-[8px] text-white/20 font-black uppercase tracking-widest">
                           <span>{(Number(file.size) / (1024 * 1024)).toFixed(1)} MB</span>
                           <span>{new Date(file.createdTime).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </motion.div>
                   );
                 })}
              </div>
            )}
          </div>
        ) : currentEventSubmissions.length === 0 ? (
          <div className="glass text-center py-24 rounded-[3rem] border border-white/5">
            <Video className="mx-auto text-white/10 mb-6" size={64} />
            <h3 className="text-2xl font-bold opacity-50 mb-2 font-display uppercase tracking-tight">Empty Bucket</h3>
            <p className="opacity-30 text-sm max-w-xs mx-auto text-balance">
              No submissions match your current filters for this event.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <AnimatePresence mode="popLayout">
              {currentEventSubmissions.map((submission) => (
                <motion.div
                  key={submission.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="glass p-6 md:p-8 rounded-[2rem] flex flex-col gap-6 border border-white/10"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-xs font-mono bg-white/10 px-3 py-1 rounded-full text-fest-primary">
                        {submission.events.category}
                      </span>
                      <h3 className="text-2xl font-bold mt-4 font-display leading-tight">{submission.events.title}</h3>
                      <p className="text-white/60 text-sm font-medium">
                        {submission.participant_name || submission.participant_user?.full_name || submission.participant_user?.email}
                      </p>
                      <div className="flex gap-2 mt-2">
                        <span className="text-[10px] uppercase tracking-widest bg-fest-primary/10 text-fest-primary px-2 py-0.5 rounded border border-fest-primary/20 font-bold">
                          Stage: {submission.qualification_stage.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                    <Video className="text-fest-primary" size={24} />
                  </div>
                  <div className="space-y-4">
                    {submission.submissions.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(s => (
                      <div key={s.id} className="glass bg-black/40 p-5 rounded-2xl border border-white/5">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-xs font-bold text-fest-primary uppercase tracking-widest">{s.round.replace(/_/g, ' ').replace('qualified','')} Entry</span>
                          <span className="text-[10px] text-white/30 font-mono">{new Date(s.created_at).toLocaleDateString()}</span>
                        </div>
                        <VideoPreview submission={s} eventTitle={submission.events.title} />
                        {!isRoundPast(submission.qualification_stage, s.round) && (
                          <>
                            <div className="mt-6 pt-6 border-t border-white/5 space-y-4 bg-white/2 rounded-2xl p-4">
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex-1">
                                  <label className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-black block mb-2">Manual Score (0-10)</label>
                                  <div className="flex items-center gap-3">
                                    <input
                                      type="number"
                                      min="0"
                                      max="10"
                                      value={scores[s.id] || 0}
                                      onChange={(e) => setScores(p => ({ ...p, [s.id]: Number(e.target.value) }))}
                                      className="w-20 px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-fest-primary font-black text-center focus:border-fest-primary transition-all"
                                    />
                                    <span className="text-white/20 font-display font-medium">/ 10</span>
                                  </div>
                                </div>
                                <button
                                  onClick={() => saveReviewData(s.id)}
                                  disabled={savingScoreId === s.id}
                                  className="px-6 py-3 bg-fest-primary/10 text-fest-primary hover:bg-fest-primary hover:text-fest-dark rounded-xl text-[10px] uppercase font-bold tracking-widest transition-all border border-fest-primary/20 flex items-center gap-2"
                                >
                                   {savingScoreId === s.id ? <Loader2 className="animate-spin" size={14} /> : <><Save size={14} /> Save</>}
                                </button>
                              </div>
                              <textarea
                                value={notes[s.id] || ''}
                                onChange={(e) => setNotes((current) => ({ ...current, [s.id]: e.target.value }))}
                                placeholder="Add private judge notes..."
                                className="w-full h-20 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-fest-primary resize-none transition-colors"
                              />
                            </div>
                            {activeTab === 'pending' && (
                              <div className="grid grid-cols-2 gap-4 mt-8 pt-2 border-t border-white/5">
                                <button
                                  onClick={() => handleDecision(submission.id, s.round, 'selected')}
                                  disabled={actionLoading === submission.id}
                                  className="py-4 bg-fest-primary text-fest-dark rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-fest-primary-light transition-all flex items-center justify-center gap-2 glow-primary"
                                >
                                  {actionLoading === submission.id ? <Loader2 className="animate-spin" size={16} /> : <><CheckCircle2 size={16} /> Promote</>}
                                </button>
                                <button
                                  onClick={() => handleDecision(submission.id, s.round, 'eliminated')}
                                  disabled={actionLoading === submission.id}
                                  className="py-4 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 border border-red-500/20"
                                >
                                  {actionLoading === submission.id ? <Loader2 className="animate-spin" size={16} /> : <><XCircle size={16} /> Eliminate</>}
                                </button>
                              </div>
                            )}
                          </>
                        )}
                        {isRoundPast(submission.qualification_stage, s.round) && (
                          <div className="mt-4 px-4 py-4 bg-fest-primary/5 border border-fest-primary/10 rounded-2xl flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                              <div className="flex flex-col">
                                <div className="text-[10px] text-fest-primary uppercase tracking-[0.2em] font-black mb-1">Final Result</div>
                                <div className="text-[10px] font-bold text-white/60">Stage Successful</div>
                              </div>
                              <div className="flex items-center gap-2 bg-fest-primary/10 px-4 py-2 rounded-xl border border-fest-primary/20">
                                <span className="text-2xl font-display font-black text-fest-primary">{scores[s.id] || 0}</span>
                                <span className="text-[10px] text-fest-primary/40 font-bold uppercase tracking-widest pt-1">/ 10</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {activeTab === 'reviewed' && (
                    <div className={`text-center w-full uppercase tracking-widest text-[10px] font-black py-4 rounded-xl ${submission.qualification_stage === 'eliminated' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-fest-primary/20 text-fest-primary border border-fest-primary/20'}`}>
                      STATUS: {submission.qualification_stage === 'eliminated' ? 'Eliminated' : 'Promoted'}
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </main>
  );
}
