import { motion } from 'motion/react';
import { useState, FormEvent, useEffect } from 'react';
import { CheckCircle2, Send, UploadCloud, Loader2, Users, Copy } from 'lucide-react';
import { useParams, Link } from 'react-router-dom';

import { uploadToS3 } from '../lib/storage';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { DatabaseEvent } from '../types';
import { HARDCODED_EVENTS } from '../hooks/useAwsData';
import toast from 'react-hot-toast';

export default function Register() {
  const { eventId } = useParams();
  const { user, profile } = useAuth();

  const [event, setEvent] = useState<DatabaseEvent | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [phone, setPhone] = useState(profile?.phone || '');
  const [collegeName, setCollegeName] = useState(profile?.college_name || '');
  const [department, setDepartment] = useState('');
  const [yearOfStudy, setYearOfStudy] = useState('');
  const [teamName, setTeamName] = useState('');
  const [teamSize, setTeamSize] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [applicationFormNo, setApplicationFormNo] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [userPhotoFile, setUserPhotoFile] = useState<File | null>(null);
  const [subCategory, setSubCategory] = useState('');
  const [registeredSubCategories, setRegisteredSubCategories] = useState<string[]>([]);
  const [teamMembers, setTeamMembers] = useState<{ name: string; game_id: string }[]>(
    Array(5).fill(null).map(() => ({ name: '', game_id: '' }))
  );

  useEffect(() => {
    if (!eventId) return;
    const foundEvent = HARDCODED_EVENTS.find(e => e.id === eventId);
    if (foundEvent) {
      setEvent(foundEvent);
      setTeamSize(1);
    } else {
      toast.error('Event not found');
    }
    setLoadingConfig(false);
  }, [eventId]);

  useEffect(() => {
    setPhone(profile?.phone || '');
    setCollegeName(profile?.college_name || '');
  }, [profile]);

  const handleSubmit = async (e: FormEvent) => {
    if (!user) return toast.error('You must be logged in to register');
    if (!event) return toast.error('Event not found');
    if (!applicationFormNo) return toast.error('Please enter your Application Form Number');
    if (!userPhotoFile) return toast.error('Please upload your photo');
    
    if (event.sub_categories && event.sub_categories.length > 0 && !subCategory) {
      return toast.error('Please select an event category/slot');
    }

    const MAX_FILE_SIZE = 500 * 1024; // Increased to 500KB for better photo quality
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];

    if (userPhotoFile.size > MAX_FILE_SIZE) {
      return toast.error('User photo must be under 500KB. Please compress the image if needed.');
    }
    if (!allowedImageTypes.includes(userPhotoFile.type)) {
      return toast.error('Only JPG, PNG, or WebP images are allowed.');
    }

    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 10 || phoneDigits.length > 13) {
      return toast.error('Please enter a valid phone number.');
    }

    setSubmitting(true);
    try {
      const safeEventTitle = (event?.title || 'event').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const safeUserName = (profile?.full_name || 'student').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();

      const photoPrefix = `${safeEventTitle}_${safeUserName}_photo`;
      const { key: photoKey } = await uploadToS3(userPhotoFile, 'user_photos', photoPrefix);

      const payload = {
        event_id: event.id,
        participant_name: profile?.full_name || '',
        email: user.email,
        phone: phoneDigits,
        college_name: collegeName || null,
        department: department || null,
        year_of_study: yearOfStudy || null,
        team_name: teamName || null,
        team_size: teamSize,
        sub_category: subCategory || null,
        team_members: event.requires_team_details ? teamMembers : [],
        application_form_no: applicationFormNo,
        referral_code: referralCode,
        user_photo_url: photoKey,
      };

      const res = await api.post<any>('/api/participant-hub?action=register', payload);

      if (res.autoApproved) {
        toast.success('Registration successful and auto-approved!');
      } else {
        toast.success('Registration submitted successfully.');
      }
      
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit registration');
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  if (loadingConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-fest-primary" size={48} />
      </div>
    );
  }

  // Check if there are still unregistered subcategories
  const hasMoreSubCategories = event?.sub_categories && event.sub_categories.length > 0 &&
    event.sub_categories.some(cat => !registeredSubCategories.includes(cat));

  if (submitted) {
    return (
      <main className="pt-32 pb-24 px-6 min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full glass p-12 rounded-[3rem] text-center"
        >
          <div className="w-20 h-20 bg-fest-primary/20 rounded-full flex items-center justify-center mx-auto mb-8">
            <CheckCircle2 size={40} className="text-fest-primary" />
          </div>
          <h2 className="text-3xl font-display font-bold mb-4">Registration Successful</h2>
          <p className="text-white/50 mb-10">
            You've successfully registered for <strong className="text-white">{event?.title}</strong>
            {subCategory && <span> in the <strong className="text-fest-primary">{subCategory}</strong> category</span>}.
          </p>
          <div className="space-y-4">
            <Link
              to="/dashboard"
              className="w-full inline-block py-4 bg-fest-primary text-fest-dark rounded-2xl font-bold uppercase tracking-widest hover:bg-fest-primary-light transition-all"
            >
              Open Registered Events
            </Link>
            {hasMoreSubCategories && (
              <button
                onClick={() => {
                  setSubmitted(false);
                  setSubCategory('');
                  setUserPhotoFile(null);
                  setTeamMembers(Array(5).fill(null).map(() => ({ name: '', game_id: '' })));
                }}
                className="w-full py-4 border-2 border-fest-primary/40 text-fest-primary rounded-2xl font-bold uppercase tracking-widest hover:bg-fest-primary/10 transition-all"
              >
                Register for Another Category
              </button>
            )}
          </div>
        </motion.div>
      </main>
    );
  }

  const totalAmount = event ? (event.requires_team_details ? event.entry_fee * 4 : event.entry_fee * teamSize) : 0;

  return (
    <main className="pt-32 pb-24 px-6 min-h-screen">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-start">
        <motion.div initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} className="sticky top-32">
          <h1 className="text-5xl md:text-8xl font-display font-extrabold tracking-tighter mb-8 leading-none">
            SECURE YOUR <span className="text-fest-primary">SPOT</span>
          </h1>
          <p className="text-white/60 text-xl mb-12 leading-relaxed max-w-lg">
            Registration for <strong className="text-fest-primary">{event?.title}</strong> is almost complete. Please provide your application details and upload your photo below.
          </p>

          <div className="space-y-6 glass p-8 rounded-3xl border-l-4 border-fest-primary">
            <h3 className="font-display font-bold text-xl mb-4">Registration Instructions</h3>
            <ul className="space-y-4 text-white/80 list-disc pl-5">
              <li>Enter your correct <strong>Application Form Number</strong>.</li>
              <li>Upload a clear **User Photo** of yourself.</li>
              <li>Enter a **Referral Code** if you have one for instant approval.</li>
              <li>Ensure all personal details match your application records.</li>
            </ul>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass p-8 md:p-12 rounded-[3rem] relative"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-fest-primary/10 blur-[80px] -z-10" />

          <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
            <div className="relative group">
              <input
                type="text"
                disabled
                value={profile?.full_name || ''}
                className="w-full bg-transparent border-b-2 border-white/10 py-3 focus:outline-none transition-colors opacity-50 font-bold text-fest-primary cursor-not-allowed"
              />
              <label className="absolute left-0 -top-4 text-fest-primary text-xs">Full Name</label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="relative group">
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-transparent border-b-2 border-white/10 py-3 focus:outline-none focus:border-fest-primary transition-colors peer placeholder-transparent"
                  placeholder="Phone Number"
                  id="phone"
                />
                <label htmlFor="phone" className="absolute left-0 top-3 text-white/30 text-sm transition-all peer-focus:-top-4 peer-focus:text-fest-primary peer-focus:text-xs peer-[:not(:placeholder-shown)]:-top-4 peer-[:not(:placeholder-shown)]:text-xs">
                  Phone Number
                </label>
              </div>
              <div className="relative group">
                <input
                  type="text"
                  required
                  value={collegeName}
                  onChange={(e) => setCollegeName(e.target.value)}
                  className="w-full bg-transparent border-b-2 border-white/10 py-3 focus:outline-none focus:border-fest-primary transition-colors peer placeholder-transparent"
                  placeholder="School/College Name"
                  id="college"
                />
                <label htmlFor="college" className="absolute left-0 top-3 text-white/30 text-sm transition-all peer-focus:-top-4 peer-focus:text-fest-primary peer-focus:text-xs peer-[:not(:placeholder-shown)]:-top-4 peer-[:not(:placeholder-shown)]:text-xs">
                  School/College Name
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="relative group">
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full bg-transparent border-b-2 border-white/10 py-3 focus:outline-none focus:border-fest-primary transition-colors peer placeholder-transparent"
                  placeholder="Department"
                  id="department"
                />
                <label htmlFor="department" className="absolute left-0 top-3 text-white/30 text-sm transition-all peer-focus:-top-4 peer-focus:text-fest-primary peer-focus:text-xs peer-[:not(:placeholder-shown)]:-top-4 peer-[:not(:placeholder-shown)]:text-xs">
                  Department
                </label>
              </div>
              <div className="relative group">
                <input
                  type="text"
                  value={yearOfStudy}
                  onChange={(e) => setYearOfStudy(e.target.value)}
                  className="w-full bg-transparent border-b-2 border-white/10 py-3 focus:outline-none focus:border-fest-primary transition-colors peer placeholder-transparent"
                  placeholder="Year"
                  id="year"
                />
                <label htmlFor="year" className="absolute left-0 top-3 text-white/30 text-sm transition-all peer-focus:-top-4 peer-focus:text-fest-primary peer-focus:text-xs peer-[:not(:placeholder-shown)]:-top-4 peer-[:not(:placeholder-shown)]:text-xs">
                  Year Of Study
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="relative group">
                <input
                  type="text"
                  required
                  value={applicationFormNo}
                  onChange={(e) => setApplicationFormNo(e.target.value)}
                  className="w-full bg-transparent border-b-2 border-white/10 py-3 focus:outline-none focus:border-fest-primary transition-colors peer placeholder-transparent"
                  placeholder="Application Form No"
                  id="application-no"
                />
                <label htmlFor="application-no" className="absolute left-0 top-3 text-white/30 text-sm transition-all peer-focus:-top-4 peer-focus:text-fest-primary peer-focus:text-xs peer-[:not(:placeholder-shown)]:-top-4 peer-[:not(:placeholder-shown)]:text-xs">
                  Application Form No
                </label>
              </div>
              <div className="relative group">
                <input
                  type="text"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value)}
                  className="w-full bg-transparent border-b-2 border-white/10 py-3 focus:outline-none focus:border-fest-primary transition-colors peer placeholder-transparent"
                  placeholder="Referral Code (e.g. ifim_unscripTx_2026)"
                  id="referral-code"
                />
                <label htmlFor="referral-code" className="absolute left-0 top-3 text-white/30 text-sm transition-all peer-focus:-top-4 peer-focus:text-fest-primary peer-focus:text-xs peer-[:not(:placeholder-shown)]:-top-4 peer-[:not(:placeholder-shown)]:text-xs">
                  Referral Code (for instant approval)
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="relative group">
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="w-full bg-transparent border-b-2 border-white/10 py-3 focus:outline-none focus:border-fest-primary transition-colors peer placeholder-transparent"
                  placeholder="Team Name"
                  id="team"
                />
                <label htmlFor="team" className="absolute left-0 top-3 text-white/30 text-sm transition-all peer-focus:-top-4 peer-focus:text-fest-primary peer-focus:text-xs peer-[:not(:placeholder-shown)]:-top-4 peer-[:not(:placeholder-shown)]:text-xs">
                  Team Name
                </label>
              </div>
              <div className="relative group">
                <input
                  type="number"
                  min={1}
                  max={event?.max_team_size || 1}
                  value={teamSize}
                  onChange={(e) => setTeamSize(Number(e.target.value))}
                  className="w-full bg-transparent border-b-2 border-white/10 py-3 focus:outline-none focus:border-fest-primary transition-colors peer placeholder-transparent"
                  placeholder="Team Size"
                  id="team-size"
                />
                <label htmlFor="team-size" className="absolute left-0 top-3 text-white/30 text-sm transition-all peer-focus:-top-4 peer-focus:text-fest-primary peer-focus:text-xs peer-[:not(:placeholder-shown)]:-top-4 peer-[:not(:placeholder-shown)]:text-xs">
                  Team Size
                </label>
              </div>
            </div>

            {/* TEAM ROSTER SECTION */}
            {event?.requires_team_details && (
              <div className="space-y-6 mt-10 p-6 rounded-3xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-3 text-fest-primary text-xs font-black uppercase tracking-[0.2em] mb-4">
                  <Users size={16} /> 5-Player Gaming Roster
                </div>
                <div className="grid grid-cols-1 gap-6">
                  {teamMembers.map((member, idx) => (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end pb-6 border-b border-white/5 last:border-0 last:pb-0">
                      <div className="relative group">
                        <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mb-2">
                          Player {idx + 1} Name {idx === 4 ? '(Optional Sub)' : '(Compulsory)'}
                        </div>
                        <input
                          type="text"
                          required={idx < 4}
                          value={member.name}
                          onChange={(e) => {
                            const newMembers = [...teamMembers];
                            newMembers[idx].name = e.target.value;
                            setTeamMembers(newMembers);
                          }}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-fest-primary transition-all"
                          placeholder="Full Name"
                        />
                      </div>
                      <div className="relative group">
                        <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mb-2">
                          Game ID / In-Game Name {idx === 4 ? '(Optional)' : ''}
                        </div>
                        <input
                          type="text"
                          required={idx < 4}
                          value={member.game_id}
                          onChange={(e) => {
                            const newMembers = [...teamMembers];
                            newMembers[idx].game_id = e.target.value;
                            setTeamMembers(newMembers);
                          }}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-fest-primary transition-all"
                          placeholder="ID (e.g. 512344566)"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-white/30 italic">Note: The first 4 players are compulsory. The 5th slot is an optional substitute player (free of charge).</p>
              </div>
            )}

            {event?.sub_categories && event.sub_categories.length > 0 && (
              <div className="relative group">
                <select
                  required
                  value={subCategory}
                  onChange={(e) => setSubCategory(e.target.value)}
                  className="w-full bg-transparent border-b-2 border-white/10 py-3 focus:outline-none focus:border-fest-primary transition-colors text-white"
                >
                  <option value="" className="bg-fest-dark text-white/50">Select Category / Slot</option>
                  {event.sub_categories.map((cat, idx) => {
                    const alreadyRegistered = registeredSubCategories.includes(cat);
                    return (
                      <option
                        key={idx}
                        value={cat}
                        disabled={alreadyRegistered}
                        className={`bg-fest-dark ${alreadyRegistered ? 'text-white/30' : 'text-white'}`}
                      >
                        {cat}{alreadyRegistered ? ' (Already Registered)' : ''}
                      </option>
                    );
                  })}
                </select>
                <label className="absolute left-0 -top-4 text-fest-primary text-xs">Category / Slot Selection (Required)</label>
                {registeredSubCategories.length > 0 && (
                  <p className="text-xs text-fest-primary/60 mt-2">
                    You've already registered for: {registeredSubCategories.join(', ')}
                  </p>
                )}
              </div>
            )}

            <div className="relative group">
              <input
                type="text"
                disabled
                value={event?.title || ''}
                className="w-full bg-transparent border-b-2 border-white/10 py-3 focus:outline-none transition-colors opacity-50 font-bold text-fest-primary cursor-not-allowed"
              />
              <label className="absolute left-0 -top-4 text-fest-primary text-xs">Selected Event</label>
            </div>

            <div className="space-y-5 mt-4">
              <div
                className="relative rounded-3xl border-2 border-dashed border-fest-primary/40 bg-fest-primary/5 p-6 flex flex-col md:flex-row items-center md:items-start gap-4 hover:bg-fest-primary/10 hover:border-fest-primary transition-all cursor-pointer group"
                onClick={() => document.getElementById('photo-upload')?.click()}
              >
                <input
                  type="file"
                  id="photo-upload"
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => setUserPhotoFile(e.target.files?.[0] || null)}
                />
                <div className={`p-4 rounded-full flex-shrink-0 transition-transform group-hover:scale-110 ${userPhotoFile ? 'bg-green-500/20 text-green-500' : 'bg-fest-primary/20 text-fest-primary'}`}>
                  <UploadCloud size={28} />
                </div>
                <div className="text-center md:text-left flex-1">
                  <h4 className="text-sm font-bold uppercase tracking-widest text-white mb-1">User Photo</h4>
                  <p className="text-xs text-white/50">{userPhotoFile ? userPhotoFile.name : 'Upload Your Photo / Max 500KB (.jpg, .png)'}</p>
                </div>
                {userPhotoFile && <CheckCircle2 className="text-green-500 hidden md:block" size={24} />}
              </div>
            </div>



            <button
              type="submit"
              disabled={submitting}
              className="w-full py-5 bg-fest-primary text-fest-dark font-black uppercase tracking-[0.2em] text-lg rounded-2xl hover:bg-fest-primary-light transition-all glow-primary flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {submitting ? 'PROCESSING...' : 'SUBMIT REGISTRATION'} {!submitting && <Send size={20} />}
            </button>
          </form>
        </motion.div>
      </div>
    </main>
  );
}
