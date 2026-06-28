import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, addDoc, query, where, getDocs, Timestamp, onSnapshot, updateDoc } from 'firebase/firestore';
import { Phone, Shield, ShieldAlert, Activity, Flame, MessageCircle, AlertTriangle, CheckCircle, Clock, Wrench, QrCode, Bell, BellRing, X } from 'lucide-react';

// Simple native audio synthesizer helper to make chimes
function playChimeSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
    osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
    
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {
    console.warn("Chime play blocked or unsupported:", e);
  }
}

interface FinderPageProps {
  qrId: string;
}

const PRESET_MESSAGES = [
  {
    label: "Vehicle is blocking my way",
    text: "Hi, your vehicle is blocking my way. Could you please move it?"
  },
  {
    label: "Headlights are on",
    text: "Hi, I noticed your headlights are on."
  },
  {
    label: "Vehicle is leaking fluid",
    text: "Hi, your vehicle seems to be leaking fluid, please check."
  },
  {
    label: "Alarm is going off",
    text: "Hi, I think your alarm is going off."
  },
  {
    label: "Other / general contact",
    text: "Hi, I'd like to contact you about your parked vehicle."
  }
];

const EMERGENCY_NUMBERS = [
  { name: 'Police', phone: '999', icon: Shield, color: 'bg-blue-50 text-blue-700 border-blue-250 hover:bg-blue-100/50' },
  { name: 'Ambulance', phone: '998', icon: Activity, color: 'bg-emerald-50 text-emerald-700 border-emerald-250 hover:bg-emerald-100/50' },
  { name: 'Civil Defence', phone: '997', icon: Flame, color: 'bg-orange-50 text-orange-700 border-orange-250 hover:bg-orange-100/50' },
  { name: 'Police (Non-Emergency)', phone: '901', icon: ShieldAlert, color: 'bg-slate-50 text-slate-700 border-slate-250 hover:bg-slate-100/50' }
];

