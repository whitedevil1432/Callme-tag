import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, addDoc, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { Phone, Shield, ShieldAlert, Activity, Flame, MessageCircle, AlertTriangle, CheckCircle, Clock, Wrench } from 'lucide-react';

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
  { name: 'Police', phone: '999', icon: Shield, color: 'bg-blue-50 text-blue-600 border-blue-100' },
  { name: 'Ambulance', phone: '998', icon: Activity, color: 'bg-red-50 text-red-600 border-red-100' },
  { name: 'Civil Defence', phone: '997', icon: Flame, color: 'bg-orange-50 text-orange-600 border-orange-100' },
  { name: 'Police (Non-Emergency)', phone: '901', icon: ShieldAlert, color: 'bg-slate-50 text-slate-600 border-slate-100' }
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
        // Assume Dubai/UAE phone
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
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6" id="finder-loading-container">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#0F6E56]" id="finder-loading-spinner" />
        <p className="mt-4 text-slate-500 font-sans text-sm font-medium animate-pulse" id="finder-loading-text">Loading secure vehicle portal...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center" id="finder-error-container">
        <div className="bg-white p-8 rounded-2xl shadow-sm max-w-sm border border-slate-100 flex flex-col items-center" id="finder-error-card">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" id="finder-error-icon" />
          <h2 className="text-xl font-sans font-semibold text-slate-800 tracking-tight" id="finder-error-title">Error Encountered</h2>
          <p className="mt-2 text-slate-500 font-sans text-sm" id="finder-error-msg">{error}</p>
        </div>
      </div>
    );
  }

  if (!isActive) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center" id="finder-inactive-container">
        <div className="bg-white p-8 rounded-2xl shadow-sm max-w-sm border border-slate-100 flex flex-col items-center" id="finder-inactive-card">
          <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-4" id="finder-inactive-icon" />
          <h2 className="text-xl font-sans font-semibold text-slate-850 tracking-tight" id="finder-inactive-title">Tag Not Active</h2>
          <p className="mt-3 text-slate-500 font-sans text-sm leading-relaxed" id="finder-inactive-msg">
            This vehicle CallMe Tag is not currently active. Contact options are temporarily disabled.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-8 px-4" id="finder-main-container">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col" id="finder-main-card">
        
        {/* Dubai Theme Header */}
        <div className="bg-gradient-to-r from-[#0F6E56] to-[#0b5c47] p-6 text-white text-center relative" id="finder-header">
          <p className="text-xs uppercase tracking-widest text-teal-100 font-sans font-bold" id="finder-sub">Dubai Vehicle Portal</p>
          <h1 className="text-2xl font-sans font-extrabold tracking-tight mt-1" id="finder-title">CallMe Tag</h1>
          
          {plateNumber ? (
            <div className="mt-5 inline-flex flex-col items-center bg-white text-slate-800 px-6 py-2 rounded-lg border-2 border-slate-900 shadow-sm" id="finder-plate">
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#0F6E56] border-b border-slate-100 w-full text-center pb-0.5">DUBAI دبي</span>
              <span className="text-2xl font-mono font-extrabold tracking-widest uppercase mt-0.5">{plateNumber}</span>
            </div>
          ) : (
            <div className="mt-4 text-sm text-teal-50 font-sans font-medium" id="finder-no-plate">
              Registered Vehicle owner
            </div>
          )}
        </div>

        {/* Action Form / Contact */}
        <div className="p-6 flex-1 flex flex-col" id="finder-body">
          {/* Quick instructions */}
          <p className="text-xs text-slate-500 leading-relaxed text-center mb-6 font-sans" id="finder-instructions">
            The owner will be contacted securely without showing their name or phone number. Select a reason below to open WhatsApp on your phone.
          </p>

          {/* Preset drop-down */}
          <div className="space-y-2 mb-6" id="finder-reasons-group">
            <label className="block text-xs uppercase tracking-wider text-slate-400 font-sans font-bold" htmlFor="reason-selector">
              Reason for Contact
            </label>
            <select
              id="reason-selector"
              value={selectedPresetIndex}
              onChange={(e) => setSelectedPresetIndex(Number(e.target.value))}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-sans text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F6E56] focus:border-transparent transition-all"
            >
              {PRESET_MESSAGES.map((msg, idx) => (
                <option key={idx} value={idx}>
                  {msg.label}
                </option>
              ))}
            </select>
          </div>

          {/* Contact Button */}
          <div className="mb-8" id="finder-whatsapp-block">
            {rateLimited ? (
              <div className="bg-rose-50 border border-rose-100 text-rose-700 p-4 rounded-xl text-center flex items-center justify-center space-x-2" id="finder-ratelimit-message">
                <Clock className="w-5 h-5 flex-shrink-0" />
                <span className="text-xs font-sans font-bold">Please wait before contacting again (Limit: 5 hourly scans reached)</span>
              </div>
            ) : (
              <button
                id="contact-whatsapp-btn"
                onClick={handleWhatsAppContact}
                disabled={initiatingCall}
                className="w-full bg-[#0F6E56] hover:bg-[#0b5c47] text-white py-4 px-4 rounded-xl font-sans font-semibold text-sm shadow-sm flex items-center justify-center space-x-2 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {initiatingCall ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    <span>Connecting securely...</span>
                  </>
                ) : success ? (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    <span>WhatsApp Opened!</span>
                  </>
                ) : (
                  <>
                    <MessageCircle className="w-5 h-5" />
                    <span>Continue to WhatsApp</span>
                  </>
                )}
              </button>
            )}
            <p className="text-[10px] text-slate-400 text-center mt-2 font-sans" id="finder-note">
              No personal data or phone number is displayed to any public scanners.
            </p>
          </div>

          {/* Emergency Family Contact Section (if configured) */}
          {(emergencyContactName || emergencyContactNumber) && (() => {
            const isNumericName = emergencyContactName && /^\+?[\d\s\-()]+$/.test(emergencyContactName) && emergencyContactName.replace(/[^\d]/g, '').length > 4;
            const safeEmergencyName = isNumericName ? 'Family/Emergency Contact' : (emergencyContactName || 'Emergency Contact');
            
            return (
              <div className="border-t border-slate-100 pt-6 mb-4" id="family-emergency-section">
                <h3 className="text-xs uppercase tracking-wider text-rose-500 font-sans font-extrabold mb-3 flex items-center space-x-1.5" id="family-emergency-title">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                  <span>Emergency Family Contact</span>
                </h3>
                <a
                  id="family-emergency-call-btn"
                  href={`tel:${emergencyContactNumber || ''}`}
                  className="flex items-center justify-between p-4 bg-rose-50 border border-rose-100 rounded-xl hover:bg-rose-100/60 transition-all duration-200 active:scale-95 group shadow-2xs"
                  title="Call Emergency Contact"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-rose-500 text-white rounded-lg group-hover:scale-105 transition-transform flex items-center justify-center">
                      <Phone className="w-5 h-5 flex-shrink-0" id="family-emergency-call-icon" />
                    </div>
                    <div className="text-left">
                      <p className="text-[9px] uppercase font-sans font-bold text-rose-600 tracking-wider">Tap to Call Directly</p>
                      <p className="text-sm font-sans font-bold text-slate-800 leading-tight">
                        {safeEmergencyName}
                      </p>
                    </div>
                  </div>
                  {emergencyContactNumber && (
                    <span className="font-sans text-xs font-bold text-rose-700 bg-white border border-rose-200/50 p-1.5 px-3 rounded-lg shadow-3xs group-hover:bg-rose-500 group-hover:text-white transition-all">
                      Tap to Call
                    </span>
                  )}
                </a>
              </div>
            );
          })()}

          {/* Roadside Assistance Section */}
          <div className="border-t border-slate-100 pt-6 mb-4" id="roadside-assistance-section">
            <h3 className="text-xs uppercase tracking-wider text-amber-600 font-sans font-extrabold mb-3 flex items-center space-x-1.5" id="roadside-assistance-title">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              <span>Roadside Assistance</span>
            </h3>
            <a
              id="roadside-assistance-call-btn"
              href="tel:8009000"
              className="flex items-center justify-between p-4 bg-amber-50 border border-amber-100 rounded-xl hover:bg-amber-100/60 transition-all duration-200 active:scale-95 group shadow-2xs"
              title="Call Roadside Assistance"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-amber-500 text-white rounded-lg group-hover:scale-105 transition-transform flex items-center justify-center">
                  <Wrench className="w-5 h-5 flex-shrink-0" id="roadside-assistance-icon" />
                </div>
                <div className="text-left">
                  <p className="text-[9px] uppercase font-sans font-bold text-amber-600 tracking-wider">24/7 Support</p>
                  <p className="text-sm font-sans font-bold text-slate-800 leading-tight">
                    Roadside Assistance
                  </p>
                </div>
              </div>
              <span className="font-sans text-xs font-bold text-amber-700 bg-white border border-amber-200/50 p-1.5 px-3 rounded-lg shadow-3xs group-hover:bg-amber-500 group-hover:text-white transition-all">
                800 9000
              </span>
            </a>
          </div>

          {/* UAE Emergency Grid */}
          <div className="border-t border-slate-100 pt-6" id="finder-emergency-block">
            <h3 className="text-xs uppercase tracking-wider text-slate-400 font-sans font-bold mb-4" id="finder-emerg-title">
              UAE Emergency Numbers
            </h3>
            <div className="grid grid-cols-2 gap-3" id="finder-emerg-grid">
              {EMERGENCY_NUMBERS.map((emerg) => {
                const IconComp = emerg.icon;
                return (
                  <a
                    id={`emerg-link-${emerg.phone}`}
                    key={emerg.phone}
                    href={`tel:${emerg.phone}`}
                    className={`flex items-center space-x-3 p-3 border rounded-xl hover:bg-white tracking-wide transition-all duration-200 active:scale-95 ${emerg.color}`}
                  >
                    <IconComp className="w-5 h-5 flex-shrink-0" />
                    <div className="text-left">
                      <p className="text-[10px] font-sans font-bold opacity-80 uppercase leading-none">{emerg.name}</p>
                      <p className="text-sm font-sans font-extrabold leading-tight">{emerg.phone}</p>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        </div>

        {/* Small Elegant Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-100 text-center text-xs text-slate-400 font-sans" id="finder-footer">
          Powered by <strong className="text-[#0F6E56] font-extrabold">CallMe Tag</strong> Secure QR System
        </div>
      </div>
    </div>
  );
}
