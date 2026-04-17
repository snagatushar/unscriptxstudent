import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../lib/api';
import { Loader2, Plus, Users, CalendarDays, ShieldCheck, CheckSquare, ExternalLink, CheckCircle2, XCircle, Search, Download, Trash2, Pencil, ImagePlus, ArrowLeft, Phone, Mail, ChevronRight, SlidersHorizontal, Save, Image as ImageIcon, DollarSign, Menu, X, ChevronDown, LogOut, ListFilter, Video } from 'lucide-react';
import toast from 'react-hot-toast';
import { AppRole, CommitteeMember, DatabaseEvent, GeneralRule, HeroSlide, QualificationStage, SiteContent } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { exportToExcel } from '../lib/excel';
import { openPaymentScreenshot, openIdCard, uploadToS3, deleteFromS3 } from '../lib/storage';
import { getDriveStreamUrl } from '../lib/drive';
import { 
  Activity,
  History,
  Clock,
  Layout
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { logAdminAction } from '../lib/audit';

type DashboardTab = 'events' | 'payment_reviews' | 'qualified_rounds' | 'users' | 'judges_access' | 'payment_access' | 'registrations' | 'ui' | 'system_logs' | 'contact_messages';

type AuditLogRow = {
  id: string;
  actor_id: string;
  action_type: string;
  target_id: string;
  details: any;
  created_at: string;
  actor_user: { full_name: string | null; email: string; role: string } | null;
};

type AppUser = {
  id: string;
  full_name: string | null;
  email: string;
  role: AppRole;
  phone: string | null;
  college_name: string | null;
};

type ReviewerAssignment = {
  id: string;
  reviewer_id: string;
  event_id: string;
  role_type: 'judge' | 'payment';
  reviewer_user: { full_name: string | null; email: string; role: AppRole } | null;
  assigned_event: { title: string; category: string } | null;
};

type RegistrationRow = {
  id: string;
  event_id: string;
  participant_name: string | null;
  email: string | null;
  phone: string;
  college_name: string | null;
  team_name: string | null;
  team_size: number;
  sub_category: string | null;
  team_members: { name: string; game_id: string }[] | null;
  payment_status: 'pending' | 'approved' | 'rejected';
  payment_screenshot_url: string;
  id_card_url?: string | null;
  payment_review_notes: string | null;
  upload_enabled: boolean;
  submission_status: string;
  review_status: string;
  qualification_stage: QualificationStage;
  qualification_notes: string | null;
  participant_user: { full_name: string | null; email: string } | null;
  event: { title: string; category: string } | null;
  submissions: {
    id: string;
    round: string;
    video_url: string;
    video_path: string;
    created_at: string;
    notes: string | null;
    internal_reviews: { score: number; judge_remarks: string }[] | null;
  }[];
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

function getNextRound(stage: QualificationStage): { id: QualificationStage; name: string } | null {
  switch (stage) {
    case 'not_started': return { id: 'round_1_qualified', name: 'Round 1' };
    case 'round_1_qualified': return { id: 'round_2_qualified', name: 'Round 2' };
    case 'round_2_qualified': return { id: 'semifinal', name: 'Semifinal' };
    case 'semifinal': return { id: 'final', name: 'Final' };
    default: return null;
  }
}

function VideoPreview({ submission, eventTitle, onSave, isPast }: { submission: any; eventTitle: string; onSave: (id: string, score: number, remarks: string) => void; isPast?: boolean }) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState(0);
  const [remarks, setRemarks] = useState('');

  // Always sync state with the actual data from props
  useEffect(() => {
    async function syncData() {
      // If props already have results, use them
      if (submission.internal_reviews && submission.internal_reviews.length > 0) {
        setScore(submission.internal_reviews[0].score || 0);
        setRemarks(submission.internal_reviews[0].judge_remarks || '');
        return;
      }

      // Fallback: Fetch directly from the table if props are empty
      try {
        const reviews = await api.get<any[]>(`/api/admin?resource=internal_reviews`);
        const data = reviews.find(r => r.submission_id === submission.id);
        if (data) {
          setScore(data.score || 0);
          setRemarks(data.judge_remarks || '');
        }
      } catch (err) {
        console.error('Error fetching review:', err);
      }
    }
    syncData();
  }, [submission]);

  useEffect(() => {
    async function getUrl() {
      try {
        const url = await getDriveStreamUrl(submission.video_path);
        setVideoUrl(url);
      } catch (error) {
        console.error('Error creating signed URL:', error);
        setVideoUrl(null);
      }
      setLoading(false);
    }
    getUrl();
  }, [submission.video_path, eventTitle]);

  if (loading) return (
    <div className="w-full h-32 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 animate-pulse">
      <Loader2 className="animate-spin text-white/20" size={16} />
    </div>
  );

  if (!videoUrl) return null;

  return (
    <div className={`space-y-4 p-4 rounded-2xl border transition-all ${isPast ? 'bg-white/2 border-white/5' : 'bg-black/40 border-white/10'}`}>
      <div className="flex justify-between items-center px-1">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-fest-primary uppercase tracking-widest text-shadow-glow">
              {submission.round.replace(/_/g, ' ').replace('qualified','')} Entry
            </span>
            {isPast && (
              <span className="text-[8px] px-1.5 py-0.5 bg-white/10 text-white/40 rounded uppercase font-black">History</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <input
              type="number"
              min="0"
              max="10"
              value={score}
              onChange={(e) => setScore(Number(e.target.value))}
              className="w-12 bg-white/10 border border-white/10 rounded-lg text-fest-primary font-black text-center text-sm py-1 focus:border-fest-primary transition-all"
            />
            <span className="text-[10px] text-white/30 font-bold uppercase tracking-widest">/ 10 PTS</span>
          </div>
        </div>
        
        <button
          onClick={() => onSave(submission.id, score, remarks)}
          className="p-2 bg-fest-primary/10 text-fest-primary hover:bg-fest-primary hover:text-fest-dark rounded-lg transition-all border border-fest-primary/20"
          title="Update Points & Remarks"
        >
          <Save size={14} />
        </button>
      </div>

      <video 
        src={videoUrl} 
        controls 
        className="w-full aspect-video rounded-xl bg-black border border-white/10 shadow-[0_0_20px_rgba(0,0,0,0.5)]" 
      />

      <div className="rounded-xl px-3 py-2 border bg-black/30 border-white/10">
        <textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Admin notes / Judge remarks..."
          className="w-full bg-transparent text-[10px] text-white/60 outline-none resize-none transition-colors italic h-16"
        />
      </div>
    </div>
  );
}

const ROLE_OPTIONS: AppRole[] = ['user', 'payment_reviewer', 'content_reviewer', 'admin'];

const emptyEventForm = {
  title: '',
  category: '',
  description: '',
  entry_fee: 0,
  max_team_size: 1,
  payment_account_name: '',
  payment_account_number: '',
  payment_ifsc: '',
  payment_upi_id: '',
  image_url: '',
  rules: '',
  sub_categories: [] as string[],
  requires_team_details: false,
};

const defaultSiteContent = (contentKey: string): SiteContent => ({
  content_key: contentKey,
  title: '',
  subtitle: '',
  body: '',
  secondary_body: '',
  image_url: '',
  metadata: {},
});

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>(() => {
    const saved = sessionStorage.getItem('admin_active_tab') as DashboardTab | null;
    return saved || 'events';
  });
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [activePaymentSection, setActivePaymentSection] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [events, setEvents] = useState<DatabaseEvent[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [assignments, setAssignments] = useState<ReviewerAssignment[]>([]);
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>([]);
  const [siteContent, setSiteContent] = useState<Record<string, SiteContent>>({
    home_about_event: defaultSiteContent('home_about_event'),
    home_about_college: defaultSiteContent('home_about_college'),
    home_about_school: defaultSiteContent('home_about_school'),
    home_why_join: defaultSiteContent('home_why_join'),
    home_team_group: defaultSiteContent('home_team_group'),
    about_hero: defaultSiteContent('about_hero'),
    about_mission: defaultSiteContent('about_mission'),
    about_community: defaultSiteContent('about_community'),
    about_vision: defaultSiteContent('about_vision'),
    about_story: defaultSiteContent('about_story'),
    contact_info: defaultSiteContent('contact_info'),
  });
  const [committeeEntries, setCommitteeEntries] = useState<CommitteeMember[]>([]);
  const [guidelineEntries, setGuidelineEntries] = useState<GeneralRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegistrationEventId, setSelectedRegistrationEventId] = useState('');
  const [selectedPaymentEventId, setSelectedPaymentEventId] = useState('');
  const [selectedQualifiedEventId, setSelectedQualifiedEventId] = useState('');
  const [registrationSearch, setRegistrationSearch] = useState('');
  const [paymentSearch, setPaymentSearch] = useState('');
  const [qualificationSearch, setQualificationSearch] = useState('');
  const [createdEventsSearch, setCreatedEventsSearch] = useState('');
  const [createdEventsCategory, setCreatedEventsCategory] = useState('all');
  const [isCreatedEventsExpanded, setIsCreatedEventsExpanded] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
  const [paymentNotes, setPaymentNotes] = useState<Record<string, string>>({});
  const [qualificationNotes, setQualificationNotes] = useState<Record<string, string>>({});
  const [expandedQualifiedRows, setExpandedQualifiedRows] = useState<Record<string, boolean>>({});
  const [expandedRegisterRows, setExpandedRegisterRows] = useState<Record<string, boolean>>({});
  const [contactMessages, setContactMessages] = useState<any[]>([]);

  const [newEvent, setNewEvent] = useState(emptyEventForm);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventImageUploading, setEventImageUploading] = useState(false);
  const [eventImageDeleting, setEventImageDeleting] = useState(false);
  const [uiSaving, setUiSaving] = useState(false);
  const [newSlideDuration, setNewSlideDuration] = useState(2);
  const [committeeForm, setCommitteeForm] = useState({ name: '', role: '', image_url: '', display_order: 0 });
  const [editingGuidelineId, setEditingGuidelineId] = useState<string | null>(null);
  const [ruleForm, setRuleForm] = useState({ rule_text: '', display_order: 0 });
  const [reviewerId, setReviewerId] = useState('');
  const [assignmentEventId, setAssignmentEventId] = useState('');
  const [activeQualifiedStage, setActiveQualifiedStage] = useState<'all' | QualificationStage>('all');
  const [subCategoryInput, setSubCategoryInput] = useState('');

  useEffect(() => {
    sessionStorage.setItem('admin_active_tab', activeTab);
    void fetchData(false);
  }, [activeTab]);

  useEffect(() => {
    setActivePaymentSection('pending');
    setPaymentSearch('');
  }, [selectedPaymentEventId]);

  const fetchAuditLogs = async () => {
    try {
      const data = await api.get<AuditLogRow[]>('/api/admin?resource=audit_logs_detailed');
      setAuditLogs(data);
    } catch (err) {
      console.error('Failed to fetch audit logs');
    }
  };

  const fetchData = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      if (activeTab === 'events') {
        const [eventsData, registrationsData] = await Promise.all([
          api.get<any[]>('/api/admin?resource=events'),
          api.get<any[]>('/api/admin?resource=registrations_detailed'),
        ]);

        const mappedEvents = eventsData.map((event) => ({
          ...event,
          entry_fee: Number(event.entry_fee || 0),
          rules: event.rules || [],
        }));
        
        const mappedRegistrations = registrationsData.map(reg => ({
          ...reg,
          participant_user: { full_name: reg.participant_user_name, email: reg.participant_user_email },
          event: { title: reg.event_title, category: reg.event_category, requires_team_details: reg.event_requires_team_details },
          submissions: [] // Submissions requires a separate view or nested fetch if needed, but for list view usually ok
        })) as unknown as RegistrationRow[];

        setEvents(mappedEvents);
        setRegistrations(mappedRegistrations);
      }

      if (activeTab === 'registrations' || activeTab === 'payment_reviews' || activeTab === 'qualified_rounds') {
        const [eventsData, registrationsData] = await Promise.all([
          api.get<any[]>('/api/admin?resource=events'),
          api.get<any[]>('/api/admin?resource=registrations_detailed'),
        ]);

        const mappedEvents = eventsData.map((event) => ({
          ...event,
          entry_fee: Number(event.entry_fee || 0),
          rules: event.rules || [],
        }));

        const mappedRegistrations = registrationsData.map(reg => ({
          ...reg,
          participant_user: { full_name: reg.participant_user_name, email: reg.participant_user_email },
          event: { title: reg.event_title, category: reg.event_category, requires_team_details: reg.event_requires_team_details },
          submissions: reg.submissions || []
        })) as unknown as RegistrationRow[];

        setEvents(mappedEvents);
        setRegistrations(mappedRegistrations);

        setPaymentNotes(
          mappedRegistrations.reduce((acc, registration) => {
            acc[registration.id] = registration.payment_review_notes || '';
            return acc;
          }, {} as Record<string, string>)
        );
        setQualificationNotes(
          mappedRegistrations.reduce((acc, registration) => {
            acc[registration.id] = registration.qualification_notes || '';
            return acc;
          }, {} as Record<string, string>)
        );

        if (!selectedRegistrationEventId && mappedEvents[0]?.id) setSelectedRegistrationEventId(mappedEvents[0].id);
        if (!selectedPaymentEventId && mappedEvents[0]?.id) setSelectedPaymentEventId(mappedEvents[0].id);
        if (!selectedQualifiedEventId && mappedEvents[0]?.id) setSelectedQualifiedEventId(mappedEvents[0].id);
      }

      if (activeTab === 'users') {
        const data = await api.get<AppUser[]>('/api/admin?resource=users');
        setUsers(data || []);
      }

      if (activeTab === 'judges_access' || activeTab === 'payment_access') {
        const assignmentsData = await api.get<any[]>('/api/admin?resource=reviewer_event_assignments');
        setAssignments(assignmentsData || []);

        const eventData = await api.get<any[]>('/api/admin?resource=events');
        setEvents(eventData.map(e => ({ ...e, entry_fee: Number(e.entry_fee || 0), rules: e.rules || [] })));

        const userData = await api.get<AppUser[]>('/api/admin?resource=users');
        setUsers(userData.filter(u => ['content_reviewer', 'payment_reviewer', 'admin'].includes(u.role)));
      }

      if (activeTab === 'ui') {
        const [slideData, contentData, committeeData, rulesData] = await Promise.all([
          api.get<HeroSlide[]>('/api/admin?resource=hero_slideshow'),
          api.get<SiteContent[]>('/api/admin?resource=site_content'),
          api.get<CommitteeMember[]>('/api/admin?resource=committee'),
          api.get<GeneralRule[]>('/api/admin?resource=general_rules'),
        ]);

        setHeroSlides(slideData || []);
        setCommitteeEntries(committeeData || []);
        setGuidelineEntries(rulesData || []);

        const contentMap = {
          home_about_event: defaultSiteContent('home_about_event'),
          home_about_college: defaultSiteContent('home_about_college'),
          home_about_school: defaultSiteContent('home_about_school'),
          home_why_join: defaultSiteContent('home_why_join'),
          home_team_group: defaultSiteContent('home_team_group'),
          about_hero: defaultSiteContent('about_hero'),
          about_mission: defaultSiteContent('about_mission'),
          about_community: defaultSiteContent('about_community'),
          about_vision: defaultSiteContent('about_vision'),
          about_story: defaultSiteContent('about_story'),
          contact_info: defaultSiteContent('contact_info'),
        } as Record<string, SiteContent>;

        (contentData || []).forEach((entry) => {
          contentMap[entry.content_key] = {
            ...defaultSiteContent(entry.content_key),
            ...entry,
            metadata: entry.metadata || {},
          };
        });

        setSiteContent(contentMap);
      }

      if (activeTab === 'system_logs') {
        await fetchAuditLogs();
      }

      if (activeTab === 'contact_messages') {
        const data = await api.get<any[]>('/api/admin?resource=contact_messages');
        setContactMessages(data || []);
      }

    } catch (err: any) {
      toast.error(err.message || 'Failed to load admin data.');
    } finally {
      setLoading(false);
    }
  };

  const selectedRegistrationEventRows = useMemo(() => {
    const filteredByEvent = registrations.filter((registration) => registration.event_id === selectedRegistrationEventId);
    if (!registrationSearch.trim()) return filteredByEvent;

    const term = registrationSearch.toLowerCase();
    return filteredByEvent.filter((registration) => {
      const participant = registration.participant_name || registration.participant_user?.full_name || registration.participant_user?.email || '';
      return (
        participant.toLowerCase().includes(term) ||
        (registration.email || '').toLowerCase().includes(term) ||
        registration.phone.toLowerCase().includes(term) ||
        (registration.team_name || '').toLowerCase().includes(term)
      );
    });
  }, [registrations, selectedRegistrationEventId, registrationSearch]);

  const selectedPaymentEventRows = useMemo(() => {
    const filteredByEvent = registrations.filter((registration) => registration.event_id === selectedPaymentEventId);
    if (!paymentSearch.trim()) return filteredByEvent;

    const term = paymentSearch.toLowerCase();
    return filteredByEvent.filter((registration) => {
      const participant = registration.participant_name || registration.participant_user?.full_name || registration.participant_user?.email || '';
      return (
        participant.toLowerCase().includes(term) ||
        (registration.email || '').toLowerCase().includes(term) ||
        registration.phone.toLowerCase().includes(term) ||
        (registration.team_name || '').toLowerCase().includes(term)
      );
    });
  }, [registrations, selectedPaymentEventId, paymentSearch]);

  const selectedPaymentEventSummary = useMemo(() => {
    const rows = registrations.filter((registration) => registration.event_id === selectedPaymentEventId);
    return {
      total: rows.length,
      pending: rows.filter((registration) => registration.payment_status === 'pending').length,
      approved: rows.filter((registration) => registration.payment_status === 'approved').length,
      rejected: rows.filter((registration) => registration.payment_status === 'rejected').length,
      uploadEnabled: rows.filter((registration) => registration.upload_enabled).length,
    };
  }, [registrations, selectedPaymentEventId]);

  const selectedQualifiedEventRows = useMemo(() => {
    const filteredByEvent = registrations.filter((registration) => registration.event_id === selectedQualifiedEventId);
    const filteredBySearch = qualificationSearch.trim()
      ? filteredByEvent.filter((registration) => {
          const participant = registration.participant_name || registration.participant_user?.full_name || registration.participant_user?.email || '';
          const term = qualificationSearch.toLowerCase();
          return (
            participant.toLowerCase().includes(term) ||
            (registration.email || '').toLowerCase().includes(term) ||
            registration.phone.toLowerCase().includes(term) ||
            (registration.team_name || '').toLowerCase().includes(term)
          );
        })
      : filteredByEvent;

    if (activeQualifiedStage === 'all') return filteredBySearch;
    return filteredBySearch.filter((registration) => registration.qualification_stage === activeQualifiedStage);
  }, [registrations, selectedQualifiedEventId, qualificationSearch, activeQualifiedStage]);

  const selectedRegistrationEvent = events.find((event) => event.id === selectedRegistrationEventId) || null;
  const selectedPaymentEvent = events.find((event) => event.id === selectedPaymentEventId) || null;
  const selectedQualifiedEvent = events.find((event) => event.id === selectedQualifiedEventId) || null;

  const uniqueEventCategories = useMemo(() => {
    return Array.from(new Set(events.map(e => e.category))).filter(Boolean);
  }, [events]);

  const filteredCreatedEvents = useMemo(() => {
    return events.filter((event) => {
      const matchesSearch = 
        event.title.toLowerCase().includes(createdEventsSearch.toLowerCase()) ||
        event.category.toLowerCase().includes(createdEventsSearch.toLowerCase());
      const matchesCategory = createdEventsCategory === 'all' || event.category === createdEventsCategory;
      return matchesSearch && matchesCategory;
    });
  }, [events, createdEventsSearch, createdEventsCategory]);

  const resetEventForm = () => {
    setNewEvent(emptyEventForm);
    setEditingEventId(null);
  };

  const startEditingEvent = (event: DatabaseEvent) => {
    setEditingEventId(event.id);
    setNewEvent({
      title: event.title || '',
      category: event.category || '',
      description: event.description || '',
      entry_fee: Number(event.entry_fee || 0),
      max_team_size: Number(event.max_team_size || 1),
      payment_account_name: event.payment_account_name || '',
      payment_account_number: event.payment_account_number || '',
      payment_ifsc: event.payment_ifsc || '',
      payment_upi_id: event.payment_upi_id || '',
      image_url: event.image_url || '',
      rules: (event.rules || []).join('\n'),
      sub_categories: event.sub_categories || [],
      requires_team_details: !!event.requires_team_details,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const uploadAsset = async (file: File, folder: string) => {
    const { publicUrl } = await uploadToS3(file, folder);
    return publicUrl;
  };

  const handleEventImageUpload = async (file: File) => {
    setEventImageUploading(true);
    try {
      const imageUrl = await uploadAsset(file, 'events');
      setNewEvent((current) => ({ ...current, image_url: imageUrl }));
      toast.success('Front image uploaded.');
    } catch (err: any) {
      toast.error(err.message || 'Could not upload event image.');
    } finally {
      setEventImageUploading(false);
    }
  };

  const extractStoragePath = (url: string) => {
    try {
      const urlObj = new URL(url);
      // For S3 URLs, the path starts with a slash, we remove the leading slash for the key
      const key = urlObj.pathname.startsWith('/') ? urlObj.pathname.substring(1) : urlObj.pathname;
      
      // If the old Supabase URL is still used, try to extract it from there
      const parts = urlObj.pathname.split('/storage/v1/object/public/assets/');
      if (parts.length > 1) {
        return parts[1];
      }
      return key;
    } catch (e) {
      return null;
    }
  };

  const handleDeleteAsset = async (imageUrl: string) => {
    if (!imageUrl) return;
    
    setEventImageDeleting(true);
    try {
      const path = extractStoragePath(imageUrl);
      if (!path) {
        setNewEvent((current) => ({ ...current, image_url: '' }));
        return;
      }

      await deleteFromS3(path);

      setNewEvent((current) => ({ ...current, image_url: '' }));
      toast.success('Front image removed from storage.');
    } catch (err: any) {
      toast.error(err.message || 'Could not delete asset from storage.');
    } finally {
      setEventImageDeleting(false);
    }
  };

  const saveSiteContent = async (contentKey: string) => {
    setUiSaving(true);
    try {
      const entry = siteContent[contentKey];
      const record = {
        content_key: contentKey,
        title: entry.title || null,
        subtitle: entry.subtitle || null,
        body: entry.body || null,
        secondary_body: entry.secondary_body || null,
        image_url: entry.image_url || null,
        metadata: entry.metadata || {},
      };

      if (entry.id) {
        await api.post('/api/admin', { action: 'update', table: 'site_content', id: entry.id, record });
      } else {
        await api.post('/api/admin', { action: 'insert', table: 'site_content', record });
      }
      toast.success('Content updated.');
      
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Could not save content.');
    } finally {
      setUiSaving(false);
    }
  };

  const handleSlideUpload = async (file: File) => {
    setUiSaving(true);
    try {
      const imageUrl = await uploadAsset(file, 'slideshow');
      await api.post('/api/admin', { 
        action: 'insert', 
        table: 'hero_slideshow', 
        record: {
          image_url: imageUrl,
          duration_seconds: Math.max(1, newSlideDuration),
          display_order: heroSlides.length,
        }
      });
      toast.success('Slide added.');
      setNewSlideDuration(2);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Could not add slide.');
    } finally {
      setUiSaving(false);
    }
  };

  const handleDeleteSlide = async (id: string) => {
    try {
      await api.post('/api/admin', { action: 'delete', table: 'hero_slideshow', id });
      toast.success('Slide removed.');
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Could not delete slide.');
    }
  };

  const handleAddCommitteeMember = async () => {
    if (!committeeForm.name || !committeeForm.role || !committeeForm.image_url) {
      toast.error('Add name, designation and image first.');
      return;
    }

    try {
      await api.post('/api/admin', {
        action: 'insert',
        table: 'committee',
        record: {
          name: committeeForm.name,
          role: committeeForm.role,
          image_url: committeeForm.image_url,
          display_order: committeeForm.display_order,
        }
      });
      toast.success('Committee member added.');
      setCommitteeForm({ name: '', role: '', image_url: '', display_order: 0 });
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Could not add committee member.');
    }
  };

  const handleDeleteCommitteeMember = async (id: string) => {
    try {
      await api.post('/api/admin', { action: 'delete', table: 'committee', id });
      toast.success('Committee member removed.');
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Could not remove committee member.');
    }
  };

  const handleAddGuideline = async () => {
    if (!ruleForm.rule_text.trim()) {
      toast.error('Enter a guideline first.');
      return;
    }

    try {
      const action = editingGuidelineId ? 'update' : 'insert';
      await api.post('/api/admin', { 
        action, 
        table: 'general_rules', 
        id: editingGuidelineId, 
        record: {
          rule_text: ruleForm.rule_text.trim(),
          display_order: ruleForm.display_order,
        }
      });
      
      toast.success(editingGuidelineId ? 'Guideline updated.' : 'Guideline added.');
      setEditingGuidelineId(null);
      setRuleForm({ rule_text: '', display_order: 0 });
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || (editingGuidelineId ? 'Could not update guideline.' : 'Could not add guideline.'));
    }
  };

  const handleDeleteGuideline = async (id: string) => {
    try {
      await api.post('/api/admin', { action: 'delete', table: 'general_rules', id });
      toast.success('Guideline removed.');
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Could not remove guideline.');
    }
  };

  const startEditingGuideline = (rule: GeneralRule) => {
    setEditingGuidelineId(rule.id);
    setRuleForm({
      rule_text: rule.rule_text,
      display_order: rule.display_order,
    });
  };

  const exportQualifiedToExcel = async () => {
    if (selectedQualifiedEventRows.length === 0) {
      toast.error('No participants to export.');
      return;
    }

    const data = selectedQualifiedEventRows.map(reg => {
      const sortedSubmissions = [...(reg.submissions || [])].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const currentSub = sortedSubmissions[0];
      
      return {
        'Participant Name': reg.participant_name || reg.participant_user?.full_name || 'N/A',
        'College': reg.college_name || 'N/A',
        'Email': reg.email || reg.participant_user?.email || 'N/A',
        'Phone': reg.phone || 'N/A',
        'Event': reg.event?.title || 'N/A',
        'Category/Slot': reg.sub_category || 'N/A',
        'Current Stage': reg.qualification_stage.replace(/_/g, ' ').toUpperCase(),
        'Latest Score': currentSub?.internal_reviews?.[0]?.score || 0,
        'Judge Remarks': currentSub?.internal_reviews?.[0]?.judge_remarks || 'No notes',
        'Submission Date': currentSub ? new Date(currentSub.created_at).toLocaleString() : 'No submission',
        ...((reg.team_members || []).reduce((acc, member, idx) => ({
          ...acc,
          [`Player ${idx + 1} Name`]: member.name,
          [`Player ${idx + 1} ID`]: member.game_id,
        }), {}))
      };
    });

    const fileName = `UNSCRIPTX_${activeQualifiedStage}_${selectedQualifiedEvent?.title || 'all_events'}.xlsx`.toLowerCase().replace(/\s+/g, '_');
    await exportToExcel(data, 'Qualified Participants', fileName);
    toast.success('Excel downloaded successfully.');
  };

  const handleEventCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const rulesArray = newEvent.rules.split('\n').map((rule) => rule.trim()).filter(Boolean);
      const payload = {
        ...newEvent,
        slug: newEvent.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        image_url: newEvent.image_url || null,
        rules: rulesArray,
        is_active: true,
      };

      const action = editingEventId ? 'update' : 'insert';
      await api.post('/api/admin', { 
        action, 
        table: 'events', 
        id: editingEventId, 
        record: payload 
      });

      toast.success(editingEventId ? 'Event updated.' : 'Event created.');
      
      // Proactively create subcategory folders on Google Drive
      if (payload.sub_categories && payload.sub_categories.length > 0) {
        try {
          const token = localStorage.getItem('unscriptx_token');
          if (token) {
            const driveRes = await fetch('/api/drive-create-folders', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({
                eventTitle: payload.title,
                subCategories: payload.sub_categories,
              }),
            });
            if (driveRes.ok) {
              const result = await driveRes.json();
              toast.success(`Created ${result.created.length} subcategory folder(s) on Google Drive.`);
            }
          }
        } catch (driveErr: any) {
          console.warn('Drive folder creation failed', driveErr);
        }
      }

      setIsCreatedEventsExpanded(true);
      resetEventForm();
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || (editingEventId ? 'Could not update event.' : 'Could not create event.'));
    }
  };

  const handleAddSubCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const cat = subCategoryInput.trim();
    if (!cat) return;
    if (newEvent.sub_categories.includes(cat)) {
      toast.error('Category already exists');
      return;
    }
    setNewEvent(curr => ({
      ...curr,
      sub_categories: [...curr.sub_categories, cat]
    }));
    setSubCategoryInput('');
  };

  const handleRemoveSubCategory = (catToRemove: string) => {
    setNewEvent(curr => ({
      ...curr,
      sub_categories: curr.sub_categories.filter(c => c !== catToRemove)
    }));
  };


  const handleDeleteEvent = async (eventId: string, eventTitle: string) => {
    if (!window.confirm(`Delete "${eventTitle}"?\n\nThis will also remove registrations and event assignments linked to it.`)) {
      return;
    }

    try {
      await api.post('/api/admin', { action: 'delete', table: 'events', id: eventId });
      toast.success('Event deleted.');
      
      await logAdminAction(user?.id || '', 'EVENT_DELETE', eventId, {
        title: eventTitle
      });

      if (selectedRegistrationEventId === eventId) setSelectedRegistrationEventId('');
      if (selectedPaymentEventId === eventId) setSelectedPaymentEventId('');
      if (selectedQualifiedEventId === eventId) setSelectedQualifiedEventId('');
      if (assignmentEventId === eventId) setAssignmentEventId('');
      if (editingEventId === eventId) resetEventForm();

      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Could not delete event.');
    }
  };

  const handleRoleChange = async (userId: string, role: AppRole) => {
    try {
      await api.post('/api/admin', { action: 'update', table: 'users', id: userId, record: { role } });
      toast.success('Role updated.');
      
      const targetUser = users.find(u => u.id === userId);
      await logAdminAction(user?.id || '', 'ROLE_UPDATE', userId, {
        new_role: role,
        email: targetUser?.email,
        name: targetUser?.full_name
      });
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Role update failed.');
    }
  };

  const handleAssignmentCreate = async (e: React.FormEvent, roleType: 'judge' | 'payment') => {
    e.preventDefault();
    if (!reviewerId || !assignmentEventId) {
      toast.error('Select both reviewer and event.');
      return;
    }

    try {
      await api.post('/api/admin', { 
        action: 'insert', 
        table: 'reviewer_event_assignments', 
        record: { 
          reviewer_id: reviewerId, 
          event_id: assignmentEventId,
          role_type: roleType
        }
      });
      toast.success(`${roleType === 'judge' ? 'Judge' : 'Payment staff'} assigned to event.`);
      
      const reviewer = users.find(u => u.id === reviewerId);
      const event = events.find(e => e.id === assignmentEventId);
      await logAdminAction(user?.id || '', 'ASSIGNMENT_CREATE', reviewerId, {
        role_type: roleType,
        event: event?.title,
        staff_name: reviewer?.full_name || reviewer?.email
      });
      setReviewerId('');
      setAssignmentEventId('');
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Assignment failed.');
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    try {
      await api.post('/api/admin', { action: 'delete', table: 'reviewer_event_assignments', id: assignmentId });
      toast.success('Assignment removed.');
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Delete failed.');
    }
  };

  const handlePaymentDecision = async (registrationId: string, decision: 'approved' | 'rejected') => {
    setActionLoadingId(registrationId);
    try {
      const approve = decision === 'approved';
      await api.post('/api/admin', { 
        action: 'update', 
        table: 'registrations', 
        id: registrationId, 
        record: {
          payment_status: decision,
          payment_review_notes: paymentNotes[registrationId] || null,
          payment_reviewed_by: user?.id || null,
          payment_reviewed_at: new Date().toISOString(),
          upload_enabled: approve,
          upload_enabled_by: approve ? user?.id || null : null,
          upload_enabled_at: approve ? new Date().toISOString() : null,
          submission_status: approve ? 'ready' : 'locked',
        }
      });
      toast.success(approve ? 'Payment approved and upload opened.' : 'Payment rejected.');
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Action failed.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const exportRegistrationsForEvent = async (event: DatabaseEvent, eventRows: RegistrationRow[]) => {
    if (!event) {
      toast.error('Select an event first.');
      return;
    }

    const rows = eventRows.map((registration) => ({
      participant_name: registration.participant_name || registration.participant_user?.full_name || '',
      email: registration.email || registration.participant_user?.email || '',
      phone: registration.phone,
      college_name: registration.college_name || '',
      team_name: registration.team_name || '',
      sub_category: registration.sub_category || '',
      ...((registration.team_members || []).reduce((acc, member, idx) => ({
        ...acc,
        [`player_${idx + 1}_name`]: member.name,
        [`player_${idx + 1}_id`]: member.game_id,
      }), {})),
      payment_status: registration.payment_status,
      id_card_url: registration.id_card_url || '',
      upload_enabled: registration.upload_enabled ? 'Yes' : 'No',
      submission_status: registration.submission_status,
      review_status: registration.review_status,
    }));

    const safeName = event.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    await exportToExcel(rows, 'Registrations', `${safeName}_registrations_export.xlsx`);
    toast.success('Excel exported.');
  };

  const handleDeleteRegistration = async (id: string, name: string) => {
    if (!window.confirm(`Permanently delete registration for ${name}?`)) return;

    try {
      await api.post('/api/admin', { action: 'delete', table: 'registrations', id });
      toast.success('Registration deleted.');
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Could not delete registration.');
    }
  };

  const handleViewScreenshot = async (pathOrUrl: string) => {
    try {
      await openPaymentScreenshot(pathOrUrl);
    } catch (err: any) {
      toast.error(err.message || 'Could not open payment screenshot.');
    }
  };

  const handleViewIdCard = async (pathOrUrl: string) => {
    if (!pathOrUrl) return toast.error('No ID Card available for this registration.');
    try {
      await openIdCard(pathOrUrl);
    } catch (err: any) {
      toast.error(err.message || 'Could not open ID Card.');
    }
  };


  const handleQualificationStage = async (registration: RegistrationRow, stage: QualificationStage) => {
    setActionLoadingId(registration.id);
    try {
      const shouldKeepUploadOpen =
        registration.payment_status === 'approved' && stage !== 'eliminated';

      await api.post('/api/admin', {
        action: 'update',
        table: 'registrations',
        id: registration.id,
        record: {
          qualification_stage: stage,
          qualification_notes: qualificationNotes[registration.id] || null,
          upload_enabled: shouldKeepUploadOpen,
          upload_enabled_by: shouldKeepUploadOpen ? user?.id || null : null,
          upload_enabled_at: shouldKeepUploadOpen ? new Date().toISOString() : null,
          submission_status: shouldKeepUploadOpen ? 'ready' : 'locked',
        }
      });

      toast.success('Qualification stage updated.');
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Could not update qualification stage.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const renderPaymentCards = (rows: RegistrationRow[], section: 'pending' | 'approved' | 'rejected') => {
    if (rows.length === 0) {
      return (
        <div className="rounded-3xl border border-dashed border-white/10 py-12 text-center text-white/35">
          No {section} registrations in this section.
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 max-w-5xl">
        {rows.map((registration) => (
          <div key={registration.id} className="rounded-3xl border border-white/10 bg-black/20 p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="text-lg font-bold">
                  {registration.participant_name || registration.participant_user?.full_name || registration.participant_user?.email}
                </h4>
                <p className="text-xs text-white/40 mt-1">{registration.email || registration.participant_user?.email}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                  registration.payment_status === 'approved'
                    ? 'bg-green-500/10 text-green-400'
                    : registration.payment_status === 'rejected'
                      ? 'bg-red-500/10 text-red-400'
                      : 'bg-fest-primary/10 text-fest-primary'
                }`}>
                  {registration.payment_status}
                </div>
                {(() => {
                  const next = getNextRound(registration.qualification_stage);
                  const hasSubmittedForNext = registration.submissions?.some(s => s.round === next?.id);
                  if (hasSubmittedForNext) {
                    return (
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-black uppercase tracking-widest animate-pulse">
                        <Video size={10} /> {next?.name} Ready
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-white/5 p-3.5">
                <div className="text-white/40 text-[10px] uppercase tracking-widest mb-1">Phone</div>
                <div className="font-semibold">{registration.phone}</div>
              </div>
              <div className="rounded-2xl bg-fest-primary/5 border border-fest-primary/20 p-3.5 col-span-2 flex justify-between items-center">
                <div>
                  <div className="text-fest-primary/80 text-[10px] uppercase tracking-widest mb-1 font-black">Total Participants</div>
                  <div className="font-black text-fest-primary text-lg">{registration.team_size || 1} {registration.team_size === 1 ? 'Member' : 'Members'}</div>
                </div>
                <div className="text-right">
                  <div className="text-white/40 text-[10px] uppercase tracking-widest mb-1">Team Name / Category</div>
                  <div className="font-semibold">
                    {registration.team_name || 'Solo'} 
                    {registration.sub_category ? ` â€¢ ${registration.sub_category}` : ''}
                  </div>
                </div>
              </div>
              <div className="rounded-2xl bg-white/5 p-3.5">
                <div className="text-white/40 text-[10px] uppercase tracking-widest mb-1">College</div>
                <div className="font-semibold">{registration.college_name || 'Not provided'}</div>
              </div>
              <div className="rounded-2xl bg-white/5 p-3.5">
                <div className="text-white/40 text-[10px] uppercase tracking-widest mb-1">Upload</div>
                <div className="font-semibold">{registration.upload_enabled ? 'Enabled' : 'Locked'}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => void handleViewScreenshot(registration.payment_screenshot_url)}
                className="flex justify-center items-center gap-2 py-3 border border-white/10 border-dashed rounded-xl hover:bg-white/5 hover:border-white/30 transition-all text-[10px] font-bold uppercase tracking-widest text-fest-primary-light"
              >
                Payment <ExternalLink size={12} />
              </button>
              <button
                type="button"
                onClick={() => void handleViewIdCard(registration.id_card_url || '')}
                className="flex justify-center items-center gap-2 py-3 border border-white/10 border-dashed rounded-xl hover:bg-white/5 hover:border-white/30 transition-all text-[10px] font-bold uppercase tracking-widest text-fest-primary-light"
              >
                ID Card <ExternalLink size={12} />
              </button>
            </div>

            {registration.team_members && registration.team_members.length > 0 && (
              <div className="rounded-2xl border border-fest-primary/20 bg-fest-primary/5 p-4 overflow-hidden relative">
                <div className="flex items-center gap-3 text-fest-primary text-[10px] font-black uppercase tracking-[0.2em] mb-4">
                  <Users size={14} /> 5-Player Gaming Roster
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  {registration.team_members.map((member, idx) => (
                    <div key={idx} className="rounded-xl bg-black/40 border border-white/5 p-2.5">
                      <div className="text-[8px] font-black text-white/20 uppercase tracking-widest">P{idx + 1}</div>
                      <div className="font-bold text-white/90 text-[11px] truncate">{member.name}</div>
                      <div className="text-[9px] text-fest-primary font-mono opacity-60 truncate">{member.game_id}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <textarea
              value={paymentNotes[registration.id] || ''}
              onChange={(e) => setPaymentNotes((current) => ({ ...current, [registration.id]: e.target.value }))}
              placeholder="Optional admin note for this registration"
              className="w-full h-20 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-fest-primary resize-none"
            />

            {section === 'pending' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => void handlePaymentDecision(registration.id, 'rejected')}
                  disabled={actionLoadingId === registration.id}
                  className="w-full py-2.5 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-xl font-bold uppercase tracking-widest text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {actionLoadingId === registration.id ? <Loader2 className="animate-spin" size={16} /> : <><XCircle size={16} /> Decline</>}
                </button>
                <button
                  onClick={() => void handlePaymentDecision(registration.id, 'approved')}
                  disabled={actionLoadingId === registration.id}
                  className="w-full py-2.5 bg-fest-primary/10 text-fest-primary hover:bg-fest-primary hover:text-fest-dark rounded-xl font-bold uppercase tracking-widest text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {actionLoadingId === registration.id ? <Loader2 className="animate-spin" size={16} /> : <><CheckCircle2 size={16} /> Approve</>}
                </button>
              </div>
            ) : (
              <div className={`rounded-2xl p-3 text-center text-[10px] font-bold uppercase tracking-widest ${
                section === 'approved'
                  ? 'border border-green-500/20 bg-green-500/5 text-green-400'
                  : 'border border-red-500/20 bg-red-500/5 text-red-400'
              }`}>
                Moved to {section === 'approved' ? 'approved' : 'declined'} section
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const TAB_GROUPS = [
    {
      label: 'Core',
      tabs: [
        { id: 'events' as DashboardTab, label: 'Events', icon: CalendarDays },
        { id: 'payment_reviews' as DashboardTab, label: 'Payments', icon: DollarSign },
        { id: 'qualified_rounds' as DashboardTab, label: 'Qualified', icon: CheckCircle2 },
        { id: 'registrations' as DashboardTab, label: 'Registrations', icon: CheckSquare },
      ],
    },
    {
      label: 'Access Control',
      tabs: [
        { id: 'users' as DashboardTab, label: 'Users', icon: Users },
        { id: 'judges_access' as DashboardTab, label: 'Judges', icon: ShieldCheck },
        { id: 'payment_access' as DashboardTab, label: 'Pay Staff', icon: DollarSign },
      ],
    },
    {
      label: 'System',
      tabs: [
        { id: 'ui' as DashboardTab, label: 'Site Editor', icon: SlidersHorizontal },
        { id: 'contact_messages' as DashboardTab, label: 'Messages', icon: Mail },
        { id: 'system_logs' as DashboardTab, label: 'Audit Logs', icon: History },
      ],
    },
  ];

  const activeTabMeta = TAB_GROUPS.flatMap(g => g.tabs).find(t => t.id === activeTab);

  return (
    <main className="pt-20 min-h-screen">
      {/* MOBILE SIDEBAR OVERLAY */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <div className="flex min-h-[calc(100vh-5rem)]">
        {/* SIDEBAR */}
        <aside className={`fixed lg:sticky top-20 left-0 z-50 lg:z-10 h-[calc(100vh-5rem)] w-72 shrink-0 border-r border-white/[0.06] bg-black/80 lg:bg-black/40 backdrop-blur-xl flex flex-col transition-transform duration-300 ease-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
          {/* Sidebar header */}
          <div className="px-6 pt-8 pb-6 border-b border-white/[0.06]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-display font-extrabold tracking-tight text-white">Admin</h2>
                <p className="text-[10px] uppercase tracking-[0.3em] text-fest-primary font-bold mt-1">UNSCRIPTX</p>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="lg:hidden w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Nav groups */}
          <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
            {TAB_GROUPS.map((group) => (
              <div key={group.label}>
                <div className="text-[9px] font-black uppercase tracking-[0.35em] text-white/20 px-3 mb-3">{group.label}</div>
                <div className="space-y-1">
                  {group.tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => { setActiveTab(tab.id); setSidebarOpen(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 group ${
                          isActive
                            ? 'bg-fest-primary/10 text-fest-primary shadow-[inset_3px_0_0_0_#3b82f6]'
                            : 'text-white/45 hover:text-white hover:bg-white/[0.04]'
                        }`}
                      >
                        <tab.icon size={16} className={isActive ? 'text-fest-primary' : 'text-white/25 group-hover:text-white/50'} />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Sidebar footer */}
          <div className="px-4 py-5 border-t border-white/[0.06] space-y-3">
            <div 
              className="flex items-center gap-3 px-3 mt-4 group cursor-default"
              onDoubleClick={async () => {
                try {
                  const token = localStorage.getItem('unscriptx_token');
                  if (token) {
                    window.location.href = `/api/auth-hub?action=google-login&token=${token}`;
                  } else {
                    toast.error("Not fully authenticated. Please log in again.");
                  }
                } catch (e: any) {
                  toast.error("Failed. " + e.message);
                }
              }}
              title="Double click to reconnect Google Drive"
            >
              <div className="w-8 h-8 rounded-full bg-fest-primary/20 flex items-center justify-center text-fest-primary text-xs font-black transition-transform group-hover:scale-110">
                {(user as any)?.email?.charAt(0).toUpperCase() || 'A'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-white/70 truncate">{(user as any)?.email || 'Admin'}</div>
                <div className="text-[9px] text-white/25 uppercase tracking-widest font-bold">Administrator</div>
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <div className="flex-1 min-w-0">
          {/* Top bar */}
          <div className="sticky top-20 z-20 bg-fest-dark/80 backdrop-blur-xl border-b border-white/[0.06] px-6 lg:px-10 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button onClick={() => setSidebarOpen(true)} className="lg:hidden w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors">
                  <Menu size={20} />
                </button>
                <div>
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-white/25 font-bold">
                    <span>Dashboard</span>
                    <ChevronRight size={10} />
                    <span className="text-fest-primary">{activeTabMeta?.label}</span>
                  </div>
                  <h1 className="text-xl md:text-2xl font-display font-extrabold tracking-tight mt-0.5">
                    {activeTabMeta?.label || 'Dashboard'}
                  </h1>
                </div>
              </div>
            </div>
          </div>

          {/* Content area */}
          <div className="px-6 lg:px-10 py-8">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-32 gap-4">
                <Loader2 className="animate-spin text-fest-primary" size={40} />
                <p className="text-xs uppercase tracking-[0.3em] text-white/20 font-bold">Loading data...</p>
              </div>
            ) : activeTab === 'events' ? (
            <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-8">
              <form onSubmit={handleEventCreate} className="space-y-4 rounded-3xl border border-white/10 bg-black/20 p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-fest-primary font-bold uppercase tracking-widest text-sm">
                    {editingEventId ? <Pencil size={16} /> : <Plus size={16} />}
                    {editingEventId ? 'Edit Event' : 'Create Event'}
                  </div>
                  {editingEventId ? (
                    <button
                      type="button"
                      onClick={resetEventForm}
                      className="px-4 py-2 rounded-xl border border-white/10 text-xs font-bold uppercase tracking-widest text-white/70 hover:bg-white/5"
                    >
                      Cancel Edit
                    </button>
                  ) : null}
                </div>
                <input placeholder="Title" required className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary" value={newEvent.title} onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })} />
                <input placeholder="Category" required className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary" value={newEvent.category} onChange={(e) => setNewEvent({ ...newEvent, category: e.target.value })} />
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
                  <div className="flex items-center gap-2 text-white/70 text-xs font-bold uppercase tracking-widest">
                    <ImagePlus size={16} /> Event Front Image
                  </div>
                  <label className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/15 bg-black/20 px-4 py-6 text-center cursor-pointer hover:border-fest-primary/60 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleEventImageUpload(file);
                        e.currentTarget.value = '';
                      }}
                    />
                    {eventImageUploading ? (
                      <div className="flex items-center gap-2 text-fest-primary text-sm font-semibold">
                        <Loader2 className="animate-spin" size={16} /> Uploading image...
                      </div>
                    ) : (
                      <>
                        <div className="text-sm font-semibold">Upload event cover image</div>
                        <div className="text-xs text-white/45">This image will be used as the front image for the event card and event page.</div>
                      </>
                    )}
                  </label>
                  {newEvent.image_url ? (
                    <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black/20 group">
                      <img src={newEvent.image_url} alt={newEvent.title || 'Event preview'} className="w-full h-48 object-cover" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm('Are you sure you want to permanently delete this image from storage?')) {
                              void handleDeleteAsset(newEvent.image_url);
                            }
                          }}
                          disabled={eventImageDeleting}
                          className="flex items-center gap-2 px-4 py-2 bg-red-500/80 hover:bg-red-500 text-white rounded-xl transition-all shadow-lg text-xs font-bold uppercase tracking-widest disabled:opacity-50"
                        >
                          {eventImageDeleting ? (
                            <><Loader2 className="animate-spin" size={16} /> Deleting...</>
                          ) : (
                            <><Trash2 size={16} /> Remove Image</>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
                <textarea placeholder="Description" required className="w-full h-24 rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary resize-none" value={newEvent.description} onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })} />
                <div className="grid grid-cols-2 gap-4">
                  <input type="number" min={0} placeholder="Entry Fee" className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary" value={newEvent.entry_fee} onChange={(e) => setNewEvent({ ...newEvent, entry_fee: Number(e.target.value) })} />
                  <input type="number" min={1} placeholder="Team Limit" className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary" value={newEvent.max_team_size} onChange={(e) => setNewEvent({ ...newEvent, max_team_size: Number(e.target.value) })} />
                </div>

                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:border-fest-primary/30 transition-all cursor-pointer select-none" onClick={() => setNewEvent({ ...newEvent, requires_team_details: !newEvent.requires_team_details })}>
                  <div className={`w-10 h-5 rounded-full relative transition-all ${newEvent.requires_team_details ? 'bg-fest-primary' : 'bg-white/10'}`}>
                    <div className={`absolute top-1 w-3 h-3 rounded-full bg-fest-dark transition-all ${newEvent.requires_team_details ? 'right-1' : 'left-1'}`} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold uppercase tracking-widest text-white/70">Require Player Names & Game IDs</span>
                    <span className="text-[10px] text-white/30 truncate">Specifically for BGMI, Free Fire, and other roster-based games</span>
                  </div>
                </div>
                
                {/* Sub-categories List Manager */}
                <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center gap-2 text-white/70 text-xs font-bold uppercase tracking-widest mb-2">
                    <ListFilter size={16} className="text-fest-primary" /> Categories / Slots
                  </div>
                  <div className="flex gap-2">
                    <input 
                      placeholder="Add Category (e.g. Solo, Duet, Slot 1...)" 
                      className="flex-1 rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary transition-all" 
                      value={subCategoryInput} 
                      onChange={(e) => setSubCategoryInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddSubCategory(e as any);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddSubCategory}
                      className="px-6 rounded-xl bg-fest-primary text-fest-dark font-black uppercase text-xs tracking-widest hover:bg-fest-primary-light transition-all"
                    >
                      Add
                    </button>
                  </div>
                  
                  {newEvent.sub_categories.length > 0 ? (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {newEvent.sub_categories.map((cat) => (
                        <div key={cat} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-fest-primary/10 border border-fest-primary/20 text-fest-primary text-xs font-bold">
                          {cat}
                          <button 
                            type="button"
                            onClick={() => handleRemoveSubCategory(cat)}
                            className="hover:text-white transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[10px] text-white/20 uppercase tracking-widest text-center py-2 italic font-medium">
                      No specific categories added yet. If empty, the field won't show in registration.
                    </div>
                  )}
                </div>

                <input placeholder="Payment Account Name" className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary" value={newEvent.payment_account_name} onChange={(e) => setNewEvent({ ...newEvent, payment_account_name: e.target.value })} />
                <div className="grid grid-cols-2 gap-4">
                  <input placeholder="Account Number" className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary" value={newEvent.payment_account_number} onChange={(e) => setNewEvent({ ...newEvent, payment_account_number: e.target.value })} />
                  <input placeholder="IFSC" className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary" value={newEvent.payment_ifsc} onChange={(e) => setNewEvent({ ...newEvent, payment_ifsc: e.target.value })} />
                </div>
                <input placeholder="UPI ID" className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary" value={newEvent.payment_upi_id} onChange={(e) => setNewEvent({ ...newEvent, payment_upi_id: e.target.value })} />
                <textarea placeholder="Rules, one per line" className="w-full h-28 rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary resize-none" value={newEvent.rules} onChange={(e) => setNewEvent({ ...newEvent, rules: e.target.value })} />
                <button type="submit" className="w-full py-4 bg-fest-primary text-fest-dark font-black uppercase tracking-widest rounded-xl hover:bg-fest-primary-light transition-all shadow-lg glow-primary">
                  {editingEventId ? 'Update Event' : 'Create Event'}
                </button>
              </form>

              <div className="rounded-3xl border border-white/10 bg-black/20 p-6 transition-all duration-300">
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                  <div
                    onClick={() => setIsCreatedEventsExpanded(!isCreatedEventsExpanded)}
                    className="flex-1 cursor-pointer group"
                  >
                    <h3 className="text-xl font-bold transition-colors group-hover:text-fest-primary">Created Events</h3>
                    <p className="text-white/45 text-sm mt-1">Click the arrow to expand and view, edit, or delete any of the {events.length} events created.</p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                      <input
                        type="text"
                        placeholder="Search events by title..."
                        value={createdEventsSearch}
                        onChange={(e) => {
                          setCreatedEventsSearch(e.target.value);
                          if (e.target.value.trim() !== '') {
                            setIsCreatedEventsExpanded(true);
                          }
                        }}
                        className="pl-12 pr-4 py-2 bg-black/40 border border-white/10 rounded-xl w-full text-sm focus:border-fest-primary outline-none transition-all"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsCreatedEventsExpanded(!isCreatedEventsExpanded)}
                      className={`w-10 h-10 shrink-0 rounded-full bg-white/5 border border-white/10 flex items-center justify-center transition-all duration-300 hover:bg-white/10 ${isCreatedEventsExpanded ? 'rotate-180 bg-fest-primary/10 border-fest-primary/30 text-fest-primary' : 'text-white/60'}`}
                    >
                      <ChevronDown size={20} />
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {isCreatedEventsExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="pt-8 mt-6 border-t border-white/10">
                        {events.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center text-white/35">
                            No events created yet.
                          </div>
                        ) : filteredCreatedEvents.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center text-white/35">
                            No events match your search.
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {filteredCreatedEvents.map((event) => {
                              const eventRegistrationCount = registrations.filter((registration) => registration.event_id === event.id).length;
                              return (
                                <div key={event.id} className="rounded-2xl border border-white/10 bg-white/5 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                                  <div className="flex items-center gap-4 min-w-0">
                                    <div className="w-24 h-24 rounded-2xl overflow-hidden border border-white/10 bg-black/20 shrink-0">
                                      {event.image_url ? (
                                        <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center text-white/25 text-[10px] uppercase tracking-widest">
                                          No Image
                                        </div>
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="font-bold text-lg">{event.title}</div>
                                      <div className="text-sm text-white/55 mt-1">{event.category} â€¢ â‚¹{event.entry_fee}</div>
                                      <div className="text-xs text-white/35 mt-2">{eventRegistrationCount} registrations</div>
                                    </div>
                                  </div>
                                  <div className="flex flex-col sm:flex-row gap-2">
                                    <button
                                      type="button"
                                      onClick={() => startEditingEvent(event)}
                                      className="px-4 py-3 rounded-2xl bg-fest-primary/10 text-fest-primary hover:bg-fest-primary hover:text-fest-dark transition-colors text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2"
                                    >
                                      <Pencil size={16} /> Edit Event
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void handleDeleteEvent(event.id, event.title)}
                                      className="px-4 py-3 rounded-2xl bg-red-500/10 text-red-300 hover:bg-red-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2"
                                    >
                                      <Trash2 size={16} /> Delete Event
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          ) : activeTab === 'payment_reviews' ? (
            <div className="space-y-8">
              {!selectedPaymentEventId ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {events.map((event) => {
                    const eventRows = registrations.filter((registration) => registration.event_id === event.id);
                    const pending = eventRows.filter((registration) => registration.payment_status === 'pending').length;
                    const approved = eventRows.filter((registration) => registration.payment_status === 'approved').length;

                    return (
                      <motion.button
                        key={event.id}
                        onClick={() => setSelectedPaymentEventId(event.id)}
                        whileHover={{ y: -5 }}
                        className="glass p-8 rounded-[3rem] text-left group hover:border-fest-primary/40 transition-all flex flex-col justify-between"
                      >
                        <div className="flex justify-between items-start mb-8">
                          <div className="w-14 h-14 rounded-2xl bg-fest-primary/10 flex items-center justify-center text-fest-primary">
                            <ShieldCheck size={28} />
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] text-white/30 uppercase tracking-[0.25em] mb-1">Pending</div>
                            <div className="text-sm font-bold text-fest-primary uppercase tracking-tighter">{pending}</div>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-2xl font-display font-extrabold uppercase tracking-tighter mb-4 group-hover:text-fest-primary transition-colors">
                            {event.title}
                          </h3>
                          <div className="text-sm text-white/45 mb-6">{event.category}</div>
                          <div className="grid grid-cols-3 gap-3 pt-6 border-t border-white/5 text-xs uppercase tracking-widest">
                            <div>
                              <div className="text-white/25">Total</div>
                              <div className="text-white mt-2 font-bold">{eventRows.length}</div>
                            </div>
                            <div>
                              <div className="text-white/25">Approved</div>
                              <div className="text-green-400 mt-2 font-bold">{approved}</div>
                            </div>
                            <div className="flex items-end justify-end">
                              <ChevronRight className="text-white/20 group-hover:text-fest-primary transition-all" size={20} />
                            </div>
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}

                  {events.length === 0 && (
                    <div className="col-span-full py-20 text-center text-white/20 font-bold uppercase tracking-widest text-xs border border-dashed border-white/10 rounded-[3rem]">
                      No events created yet
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-8">
                  <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                      <button
                        onClick={() => setSelectedPaymentEventId('')}
                        className="w-12 h-12 rounded-full glass flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
                      >
                        <ArrowLeft size={24} />
                      </button>
                      <div>
                        <h3 className="text-3xl md:text-4xl font-display font-extrabold uppercase tracking-tighter">
                          {selectedPaymentEvent?.title}
                        </h3>
                        <p className="text-fest-primary-light text-xs font-bold uppercase tracking-widest mt-1 opacity-60">
                          {selectedPaymentEvent?.category} | {selectedPaymentEventSummary.total} Registrations
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                      <div className="relative w-full sm:w-80">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35" size={16} />
                        <input
                          type="text"
                          value={paymentSearch}
                          onChange={(e) => setPaymentSearch(e.target.value)}
                          placeholder="Search participants"
                          className="w-full rounded-2xl bg-white/5 border border-white/10 pl-11 pr-4 py-3 text-sm outline-none focus:border-fest-primary"
                        />
                      </div>
                      {selectedPaymentEvent && (
                        <button
                          type="button"
                          onClick={() => exportRegistrationsForEvent(selectedPaymentEvent, selectedPaymentEventRows)}
                          className="w-full sm:w-auto px-6 py-3 bg-fest-primary text-fest-dark rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-fest-primary-light transition-all shadow-lg glow-primary"
                        >
                          <Download size={16} /> Export Excel
                        </button>
                      )}
                    </div>
                  </header>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[
                      { label: 'Total', value: selectedPaymentEventSummary.total },
                      { label: 'Pending', value: selectedPaymentEventSummary.pending },
                      { label: 'Approved', value: selectedPaymentEventSummary.approved },
                      { label: 'Rejected', value: selectedPaymentEventSummary.rejected },
                      { label: 'Upload Open', value: selectedPaymentEventSummary.uploadEnabled },
                    ].map((item) => (
                      <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="text-[10px] uppercase tracking-widest text-white/40">{item.label}</div>
                        <div className="text-2xl font-bold mt-2">{item.value}</div>
                      </div>
                    ))}
                  </div>

                  {selectedPaymentEventRows.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-white/10 py-16 text-center text-white/35">
                      No registrations found for this event yet.
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[
                          {
                            id: 'pending' as const,
                            label: 'Pending Container',
                            tone: 'text-fest-primary',
                            count: selectedPaymentEventRows.filter((registration) => registration.payment_status === 'pending').length,
                          },
                          {
                            id: 'approved' as const,
                            label: 'Approved Container',
                            tone: 'text-green-400',
                            count: selectedPaymentEventRows.filter((registration) => registration.payment_status === 'approved').length,
                          },
                          {
                            id: 'rejected' as const,
                            label: 'Declined Container',
                            tone: 'text-red-400',
                            count: selectedPaymentEventRows.filter((registration) => registration.payment_status === 'rejected').length,
                          },
                        ].map((section) => (
                          <button
                            key={section.id}
                            type="button"
                            onClick={() => setActivePaymentSection(section.id)}
                            className={`rounded-3xl border p-5 text-left transition-all ${
                              activePaymentSection === section.id
                                ? 'border-fest-primary bg-fest-primary/10'
                                : 'border-white/10 bg-white/5 hover:bg-white/10'
                            }`}
                          >
                            <div className={`text-sm font-bold uppercase tracking-widest ${section.tone}`}>{section.label}</div>
                            <div className="text-3xl font-black mt-3">{section.count}</div>
                            <div className="text-[10px] uppercase tracking-widest text-white/30 mt-2">Click to view</div>
                          </button>
                        ))}
                      </div>

                      <section className="space-y-4">
                        <div className="flex items-center justify-between gap-4">
                          <h4 className={`text-lg font-bold uppercase tracking-widest ${
                            activePaymentSection === 'approved'
                              ? 'text-green-400'
                              : activePaymentSection === 'rejected'
                                ? 'text-red-400'
                                : 'text-fest-primary'
                          }`}>
                            {activePaymentSection === 'approved'
                              ? 'Approved Section'
                              : activePaymentSection === 'rejected'
                                ? 'Declined Section'
                                : 'Pending Review'}
                          </h4>
                          <div className="text-xs text-white/35 uppercase tracking-widest">
                            {selectedPaymentEventRows.filter((registration) => registration.payment_status === activePaymentSection).length} participants
                          </div>
                        </div>
                        {renderPaymentCards(
                          selectedPaymentEventRows.filter((registration) => registration.payment_status === activePaymentSection),
                          activePaymentSection
                        )}
                      </section>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : activeTab === 'qualified_rounds' ? (
            <div className="space-y-8">
              {!selectedQualifiedEventId ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {events.map((event) => {
                    const eventRows = registrations.filter((registration) => registration.event_id === event.id);
                    const qualifiedCount = eventRows.filter((registration) => registration.qualification_stage !== 'not_started' && registration.qualification_stage !== 'eliminated').length;
                    const eliminatedCount = eventRows.filter((registration) => registration.qualification_stage === 'eliminated').length;

                    return (
                      <motion.button
                        key={event.id}
                        onClick={() => setSelectedQualifiedEventId(event.id)}
                        whileHover={{ y: -5 }}
                        className="glass p-8 rounded-[3rem] text-left group hover:border-fest-primary/40 transition-all flex flex-col justify-between"
                      >
                        <div className="flex justify-between items-start mb-8">
                          <div className="w-14 h-14 rounded-2xl bg-fest-primary/10 flex items-center justify-center text-fest-primary">
                            <CheckCircle2 size={28} />
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] text-white/30 uppercase tracking-[0.25em] mb-1">Qualified</div>
                            <div className="text-sm font-bold text-fest-primary uppercase tracking-tighter">{qualifiedCount}</div>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-2xl font-display font-extrabold uppercase tracking-tighter mb-4 group-hover:text-fest-primary transition-colors">
                            {event.title}
                          </h3>
                          <div className="text-sm text-white/45 mb-6">{event.category}</div>
                          <div className="grid grid-cols-3 gap-3 pt-6 border-t border-white/5 text-xs uppercase tracking-widest">
                            <div>
                              <div className="text-white/25">Total</div>
                              <div className="text-white mt-2 font-bold">{eventRows.length}</div>
                            </div>
                            <div>
                              <div className="text-white/25">Out</div>
                              <div className="text-red-400 mt-2 font-bold">{eliminatedCount}</div>
                            </div>
                            <div className="flex items-end justify-end">
                              <ChevronRight className="text-white/20 group-hover:text-fest-primary transition-all" size={20} />
                            </div>
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-8">
                  <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                      <button
                        onClick={() => setSelectedQualifiedEventId('')}
                        className="w-12 h-12 rounded-full glass flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
                      >
                        <ArrowLeft size={24} />
                      </button>
                      <div>
                        <h3 className="text-3xl md:text-4xl font-display font-extrabold uppercase tracking-tighter">
                          {selectedQualifiedEvent?.title}
                        </h3>
                        <p className="text-fest-primary-light text-xs font-bold uppercase tracking-widest mt-1 opacity-60">
                          {selectedQualifiedEvent?.category} | {registrations.filter((registration) => registration.event_id === selectedQualifiedEventId).length} Registered
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                      <div className="relative w-full sm:w-80">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35" size={16} />
                        <input
                          type="text"
                          value={qualificationSearch}
                          onChange={(e) => setQualificationSearch(e.target.value)}
                          placeholder="Search participants"
                          className="w-full rounded-2xl bg-white/5 border border-white/10 pl-11 pr-4 py-3 text-sm outline-none focus:border-fest-primary"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={exportQualifiedToExcel}
                        className="w-full sm:w-auto px-6 py-3 bg-fest-primary text-fest-dark rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-fest-primary-light transition-all shadow-lg glow-primary shadow-fest-primary/20"
                      >
                        <Download size={16} /> Export Round Excel
                      </button>
                    </div>
                  </header>

                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                    {[
                      { id: 'all' as const, label: 'All', tone: 'text-white' },
                      { id: 'round_1_qualified' as const, label: '1st Round', tone: 'text-fest-primary' },
                      { id: 'round_2_qualified' as const, label: '2nd Round', tone: 'text-fest-primary' },
                      { id: 'semifinal' as const, label: 'Semifinal', tone: 'text-fest-primary' },
                      { id: 'final' as const, label: 'Final', tone: 'text-green-400' },
                      { id: 'eliminated' as const, label: 'Eliminated', tone: 'text-red-400' },
                    ].map((stage) => (
                      <button
                        key={stage.id}
                        type="button"
                        onClick={() => setActiveQualifiedStage(stage.id)}
                        className={`rounded-3xl border p-4 text-left transition-all ${
                          activeQualifiedStage === stage.id
                            ? 'border-fest-primary bg-fest-primary/10'
                            : 'border-white/10 bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        <div className={`text-sm font-bold uppercase tracking-widest ${stage.tone}`}>{stage.label}</div>
                        <div className="text-[10px] uppercase tracking-widest text-white/30 mt-2">Open list</div>
                      </button>
                    ))}
                  </div>

                  {selectedQualifiedEventRows.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-white/10 py-16 text-center text-white/35">
                      No participants found in this stage.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {selectedQualifiedEventRows.map((registration) => {
                        const participantName = registration.participant_name || registration.participant_user?.full_name || registration.participant_user?.email || 'Participant';
                        const isExpanded = !!expandedQualifiedRows[registration.id];
                        const submissions = registration.submissions || [];
                        const latestSubmission = [...submissions].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
                        const lastScore = latestSubmission?.internal_reviews?.[0]?.score || 0;

                        return (
                          <div key={registration.id} className="rounded-3xl border border-white/5 bg-white/[0.03] overflow-hidden transition-all hover:bg-white/[0.04]">
                            {/* COLLAPSIBLE HEADER */}
                            <button
                              type="button"
                              onClick={() => setExpandedQualifiedRows(prev => ({ ...prev, [registration.id]: !prev[registration.id] }))}
                              className="w-full text-left px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4 select-none"
                            >
                              <div className="flex items-center gap-5">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${isExpanded ? 'bg-fest-primary text-fest-dark' : 'bg-white/5 text-fest-primary'}`}>
                                  <Users size={22} />
                                </div>
                                <div>
                                  <h4 className={`text-xl font-bold tracking-tight transition-colors flex items-center gap-2 ${isExpanded ? 'text-fest-primary' : 'text-white'}`}>
                                    {participantName} 
                                    {(() => {
                                      const next = getNextRound(registration.qualification_stage);
                                      const hasSubmittedForNext = registration.submissions?.some(s => s.round === next?.id);
                                      if (hasSubmittedForNext) {
                                        return (
                                          <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-500/10 border border-green-500/20 text-green-400 text-[9px] font-black uppercase tracking-widest animate-pulse">
                                            <Video size={10} /> {next?.name} Ready
                                          </span>
                                        );
                                      }
                                      return null;
                                    })()}
                                  </h4>
                                  <div className="flex items-center gap-3 mt-1.5">
                                    <div className="flex items-center gap-1.5 text-xs text-white/40 font-medium">
                                      <Mail size={12} className="text-fest-primary/40" /> {registration.email || registration.participant_user?.email}
                                    </div>
                                    <span className="w-1 h-1 bg-white/10 rounded-full" />
                                    <div className="px-3 py-0.5 rounded-full bg-white/5 border border-white/5 text-[9px] font-black uppercase tracking-widest text-white/30">
                                       ID: {registration.id.slice(0, 8)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-6 self-end md:self-auto">
                                <div className="text-right flex flex-col items-end gap-1.5">
                                  <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-colors ${
                                    registration.qualification_stage === 'eliminated' ? 'border-red-500/20 bg-red-500/10 text-red-400' : 'border-fest-primary/20 bg-fest-primary/10 text-fest-primary'
                                  }`}>
                                    {registration.qualification_stage.replaceAll('_', ' ')}
                                  </div>
                                  {lastScore > 0 && (
                                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
                                      LAST SCORE: <span className="text-fest-primary">{lastScore}</span> / 10
                                    </div>
                                  )}
                                </div>
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center glass transition-all ${isExpanded ? 'rotate-90 bg-fest-primary text-fest-dark border-transparent' : 'text-white/40'}`}>
                                  <ChevronRight size={20} />
                                </div>
                              </div>
                            </button>

                            {/* COLLAPSIBLE BODY */}
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.3 }}
                                >
                                  <div className="px-8 pb-8 pt-2 border-t border-white/5">
                                    {/* INFO GRID */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm mb-10">
                                      <div className="rounded-2xl bg-white/5 p-5 border border-white/5">
                                        <div className="text-white/30 text-[10px] uppercase tracking-widest font-black mb-1.5 flex items-center gap-2">
                                          <Phone size={12} /> Contact
                                        </div>
                                        <div className="font-bold tracking-tight text-white/90">{registration.phone}</div>
                                      </div>
                                      <div className="rounded-2xl bg-white/5 p-5 border border-white/5">
                                        <div className="text-white/30 text-[10px] uppercase tracking-widest font-black mb-1.5">College</div>
                                        <div className="font-bold tracking-tight text-white/90 truncate">{registration.college_name || 'Not specified'}</div>
                                      </div>
                                      <div className="rounded-2xl bg-white/5 p-5 border border-white/5">
                                        <div className="text-white/30 text-[10px] uppercase tracking-widest font-black mb-1.5 flex justify-between">
                                          <span>Team / Category</span>
                                          <span>Size: {registration.team_size || 1}</span>
                                        </div>
                                        <div className="font-bold tracking-tight text-white/90">
                                          {registration.team_name || 'Solo Participant'}
                                          {registration.sub_category ? ` • ${registration.sub_category}` : ''}
                                        </div>
                                      </div>
                                      <div className="rounded-2xl bg-white/5 p-5 border border-white/5 group">
                                        <div className="text-white/30 text-[10px] uppercase tracking-widest font-black mb-1.5 text-fest-primary">Current Status</div>
                                        <div className="font-black uppercase text-xs tracking-widest text-white/80">{registration.qualification_stage.replace(/_/g, ' ')}</div>
                                      </div>
                                    </div>

                                    {/* TEAM ROSTER SECTION */}
                                    {registration.team_members && registration.team_members.length > 0 && (
                                      <div className="mb-10 rounded-3xl border border-fest-primary/20 bg-fest-primary/5 p-6 overflow-hidden relative">
                                        <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                                          <Users size={120} />
                                        </div>
                                        <div className="flex items-center gap-3 text-fest-primary text-xs font-black uppercase tracking-[0.2em] mb-6">
                                          <Users size={16} /> 5-Player Gaming Roster
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                          {registration.team_members.map((member, idx) => (
                                            <div key={idx} className="rounded-2xl bg-black/40 border border-white/5 p-4 transition-all hover:border-fest-primary/30 group">
                                              <div className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-1 group-hover:text-fest-primary/40 transition-colors">Player {idx + 1}</div>
                                              <div className="font-bold text-white/90 text-sm truncate">{member.name}</div>
                                              <div className="text-[10px] text-fest-primary font-mono mt-1 opacity-60">ID: {member.game_id}</div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* DECISION ACTION BUTTONS */}
                                    <div className="mb-10">
                                      <div className="text-[10px] uppercase tracking-widest text-white/30 font-black mb-4 px-2">Decision Dashboard</div>
                                      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                                        {[
                                          { id: 'round_1_qualified', label: '1st Round' },
                                          { id: 'round_2_qualified', label: '2nd Round' },
                                          { id: 'semifinal', label: 'Semifinal' },
                                          { id: 'final', label: 'Final' },
                                          { id: 'winner', label: 'Winner' },
                                          { id: 'eliminated', label: 'Eliminate' },
                                        ]
                                        .filter(stage => {
                                          if (stage.id === 'eliminated') return true;
                                          const currentIndex = STAGE_ORDER.indexOf(registration.qualification_stage);
                                          const stageIndex = STAGE_ORDER.indexOf(stage.id as QualificationStage);
                                          return stageIndex > currentIndex;
                                        })
                                        .map((stage) => (
                                          <button
                                            key={stage.id}
                                            type="button"
                                            onClick={() => void handleQualificationStage(registration, stage.id as QualificationStage)}
                                            disabled={actionLoadingId === registration.id}
                                            className={`py-3.5 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all ${
                                              stage.id === 'eliminated'
                                                ? 'bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white'
                                                : 'bg-fest-primary/10 text-fest-primary hover:bg-fest-primary hover:text-fest-dark'
                                            } disabled:opacity-50`}
                                          >
                                            {stage.label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    {/* SUBMISSIONS */}
                                    {submissions.length > 0 && (() => {
                                      const sortedSubmissions = [...submissions].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                                      const currentSub = sortedSubmissions[0];
                                      const pastSubs = sortedSubmissions.slice(1);

                                      return (
                                        <div className="space-y-10">
                                          <div className="space-y-4">
                                            <div className="flex items-center justify-between px-2">
                                              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-fest-primary font-black">
                                                <Activity size={14} /> Active Competition Submission
                                              </div>
                                              <div className="text-[10px] text-white/20 font-bold uppercase tracking-widest">
                                                {new Date(currentSub.created_at).toLocaleDateString()}
                                              </div>
                                            </div>
                                            <VideoPreview 
                                              submission={currentSub} 
                                              eventTitle={registration.event?.title || ''} 
                                              isPast={false}
                                              onSave={(id, score, remarks) => {
                                                api.post('/api/admin', {
                                                  action: 'upsert',
                                                  table: 'internal_reviews',
                                                  conflict_target: 'submission_id',
                                                  record: {
                                                    submission_id: id,
                                                    score,
                                                    judge_remarks: remarks,
                                                    updated_at: new Date().toISOString()
                                                  }
                                                }).then(() => {
                                                  toast.success('Internal review saved');
                                                  fetchData();
                                                }).catch(() => {
                                                  toast.error('Save failed');
                                                });
                                              }}
                                            />
                                          </div>

                                          {pastSubs.length > 0 && (
                                            <details className="group">
                                              <summary className="flex items-center gap-2 cursor-pointer text-[10px] uppercase tracking-widest text-white/20 font-black hover:text-white transition-colors py-4 bg-white/5 border border-white/5 rounded-3xl px-8 select-none list-none">
                                                <ChevronRight size={14} className="group-open:rotate-90 transition-transform text-fest-primary" />
                                                View Previous Round Archive ({pastSubs.length})
                                              </summary>
                                              <div className="grid grid-cols-1 gap-12 mt-8 pt-8 border-t border-white/5">
                                                {pastSubs.map(s => (
                                                  <VideoPreview 
                                                    key={s.id} 
                                                    submission={s} 
                                                    eventTitle={registration.event?.title || ''} 
                                                    isPast={true}
                                                    onSave={(id, score, remarks) => {
                                                      api.post('/api/admin', {
                                                        action: 'upsert',
                                                        table: 'internal_reviews',
                                                        conflict_target: 'submission_id',
                                                        record: {
                                                          submission_id: id,
                                                          score,
                                                          judge_remarks: remarks,
                                                          updated_at: new Date().toISOString()
                                                        }
                                                      }).then(() => {
                                                        toast.success('Archive record updated');
                                                        fetchData();
                                                      }).catch(() => {
                                                        toast.error('Archive update failed');
                                                      });
                                                    }}
                                                  />
                                                ))}
                                              </div>
                                            </details>
                                          )}
                                        </div>
                                      );
                                    })()}

                                    {/* NOTES */}
                                    <div className="mt-12 space-y-4">
                                      <div className="text-[10px] uppercase tracking-widest text-white/20 font-black px-2 flex items-center gap-2">
                                        <Layout size={14} /> Master Qualification Notes
                                      </div>
                                      <textarea
                                        value={qualificationNotes[registration.id] || ''}
                                        onChange={(e) => setQualificationNotes(cur => ({ ...cur, [registration.id]: e.target.value }))}
                                        placeholder="Record internal staff notes for this candidate's journey..."
                                        className="w-full h-36 rounded-[2rem] border border-white/10 bg-black/40 px-8 py-6 text-sm outline-none focus:border-fest-primary resize-none transition-all"
                                      />
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : activeTab === 'ui' ? (
            <div className="space-y-8">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <div className="rounded-3xl border border-white/10 bg-black/20 p-6 space-y-5">
                  <div>
                    <h3 className="text-xl font-bold">Landing Page Slideshow</h3>
                    <p className="text-white/45 text-sm mt-1">Add slideshow images and control how many seconds each image stays on screen.</p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
                    <div className="w-full sm:w-40">
                      <label className="text-[10px] uppercase tracking-widest text-white/40 block mb-2">Duration Sec</label>
                      <input
                        type="number"
                        min={1}
                        value={newSlideDuration}
                        onChange={(e) => setNewSlideDuration(Number(e.target.value))}
                        className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary"
                      />
                    </div>
                    <label className="px-5 py-3 rounded-2xl bg-fest-primary text-fest-dark font-bold uppercase tracking-widest text-xs cursor-pointer hover:bg-fest-primary-light transition-all flex items-center gap-2">
                      <ImagePlus size={16} /> Add Slide
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void handleSlideUpload(file);
                          e.currentTarget.value = '';
                        }}
                      />
                    </label>
                  </div>

                  <div className="space-y-4">
                    {heroSlides.map((slide) => (
                      <div key={slide.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col md:flex-row md:items-center gap-4">
                        <img src={slide.image_url} alt="Slide" className="w-full md:w-40 h-24 object-cover rounded-xl border border-white/10" />
                        <div className="flex-1">
                          <div className="text-sm font-bold">Slide #{slide.display_order + 1}</div>
                          <div className="text-xs text-white/45 mt-1">Shows for {slide.duration_seconds} seconds</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleDeleteSlide(slide.id)}
                          className="px-4 py-2 rounded-xl bg-red-500/10 text-red-300 hover:bg-red-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                    {heroSlides.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-white/30 text-sm">
                        No slideshow images added yet.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-black/20 p-6 space-y-5">
                  <div>
                    <h3 className="text-xl font-bold">About The Event</h3>
                    <p className="text-white/45 text-sm mt-1">Control the landing page event introduction dynamically.</p>
                  </div>

                  <input
                    placeholder="Main title"
                    value={siteContent.home_about_event.title || ''}
                    onChange={(e) => setSiteContent((current) => ({
                      ...current,
                      home_about_event: { ...current.home_about_event, title: e.target.value },
                    }))}
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary"
                  />
                  <input
                    placeholder="Highlighted subtitle"
                    value={siteContent.home_about_event.subtitle || ''}
                    onChange={(e) => setSiteContent((current) => ({
                      ...current,
                      home_about_event: { ...current.home_about_event, subtitle: e.target.value },
                    }))}
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary"
                  />
                  <textarea
                    placeholder="About the event description"
                    value={siteContent.home_about_event.body || ''}
                    onChange={(e) => setSiteContent((current) => ({
                      ...current,
                      home_about_event: { ...current.home_about_event, body: e.target.value },
                    }))}
                    className="w-full h-36 rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary resize-none"
                  />
                  <button
                    type="button"
                    onClick={() => void saveSiteContent('home_about_event')}
                    disabled={uiSaving}
                    className="px-5 py-3 rounded-2xl bg-fest-primary text-fest-dark font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-fest-primary-light transition-all"
                  >
                    <Save size={16} /> Save Event Content
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <div className="rounded-3xl border border-white/10 bg-black/20 p-6 space-y-5">
                  <div>
                    <h3 className="text-xl font-bold">About The College</h3>
                    <p className="text-white/45 text-sm mt-1">Control the college section text, image and highlights.</p>
                  </div>

                  <input
                    placeholder="Title"
                    value={siteContent.home_about_college.title || ''}
                    onChange={(e) => setSiteContent((current) => ({
                      ...current,
                      home_about_college: { ...current.home_about_college, title: e.target.value },
                    }))}
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary"
                  />
                  <input
                    placeholder="Highlighted word"
                    value={siteContent.home_about_college.subtitle || ''}
                    onChange={(e) => setSiteContent((current) => ({
                      ...current,
                      home_about_college: { ...current.home_about_college, subtitle: e.target.value },
                    }))}
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary"
                  />
                  <textarea
                    placeholder="College description"
                    value={siteContent.home_about_college.body || ''}
                    onChange={(e) => setSiteContent((current) => ({
                      ...current,
                      home_about_college: { ...current.home_about_college, body: e.target.value },
                    }))}
                    className="w-full h-36 rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary resize-none"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      placeholder="Highlight 1 value"
                      value={String(siteContent.home_about_college.metadata?.highlight_one_value || '')}
                      onChange={(e) => setSiteContent((current) => ({
                        ...current,
                        home_about_college: {
                          ...current.home_about_college,
                          metadata: { ...current.home_about_college.metadata, highlight_one_value: e.target.value },
                        },
                      }))}
                      className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary"
                    />
                    <input
                      placeholder="Highlight 1 label"
                      value={String(siteContent.home_about_college.metadata?.highlight_one_label || '')}
                      onChange={(e) => setSiteContent((current) => ({
                        ...current,
                        home_about_college: {
                          ...current.home_about_college,
                          metadata: { ...current.home_about_college.metadata, highlight_one_label: e.target.value },
                        },
                      }))}
                      className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary"
                    />
                    <input
                      placeholder="Highlight 2 value"
                      value={String(siteContent.home_about_college.metadata?.highlight_two_value || '')}
                      onChange={(e) => setSiteContent((current) => ({
                        ...current,
                        home_about_college: {
                          ...current.home_about_college,
                          metadata: { ...current.home_about_college.metadata, highlight_two_value: e.target.value },
                        },
                      }))}
                      className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary"
                    />
                    <input
                      placeholder="Highlight 2 label"
                      value={String(siteContent.home_about_college.metadata?.highlight_two_label || '')}
                      onChange={(e) => setSiteContent((current) => ({
                        ...current,
                        home_about_college: {
                          ...current.home_about_college,
                          metadata: { ...current.home_about_college.metadata, highlight_two_label: e.target.value },
                        },
                      }))}
                      className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors text-sm font-medium">
                      <ImageIcon size={16} /> Upload College Image
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const imageUrl = await uploadAsset(file, 'college');
                            setSiteContent((current) => ({
                              ...current,
                              home_about_college: { ...current.home_about_college, image_url: imageUrl },
                            }));
                            toast.success('College image uploaded.');
                          } catch (err: any) {
                            toast.error(err.message || 'Could not upload college image.');
                          }
                          e.currentTarget.value = '';
                        }}
                      />
                    </label>
                    {siteContent.home_about_college.image_url ? (
                      <img src={siteContent.home_about_college.image_url || ''} alt="College preview" className="w-full h-40 object-cover rounded-2xl border border-white/10" />
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => void saveSiteContent('home_about_college')}
                    disabled={uiSaving}
                    className="px-5 py-3 rounded-2xl bg-fest-primary text-fest-dark font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-fest-primary-light transition-all"
                  >
                    <Save size={16} /> Save College Content
                  </button>
                </div>

                <div className="rounded-3xl border border-white/10 bg-black/20 p-6 space-y-5">
                  <div>
                    <h3 className="text-xl font-bold">About School of Technology</h3>
                    <p className="text-white/45 text-sm mt-1">Control the School of Technology section text and image.</p>
                  </div>

                  <input
                    placeholder="Title"
                    value={siteContent.home_about_school.title || ''}
                    onChange={(e) => setSiteContent((current) => ({
                      ...current,
                      home_about_school: { ...current.home_about_school, title: e.target.value },
                    }))}
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary"
                  />
                  <input
                    placeholder="Highlighted subtitle"
                    value={siteContent.home_about_school.subtitle || ''}
                    onChange={(e) => setSiteContent((current) => ({
                      ...current,
                      home_about_school: { ...current.home_about_school, subtitle: e.target.value },
                    }))}
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary"
                  />
                  <textarea
                    placeholder="School description"
                    value={siteContent.home_about_school.body || ''}
                    onChange={(e) => setSiteContent((current) => ({
                      ...current,
                      home_about_school: { ...current.home_about_school, body: e.target.value },
                    }))}
                    className="w-full h-36 rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary resize-none"
                  />
                  
                  <div className="space-y-3">
                    <label className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors text-sm font-medium">
                      <ImageIcon size={16} /> Upload School Image
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const imageUrl = await uploadAsset(file, 'college');
                            setSiteContent((current) => ({
                              ...current,
                              home_about_school: { ...current.home_about_school, image_url: imageUrl },
                            }));
                            toast.success('School image uploaded.');
                          } catch (err: any) {
                            toast.error(err.message || 'Could not upload school image.');
                          }
                          e.currentTarget.value = '';
                        }}
                      />
                    </label>
                    {siteContent.home_about_school.image_url ? (
                      <img src={siteContent.home_about_school.image_url} alt="School preview" className="w-full h-40 object-cover rounded-2xl border border-white/10" />
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => void saveSiteContent('home_about_school')}
                    disabled={uiSaving}
                    className="px-5 py-3 rounded-2xl bg-fest-primary text-fest-dark font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-fest-primary-light transition-all"
                  >
                    <Save size={16} /> Save School Content
                  </button>
                </div>

                <div className="rounded-3xl border border-white/10 bg-black/20 p-6 space-y-5">
                  <div>
                    <h3 className="text-xl font-bold">Why Join Section</h3>
                    <p className="text-white/45 text-sm mt-1">Control the engaging welcome grid on the homepage.</p>
                  </div>

                  <input
                    placeholder="Main Header (Use [brackets] to highlight a word gold)"
                    value={siteContent.home_why_join.title || ''}
                    onChange={(e) => setSiteContent((current) => ({
                      ...current,
                      home_why_join: { ...current.home_why_join, title: e.target.value },
                    }))}
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary"
                  />
                  <textarea
                    placeholder="Description paragraph..."
                    value={siteContent.home_why_join.body || ''}
                    onChange={(e) => setSiteContent((current) => ({
                      ...current,
                      home_why_join: { ...current.home_why_join, body: e.target.value },
                    }))}
                    className="w-full h-36 rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary resize-none"
                  />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      placeholder="Feature 1 (e.g. Musical Nights)"
                      value={String(siteContent.home_why_join.metadata?.f1 || '')}
                      onChange={(e) => setSiteContent((current) => ({
                        ...current,
                        home_why_join: {
                          ...current.home_why_join,
                          metadata: { ...current.home_why_join.metadata, f1: e.target.value },
                        },
                      }))}
                      className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary"
                    />
                    <input
                      placeholder="Feature 2 (e.g. High Energy)"
                      value={String(siteContent.home_why_join.metadata?.f2 || '')}
                      onChange={(e) => setSiteContent((current) => ({
                        ...current,
                        home_why_join: {
                          ...current.home_why_join,
                          metadata: { ...current.home_why_join.metadata, f2: e.target.value },
                        },
                      }))}
                      className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary"
                    />
                    <input
                      placeholder="Feature 3 (e.g. Star Guests)"
                      value={String(siteContent.home_why_join.metadata?.f3 || '')}
                      onChange={(e) => setSiteContent((current) => ({
                        ...current,
                        home_why_join: {
                          ...current.home_why_join,
                          metadata: { ...current.home_why_join.metadata, f3: e.target.value },
                        },
                      }))}
                      className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary"
                    />
                    <input
                      placeholder="Feature 4 (e.g. Artistic Souls)"
                      value={String(siteContent.home_why_join.metadata?.f4 || '')}
                      onChange={(e) => setSiteContent((current) => ({
                        ...current,
                        home_why_join: {
                          ...current.home_why_join,
                          metadata: { ...current.home_why_join.metadata, f4: e.target.value },
                        },
                      }))}
                      className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors text-sm font-medium">
                      <ImageIcon size={16} /> Upload Why Join Image
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const imageUrl = await uploadAsset(file, 'why-join');
                            setSiteContent((current) => ({
                              ...current,
                              home_why_join: { ...current.home_why_join, image_url: imageUrl },
                            }));
                            toast.success('Why Join image uploaded.');
                          } catch (err: any) {
                            toast.error(err.message || 'Could not upload Why Join image.');
                          }
                          e.currentTarget.value = '';
                        }}
                      />
                    </label>
                    {siteContent.home_why_join.image_url ? (
                      <img src={siteContent.home_why_join.image_url} alt="Why Join preview" className="w-full h-40 object-cover rounded-2xl border border-white/10" />
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => void saveSiteContent('home_why_join')}
                    disabled={uiSaving}
                    className="px-5 py-3 rounded-2xl bg-fest-primary text-fest-dark font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-fest-primary-light transition-all"
                  >
                    <Save size={16} /> Save 'Why Join' Content
                  </button>
                </div>

                <div className="rounded-3xl border border-white/10 bg-black/20 p-6 space-y-5">
                  <div>
                    <h3 className="text-xl font-bold">Event Management Team Section</h3>
                    <p className="text-white/45 text-sm mt-1">Manage the team group photo and introductory text.</p>
                  </div>

                  <input
                    placeholder="Section Title"
                    value={siteContent.home_team_group.title || ''}
                    onChange={(e) => setSiteContent((current) => ({
                      ...current,
                      home_team_group: { ...current.home_team_group, title: e.target.value },
                    }))}
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary"
                  />
                  <input
                    placeholder="Subtitle"
                    value={siteContent.home_team_group.subtitle || ''}
                    onChange={(e) => setSiteContent((current) => ({
                      ...current,
                      home_team_group: { ...current.home_team_group, subtitle: e.target.value },
                    }))}
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary"
                  />
                  <textarea
                    placeholder="Team description..."
                    value={siteContent.home_team_group.body || ''}
                    onChange={(e) => setSiteContent((current) => ({
                      ...current,
                      home_team_group: { ...current.home_team_group, body: e.target.value },
                    }))}
                    className="w-full h-36 rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary resize-none"
                  />
                  
                  <div className="space-y-3">
                    <label className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors text-sm font-medium">
                      <ImageIcon size={16} /> Upload Team Photo
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const imageUrl = await uploadAsset(file, 'team');
                            setSiteContent((current) => ({
                              ...current,
                              home_team_group: { ...current.home_team_group, image_url: imageUrl },
                            }));
                            toast.success('Team photo uploaded.');
                          } catch (err: any) {
                            toast.error(err.message || 'Could not upload team photo.');
                          }
                          e.currentTarget.value = '';
                        }}
                      />
                    </label>
                    {siteContent.home_team_group.image_url ? (
                      <img src={siteContent.home_team_group.image_url} alt="Team preview" className="w-full h-40 object-cover rounded-2xl border border-white/10" />
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => void saveSiteContent('home_team_group')}
                    disabled={uiSaving}
                    className="px-5 py-3 rounded-2xl bg-fest-primary text-fest-dark font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-fest-primary-light transition-all"
                  >
                    <Save size={16} /> Save Team Content
                  </button>
                </div>

                <div className="rounded-3xl border border-white/10 bg-black/20 p-6 space-y-5">
                  <div>
                    <h3 className="text-xl font-bold">Universal Guidelines</h3>
                    <p className="text-white/45 text-sm mt-1">Add and remove the guidelines shown on the landing page and rules page.</p>
                  </div>
                  <textarea
                    placeholder="Add a universal guideline"
                    value={ruleForm.rule_text}
                    onChange={(e) => setRuleForm((current) => ({ ...current, rule_text: e.target.value }))}
                    className="w-full h-24 rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary resize-none"
                  />
                  <div className="flex gap-4 items-end">
                    <div className="w-40">
                      <label className="text-[10px] uppercase tracking-widest text-white/40 block mb-2">Display Order</label>
                      <input
                        type="number"
                        value={ruleForm.display_order}
                        onChange={(e) => setRuleForm((current) => ({ ...current, display_order: Number(e.target.value) }))}
                        className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleAddGuideline()}
                      className="px-5 py-3 rounded-2xl bg-fest-primary text-fest-dark font-bold uppercase tracking-widest text-xs hover:bg-fest-primary-light transition-all"
                    >
                      {editingGuidelineId ? 'Update Guideline' : 'Add Guideline'}
                    </button>
                    {editingGuidelineId ? (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingGuidelineId(null);
                          setRuleForm({ rule_text: '', display_order: 0 });
                        }}
                        className="px-5 py-3 rounded-2xl border border-white/10 text-white/70 font-bold uppercase tracking-widest text-xs hover:bg-white/5 transition-all"
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>
                  <div className="space-y-3">
                    {guidelineEntries.map((rule) => (
                      <div key={rule.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-start justify-between gap-4">
                        <div className="text-sm text-white/75">{rule.rule_text}</div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => startEditingGuideline(rule)}
                            className="px-3 py-2 rounded-xl bg-fest-primary/10 text-fest-primary hover:bg-fest-primary hover:text-fest-dark transition-colors text-xs font-bold uppercase tracking-widest"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteGuideline(rule.id)}
                            className="px-3 py-2 rounded-xl bg-red-500/10 text-red-300 hover:bg-red-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                    {guidelineEntries.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-white/30 text-sm">
                        No guidelines added yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/20 p-6 space-y-5">
                <div>
                  <h3 className="text-xl font-bold">Organizing Committee</h3>
                  <p className="text-white/45 text-sm mt-1">Add committee photos, names, and designations dynamically from the backend.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  <input
                    placeholder="Name"
                    value={committeeForm.name}
                    onChange={(e) => setCommitteeForm((current) => ({ ...current, name: e.target.value }))}
                    className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary"
                  />
                  <input
                    placeholder="Designation"
                    value={committeeForm.role}
                    onChange={(e) => setCommitteeForm((current) => ({ ...current, role: e.target.value }))}
                    className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary"
                  />
                  <input
                    type="number"
                    placeholder="Display Order"
                    value={committeeForm.display_order}
                    onChange={(e) => setCommitteeForm((current) => ({ ...current, display_order: Number(e.target.value) }))}
                    className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary"
                  />
                  <label className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors text-sm font-medium">
                    <ImageIcon size={16} /> Upload Photo
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const imageUrl = await uploadAsset(file, 'committee');
                          setCommitteeForm((current) => ({ ...current, image_url: imageUrl }));
                          toast.success('Committee photo uploaded.');
                        } catch (err: any) {
                          toast.error(err.message || 'Could not upload committee photo.');
                        }
                        e.currentTarget.value = '';
                      }}
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => void handleAddCommitteeMember()}
                  className="px-5 py-3 rounded-2xl bg-fest-primary text-fest-dark font-bold uppercase tracking-widest text-xs hover:bg-fest-primary-light transition-all"
                >
                  Add Committee Member
                </button>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {committeeEntries.map((member) => (
                    <div key={member.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <img src={member.image_url} alt={member.name} className="w-full h-40 object-cover rounded-2xl border border-white/10 mb-4" />
                      <div className="font-bold text-lg">{member.name}</div>
                      <div className="text-sm text-white/50 mt-1">{member.role}</div>
                      <button
                        type="button"
                        onClick={() => void handleDeleteCommitteeMember(member.id)}
                        className="mt-4 px-4 py-2 rounded-xl bg-red-500/10 text-red-300 hover:bg-red-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                  {committeeEntries.length === 0 && (
                    <div className="col-span-full rounded-2xl border border-dashed border-white/10 py-12 text-center text-white/30 text-sm">
                      No committee members added yet.
                    </div>
                  )}
                </div>
              </div>

              {/* ABOUT PAGE EDITOR */}
              <div className="rounded-3xl border border-white/10 bg-black/20 p-6 space-y-5">
                <div>
                  <h3 className="text-xl font-bold">About Page Content</h3>
                  <p className="text-white/45 text-sm mt-1">Control the text and story on the main About page.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* About Hero */}
                  <div className="space-y-4 p-4 border border-white/5 bg-white/5 rounded-2xl">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-fest-primary">Hero Section</h4>
                    <input
                      placeholder="Title (e.g. ABOUT)"
                      value={siteContent.about_hero.title || ''}
                      onChange={(e) => setSiteContent(c => ({ ...c, about_hero: { ...c.about_hero, title: e.target.value } }))}
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary"
                    />
                    <input
                      placeholder="Subtitle (e.g. UNSCRIPTX)"
                      value={siteContent.about_hero.subtitle || ''}
                      onChange={(e) => setSiteContent(c => ({ ...c, about_hero: { ...c.about_hero, subtitle: e.target.value } }))}
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary"
                    />
                    <textarea
                      placeholder="Hero Body Text"
                      value={siteContent.about_hero.body || ''}
                      onChange={(e) => setSiteContent(c => ({ ...c, about_hero: { ...c.about_hero, body: e.target.value } }))}
                      className="w-full h-24 rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary resize-none"
                    />
                    <button onClick={() => void saveSiteContent('about_hero')} className="w-full py-2.5 bg-fest-primary/10 text-fest-primary hover:bg-fest-primary hover:text-fest-dark rounded-xl font-bold text-xs uppercase transition-all">Save Hero</button>
                  </div>

                  {/* About Mission */}
                  <div className="space-y-4 p-4 border border-white/5 bg-white/5 rounded-2xl">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-fest-accent">Our Mission</h4>
                    <input
                      placeholder="Title"
                      value={siteContent.about_mission.title || ''}
                      onChange={(e) => setSiteContent(c => ({ ...c, about_mission: { ...c.about_mission, title: e.target.value } }))}
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-accent"
                    />
                    <textarea
                      placeholder="Mission Body Text"
                      value={siteContent.about_mission.body || ''}
                      onChange={(e) => setSiteContent(c => ({ ...c, about_mission: { ...c.about_mission, body: e.target.value } }))}
                      className="w-full h-24 rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-accent resize-none"
                    />
                    <button onClick={() => void saveSiteContent('about_mission')} className="w-full py-2.5 bg-fest-accent/10 text-fest-accent hover:bg-fest-accent hover:text-fest-dark rounded-xl font-bold text-xs uppercase transition-all">Save Mission</button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* About Community */}
                  <div className="space-y-4 p-4 border border-white/5 bg-white/5 rounded-2xl">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-fest-primary">Our Community</h4>
                    <input
                      placeholder="Title"
                      value={siteContent.about_community.title || ''}
                      onChange={(e) => setSiteContent(c => ({ ...c, about_community: { ...c.about_community, title: e.target.value } }))}
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary"
                    />
                    <textarea
                      placeholder="Community Body Text"
                      value={siteContent.about_community.body || ''}
                      onChange={(e) => setSiteContent(c => ({ ...c, about_community: { ...c.about_community, body: e.target.value } }))}
                      className="w-full h-24 rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary resize-none"
                    />
                    <button onClick={() => void saveSiteContent('about_community')} className="w-full py-2.5 bg-fest-primary/10 text-fest-primary hover:bg-fest-primary hover:text-fest-dark rounded-xl font-bold text-xs uppercase transition-all">Save Community</button>
                  </div>

                  {/* About Vision */}
                  <div className="space-y-4 p-4 border border-white/5 bg-white/5 rounded-2xl">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-fest-accent">Our Vision</h4>
                    <input
                      placeholder="Title"
                      value={siteContent.about_vision.title || ''}
                      onChange={(e) => setSiteContent(c => ({ ...c, about_vision: { ...c.about_vision, title: e.target.value } }))}
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-accent"
                    />
                    <textarea
                      placeholder="Vision Body Text"
                      value={siteContent.about_vision.body || ''}
                      onChange={(e) => setSiteContent(c => ({ ...c, about_vision: { ...c.about_vision, body: e.target.value } }))}
                      className="w-full h-24 rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-accent resize-none"
                    />
                    <button onClick={() => void saveSiteContent('about_vision')} className="w-full py-2.5 bg-fest-accent/10 text-fest-accent hover:bg-fest-accent hover:text-fest-dark rounded-xl font-bold text-xs uppercase transition-all">Save Vision</button>
                  </div>
                </div>

                {/* About Story */}
                <div className="space-y-4 p-6 border border-white/5 bg-white/5 rounded-3xl">
                  <h4 className="text-sm font-bold uppercase tracking-widest text-fest-primary">Our Story</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      placeholder="Story Title (e.g. The Story Behind The)"
                      value={siteContent.about_story.title || ''}
                      onChange={(e) => setSiteContent(c => ({ ...c, about_story: { ...c.about_story, title: e.target.value } }))}
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary"
                    />
                    <input
                      placeholder="Story Subtitle (e.g. Script)"
                      value={siteContent.about_story.subtitle || ''}
                      onChange={(e) => setSiteContent(c => ({ ...c, about_story: { ...c.about_story, subtitle: e.target.value } }))}
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary"
                    />
                  </div>
                  <textarea
                    placeholder="Main story text..."
                    value={siteContent.about_story.body || ''}
                    onChange={(e) => setSiteContent(c => ({ ...c, about_story: { ...c.about_story, body: e.target.value } }))}
                    className="w-full h-32 rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary resize-none"
                  />
                  <textarea
                    placeholder="Secondary story text (optional)..."
                    value={siteContent.about_story.secondary_body || ''}
                    onChange={(e) => setSiteContent(c => ({ ...c, about_story: { ...c.about_story, secondary_body: e.target.value } }))}
                    className="w-full h-24 rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary resize-none"
                  />
                  <div className="flex items-center gap-4">
                    <label className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors text-xs font-bold uppercase flex items-center gap-2">
                      <ImageIcon size={16} /> Story Image
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const imageUrl = await uploadAsset(file, 'about');
                            setSiteContent(c => ({ ...c, about_story: { ...c.about_story, image_url: imageUrl } }));
                            toast.success('Story image uploaded.');
                          } catch (err: any) {
                            toast.error(err.message || 'Upload failed.');
                          }
                        }}
                      />
                    </label>
                    {siteContent.about_story.image_url && (
                      <img src={siteContent.about_story.image_url} alt="Story preview" className="w-16 h-12 object-cover rounded-lg border border-white/10" />
                    )}
                  </div>
                  <button onClick={() => void saveSiteContent('about_story')} className="w-full py-4 bg-fest-primary text-fest-dark rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-fest-primary-light transition-all shadow-lg glow-primary">
                    <Save size={16} className="inline mr-2" /> Save Story Content
                  </button>
                </div>
              </div>

              {/* CONTACT INFO EDITOR */}
              <div className="rounded-3xl border border-white/10 bg-black/20 p-6 space-y-5">
                <div>
                  <h3 className="text-xl font-bold">Contact Page Info</h3>
                  <p className="text-white/45 text-sm mt-1">Update global contact details, address, and office hours.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-white/30 ml-1 mb-2 block tracking-widest">Main Emails</label>
                    <input
                      placeholder="Primary Email"
                      value={siteContent.contact_info.metadata?.email_1 || ''}
                      onChange={(e) => setSiteContent(c => ({ ...c, contact_info: { ...c.contact_info, metadata: { ...c.contact_info.metadata, email_1: e.target.value } } }))}
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary mb-3"
                    />
                    <input
                      placeholder="Secondary Email"
                      value={siteContent.contact_info.metadata?.email_2 || ''}
                      onChange={(e) => setSiteContent(c => ({ ...c, contact_info: { ...c.contact_info, metadata: { ...c.contact_info.metadata, email_2: e.target.value } } }))}
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-white/30 ml-1 mb-2 block tracking-widest">Phone Numbers</label>
                    <input
                      placeholder="Primary Phone"
                      value={siteContent.contact_info.metadata?.phone_1 || ''}
                      onChange={(e) => setSiteContent(c => ({ ...c, contact_info: { ...c.contact_info, metadata: { ...c.contact_info.metadata, phone_1: e.target.value } } }))}
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-accent mb-3"
                    />
                    <input
                      placeholder="Secondary Phone"
                      value={siteContent.contact_info.metadata?.phone_2 || ''}
                      onChange={(e) => setSiteContent(c => ({ ...c, contact_info: { ...c.contact_info, metadata: { ...c.contact_info.metadata, phone_2: e.target.value } } }))}
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-accent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-white/30 ml-1 mb-2 block tracking-widest">Address Details</label>
                    <input
                      placeholder="Address Title (e.g. IFIM SCHOOL OF TECHNOLOGY)"
                      value={siteContent.contact_info.metadata?.address_title || ''}
                      onChange={(e) => setSiteContent(c => ({ ...c, contact_info: { ...c.contact_info, metadata: { ...c.contact_info.metadata, address_title: e.target.value } } }))}
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary mb-3"
                    />
                    <textarea
                      placeholder="Address Body (e.g. electronic city...)"
                      value={siteContent.contact_info.metadata?.address_body || ''}
                      onChange={(e) => setSiteContent(c => ({ ...c, contact_info: { ...c.contact_info, metadata: { ...c.contact_info.metadata, address_body: e.target.value } } }))}
                      className="w-full h-20 rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-primary resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-white/30 ml-1 mb-2 block tracking-widest">Office Hours</label>
                    <input
                      placeholder="Weekdays (e.g. Mon-Fri 10AM-5PM)"
                      value={siteContent.contact_info.metadata?.hours_weekday || ''}
                      onChange={(e) => setSiteContent(c => ({ ...c, contact_info: { ...c.contact_info, metadata: { ...c.contact_info.metadata, hours_weekday: e.target.value } } }))}
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-accent mb-3"
                    />
                    <input
                      placeholder="Weekends (e.g. Sat 10AM-2PM)"
                      value={siteContent.contact_info.metadata?.hours_weekend || ''}
                      onChange={(e) => setSiteContent(c => ({ ...c, contact_info: { ...c.contact_info, metadata: { ...c.contact_info.metadata, hours_weekend: e.target.value } } }))}
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-fest-accent"
                    />
                  </div>
                </div>

                <button onClick={() => void saveSiteContent('contact_info')} className="w-full py-4 bg-fest-accent text-fest-dark rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-white transition-all shadow-lg glow-accent">
                  <Save size={16} className="inline mr-2" /> Update Global Contact Info
                </button>
              </div>
            </div>
          ) : activeTab === 'users' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-white/40 uppercase tracking-widest text-xs">
                    <th className="pb-4 font-bold">Name</th>
                    <th className="pb-4 font-bold">Email</th>
                    <th className="pb-4 font-bold">Phone</th>
                    <th className="pb-4 font-bold">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((entry) => (
                    <tr key={entry.id} className="border-b border-white/5">
                      <td className="py-4 font-bold">{entry.full_name || 'No name'}</td>
                      <td className="py-4 text-white/60 text-sm">{entry.email}</td>
                      <td className="py-4 text-white/60 text-sm">{entry.phone || '-'}</td>
                      <td className="py-4">
                        <select
                          value={entry.role}
                          onChange={(e) => void handleRoleChange(entry.id, e.target.value as AppRole)}
                          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-widest text-fest-primary outline-none focus:border-fest-primary"
                        >
                          {ROLE_OPTIONS.map((role) => (
                            <option key={role} value={role}>{role}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : activeTab === 'judges_access' ? (
            <div className="space-y-6">
              <div className="max-w-3xl">
                <h3 className="text-2xl font-display font-extrabold uppercase tracking-tighter text-fest-primary flex items-center gap-3">
                  <ShieldCheck size={28} /> Video Judge Assignments
                </h3>
                <p className="text-white/50 text-sm mt-2">
                  Assign <strong>Content Reviewers</strong> to specific events. They will only be able to judge and score submissions for the events they are linked to here.
                </p>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-[0.8fr_1.2fr] gap-8">
                <form onSubmit={(e) => handleAssignmentCreate(e, 'judge')} className="space-y-4 rounded-3xl border border-white/10 bg-black/20 p-6 h-fit">
                  <div className="text-[10px] text-white/40 uppercase tracking-[0.25em] font-bold mb-2">New Judge Assignment</div>
                  
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-white/40 uppercase px-1">Select Judge</label>
                    <select 
                      value={reviewerId} 
                      onChange={(e) => setReviewerId(e.target.value)} 
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-4 text-sm outline-none focus:border-fest-primary text-white appearance-none cursor-pointer"
                    >
                      <option value="" className="bg-fest-dark text-white">Choose a judge...</option>
                      {users.filter(u => u.role !== 'user').map((entry) => (
                        <option key={entry.id} value={entry.id} className="bg-fest-dark text-white">
                          {entry.full_name || entry.email} ({entry.role.replace('_', ' ')})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-white/40 uppercase px-1">Select Event</label>
                    <select 
                      value={assignmentEventId} 
                      onChange={(e) => setAssignmentEventId(e.target.value)} 
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-4 text-sm outline-none focus:border-fest-primary text-white appearance-none cursor-pointer"
                    >
                      <option value="" className="bg-fest-dark text-white">Choose an event...</option>
                      {events.map((event) => (
                        <option key={event.id} value={event.id} className="bg-fest-dark text-white">
                          {event.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button type="submit" className="w-full py-4 bg-fest-primary text-fest-dark font-black uppercase tracking-widest rounded-xl hover:bg-fest-primary-light transition-all shadow-lg glow-primary mt-4">
                    Link Judge to Event
                  </button>
                </form>

                <div className="rounded-3xl border border-white/10 bg-black/40 overflow-hidden">
                  <div className="p-6 border-b border-white/10 bg-white/5">
                    <div className="text-xs font-bold uppercase tracking-widest">Active Judge Links</div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 text-[10px] text-white/30 uppercase tracking-widest">
                          <th className="px-6 py-4 font-bold">Judge Name</th>
                          <th className="px-6 py-4 font-bold">Assigned Event</th>
                          <th className="px-6 py-4 font-bold text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assignments.filter(a => a.role_type === 'judge').map((assignment) => (
                          <tr key={assignment.id} className="border-b border-white/5 group hover:bg-white/[0.02] transition-colors">
                            <td className="px-6 py-5 font-bold text-sm">
                              {assignment.reviewer_user?.full_name || assignment.reviewer_user?.email}
                            </td>
                            <td className="px-6 py-5">
                              <span className="px-2 py-1 bg-fest-primary/10 border border-fest-primary/20 rounded text-[10px] font-bold text-fest-primary uppercase">
                                {assignment.assigned_event?.title}
                              </span>
                            </td>
                            <td className="px-6 py-5 text-right">
                              <button 
                                onClick={() => void handleDeleteAssignment(assignment.id)} 
                                className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 group-hover:bg-red-500 group-hover:text-white transition-all text-[10px] font-black uppercase"
                              >
                                Revoke Access
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'payment_access' ? (
            <div className="space-y-6">
              <div className="max-w-3xl">
                <h3 className="text-2xl font-display font-extrabold uppercase tracking-tighter text-fest-primary flex items-center gap-3">
                  <DollarSign size={28} /> Payment Access Control
                </h3>
                <p className="text-white/50 text-sm mt-2">
                  Assign <strong>Payment Staff</strong> to specific events. These staff members will only be allowed to review payment screenshots and approve/decline registrations for linked events.
                </p>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-[0.8fr_1.2fr] gap-8">
                <form onSubmit={(e) => handleAssignmentCreate(e, 'payment')} className="space-y-4 rounded-3xl border border-white/10 bg-black/20 p-6 h-fit">
                  <div className="text-[10px] text-white/40 uppercase tracking-[0.25em] font-bold mb-2">New Payment Link</div>
                  
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-white/40 uppercase px-1">Select Staff Member</label>
                    <select 
                      value={reviewerId} 
                      onChange={(e) => setReviewerId(e.target.value)} 
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-4 text-sm outline-none focus:border-fest-primary text-white appearance-none cursor-pointer"
                    >
                      <option value="" className="bg-fest-dark text-white">Choose staff...</option>
                      {users.filter(u => u.role !== 'user').map((entry) => (
                        <option key={entry.id} value={entry.id} className="bg-fest-dark text-white">
                          {entry.full_name || entry.email} ({entry.role.replace('_', ' ')})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-white/40 uppercase px-1">Select Event</label>
                    <select 
                      value={assignmentEventId} 
                      onChange={(e) => setAssignmentEventId(e.target.value)} 
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-4 text-sm outline-none focus:border-fest-primary text-white appearance-none cursor-pointer"
                    >
                      <option value="" className="bg-fest-dark text-white">Choose an event...</option>
                      {events.map((event) => (
                        <option key={event.id} value={event.id} className="bg-fest-dark text-white">
                          {event.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button type="submit" className="w-full py-4 bg-fest-primary text-fest-dark font-black uppercase tracking-widest rounded-xl hover:bg-fest-primary-light transition-all shadow-lg glow-primary mt-4">
                    Link Staff to Payments
                  </button>
                </form>

                <div className="rounded-3xl border border-white/10 bg-black/40 overflow-hidden">
                  <div className="p-6 border-b border-white/10 bg-white/5">
                    <div className="text-xs font-bold uppercase tracking-widest">Active Payment Links</div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 text-[10px] text-white/30 uppercase tracking-widest">
                          <th className="px-6 py-4 font-bold">Staff Name</th>
                          <th className="px-6 py-4 font-bold">Assigned Event</th>
                          <th className="px-6 py-4 font-bold text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assignments.filter(a => a.role_type === 'payment').map((assignment) => (
                          <tr key={assignment.id} className="border-b border-white/5 group hover:bg-white/[0.02] transition-colors">
                            <td className="px-6 py-5 font-bold text-sm">
                              {assignment.reviewer_user?.full_name || assignment.reviewer_user?.email}
                            </td>
                            <td className="px-6 py-5">
                              <span className="px-2 py-1 bg-fest-primary/10 border border-fest-primary/20 rounded text-[10px] font-bold text-fest-primary uppercase">
                                {assignment.assigned_event?.title}
                              </span>
                            </td>
                            <td className="px-6 py-5 text-right">
                              <button 
                                onClick={() => void handleDeleteAssignment(assignment.id)} 
                                className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 group-hover:bg-red-500 group-hover:text-white transition-all text-[10px] font-black uppercase"
                              >
                                Revoke Access
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'registrations' ? (
            <div className="space-y-8">
              {!selectedEventId ? (
                // --- EVENT LIST VIEW ---
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {events.map((event) => {
                    const eventRows = registrations.filter((r) => r.event_id === event.id);
                    return (
                      <motion.button
                        key={event.id}
                        onClick={() => setSelectedEventId(event.id)}
                        whileHover={{ y: -5 }}
                        className="glass p-8 rounded-[3rem] text-left group hover:border-fest-primary/40 transition-all flex flex-col justify-between"
                      >
                        <div className="flex justify-between items-start mb-8">
                          <div className="w-14 h-14 rounded-2xl bg-fest-primary/10 flex items-center justify-center text-fest-primary">
                            <CalendarDays size={28} />
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] text-white/30 uppercase tracking-[0.25em] mb-1">Type</div>
                            <div className="text-sm font-bold text-fest-primary uppercase tracking-tighter">{event.category}</div>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-2xl font-display font-extrabold uppercase tracking-tighter mb-6 group-hover:text-fest-primary transition-colors">
                            {event.title}
                          </h3>
                          <div className="flex items-center justify-between pt-6 border-t border-white/5">
                            <div className="flex items-center gap-2 text-fest-primary-light">
                              <Users size={18} />
                              <span className="font-bold text-sm tracking-widest">{eventRows.length} Students</span>
                            </div>
                            <ChevronRight className="text-white/20 group-hover:text-fest-primary transition-all" size={20} />
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                  {events.length === 0 && (
                    <div className="col-span-full py-20 text-center text-white/20 font-bold uppercase tracking-widest text-xs border border-dashed border-white/10 rounded-[3rem]">
                      No events created yet
                    </div>
                  )}
                </div>
              ) : (
                // --- REGISTRATION DETAIL VIEW ---
                <div className="space-y-8">
                  <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                      <button
                        onClick={() => setSelectedEventId(null)}
                        className="w-12 h-12 rounded-full glass flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
                      >
                        <ArrowLeft size={24} />
                      </button>
                      <div>
                        <h3 className="text-3xl md:text-4xl font-display font-extrabold uppercase tracking-tighter">
                          {events.find((e) => e.id === selectedEventId)?.title}
                        </h3>
                        <p className="text-fest-primary-light text-xs font-bold uppercase tracking-widest mt-1 opacity-60">
                          {events.find((e) => e.id === selectedEventId)?.category} â€” {registrations.filter((r) => r.event_id === selectedEventId).length} Participants
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const event = events.find((e) => e.id === selectedEventId);
                        const rows = registrations.filter((r) => r.event_id === selectedEventId);
                        if (event) exportRegistrationsForEvent(event, rows);
                      }}
                      className="px-8 py-4 bg-fest-primary text-fest-dark rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-white hover:text-fest-dark transition-all flex items-center justify-center gap-2 shadow-lg glow-primary"
                    >
                      <Download size={16} /> Export Excel
                    </button>
                  </header>

                  <div className="overflow-x-auto glass rounded-[3rem] border border-white/10">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                      <thead>
                        <tr className="border-b border-white/5 text-white/30 uppercase tracking-widest text-[10px]">
                          <th className="px-10 py-8 font-bold">Full Name</th>
                          <th className="px-10 py-8 font-bold">College / Dept</th>
                          <th className="px-10 py-8 font-bold">Contact Details</th>
                          <th className="px-10 py-8 font-bold">Status</th>
                          <th className="px-10 py-8 font-bold">Roster</th>
                          <th className="px-10 py-8 font-bold text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {registrations.filter((r) => r.event_id === selectedEventId).length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-24 text-center text-white/20 font-bold uppercase tracking-widest text-xs">
                              No participants registered for this event yet
                            </td>
                          </tr>
                        ) : (
                          registrations
                            .filter((r) => r.event_id === selectedEventId)
                            .map((reg) => (
                              <React.Fragment key={reg.id}>
                                <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                                  <td className="px-10 py-8">
                                    <div className="font-bold text-white text-lg tracking-tight">
                                      {reg.participant_name || reg.participant_user?.full_name || 'N/A'}
                                    </div>
                                  </td>
                                  <td className="px-10 py-8 text-white/50 text-sm">
                                    <div className="font-medium text-white/70">{reg.college_name}</div>
                                    <div className="text-xs uppercase tracking-widest mt-1 opacity-40">{reg.team_name || 'Solo'} â€¢ {reg.team_size || 1} Members</div>
                                  </td>
                                  <td className="px-10 py-8">
                                    <div className="flex flex-col gap-2">
                                      <div className="flex items-center gap-2 text-white/60 text-xs">
                                        <Mail size={12} className="text-fest-primary/60" /> {reg.email || reg.participant_user?.email}
                                      </div>
                                      <div className="flex items-center gap-2 text-white/60 text-xs">
                                        <Phone size={12} className="text-fest-primary/60" /> {reg.phone}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-10 py-8">
                                    <div className={`inline-flex px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                                      reg.payment_status === 'approved' 
                                        ? 'border-green-500/20 bg-green-500/10 text-green-400' 
                                        : 'border-white/10 bg-white/5 text-white/40'
                                    }`}>
                                      {reg.payment_status}
                                    </div>
                                  </td>
                                  <td className="px-10 py-8">
                                    {reg.team_members && reg.team_members.length > 0 ? (
                                      <button
                                        onClick={() => setExpandedRegisterRows(prev => ({ ...prev, [reg.id]: !prev[reg.id] }))}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all font-bold text-[10px] uppercase tracking-widest border ${
                                          expandedRegisterRows[reg.id]
                                            ? 'bg-fest-primary text-fest-dark border-transparent'
                                            : 'border-fest-primary/30 text-fest-primary hover:bg-fest-primary/10'
                                        }`}
                                      >
                                        <Users size={12} /> {expandedRegisterRows[reg.id] ? 'Hide' : 'View'}
                                      </button>
                                    ) : (
                                      <span className="text-[10px] text-white/20 uppercase font-bold tracking-widest italic">Solo</span>
                                    )}
                                  </td>
                                  <td className="px-10 py-8 text-right">
                                    <button 
                                      onClick={() => {
                                        const name = reg.participant_name || reg.participant_user?.full_name || reg.participant_user?.email || 'N/A';
                                        void handleDeleteRegistration(reg.id, name);
                                      }} 
                                      className="p-3 text-white/20 hover:text-red-500 transition-colors"
                                    >
                                      <Trash2 size={20} />
                                    </button>
                                  </td>
                                </tr>

                                {/* ROSTER COLLAPSIBLE DETAIL */}
                                <AnimatePresence>
                                  {expandedRegisterRows[reg.id] && reg.team_members && (
                                    <tr className="bg-fest-primary/[0.02]">
                                      <td colSpan={6} className="px-10 pb-10 pt-2">
                                        <motion.div
                                          initial={{ opacity: 0, height: 0 }}
                                          animate={{ opacity: 1, height: 'auto' }}
                                          exit={{ opacity: 0, height: 0 }}
                                          className="overflow-hidden"
                                        >
                                          <div className="rounded-3xl border border-fest-primary/20 bg-fest-primary/5 p-6 relative">
                                            <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none">
                                              <Users size={80} />
                                            </div>
                                            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-fest-primary mb-4 flex items-center gap-2">
                                              <ShieldCheck size={14} /> Team Participant Roster
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                                              {reg.team_members.map((member, idx) => (
                                                <div key={idx} className="bg-black/40 border border-white/5 rounded-2xl p-4">
                                                  <div className="text-[9px] font-black text-white/20 uppercase mb-1">Player {idx + 1}</div>
                                                  <div className="text-xs font-bold text-white truncate">{member.name}</div>
                                                  <div className="text-[10px] text-fest-primary/60 font-mono mt-1">ID: {member.game_id}</div>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        </motion.div>
                                      </td>
                                    </tr>
                                  )}
                                </AnimatePresence>
                              </React.Fragment>
                            ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              </div>
          ) : activeTab === 'contact_messages' ? (
            <div className="space-y-8">
              <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h3 className="text-3xl md:text-4xl font-display font-extrabold uppercase tracking-tighter">
                    Contact <span className="text-fest-accent">Messages</span>
                  </h3>
                  <p className="text-white/40 text-xs font-bold uppercase tracking-widest mt-2">
                    {contactMessages.length} user inquiries received
                  </p>
                </div>
                <button
                  onClick={() => fetchData(true)}
                  className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all"
                >
                  <Clock size={16} className="text-fest-accent" /> Refresh Messages
                </button>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {contactMessages.length === 0 ? (
                  <div className="col-span-full py-32 glass rounded-[3rem] text-center border-dashed border-white/10">
                    <Mail size={48} className="mx-auto mb-4 text-white/10" />
                    <div className="text-xs font-bold uppercase tracking-widest text-white/20">No messages found in the system.</div>
                  </div>
                ) : (
                  contactMessages.map((msg) => (
                    <div key={msg.id} className="glass p-8 rounded-[3rem] border border-white/10 hover:border-fest-accent/40 transition-all flex flex-col justify-between group">
                      <div>
                        <div className="flex justify-between items-start mb-6">
                          <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                            msg.status === 'unread' ? 'border-fest-accent/30 bg-fest-accent/10 text-fest-accent' : 'border-white/10 bg-white/5 text-white/30'
                          }`}>
                            {msg.status}
                          </div>
                          <div className="text-[10px] text-white/20 font-bold uppercase tracking-widest">{new Date(msg.created_at).toLocaleDateString()}</div>
                        </div>
                        <h4 className="text-lg font-bold group-hover:text-fest-accent transition-colors">{msg.name}</h4>
                        <p className="text-xs text-white/40 font-medium mb-6">{msg.email}</p>
                        <div className="bg-black/20 rounded-2xl p-4 border border-white/5 min-h-[100px] text-sm text-white/70 leading-relaxed italic">
                          "{msg.message}"
                        </div>
                      </div>
                      <div className="mt-8 flex gap-3">
                        {msg.status === 'unread' && (
                          <button
                            onClick={async () => {
                              const handleStatusUpdate = async () => {
                                try {
                                  await api.post('/api/admin', { action: 'update', table: 'contact_messages', id: msg.id, record: { status: 'read' } });
                                  await fetchData();
                                } catch (err) {
                                  toast.error('Failed to update status');
                                }
                              };
                              handleStatusUpdate();
                            }}
                            className="flex-1 py-3 bg-fest-accent/10 text-fest-accent hover:bg-fest-accent hover:text-fest-dark rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all"
                          >
                            Mark Read
                          </button>
                        )}
                        <button
                          onClick={async () => {
                            if (window.confirm('Delete this message permanently?')) {
                              const handleDelete = async () => {
                                try {
                                  await api.post('/api/admin', { action: 'delete', table: 'contact_messages', id: msg.id });
                                  await fetchData();
                                } catch (err) {
                                  toast.error('Failed to delete message');
                                }
                              };
                              handleDelete();
                            }
                          }}
                          className="px-4 py-3 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-xl text-xs transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : activeTab === 'system_logs' ? (
            <div className="space-y-8">
              <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h3 className="text-3xl md:text-4xl font-display font-extrabold uppercase tracking-tighter">
                    Audit <span className="text-fest-primary">Logs</span>
                  </h3>
                  <p className="text-white/40 text-xs font-bold uppercase tracking-widest mt-2">
                    {auditLogs.length} recent administrative actions tracked
                  </p>
                </div>
                <button
                  onClick={fetchAuditLogs}
                  className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all"
                >
                  <Clock size={16} className="text-fest-primary" /> Refresh Feed
                </button>
              </header>

              <div className="space-y-4">
                {auditLogs.length === 0 ? (
                  <div className="glass rounded-[3rem] py-24 text-center border-white/5">
                     <Activity className="mx-auto mb-4 text-white/10" size={48} />
                     <div className="text-xs font-bold uppercase tracking-[0.3em] text-white/20">No system activity logged yet</div>
                  </div>
                ) : (
                  auditLogs.map((log) => (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      key={log.id}
                      className="glass rounded-3xl border border-white/5 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-white/10 hover:bg-white/[0.04] transition-all group"
                    >
                      <div className="flex items-start gap-6">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${
                          log.action_type.includes('APPROVE') || log.action_type.includes('PROMOTE') || log.action_type.includes('CREATE')
                            ? 'bg-green-500/10 text-green-400 group-hover:bg-green-500 group-hover:text-white transition-all'
                            : 'bg-red-500/10 text-red-400 group-hover:bg-red-500 group-hover:text-white transition-all'
                        }`}>
                          <Activity size={24} />
                        </div>
                        <div>
                          <div className="flex items-center gap-3">
                             <span className="text-xs font-black uppercase tracking-[0.2em] text-fest-primary">
                               {log.action_type.replace(/_/g, ' ')}
                             </span>
                             <span className="w-1 H-1 bg-white/10 rounded-full" />
                             <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
                               {new Date(log.created_at).toLocaleString()}
                             </span>
                          </div>
                          <div className="mt-2 text-lg font-bold tracking-tight">
                             {log.actor_user?.full_name || 'System Admin'} 
                             <span className="text-white/40 font-normal ml-2">
                               {log.action_type.includes('PAYMENT') ? 'processed payment for' : 
                                log.action_type.includes('JUDGE') ? 'evaluated' : 
                                log.action_type.includes('ASSIGN') ? 'modified access for' : 'updated'}
                             </span>
                             {' '}<span className="text-white/80">{log.details?.student || log.details?.event || log.target_id}</span>
                          </div>
                          {log.details?.notes && log.details.notes !== 'No notes provided' && (
                            <div className="mt-3 text-sm text-white/30 italic font-medium px-4 py-3 bg-black/20 rounded-xl border border-white/5">
                              "{log.details.notes}"
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/5 text-[10px] font-black uppercase tracking-widest text-white/20 group-hover:text-fest-primary transition-colors">
                        ACTOR ID: {log.actor_id.slice(0, 8)}...
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