export default function FinderPage({ qrId }: FinderPageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plateNumber, setPlateNumber] = useState<string | null>(null);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number>(0);
  const [rateLimited, setRateLimited] = useState<boolean>(false);
  const [initiatingCall, setInitiatingCall] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [emergencyContactName, setEmergencyContactName] = useState<string | null>(null);
  const [emergencyContactNumber, setEmergencyContactNumber] = useState<string | null>(null);

  // Live Digital Alarm states
  const [activeAlarmId, setActiveAlarmId] = useState<string | null>(null);
  const [alarmStatus, setAlarmStatus] = useState<'none' | 'pending' | 'replied'>('none');
  const [alarmReply, setAlarmReply] = useState<string>('');
  const [triggeringAlarm, setTriggeringAlarm] = useState<boolean>(false);

  // Clean up snapshot listener on unmount / activeAlarmId change
  useEffect(() => {
    let unsub: (() => void) | null = null;
    if (activeAlarmId) {
      unsub = onSnapshot(doc(db, 'alarms', activeAlarmId), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.status === 'replied') {
            setAlarmStatus('replied');
            setAlarmReply(data.reply || '');
            playChimeSound();
          } else if (data.status === 'dismissed') {
            setAlarmStatus('none');
            setAlarmReply('');
            setActiveAlarmId(null);
          }
        }
      });
    }
    return () => {
      if (unsub) unsub();
    };
  }, [activeAlarmId]);

  const handleTriggerAlarm = async () => {
    try {
      setTriggeringAlarm(true);
      const messageText = PRESET_MESSAGES[selectedPresetIndex].text;
      const alarmRef = await addDoc(collection(db, 'alarms'), {
        qr_id: qrId,
        message: messageText,
        status: 'pending',
        reply: '',
        created_at: Timestamp.now(),
        updated_at: Timestamp.now()
      });
      setActiveAlarmId(alarmRef.id);
      setAlarmStatus('pending');
    } catch (err) {
      console.error("Error triggering alarm:", err);
      alert("Could not sound the alarm. Please try WhatsApp contact.");
    } finally {
      setTriggeringAlarm(false);
    }
  };

  const cancelActiveAlarm = async () => {
    if (!activeAlarmId) return;
    try {
      await updateDoc(doc(db, 'alarms', activeAlarmId), {
        status: 'dismissed',
        updated_at: Timestamp.now()
      });
      setAlarmStatus('none');
      setActiveAlarmId(null);
    } catch (err) {
      console.error("Error cancelling alarm:", err);
      setAlarmStatus('none');
      setActiveAlarmId(null);
    }
  };

  // Load basic tag status on page load
  useEffect(() => {
    async function initFinder() {
      try {
        setLoading(true);
        // 1. Fetch tag from firestore
        const tagRef = doc(db, 'tags', qrId);
        const tagSnap = await getDoc(tagRef);

        if (!tagSnap.exists()) {
          setError("Tag not found.");
          setLoading(false);
          return;
        }

        const tagData = tagSnap.data();
        if (tagData.status !== 'active') {
          setIsActive(false);
          setLoading(false);
          return;
        }

        setIsActive(true);
        setPlateNumber(tagData.plate_number || null);
        setEmergencyContactName(tagData.emergency_contact_name || null);
        setEmergencyContactNumber(tagData.emergency_contact_number || null);

        // 2. Log scan / visit
        await addDoc(collection(db, 'scan_logs'), {
          qr_id: qrId,
          scanned_at: Timestamp.now(),
          qr_type: 'qr2_webapp'
        });

        // 3. Check rate limits for this QR code's WhatsApp button clicks in the last hour
        await checkRateLimit();

      } catch (err: any) {
        console.error("Error loading finder page:", err);
        setError("Unable to retrieve tag data. Please check your connection.");
      } finally {
        setLoading(false);
      }
    }

    initFinder();
  }, [qrId]);

  // Helper to check rate limit
  const checkRateLimit = async () => {
    try {
      const clicksRef = collection(db, 'whatsapp_clicks');
      const q = query(clicksRef, where('qr_id', '==', qrId));
      const querySnapshot = await getDocs(q);
      
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      let clickCount = 0;

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const clickedAt = data.clicked_at?.toDate()?.getTime() || 0;
        if (clickedAt >= oneHourAgo) {
          clickCount++;
        }
      });

      if (clickCount >= 5) {
        setRateLimited(true);
      } else {
        setRateLimited(false);
      }
    } catch (err) {
      console.error("Error checking rate limits:", err);
    }
  };

  const handleWhatsAppContact = async () => {
    if (rateLimited) return;
    try {
      setInitiatingCall(true);
      
      // Double check rate limit before proceeding
      await checkRateLimit();
      if (rateLimited) {
        setInitiatingCall(false);
        return;
      }

      // Fetch the owner's phone number on demand at click time only
      const tagRef = doc(db, 'tags', qrId);
      const tagSnap = await getDoc(tagRef);
      
      if (!tagSnap.exists()) {
        alert("Tag details not found.");
        setInitiatingCall(false);
        return;
      }

      const tagData = tagSnap.data();
      const phone = tagData.phone_number;
      if (!phone) {
        alert("No contact phone number registered for this tag.");
        setInitiatingCall(false);
        return;
      }

      // Format phone number: strip spaces, dashes, leading 0s, and prepend country code (971 for UAE if not present)
      let cleanedPhone = phone.replace(/[^0-9+]/g, '');
      if (cleanedPhone.startsWith('0')) {
        // Assume UAE phone
        cleanedPhone = '971' + cleanedPhone.substring(1);
      } else if (!cleanedPhone.startsWith('+') && !cleanedPhone.startsWith('971')) {
        // If not containing country code, count on default UAE phone length (e.g., starts with 5)
        if (cleanedPhone.length === 9 && cleanedPhone.startsWith('5')) {
          cleanedPhone = '971' + cleanedPhone;
        }
      }
      cleanedPhone = cleanedPhone.replace('+', ''); // wa.me does not need plus

      const messageText = PRESET_MESSAGES[selectedPresetIndex].text;
      const encodedMessage = encodeURIComponent(messageText);

      // Log the whatsapp click
      await addDoc(collection(db, 'whatsapp_clicks'), {
        qr_id: qrId,
        clicked_at: Timestamp.now()
      });

      // Quick visual success
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);

      // Open WhatsApp Link
      const whatsappUrl = `https://wa.me/${cleanedPhone}?text=${encodedMessage}`;
      window.open(whatsappUrl, '_blank');

      // Refresh rate limits to reflect new click
      await checkRateLimit();

    } catch (err) {
      console.error("Error starting contact:", err);
      alert("Failed to initiate contact. Please try again.");
    } finally {
      setInitiatingCall(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F6F3] text-[#14171A] flex flex-col items-center justify-center p-6 font-sans" id="finder-loading-container">
        <div className="bg-white rounded-3xl p-8 border border-[#DDDAD3] shadow-xs flex flex-col items-center max-w-xs text-center space-y-4">
          <div className="bg-[#D98F1F]/10 text-[#D98F1F] p-3 rounded-xl border border-[#D98F1F]/20 animate-spin">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-display font-black tracking-tight text-[#14171A] uppercase">CallMe Tag Portal</h2>
            <p className="text-[10px] text-[#D98F1F] font-extrabold tracking-wider uppercase font-mono mt-1">Establishing Secure Connection...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F7F6F3] text-[#14171A] flex flex-col items-center justify-center p-6 font-sans" id="finder-error-container">
        <div className="bg-white rounded-3xl p-8 border border-[#DDDAD3] shadow-xs flex flex-col items-center max-w-xs text-center space-y-4" id="finder-error-card">
          <div className="bg-rose-50 text-rose-700 p-3 rounded-xl border border-rose-200">
            <AlertTriangle className="w-6 h-6" id="finder-error-icon" />
          </div>
          <div>
            <h2 className="text-base font-display font-black tracking-tight text-[#14171A] uppercase" id="finder-error-title">Portal Error</h2>
            <p className="text-xs text-slate-500 mt-2 font-semibold" id="finder-error-msg">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isActive) {
    return (
      <div className="min-h-screen bg-[#F7F6F3] text-[#14171A] flex flex-col items-center justify-center p-6 font-sans" id="finder-inactive-container">
        <div className="bg-white rounded-3xl p-8 border border-[#DDDAD3] shadow-xs flex flex-col items-center max-w-xs text-center space-y-4" id="finder-inactive-card">
          <div className="bg-amber-50 text-amber-700 p-3 rounded-xl border border-amber-200">
            <AlertTriangle className="w-6 h-6" id="finder-inactive-icon" />
          </div>
          <div>
            <h2 className="text-base font-display font-black tracking-tight text-[#14171A] uppercase" id="finder-inactive-title">Tag Not Active</h2>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed font-semibold" id="finder-inactive-msg">
              This vehicle CallMe Tag is not currently active. Contact options are temporarily disabled.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F6F3] text-[#14171A] flex flex-col items-center justify-center py-10 px-4 font-sans selection:bg-[#D98F1F]/20 selection:text-[#14171A]" id="finder-main-container">
      <div className="w-full max-w-md bg-white rounded-3xl border border-[#DDDAD3] shadow-[0_15px_40px_rgba(20,23,26,0.06)] overflow-hidden flex flex-col" id="finder-main-card">
        
        {/* UAE Theme Header */}
        <div className="bg-[#F7F6F3]/50 border-b border-[#DDDAD3]/50 p-6 text-center relative flex flex-col items-center" id="finder-header">
          <div className="bg-[#D98F1F]/10 text-[#D98F1F] p-2.5 rounded-xl border border-[#D98F1F]/20 mb-3 shadow-xs">
            <QrCode className="w-5 h-5" />
          </div>
          <p className="text-[10px] uppercase tracking-widest text-[#D98F1F] font-extrabold" id="finder-sub">UAE Secure Vehicle Link</p>
          <h1 className="text-xl font-display font-black tracking-tight text-[#14171A] mt-1" id="finder-title">CallMe Tag</h1>
          
          {plateNumber ? (
            <div className="mt-5 inline-flex flex-col items-center bg-[#14171A] text-[#F7F6F3] px-8 py-3 rounded-2xl border border-[#14171A]/20 shadow-sm" id="finder-plate">
              <span className="text-[9px] uppercase font-extrabold tracking-widest text-[#F7F6F3]/60 border-b border-[#F7F6F3]/10 w-full text-center pb-1 font-mono">UAE الامارات</span>
              <span className="text-2xl font-mono font-black tracking-widest uppercase mt-1 leading-none">{plateNumber}</span>
            </div>
          ) : (
            <div className="mt-4 text-xs text-slate-500 font-medium" id="finder-no-plate">
              Registered Vehicle Owner Portal
            </div>
          )}
        </div>

        {/* Action Form / Contact */}
        <div className="p-6 flex-1 flex flex-col text-left" id="finder-body">
          {/* Quick instructions */}
          <p className="text-xs text-slate-500 leading-relaxed text-center mb-6 font-semibold" id="finder-instructions">
            Owner is contacted through our masked SMS relay gateway. Your call will route privately to secure WhatsApp. No mobile digits are visible to either party.
          </p>

          {/* Preset drop-down */}
          <div className="space-y-2 mb-6" id="finder-reasons-group">
            <label className="block text-[9px] font-extrabold text-[#14171A] uppercase tracking-widest font-mono" htmlFor="reason-selector">
              Reason for Contact
            </label>
            <select
              id="reason-selector"
              value={selectedPresetIndex}
              onChange={(e) => setSelectedPresetIndex(Number(e.target.value))}
              className="w-full px-4 py-3.5 bg-[#F7F6F3] border border-[#DDDAD3] rounded-xl font-sans text-sm text-[#14171A] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#D98F1F] focus:border-transparent transition-all font-semibold outline-none cursor-pointer"
            >
              {PRESET_MESSAGES.map((msg, idx) => (
                <option key={idx} value={idx} className="bg-white text-[#14171A]">
                  {msg.label}
                </option>
              ))}
            </select>
          </div>

          {/* Contact Button */}
          <div className="mb-6" id="finder-whatsapp-block">
            {rateLimited ? (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl text-center flex items-center justify-center space-x-2" id="finder-ratelimit-message">
                <Clock className="w-4 h-4 flex-shrink-0 animate-pulse" />
                <span className="text-xs font-semibold">Scanning rate-limit reached (Max 5 hourly alerts allowed)</span>
              </div>
            ) : (
              <button
                id="contact-whatsapp-btn"
                onClick={handleWhatsAppContact}
                disabled={initiatingCall}
                className="w-full bg-[#14171A] hover:bg-[#D98F1F] text-[#F7F6F3] py-4 px-4 rounded-xl font-display font-black text-sm shadow-[0_4px_20px_rgba(20,23,26,0.1)] hover:shadow-[0_4px_25px_rgba(217,143,31,0.2)] flex items-center justify-center space-x-2 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                {initiatingCall ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#F7F6F3] border-t-transparent" />
                    <span>Connecting securely...</span>
                  </>
                ) : success ? (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    <span>WhatsApp Route Opened!</span>
                  </>
                ) : (
                  <>
                    <MessageCircle className="w-5 h-5" />
                    <span>Send Masked WhatsApp Alert</span>
                  </>
                )}
              </button>
            )}
            <p className="text-[10px] text-slate-400 text-center mt-2.5 font-semibold" id="finder-note">
              *All vehicle alerts are routed through UAE proxy logs. Scanners cannot obtain phone information.
            </p>
          </div>

          {/* Live Digital Alarm Trigger */}
          <div className="mb-6 p-4 bg-amber-50/60 border border-amber-200/70 rounded-2xl space-y-3" id="finder-alarm-trigger-block">
            <div className="flex items-start space-x-2.5">
              <div className="p-2 bg-amber-500/10 text-[#D98F1F] rounded-lg mt-0.5">
                <BellRing className="w-4 h-4 animate-bounce" />
              </div>
              <div className="text-left flex-1">
                <h4 className="text-xs font-bold text-[#14171A]">Trigger Live Vehicle Alarm</h4>
                <p className="text-[10px] text-slate-500 font-semibold leading-relaxed mt-0.5">
                  If the owner added CallMe to their Home Screen, this sounds a loud instant alert and lets them reply instantly in real-time.
                </p>
              </div>
            </div>
            
            <button
              id="trigger-live-alarm-btn"
              onClick={handleTriggerAlarm}
              disabled={triggeringAlarm}
              className="w-full bg-[#D98F1F] hover:bg-[#14171A] text-white py-3 px-4 rounded-xl font-display font-black text-xs shadow-xs flex items-center justify-center space-x-2 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {triggeringAlarm ? (
                <>
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                  <span>Ringing Owner's Phone...</span>
                </>
              ) : (
                <>
                  <Bell className="w-4 h-4 animate-pulse" />
                  <span>Ringtone/Vibrate Alert Owner</span>
                </>
              )}
            </button>
          </div>

          {/* Emergency Family Contact Section (if configured) */}
          {(emergencyContactName || emergencyContactNumber) && (() => {
            const isNumericName = emergencyContactName && /^\+?[\d\s\-()]+$/.test(emergencyContactName) && emergencyContactName.replace(/[^\d]/g, '').length > 4;
            const safeEmergencyName = isNumericName ? 'Family/Emergency Contact' : (emergencyContactName || 'Emergency Contact');
            
            return (
              <div className="border-t border-[#DDDAD3]/50 pt-6 mb-4" id="family-emergency-section">
                <h3 className="text-xs uppercase tracking-wider text-rose-700 font-sans font-extrabold mb-3 flex items-center space-x-1.5" id="family-emergency-title">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                  <span>Emergency Family Contact</span>
                </h3>
                <a
                  id="family-emergency-call-btn"
                  href={`tel:${emergencyContactNumber || ''}`}
                  className="flex items-center justify-between p-4 bg-rose-50 border border-rose-200/60 rounded-xl hover:bg-rose-100/50 transition-all duration-200 active:scale-95 group shadow-xs cursor-pointer"
                  title="Call Emergency Contact"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-rose-600 text-white rounded-lg group-hover:scale-105 transition-transform flex items-center justify-center">
                      <Phone className="w-4 h-4 flex-shrink-0" id="family-emergency-call-icon" />
                    </div>
                    <div className="text-left">
                      <p className="text-[9px] uppercase font-sans font-bold text-rose-600 tracking-wider">Tap to Call Directly</p>
                      <p className="text-sm font-sans font-bold text-[#14171A] leading-tight">
                        {safeEmergencyName}
                      </p>
                    </div>
                  </div>
                  {emergencyContactNumber && (
                    <span className="font-sans text-xs font-bold text-rose-700 bg-rose-100 border border-rose-200 p-1.5 px-3 rounded-lg shadow-xs group-hover:bg-rose-600 group-hover:text-white transition-all">
                      Call
                    </span>
                  )}
                </a>
              </div>
            );
          })()}

          {/* Roadside Assistance Section */}
          <div className="border-t border-[#DDDAD3]/50 pt-6 mb-4" id="roadside-assistance-section">
            <h3 className="text-xs uppercase tracking-wider text-[#D98F1F] font-sans font-extrabold mb-3 flex items-center space-x-1.5" id="roadside-assistance-title">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              <span>Roadside Assistance</span>
            </h3>
            <a
              id="roadside-assistance-call-btn"
              href="tel:8009000"
              className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200/60 rounded-xl hover:bg-amber-100/50 transition-all duration-200 active:scale-95 group shadow-xs cursor-pointer"
              title="Call Roadside Assistance"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-[#D98F1F] text-white rounded-lg group-hover:scale-105 transition-transform flex items-center justify-center">
                  <Wrench className="w-4 h-4 flex-shrink-0" id="roadside-assistance-icon" />
                </div>
                <div className="text-left">
                  <p className="text-[9px] uppercase font-sans font-bold text-[#D98F1F] tracking-wider">24/7 Support</p>
                  <p className="text-sm font-sans font-bold text-[#14171A] leading-tight">
                    Roadside Assistance
                  </p>
                </div>
              </div>
              <span className="font-sans text-xs font-bold text-[#D98F1F] bg-amber-100 border border-[#D98F1F]/20 p-1.5 px-3 rounded-lg shadow-xs group-hover:bg-[#D98F1F] group-hover:text-white transition-all">
                800 9000
              </span>
            </a>
          </div>

          {/* UAE Emergency Grid */}
          <div className="border-t border-[#DDDAD3]/50 pt-6" id="finder-emergency-block">
            <h3 className="text-[9px] uppercase tracking-widest text-[#7C8187] font-extrabold mb-4 font-mono" id="finder-emerg-title">
              UAE Public Response Numbers
            </h3>
            <div className="grid grid-cols-2 gap-3" id="finder-emerg-grid">
              {EMERGENCY_NUMBERS.map((emerg) => {
                const IconComp = emerg.icon;
                return (
                  <a
                    id={`emerg-link-${emerg.phone}`}
                    key={emerg.phone}
                    href={`tel:${emerg.phone}`}
                    className={`flex items-center space-x-3 p-3 border rounded-xl hover:bg-slate-50 border-[#DDDAD3] tracking-wide transition-all duration-200 active:scale-95 cursor-pointer ${emerg.color}`}
                  >
                    <IconComp className="w-4 h-4 flex-shrink-0" />
                    <div className="text-left">
                      <p className="text-[9px] font-sans font-bold opacity-80 uppercase leading-none">{emerg.name}</p>
                      <p className="text-xs font-sans font-extrabold leading-tight mt-1">{emerg.phone}</p>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        </div>

        {/* Small Elegant Footer */}
        <div className="bg-[#F7F6F3]/50 p-4 border-t border-[#DDDAD3]/50 text-center text-xs text-slate-500 font-sans" id="finder-footer">
          Secured by <strong className="text-[#14171A] font-extrabold">CallMe Tag</strong> System
        </div>
      </div>

      {/* Live Alarm Interactive Overlay */}
      {alarmStatus !== 'none' && (
        <div className="fixed inset-0 bg-[#14171A]/75 backdrop-blur-md z-50 flex items-center justify-center p-4" id="alarm-status-overlay">
          <div className="bg-white border border-[#DDDAD3] rounded-3xl w-full max-w-sm p-6 shadow-2xl flex flex-col items-center text-center space-y-6" id="alarm-status-modal">
            
            {alarmStatus === 'pending' ? (
              <>
                <div className="relative flex items-center justify-center">
                  <div className="absolute inset-0 w-16 h-16 bg-red-500/20 rounded-full animate-ping" />
                  <div className="relative p-4 bg-red-500 text-white rounded-2xl shadow-lg shadow-red-500/25">
                    <BellRing className="w-8 h-8 animate-bounce" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-lg font-display font-black tracking-tight text-[#14171A]">🚨 Alarm Triggered!</h3>
                  <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                    We are ringing the owner's phone with high-volume beeps and vibrations. Standby for their live reply...
                  </p>
                </div>

                <div className="w-full bg-[#F7F6F3] p-3.5 rounded-xl border border-[#DDDAD3]/60 flex items-center justify-center space-x-2.5">
                  <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[10px] uppercase font-mono font-extrabold tracking-wider text-rose-700">Awaiting response</span>
                </div>

                <button
                  id="cancel-alarm-btn"
                  onClick={cancelActiveAlarm}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-sans font-bold text-xs py-3 px-4 rounded-xl transition-all cursor-pointer"
                >
                  Cancel Alert
                </button>
              </>
            ) : (
              <>
                <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 shadow-sm animate-pulse">
                  <CheckCircle className="w-10 h-10" />
                </div>
                
                <div className="space-y-2 w-full">
                  <p className="text-[10px] uppercase tracking-widest font-mono font-extrabold text-emerald-600">LIVE REPLY RECEIVED</p>
                  <h3 className="text-lg font-display font-black tracking-tight text-[#14171A]">Message from Owner</h3>
                  
                  <div className="bg-emerald-50/70 border-2 border-emerald-500/25 p-5 rounded-2xl my-3">
                    <span className="text-lg font-display font-extrabold text-emerald-800 leading-snug">
                      "{alarmReply}"
                    </span>
                  </div>
                </div>

                <button
                  id="dismiss-reply-btn"
                  onClick={() => {
                    setAlarmStatus('none');
                    setActiveAlarmId(null);
                  }}
                  className="w-full bg-[#14171A] hover:bg-slate-800 text-white font-sans font-black text-xs py-3 px-4 rounded-xl shadow-md transition-all active:scale-[0.98] cursor-pointer"
                >
                  Got it, Thanks!
                </button>
              </>
            )}
            
          </div>
        </div>
      )}
    </div>
  );
}

