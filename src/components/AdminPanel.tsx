import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../lib/firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  Timestamp,
  onSnapshot
} from 'firebase/firestore';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { 
  LogIn, 
  LogOut, 
  Plus, 
  Edit2, 
  Search, 
  QrCode, 
  Download, 
  Users, 
  AlertTriangle, 
  Check, 
  Shield, 
  Trash2, 
  ListFilter, 
  Phone, 
  User, 
  Clock, 
  Info,
  RefreshCw,
  TrendingUp,
  ExternalLink,
  Mail,
  X,
  Camera,
  Upload,
  Printer,
  Bell,
  BellRing,
  Radio,
  Volume2,
  CheckCircle
} from 'lucide-react';
import { Tag, Reseller, UserSession, ScanLog } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    role?: string | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, activeSession?: UserSession | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: activeSession?.reseller_id || activeSession?.username || null,
      email: activeSession?.role === 'reseller' ? `${activeSession?.username}@agent.com` : 'super-admin',
      role: activeSession?.role || null,
    },
    operationType,
    path
  };
  console.error('[Firestore Error Details Trace]:', JSON.stringify(errInfo, null, 2));
  const errorMessage = `Firestore Database Error (${operationType} @ ${path}): ${error instanceof Error ? error.message : String(error)}`;
  window.dispatchEvent(new CustomEvent('app-error', { detail: { message: errorMessage } }));
}

/**
 * Validates any given phone number, checking for correct format and length.
 * Focuses on UAE formatting conventions as the default fallback but handles general international formats.
 */
export const validatePhoneNumber = (phone: string): { isValid: boolean; error?: string } => {
  const trimmed = phone.trim();
  if (!trimmed) {
    return {
      isValid: false,
      error: "Phone number is required."
    };
  }
  
  // 1. Basic allowed characters check
  const phoneCharRegex = /^\+?[\d\s\-()]+$/;
  if (!phoneCharRegex.test(trimmed)) {
    return {
      isValid: false,
      error: "Phone number contains invalid characters. Only digits, spaces, dashes (-), parentheses (), and a leading plus (+) are allowed."
    };
  }

  // 2. Extract digits only to check actual digit length
  const digits = trimmed.replace(/[^\d]/g, '');

  if (digits.length < 9) {
    return {
      isValid: false,
      error: `Phone number is too short (${digits.length} digits). It must contain at least 9 digits.`
    };
  }

  if (digits.length > 15) {
    return {
      isValid: false,
      error: `Phone number is too long (${digits.length} digits). A valid mobile number cannot exceed 15 digits.`
    };
  }

  // 3. Specific UAE standard mobile checks (e.g. starts with +971, 971, 05, or 5)
  const isUaePrefix = trimmed.startsWith('+971') || trimmed.startsWith('971') || trimmed.startsWith('05') || (trimmed.startsWith('5') && digits.length === 9);
  
  if (isUaePrefix) {
    if (trimmed.startsWith('05')) {
      if (digits.length !== 10) {
        return {
          isValid: false,
          error: "UAE local mobile numbers starting with '05' must be exactly 10 digits long (e.g., 050 222 3333)."
        };
      }
    } else if (trimmed.startsWith('5') && !trimmed.startsWith('971')) {
      if (digits.length !== 9) {
        return {
          isValid: false,
          error: "UAE mobile numbers starting with '5' must be exactly 9 digits long (e.g., 50 222 3333)."
        };
      }
    } else if (trimmed.startsWith('+971') || trimmed.startsWith('971')) {
      if (digits.length !== 12) {
        return {
          isValid: false,
          error: "UAE international format numbers with country code +971 must have exactly 12 digits (e.g., +971 50 222 3333)."
        };
      }
      const afterCountryCode = digits.substring(3);
      if (!afterCountryCode.startsWith('5')) {
        return {
          isValid: false,
          error: "A valid UAE mobile number after country code +971 must start with 5 (e.g., +971 50...)."
        };
      }
    }
  }

  return { isValid: true };
};

const TagMockupSvg = ({ size }: { size: number }) => {
  const matrix = [
    [1,1,1,0,1,1,1],
    [1,0,1,0,1,0,1],
    [1,1,1,0,1,1,1],
    [0,0,0,1,0,0,0],
    [1,1,1,0,1,0,1],
    [1,0,1,0,0,1,1],
    [1,1,1,0,1,1,0]
  ];
  const cell = 9;
  return (
    <svg viewBox="0 0 220 140" xmlns="http://www.w3.org/2000/svg" style={{ width: size, height: 'auto' }} className="select-none mx-auto">
      <defs>
        <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity={0.5}/>
          <stop offset="0.4" stopColor="#ffffff" stopOpacity={0}/>
        </linearGradient>
        <filter id="ds" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#14171A" floodOpacity={0.16}/>
        </filter>
      </defs>
      <rect x={4} y={4} width={212} height={132} rx={16} fill="#FBFAF8" stroke="#DDDAD3" strokeWidth="1.5" filter="url(#ds)"/>
      <line x1={110} y1={16} x2={110} y2={124} stroke="#DDDAD3" strokeWidth="1.5" strokeDasharray="4 5"/>
      <g transform="translate(31,26)">
        <g>
          {matrix.map((row, r) =>
            row.map((v, c) =>
              v ? (
                <rect
                  key={`${r}-${c}-on`}
                  x={c * cell}
                  y={r * cell}
                  width={cell - 0.6}
                  height={cell - 0.6}
                  rx={0.6}
                  fill="#14171A"
                />
              ) : null
            )
          )}
        </g>
        <text x="31.5" y="76" textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontWeight="600" fontSize="9.5" fill="#D98F1F" letterSpacing="1">ONLINE</text>
        <text x="31.5" y="89" textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize="6.5" fill="#7C8187" letterSpacing="0.5">call · whatsapp</text>
      </g>
      <g transform="translate(140,26)">
        <g>
          {matrix.map((row, r) =>
            row.map((v, c) =>
              v ? (
                <rect
                  key={`${r}-${c}-off`}
                  x={c * cell}
                  y={r * cell}
                  width={cell - 0.6}
                  height={cell - 0.6}
                  rx={0.6}
                  fill="#14171A"
                />
              ) : null
            )
          )}
        </g>
        <text x="31.5" y="76" textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontWeight="600" fontSize="9.5" fill="#7C8187" letterSpacing="1">OFFLINE</text>
        <text x="31.5" y="89" textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize="6.5" fill="#7C8187" letterSpacing="0.5">shows number</text>
      </g>
      <rect x={4} y={4} width={212} height={132} rx={16} fill="url(#sheen)"/>
    </svg>
  );
};

export default function AdminPanel() {
  // Homepage states for FAQ and animated toasts
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [visibleToasts, setVisibleToasts] = useState<number>(0);

  // Session handling
  const [session, setSession] = useState<UserSession | null>(() => {
    try {
      const saved = localStorage.getItem('callme_tag_session');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.warn("Failed to parse callme_tag_session from local storage:", e);
      return null;
    }
  });

  // Login credentials state
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Agent self-registration state
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [regUsername, setRegUsername] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regContact, setRegContact] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Application data lists
  const [tags, setTags] = useState<Tag[]>([]);
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [resellerTagsCount, setResellerTagsCount] = useState<Record<string, number>>({});
  const [scanLogs, setScanLogs] = useState<ScanLog[]>([]);

  // Page level navigation & feedback
  const [activeTab, setActiveTab] = useState<'tags' | 'resellers' | 'logs' | 'static_qr'>('tags');
  const [loadingData, setLoadingData] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all');

  // Standalone Static QR Generator states
  const [staticPrimaryPhone, setStaticPrimaryPhone] = useState('');
  const [staticEmergencyPhone, setStaticEmergencyPhone] = useState('');
  const [staticLabel, setStaticLabel] = useState('CallMe Tag - UAE');
  const [staticPlateNumber, setStaticPlateNumber] = useState('');
  const [staticQRType, setStaticQRType] = useState<'vcard' | 'tel'>('vcard');
  const [generatedStaticQRUrl, setGeneratedStaticQRUrl] = useState('');
  const [isGeneratingStatic, setIsGeneratingStatic] = useState(false);
  const [creatorFilter, setCreatorFilter] = useState<string>('all');

  // Tag Form state (Create/Edit)
  const [showTagModal, setShowTagModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [formFields, setFormFields] = useState({
    qr_id: '',
    owner_name: '',
    phone_number: '',
    plate_number: '',
    emergency_contact_name: '',
    emergency_contact_number: '',
    status: 'active' as 'active' | 'paused',
    created_by: ''
  });
  const [phoneChanged, setPhoneChanged] = useState(false);
  const [initialPhone, setInitialPhone] = useState('');
  const [isSavingTag, setIsSavingTag] = useState(false);
  const [tagError, setTagError] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToastMsg = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    // Keep it slightly longer so users can read comfortably
    setTimeout(() => {
      setToast(prev => prev?.message === message ? null : prev);
    }, 4500);
  };

  // Generated QR preview & download states
  const [currentQR1Url, setCurrentQR1Url] = useState<string>('');
  const [currentQR2Url, setCurrentQR2Url] = useState<string>('');
  const [showQROutputModal, setShowQROutputModal] = useState(false);
  const [lastGeneratedTag, setLastGeneratedTag] = useState<Tag | null>(null);

  // Reseller Form state (Create/Edit)
  const [showResellerModal, setShowResellerModal] = useState(false);
  const [resellerForm, setResellerForm] = useState({
    username: '',
    name: '',
    contact: '',
    password: ''
  });
  const [isSavingReseller, setIsSavingReseller] = useState(false);
  const [resellerError, setResellerError] = useState('');

  // Agent status modal / editing state for dropdown and reason inputs
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusModalAgentId, setStatusModalAgentId] = useState<string>('');
  const [statusModalSelected, setStatusModalSelected] = useState<'active' | 'pending' | 'details_required' | 'suspended' | 'other'>('pending');
  const [statusModalReason, setStatusModalReason] = useState<string>('');
  const [statusModalIsSaving, setStatusModalIsSaving] = useState(false);

  // Scan Logs Drawer State
  const [selectedTagForLogs, setSelectedTagForLogs] = useState<Tag | null>(null);
  const [tagLogs, setTagLogs] = useState<ScanLog[]>([]);
  const [loadingTagLogs, setLoadingTagLogs] = useState(false);

  // QR Scanner States & Refs
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  
  const scannerVideoRef = useRef<HTMLVideoElement | null>(null);
  const scannerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scannerStreamRef = useRef<MediaStream | null>(null);
  const scannerIntervalRef = useRef<any>(null);

  // --- Owner Live Monitor States & Logics ---
  const [pairedQrId, setPairedQrId] = useState<string | null>(() => localStorage.getItem('paired_qr_id'));
  const [showOwnerPairModal, setShowOwnerPairModal] = useState(false);
  const [ownerPlateInput, setOwnerPlateInput] = useState('');
  const [ownerPhoneInput, setOwnerPhoneInput] = useState('');
  const [ownerPairError, setOwnerPairError] = useState('');
  const [ownerPairSuccess, setOwnerPairSuccess] = useState('');
  const [isPairingLoading, setIsPairingLoading] = useState(false);
  const [ownerTagData, setOwnerTagData] = useState<Tag | null>(null);
  const [activeAlarms, setActiveAlarms] = useState<any[]>([]);
  const [customOwnerReplyText, setCustomOwnerReplyText] = useState('');

  // 1. Fetch paired tag details on load or when pairedQrId changes
  useEffect(() => {
    if (!pairedQrId) {
      setOwnerTagData(null);
      return;
    }
    const fetchTag = async () => {
      try {
        const tagRef = doc(db, 'tags', pairedQrId);
        const tagSnap = await getDoc(tagRef);
        if (tagSnap.exists()) {
          setOwnerTagData({ qr_id: tagSnap.id, ...tagSnap.data() } as Tag);
        }
      } catch (err) {
        console.error("Error fetching owner tag data:", err);
      }
    };
    fetchTag();
  }, [pairedQrId]);

  // 2. Real-time subscription to pending alarms for this paired tag
  useEffect(() => {
    if (!pairedQrId) {
      setActiveAlarms([]);
      stopLiveAlarmSound();
      return;
    }

    const alarmsRef = collection(db, 'alarms');
    const q = query(
      alarmsRef,
      where('qr_id', '==', pairedQrId),
      where('status', '==', 'pending')
    );

    const unsub = onSnapshot(q, (querySnapshot) => {
      const pendingAlarms: any[] = [];
      querySnapshot.forEach((docSnap) => {
        pendingAlarms.push({ id: docSnap.id, ...docSnap.data() });
      });

      setActiveAlarms(pendingAlarms);

      if (pendingAlarms.length > 0) {
        // Sound the live physical alarm and vibrate
        startLiveAlarmSound();
      } else {
        // Silence the alarm
        stopLiveAlarmSound();
      }
    });

    return () => {
      unsub();
      stopLiveAlarmSound();
    };
  }, [pairedQrId]);

  // 3. Audio Context refs & helpers
  const audioCtxRef = useRef<AudioContext | null>(null);
  const alarmIntervalRef = useRef<any>(null);

  const startLiveAlarmSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContextClass();
      }
      
      if (alarmIntervalRef.current) return; // already playing
      
      let isBeep = false;
      alarmIntervalRef.current = setInterval(() => {
        const ctx = audioCtxRef.current;
        if (!ctx) return;
        if (ctx.state === 'suspended') {
          ctx.resume();
        }
        
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(isBeep ? 980 : 720, ctx.currentTime);
        isBeep = !isBeep;
        
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }, 700);

      if ('vibrate' in navigator) {
        navigator.vibrate([400, 250, 400, 250, 400]);
      }
    } catch (e) {
      console.warn("Audio Context error:", e);
    }
  };

  const stopLiveAlarmSound = () => {
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }
  };

  const playOwnerChimeSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = audioCtxRef.current || new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
      
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch (e) {
      console.warn("Chime error:", e);
    }
  };

  // 4. Pair handler
  const handlePairOwnerTag = async () => {
    try {
      setOwnerPairError('');
      setOwnerPairSuccess('');
      setIsPairingLoading(true);

      if (!ownerPlateInput || !ownerPhoneInput) {
        setOwnerPairError("Please fill out both your Plate Number and Mobile Number.");
        setIsPairingLoading(false);
        return;
      }

      // Query firestore to find active tag matching this plate and phone
      const tagsRef = collection(db, 'tags');
      const q = query(
        tagsRef,
        where('plate_number', '==', ownerPlateInput.trim().toUpperCase()),
        where('phone_number', '==', ownerPhoneInput.trim())
      );

      const querySnap = await getDocs(q);
      if (querySnap.empty) {
        setOwnerPairError("No active CallMe Tag found matching this plate number and phone number combination. Please double check.");
        setIsPairingLoading(false);
        return;
      }

      // Find first active tag
      let foundTagId: string | null = null;
      querySnap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.status === 'active') {
          foundTagId = docSnap.id;
        }
      });

      if (!foundTagId) {
        setOwnerPairError("The found CallMe Tag is currently paused/inactive. Please contact your Agent reseller.");
        setIsPairingLoading(false);
        return;
      }

      // Successful pairing!
      localStorage.setItem('paired_qr_id', foundTagId);
      setPairedQrId(foundTagId);
      setOwnerPairSuccess("Vehicle paired successfully! Launching Live Shield Dashboard.");
      
      setTimeout(() => {
        setShowOwnerPairModal(false);
        setOwnerPlateInput('');
        setOwnerPhoneInput('');
        playOwnerChimeSound();
      }, 1500);

    } catch (err) {
      console.error("Error pairing owner tag:", err);
      setOwnerPairError("An error occurred during pairing. Please try again.");
    } finally {
      setIsPairingLoading(false);
    }
  };

  // 5. Send alarm reply handler
  const handleSendAlarmReply = async (alarmId: string, replyMessage: string) => {
    try {
      await updateDoc(doc(db, 'alarms', alarmId), {
        status: 'replied',
        reply: replyMessage,
        updated_at: Timestamp.now()
      });
      playOwnerChimeSound();
      setCustomOwnerReplyText('');
      showToastMsg(`Reply "${replyMessage}" sent successfully!`, 'success');
    } catch (err) {
      console.error("Error replying to alarm:", err);
      showToastMsg("Failed to send reply. Please try again.", 'error');
    }
  };

  // Quick stats summary
  const [stats, setStats] = useState({
    totalTags: 0,
    activeTags: 0,
    totalScans: 0
  });

  // Seed default super-admin if database initialized
  useEffect(() => {
    async function seedAdmin() {
      try {
        const adminDocRef = doc(db, 'admins', 'admin');
        const adminSnap = await getDoc(adminDocRef);
        
        // Force update the password or create default admin account with new password
        if (!adminSnap.exists() || adminSnap.data()?.password !== 'Ashik1432@') {
          await setDoc(adminDocRef, {
            password: 'Ashik1432@',
            is_admin: true
          }, { merge: true });
          console.log("Seeded/Updated administrator account password successfully");
        }
      } catch (err) {
        console.warn("Seeding status: Firestore is currently initializing or offline. Default login admin / Ashik1432@ is available.", err);
      }
    }
    seedAdmin();
  }, []);

  // Set up a global event listener for database/Firestore errors to display toast messages without blocking alerts
  useEffect(() => {
    const handleErrorEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ message: string }>;
      if (customEvent.detail?.message) {
        showToastMsg(customEvent.detail.message, 'error');
      }
    };
    window.addEventListener('app-error', handleErrorEvent);
    return () => window.removeEventListener('app-error', handleErrorEvent);
  }, []);

  // Animate toast messages sequentially for a beautiful visual effect
  useEffect(() => {
    if (!session) {
      setVisibleToasts(1);
      const timer = setInterval(() => {
        setVisibleToasts((prev) => (prev < 3 ? prev + 1 : 1));
      }, 3500);
      return () => clearInterval(timer);
    }
  }, [session]);

  // Fetch App data when session changed
  useEffect(() => {
    if (session) {
      fetchAppCoreData();
    }
  }, [session, activeTab]);

  // Handle Log Out
  const handleLogout = () => {
    localStorage.removeItem('callme_tag_session');
    setSession(null);
    setUsernameInput('');
    setPasswordInput('');
  };

  // Google Authentication Sign In
  const handleGoogleSignIn = async () => {
    setLoginError('');
    setLoginLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      // Enable account selection hint
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const email = user.email?.trim().toLowerCase() || '';

      if (!email) {
        throw new Error('This Google account does not contain a valid email address.');
      }

      // Check if super admin
      const superAdminEmails = ['ashikr583@gmail.com', 'artamil583@gmail.com'];
      const adminDocRef = doc(db, 'admins', email);
      const adminSnap = await getDoc(adminDocRef);

      if (superAdminEmails.includes(email) || (adminSnap.exists() && adminSnap.data()?.is_admin)) {
        const userSec: UserSession = {
          username: email,
          role: 'super_admin'
        };
        localStorage.setItem('callme_tag_session', JSON.stringify(userSec));
        setSession(userSec);
        
        // Ensure admin document is seeded in Firestore
        setDoc(doc(db, 'admins', email), {
          is_admin: true,
          email: email
        }, { merge: true }).catch(err => {
          console.warn("Could not sync admin credentials with Firestore:", err);
        });
        return;
      }

      // Check if reseller
      const resellerDocRef = doc(db, 'resellers', email);
      const resellerSnap = await getDoc(resellerDocRef);

      if (resellerSnap.exists()) {
        const resellerData = resellerSnap.data();
        const accountStatus = resellerData.status || 'active';

        const userSec: UserSession = {
          username: email,
          role: 'reseller',
          reseller_id: email,
          status: accountStatus
        };
        localStorage.setItem('callme_tag_session', JSON.stringify(userSec));
        setSession(userSec);
        return;
      }

      setLoginError('Your Google Account is not registered as an agent. Please switch to the "Register Agent" tab to register instantly with your Google Account.');
    } catch (err: any) {
      console.error("Google login failure:", err);
      // Friendly message on user closed popup
      if (err.code === 'auth/popup-closed-by-user') {
        setLoginError('Sign-in popup was closed before completing authentication.');
      } else {
        setLoginError(err.message || 'Network or configuration error during Google Sign-In.');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  // Google Authentication Agent Self-Registration
  const handleGoogleRegister = async () => {
    setRegError('');
    setRegSuccess('');
    setRegLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const email = user.email?.trim().toLowerCase() || '';
      const displayName = user.displayName || user.email?.split('@')[0] || 'Google Agent';

      if (!email) {
        throw new Error('This Google account does not contain a valid email address.');
      }

      // Check if email already registered in resellers
      const resellerRef = doc(db, 'resellers', email);
      const testSnap = await getDoc(resellerRef);
      if (testSnap.exists()) {
        setRegError('This Google Account is already registered. Please use the Sign In option.');
        return;
      }

      // Check if taken as administrator
      const adminRef = doc(db, 'admins', email);
      const testAdmin = await getDoc(adminRef);
      if (testAdmin.exists() || ['ashikr583@gmail.com', 'artamil583@gmail.com'].includes(email)) {
        setRegError('This Google Account is registered as an administrator. Please use the Sign In option.');
        return;
      }

      // Safe to write registration record - default status is pending
      await setDoc(resellerRef, {
        name: displayName,
        email: email,
        contact: 'Google Authenticated',
        status: 'pending',
        created_at: Timestamp.now()
      });

      // Notify administrator email
      try {
        await fetch('/api/send-registration-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            username: email,
            name: displayName,
            email: email,
            contact: 'Google Authenticated'
          })
        });
      } catch (mailFetchErr) {
        console.error("Failed to notify registration:", mailFetchErr);
      }

      setRegSuccess('Registration submitted successfully! Your account is now pending administrator approval.');
      
      // Auto fill the login form with the newly created account
      setTimeout(() => {
        setIsRegisterMode(false);
        setRegSuccess('');
      }, 3500);

    } catch (err: any) {
      console.error("Google registration failure:", err);
      if (err.code === 'auth/popup-closed-by-user') {
        setRegError('Registration popup was closed before completing authentication.');
      } else {
        setRegError(err.message || 'Network or configuration error during Google registration.');
      }
    } finally {
      setRegLoading(false);
    }
  };


  // Fetch core application tables/documents
  const fetchAppCoreData = async () => {
    if (!session) return;
    try {
      setLoadingData(true);
      
      // Load resellers (always loaded, used for lookups)
      const resellersSnap = await getDocs(collection(db, 'resellers'));
      const fetchedResellers: Reseller[] = [];
      resellersSnap.forEach(d => {
        fetchedResellers.push({
          reseller_id: d.id,
          ...d.data()
        } as Reseller);
      });
      setResellers(fetchedResellers);

      // Dynamically update logged-in reseller session status if approved/changed by admin
      if (session.role === 'reseller' && session.reseller_id) {
        const currentReseller = fetchedResellers.find(r => r.reseller_id === session.reseller_id);
        if (currentReseller) {
          const freshStatus = currentReseller.status || 'active';
          if (freshStatus !== session.status) {
            const updatedSession = { ...session, status: freshStatus };
            localStorage.setItem('callme_tag_session', JSON.stringify(updatedSession));
            setSession(updatedSession);
          }
        }
      }

      // Fetch tags
      let fetchedTags: Tag[] = [];
      const tagsRef = collection(db, 'tags');
      const tagsQuery = query(tagsRef, orderBy('created_at', 'desc'));
      const tagsSnap = await getDocs(tagsQuery);

      tagsSnap.forEach(d => {
        const data = d.data();
        fetchedTags.push({
          qr_id: d.id,
          ...data
        } as Tag);
      });

      // Filter tags by role
      if (session.role === 'reseller') {
        fetchedTags = fetchedTags.filter(t => t.created_by === session.reseller_id);
      }
      setTags(fetchedTags);

      // Compute stats
      const totalCount = fetchedTags.length;
      const activeCount = fetchedTags.filter(t => t.status === 'active').length;

      // Tag count per reseller map
      const tagCountMap: Record<string, number> = {};
      fetchedTags.forEach(t => {
        const creator = t.created_by || 'admin';
        tagCountMap[creator] = (tagCountMap[creator] || 0) + 1;
      });
      setResellerTagsCount(tagCountMap);

      // Fetch scan logs for analytics
      const logsSnap = await getDocs(collection(db, 'scan_logs'));
      const fetchedLogs: ScanLog[] = [];
      logsSnap.forEach(d => {
        fetchedLogs.push({
          id: d.id,
          ...d.data()
        } as ScanLog);
      });
      
      // Filter log counts relative to visible tags
      const visibleTagIds = new Set(fetchedTags.map(t => t.qr_id));
      const filteredLogs = fetchedLogs.filter(lnk => visibleTagIds.has(lnk.qr_id));
      setScanLogs(filteredLogs);

      setStats({
        totalTags: totalCount,
        activeTags: activeCount,
        totalScans: filteredLogs.length
      });

    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoadingData(false);
    }
  };

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (scannerIntervalRef.current) {
        clearInterval(scannerIntervalRef.current);
      }
      if (scannerStreamRef.current) {
        scannerStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const stopScanner = () => {
    if (scannerIntervalRef.current) {
      clearInterval(scannerIntervalRef.current);
      scannerIntervalRef.current = null;
    }
    if (scannerStreamRef.current) {
      scannerStreamRef.current.getTracks().forEach(track => track.stop());
      scannerStreamRef.current = null;
    }
  };

  const startScanner = async (deviceId?: string) => {
    setScannerError(null);
    try {
      stopScanner();

      // Request initial permission if we don't have devices yet
      const devices = await navigator.mediaDevices.enumerateDevices();
      let videoDevices = devices.filter(d => d.kind === 'videoinput');
      
      // If no labels, request stream first to prompt permission, then re-enumerate
      if (videoDevices.length === 0 || !videoDevices[0].label) {
        try {
          const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
          tempStream.getTracks().forEach(track => track.stop());
          const reDevices = await navigator.mediaDevices.enumerateDevices();
          videoDevices = reDevices.filter(d => d.kind === 'videoinput');
        } catch (e) {
          console.log("Stream request denied or failed", e);
        }
      }

      setCameraDevices(videoDevices);
      if (videoDevices.length > 0 && !deviceId && !selectedCameraId) {
        setSelectedCameraId(videoDevices[0].deviceId);
      }

      const activeDeviceId = deviceId || (videoDevices.length > 0 ? videoDevices[0].deviceId : undefined);

      const constraints: MediaStreamConstraints = {
        video: activeDeviceId ? { deviceId: { exact: activeDeviceId } } : { facingMode: 'environment' }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      scannerStreamRef.current = stream;

      if (scannerVideoRef.current) {
        scannerVideoRef.current.srcObject = stream;
        scannerVideoRef.current.setAttribute('playsinline', 'true');
        scannerVideoRef.current.play();
      }

      scannerIntervalRef.current = setInterval(scanFrame, 250);
    } catch (err: any) {
      console.error("Scanner error:", err);
      setScannerError(err.message || "Failed to access camera. Please make sure you have granted camera permissions.");
    }
  };

  const scanFrame = () => {
    const video = scannerVideoRef.current;
    const canvas = scannerCanvasRef.current;
    if (!video || !canvas) return;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });

      if (code) {
        handleScannedData(code.data);
      }
    }
  };

  const handleScannedData = (scannedText: string) => {
    if (!scannedText) return;
    console.log("Scanned QR Text:", scannedText);
    
    let matchedTag: Tag | null = null;

    // 1. Try to parse as URL and extract 'qr' parameter
    try {
      if (scannedText.startsWith('http://') || scannedText.startsWith('https://')) {
        const url = new URL(scannedText);
        const qrParam = url.searchParams.get('qr');
        if (qrParam) {
          matchedTag = tags.find(t => t.qr_id.toLowerCase() === qrParam.toLowerCase()) || null;
        }
      }
    } catch (e) {
      console.error("Error parsing URL parameter:", e);
    }

    // 2. Try by exact matching qr_id
    if (!matchedTag) {
      matchedTag = tags.find(t => t.qr_id.toLowerCase() === scannedText.toLowerCase()) || null;
    }

    // 3. Try to parse from a dynamic url sub-path or hash if exists
    if (!matchedTag) {
      const cleanedUrlText = scannedText.trim();
      const lastSlashIndex = cleanedUrlText.lastIndexOf('/');
      if (lastSlashIndex !== -1) {
        const endPart = cleanedUrlText.substring(lastSlashIndex + 1);
        matchedTag = tags.find(t => t.qr_id.toLowerCase() === endPart.toLowerCase()) || null;
      }
    }

    // 4. Try as tel URI or raw number
    if (!matchedTag) {
      const cleanedScanned = scannedText.replace(/[^0-9]/g, '');
      if (cleanedScanned.length >= 7) {
        matchedTag = tags.find(t => {
          const tagPhone = t.phone_number.replace(/[^0-9]/g, '');
          const emergencyPhone = (t.emergency_contact_number || '').replace(/[^0-9]/g, '');
          return tagPhone.endsWith(cleanedScanned) || 
                 cleanedScanned.endsWith(tagPhone) || 
                 emergencyPhone.endsWith(cleanedScanned) || 
                 cleanedScanned.endsWith(emergencyPhone);
        }) || null;
      }
    }

    if (matchedTag) {
      // Match found! Close scanner and edit tag
      stopScanner();
      setShowScannerModal(false);
      handleOpenEditTag(matchedTag);
    } else {
      // Stop scanner so we don't alert spam
      stopScanner();
      showToastMsg(`No matching registered vehicle tag was found for: "${scannedText}". Please verify that this QR code belongs to a registered tag.`, 'error');
      // Restart scanner
      startScanner(selectedCameraId);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code) {
          handleScannedData(code.data);
        } else {
          showToastMsg("Could not detect any QR code in the uploaded image. Make sure it's clear, well-lit, and fits fully.", 'error');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Handle open tag modal for creation
  const handleOpenCreateTag = () => {
    setModalMode('create');
    setPhoneChanged(false);
    setInitialPhone('');
    setTagError('');
    setFormFields({
      qr_id: '',
      owner_name: '',
      phone_number: '',
      plate_number: '',
      emergency_contact_name: '',
      emergency_contact_number: '',
      status: 'active',
      created_by: session?.role === 'reseller' ? session.reseller_id || '' : 'admin'
    });
    setShowTagModal(true);
  };

  // Handle open tag modal for editing
  const handleOpenEditTag = (tag: Tag) => {
    setModalMode('edit');
    setPhoneChanged(false);
    setInitialPhone(tag.phone_number);
    setTagError('');
    setFormFields({
      qr_id: tag.qr_id,
      owner_name: tag.owner_name,
      phone_number: tag.phone_number,
      plate_number: tag.plate_number || '',
      emergency_contact_name: tag.emergency_contact_name || '',
      emergency_contact_number: tag.emergency_contact_number || '',
      status: tag.status,
      created_by: tag.created_by
    });
    setShowTagModal(true);
  };

   // Save tag to database & trigger QR generation
  const handleSaveTag = async (e: React.FormEvent) => {
    e.preventDefault();
    setTagError('');

    // Prevent non-active resellers from submitting tag registrations
    if (session?.role === 'reseller' && session?.status !== 'active') {
      setTagError("Registration Restricted: Your agent account is currently not active or registered details require review. Action restricted.");
      return;
    }

    if (!formFields.owner_name || !formFields.phone_number || !formFields.emergency_contact_name || !formFields.emergency_contact_number) {
      setTagError("Owner name, Phone Number, and Emergency Contact Name & Phone are required");
      return;
    }

    const ownerPhoneCheck = validatePhoneNumber(formFields.phone_number);
    if (!ownerPhoneCheck.isValid) {
      setTagError(`Invalid Owner Phone Number: ${ownerPhoneCheck.error}`);
      return;
    }

    const emergPhoneCheck = validatePhoneNumber(formFields.emergency_contact_number);
    if (!emergPhoneCheck.isValid) {
      setTagError(`Invalid Emergency Contact Phone Number: ${emergPhoneCheck.error}`);
      return;
    }

    try {
      setIsSavingTag(true);
      let targetQrId = formFields.qr_id;

      let savedTagRecord: Tag;

      if (modalMode === 'create') {
        // Generate a random high-entropy human-readable tag identifier (6 letters/numbers)
        targetQrId = 'D' + Math.floor(100000 + Math.random() * 900000).toString();
        
        // Ensure redundancy check for unique physical ID
        const testSnap = await getDoc(doc(db, 'tags', targetQrId));
        if (testSnap.exists()) {
          // Retry secondary
          targetQrId = 'D' + Math.floor(100000 + Math.random() * 900000).toString();
        }

        const tagData = {
          owner_name: formFields.owner_name.trim(),
          phone_number: formFields.phone_number.trim(),
          plate_number: formFields.plate_number.trim() || null,
          emergency_contact_name: formFields.emergency_contact_name.trim() || null,
          emergency_contact_number: formFields.emergency_contact_number.trim() || null,
          status: formFields.status,
          created_by: session?.role === 'reseller' ? session.reseller_id || '' : 'admin',
          created_at: Timestamp.now(),
          updated_at: Timestamp.now()
        };

        await setDoc(doc(db, 'tags', targetQrId), tagData);
        
        savedTagRecord = {
          qr_id: targetQrId,
          ...tagData
        } as Tag;

      } else {
        // Edit Mode
        const updateData: any = {
          owner_name: formFields.owner_name.trim(),
          phone_number: formFields.phone_number.trim(),
          plate_number: formFields.plate_number.trim() || null,
          emergency_contact_name: formFields.emergency_contact_name.trim() || null,
          emergency_contact_number: formFields.emergency_contact_number.trim() || null,
          status: formFields.status,
          updated_at: Timestamp.now()
        };

        const tagDocRef = doc(db, 'tags', targetQrId);
        await updateDoc(tagDocRef, updateData);

        const currentSnap = await getDoc(tagDocRef);
        savedTagRecord = {
          qr_id: targetQrId,
          ...currentSnap.data()
        } as Tag;
      }

      setShowTagModal(false);
      
      // Auto-trigger generation and viewing output of high-res QR stickers
      await generateQRCodes(savedTagRecord);
      fetchAppCoreData();
      showToastMsg(`Tag registration for ${savedTagRecord.owner_name} successfully saved!`, 'success');

    } catch (err) {
      console.error("Error saving vehicle metadata:", err);
      setTagError(`Could not commit database transactions: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSavingTag(false);
    }
  };

  // QR Code creation generator (static QR1 tel direct vs dynamic QR2 link locator)
  const generateQRCodes = async (tag: Tag) => {
    try {
      setLastGeneratedTag(tag);
      
      // Format number to clean phone pattern for encoding tel: directly
      let phoneDirect = tag.phone_number.replace(/[^0-9+]/g, '');
      if (phoneDirect.startsWith('0')) {
        phoneDirect = '971' + phoneDirect.substring(1);
      } else if (!phoneDirect.startsWith('+') && !phoneDirect.startsWith('971')) {
        if (phoneDirect.length === 9 && phoneDirect.startsWith('5')) {
          phoneDirect = '971' + phoneDirect;
        }
      }
      
      // QR1 direct tel URL
      const qr1Str = `tel:${phoneDirect}`;
      
      // QR2 locator web locator
      const qr2Str = `${window.location.origin}/?qr=${tag.qr_id}`;

      // Configured sizes of 30x30mm 300dpi is approx 354px
      const options = {
        width: 354,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      };

      const qr1Data = await QRCode.toDataURL(qr1Str, options);
      const qr2Data = await QRCode.toDataURL(qr2Str, options);

      setCurrentQR1Url(qr1Data);
      setCurrentQR2Url(qr2Data);
      setShowQROutputModal(true);

    } catch (err) {
      console.error("Error rendering QR code stickers:", err);
    }
  };

  // Simple script triggering immediate PNG download
  const handleDownloadQR = (url: string, prefix: string) => {
    if (!lastGeneratedTag) return;
    const plateText = lastGeneratedTag.plate_number || 'NoPlate';
    const tagId = lastGeneratedTag.qr_id;
    const filename = `CallMeTag_${tagId}_${prefix}_${plateText}.png`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleGenerateStaticQR = async () => {
    if (!staticPrimaryPhone) {
      showToastMsg("Please specify at least the primary owner's phone number.", 'error');
      return;
    }
    
    setIsGeneratingStatic(true);
    try {
      let qrStr = '';
      if (staticQRType === 'tel') {
        let phoneDirect = staticPrimaryPhone.replace(/[^0-9+]/g, '');
        if (phoneDirect.startsWith('0')) {
          phoneDirect = '971' + phoneDirect.substring(1);
        } else if (!phoneDirect.startsWith('+') && !phoneDirect.startsWith('971')) {
          if (phoneDirect.length === 9 && phoneDirect.startsWith('5')) {
            phoneDirect = '971' + phoneDirect;
          }
        }
        qrStr = `tel:${phoneDirect}`;
      } else {
        // Build robust vCard
        let labelText = staticLabel.trim() || 'CallMe Tag Contact';
        if (staticPlateNumber.trim()) {
          labelText += ` (Plate ${staticPlateNumber.trim().toUpperCase()})`;
        }
        
        // Standard high-compatibility vCard v3.0 format
        qrStr = `BEGIN:VCARD\nVERSION:3.0\nFN:${labelText}\nTEL;TYPE=CELL:${staticPrimaryPhone}`;
        if (staticEmergencyPhone) {
          qrStr += `\nTEL;TYPE=WORK,CELL:${staticEmergencyPhone}`;
        }
        qrStr += `\nEND:VCARD`;
      }
      
      const options = {
        width: 354,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      };
      
      const qrData = await QRCode.toDataURL(qrStr, options);
      setGeneratedStaticQRUrl(qrData);
    } catch (err) {
      console.error("Error generating static QR:", err);
      showToastMsg("Could not generate static QR code. Please verify phone number formats.", 'error');
    } finally {
      setIsGeneratingStatic(false);
    }
  };

  const handleDownloadStaticQR = () => {
    if (!generatedStaticQRUrl) return;
    const labelText = staticPlateNumber.trim() || 'OfflineContact';
    const filename = `CallMeTag_StaticQR_${labelText}.png`;

    const a = document.createElement('a');
    a.href = generatedStaticQRUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Delete a tag
  const handleDeleteTag = async (qrId: string) => {
    try {
      await deleteDoc(doc(db, 'tags', qrId));
      fetchAppCoreData();
      showToastMsg("Tag registration deleted successfully.", "success");
    } catch (err) {
      showToastMsg("Error deleting tag registration.", "error");
    }
  };

  // Load and show detailed scan log list
  const handleViewLogs = async (tag: Tag) => {
    try {
      setSelectedTagForLogs(tag);
      setLoadingTagLogs(true);
      
      const logsRef = collection(db, 'scan_logs');
      const q = query(logsRef, where('qr_id', '==', tag.qr_id));
      const logsSnap = await getDocs(q);
      
      const fetchedLogs: ScanLog[] = [];
      logsSnap.forEach((d) => {
        fetchedLogs.push({
          id: d.id,
          ...d.data()
        } as ScanLog);
      });

      // Sort logs by date manually (or in Firestore if query is simple, manual sorting is index-free/safe)
      fetchedLogs.sort((a, b) => {
        const dateA = a.scanned_at?.toDate()?.getTime() || 0;
        const dateB = b.scanned_at?.toDate()?.getTime() || 0;
        return dateB - dateA;
      });

      setTagLogs(fetchedLogs);
    } catch (err) {
      console.error("Error retrieving historical logs:", err);
    } finally {
      setLoadingTagLogs(false);
    }
  };

  // Add / create reseller
  const handleCreateReseller = async (e: React.FormEvent) => {
    e.preventDefault();
    setResellerError('');
    const emailLower = resellerForm.username.trim().toLowerCase();
    
    if (!emailLower || !resellerForm.name || !resellerForm.contact) {
      setResellerError('Google Email, Partner Name, and Contact Phone are all required.');
      return;
    }

    // Verify legitimacy of Email address with robust regex pattern
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailLower)) {
      setResellerError('Please specify a legitimate Google email address (e.g. name@domain.com).');
      return;
    }

    const contactVal = validatePhoneNumber(resellerForm.contact);
    if (!contactVal.isValid) {
      setResellerError(`Invalid Contact Phone: ${contactVal.error}`);
      return;
    }

    try {
      setIsSavingReseller(true);

      // Check email isn't taken in resellers collection
      const resellerRef = doc(db, 'resellers', emailLower);
      const testSnap = await getDoc(resellerRef);
      if (testSnap.exists()) {
        setResellerError('This Google Email is already registered.');
        setIsSavingReseller(false);
        return;
      }

      // Check email isn't taken in admins collection
      const adminRef = doc(db, 'admins', emailLower);
      const testAdmin = await getDoc(adminRef);
      if (testAdmin.exists() || ['ashikr583@gmail.com', 'artamil583@gmail.com'].includes(emailLower)) {
        setResellerError('This Google Email is reserved as an administrator email.');
        setIsSavingReseller(false);
        return;
      }

      await setDoc(resellerRef, {
        name: resellerForm.name.trim(),
        contact: resellerForm.contact.trim(),
        email: emailLower,
        status: 'active', // Since administrator created them directly, approve instantly
        created_at: Timestamp.now()
      });

      setShowResellerModal(false);
      setResellerForm({ username: '', name: '', contact: '', password: '' });
      fetchAppCoreData();

    } catch (err) {
      console.error("Reseller addition failure:", err);
      setResellerError('Database connection error occurred.');
    } finally {
      setIsSavingReseller(false);
    }
  };

  // Delete/Remove reseller
  const handleDeleteReseller = async (resellerId: string) => {
    try {
      await deleteDoc(doc(db, 'resellers', resellerId));
      fetchAppCoreData();
      showToastMsg("Agent removed successfully.", "success");
    } catch (err) {
      showToastMsg("Failed to remove reseller registration.", "error");
    }
  };

  // Update reseller activation status with custom reason compatibility
  const handleUpdateResellerStatus = async (
    resellerId: string, 
    newStatus: 'active' | 'pending' | 'details_required' | 'suspended' | 'other',
    reason?: string
  ) => {
    // BACKEND VERIFICATION FLOW TRACING LOGS
    console.log(`%c[VERIFICATION FLOW TRACE - START]`, "color: #D98F1F; font-weight: bold; font-size: 13px;");
    console.log(`[VERIFICATION TRACE] Initiating agent activation status transition...`);
    console.log(`[VERIFICATION TRACE] --- Target Agent Username/ID: "${resellerId}"`);
    console.log(`[VERIFICATION TRACE] --- Transiting to new status: "${newStatus}"`);
    console.log(`[VERIFICATION TRACE] --- Included Reason/Rejection Text: "${reason || 'None provided'}"`);
    console.log(`[VERIFICATION TRACE] --- Initiated by logged in user: "${session?.username}" with role: "${session?.role}"`);

    // Requester authorization check
    if (session?.role !== 'super_admin') {
      const authErr = `Unauthorized status transition request by non-admin identity user "${session?.username}".`;
      console.error(`[VERIFICATION TRACE - ERROR] SECURITY POLICY BREACH:`, authErr);
      showToastMsg("Verification Failed: You must be signed in with a Super Admin identity block to approve or suspend field agent rosters.", "error");
      console.log(`%c[VERIFICATION FLOW TRACE - STOPPED]`, "color: #ef4444; font-weight: bold; font-size: 13px;");
      return;
    }

    try {
      const resellerRef = doc(db, 'resellers', resellerId);
      console.log(`[VERIFICATION TRACE] Formulating Firestore Reference: resellers/${resellerId}`);
      console.log(`[VERIFICATION TRACE] Committing write operation via setDoc merge to guarantee update...`);

      const updatePayload = {
        status: newStatus,
        status_reason: reason || ""
      };

      // We use setDoc merge to be fully resilient in case of missing state references
      await setDoc(resellerRef, updatePayload, { merge: true });

      console.log(`[VERIFICATION TRACE] Firestore commit successful! Status written exactly as: "${newStatus}" with reason: "${reason || ''}"`);

      // Update local state dynamically
      setResellers(prev => prev.map(r => r.reseller_id === resellerId ? { ...r, status: newStatus, status_reason: reason || "" } : r));
      console.log(`[VERIFICATION TRACE] React local state arrays synchronized with status: "${newStatus}"`);
      console.log(`%c[VERIFICATION FLOW TRACE - COMPLETED SUCCESS]`, "color: #10b981; font-weight: bold; font-size: 13px;");
    } catch (err) {
      console.error("[VERIFICATION TRACE - ERROR] Failed to mutate status in Firestore:", err);
      handleFirestoreError(err, OperationType.UPDATE, `resellers/${resellerId}`, session);
      console.log(`%c[VERIFICATION FLOW TRACE - COMPLETED WITH FAILURE]`, "color: #ef4444; font-weight: bold; font-size: 13px;");
    }
  };

  // Filter list computed
  const filteredTags = tags.filter(tag => {
    const matchesSearch = 
      tag.owner_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tag.qr_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tag.plate_number && tag.plate_number.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || tag.status === statusFilter;
    const matchesCreator = creatorFilter === 'all' || tag.created_by === creatorFilter;

    return matchesSearch && matchesStatus && matchesCreator;
  });

  // Render Car Owner Live Monitor if paired and no admin session is set
  if (!session && pairedQrId) {
    return (
      <div className="min-h-screen bg-[#F7F6F3] text-[#14171A] flex flex-col font-sans selection:bg-[#F2A93B]/30" id="owner-dashboard-screen">
        {/* Navigation Header */}
        <header className="sticky top-0 z-50 bg-[#F7F6F3]/92 backdrop-blur-md border-b border-[#DDDAD3] px-4 py-3">
          <div className="max-w-[840px] mx-auto flex items-center justify-between h-[52px]">
            <div className="flex items-center gap-2 font-black text-[0.98rem] text-[#14171A]">
              <div className="w-[9px] h-[9px] rounded-[3px] bg-[#F2A93B] rotate-45 flex-shrink-0" />
              <span>CallMe Tag</span>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                type="button"
                onClick={() => {
                  localStorage.removeItem('paired_qr_id');
                  setPairedQrId(null);
                  stopLiveAlarmSound();
                  showToastMsg("Vehicle tag disconnected successfully.", "info");
                }}
                className="bg-slate-200 hover:bg-rose-50 hover:text-rose-700 text-slate-700 px-[14px] py-[7px] rounded-full text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                Unlink Tag
              </button>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="flex-1 max-w-[840px] w-full mx-auto p-4 py-8 flex flex-col items-center justify-center space-y-6" id="owner-dashboard-body">
          {activeAlarms.length > 0 ? (
            /* ACTIVE ALARM BLOWN SCREEN */
            <div className="w-full max-w-md bg-white border-2 border-red-500 rounded-3xl p-6 md:p-8 shadow-[0_20px_50px_rgba(239,68,68,0.15)] flex flex-col items-center text-center space-y-6" id="owner-active-alarm-card">
              <div className="relative">
                <div className="absolute inset-0 bg-red-500/20 rounded-full animate-ping w-20 h-20 -m-2" />
                <div className="relative p-5 bg-red-500 text-white rounded-2xl shadow-xl shadow-red-500/30">
                  <BellRing className="w-10 h-10 animate-bounce" />
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-[10px] uppercase font-mono font-black text-red-600 tracking-widest animate-pulse">🚨 EMERGENCY ALERT</p>
                <h2 className="text-2xl font-display font-black tracking-tight text-[#14171A]">Vehicle Blocked Alert!</h2>
                {ownerTagData?.plate_number && (
                  <div className="inline-flex bg-[#14171A] text-white px-5 py-1.5 rounded-xl border border-[#DDDAD3] font-mono text-sm font-black tracking-widest mt-1">
                    {ownerTagData.plate_number}
                  </div>
                )}
              </div>

              {/* Message from Finder */}
              <div className="w-full bg-[#F7F6F3] p-5 rounded-2xl border border-[#DDDAD3]/80 space-y-2 text-left">
                <span className="text-[9px] uppercase font-mono font-bold text-slate-400">Scanner Message:</span>
                <p className="text-sm font-semibold text-[#14171A] italic">
                  "{activeAlarms[0].message}"
                </p>
              </div>

              {/* Quick Reply Actions */}
              <div className="w-full space-y-3">
                <p className="text-[10px] uppercase tracking-wider font-mono font-extrabold text-slate-500 text-left pl-1">
                  Tap to Respond Instantly:
                </p>
                
                <div className="grid grid-cols-1 gap-2.5">
                  <button
                    onClick={() => handleSendAlarmReply(activeAlarms[0].id, "I am coming right now!")}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-sans font-black text-xs py-3.5 px-4 rounded-xl shadow-xs transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center space-x-2"
                  >
                    <span>🟢 Coming right now!</span>
                  </button>

                  <button
                    onClick={() => handleSendAlarmReply(activeAlarms[0].id, "Give me 2 minutes, please.")}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white font-sans font-black text-xs py-3.5 px-4 rounded-xl shadow-xs transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center space-x-2"
                  >
                    <span>🟡 Coming in 2 minutes</span>
                  </button>

                  <button
                    onClick={() => handleSendAlarmReply(activeAlarms[0].id, "I will remove the car immediately.")}
                    className="w-full bg-[#14171A] hover:bg-slate-800 text-white font-sans font-black text-xs py-3.5 px-4 rounded-xl shadow-xs transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center space-x-2"
                  >
                    <span>🚗 I will move it immediately</span>
                  </button>
                </div>

                {/* Custom message input */}
                <div className="border-t border-[#DDDAD3] pt-4 mt-3 space-y-2">
                  <label className="block text-[10px] uppercase tracking-wider font-mono font-bold text-slate-400 text-left pl-1">
                    Or send custom message:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Type a quick reply..."
                      value={customOwnerReplyText}
                      onChange={(e) => setCustomOwnerReplyText(e.target.value)}
                      className="flex-1 px-3.5 py-2.5 bg-[#F7F6F3] border border-[#DDDAD3] rounded-xl font-sans text-xs text-[#14171A] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#D98F1F]"
                    />
                    <button
                      onClick={() => {
                        if (customOwnerReplyText.trim()) {
                          handleSendAlarmReply(activeAlarms[0].id, customOwnerReplyText.trim());
                        }
                      }}
                      className="bg-[#D98F1F] hover:bg-[#14171A] text-white px-4 py-2.5 rounded-xl font-bold text-xs transition-all active:scale-[0.97]"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* STANDBY RADAR SCREEN */
            <div className="w-full max-w-md bg-white border border-[#DDDAD3] rounded-3xl p-6 md:p-8 shadow-[0_15px_40px_rgba(20,23,26,0.06)] flex flex-col items-center text-center space-y-6" id="owner-standby-card">
              {/* Radar pulse effect */}
              <div className="relative flex items-center justify-center">
                <div className="absolute w-24 h-24 bg-emerald-500/10 rounded-full animate-ping" />
                <div className="absolute w-16 h-16 bg-emerald-500/15 rounded-full animate-ping [animation-delay:0.5s]" />
                <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 shadow-sm relative z-10">
                  <Radio className="w-8 h-8 animate-pulse" />
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] uppercase font-mono font-black text-emerald-600 tracking-widest flex items-center justify-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Active Shield Monitor</span>
                </p>
                <h2 className="text-xl font-display font-black tracking-tight text-[#14171A]">Your Car is Protected</h2>
                <p className="text-xs text-slate-500 leading-relaxed font-semibold px-2">
                  This device is paired with your CallMe Tag. If someone triggers the alarm, it will alert you in real-time.
                </p>
              </div>

              {/* Tag Metadata display */}
              <div className="w-full bg-[#F7F6F3] p-5 rounded-2xl border border-[#DDDAD3]/50 text-left space-y-3 font-sans">
                <p className="text-[10px] uppercase font-mono font-extrabold tracking-wider text-slate-400 border-b border-[#DDDAD3]/50 pb-2">Vehicle Details</p>
                
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="text-slate-400">Plate Number</span>
                  <span className="font-mono bg-[#14171A] text-white px-3 py-1 rounded-lg uppercase">{ownerTagData?.plate_number || 'N/A'}</span>
                </div>

                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="text-slate-400">Owner Name</span>
                  <span className="text-[#14171A]">{ownerTagData?.owner_name || 'Loading...'}</span>
                </div>

                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="text-slate-400">Mobile Number</span>
                  <span className="text-[#14171A]">{ownerTagData?.phone_number || 'Loading...'}</span>
                </div>
              </div>

              {/* Speaker Test and Instructions */}
              <div className="w-full space-y-3.5 pt-2">
                <div className="bg-amber-50/70 border border-amber-200/50 p-4 rounded-2xl text-left space-y-1.5">
                  <h4 className="text-xs font-bold text-amber-800 flex items-center space-x-1">
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Ringer Test</span>
                  </h4>
                  <p className="text-[10px] text-amber-700 leading-relaxed font-semibold">
                    Ensure your phone is not on Silent/Vibrate mode. Press below to test if your browser can sound alarms successfully.
                  </p>
                  <button
                    onClick={() => {
                      startLiveAlarmSound();
                      setTimeout(stopLiveAlarmSound, 2100);
                      showToastMsg("Sound test initiated: Playing rhythmic beeps for 2s.", "success");
                    }}
                    className="mt-1 bg-[#D98F1F] hover:bg-[#14171A] text-white px-3.5 py-2 rounded-lg font-bold text-[10px] transition-all cursor-pointer shadow-xs"
                  >
                    Test Alarm Chime (2s)
                  </button>
                </div>

                <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                  💡 **Pro Tip**: Tap **Add to Home Screen** from your browser options to keep this dashboard instantly accessible right from your phone's desktop!
                </p>
              </div>
            </div>
          )}
        </main>

        <footer className="bg-[#F7F6F3]/50 p-4 border-t border-[#DDDAD3]/50 text-center text-xs text-slate-500 font-sans">
          CallMe Tag Live Response Network · Dubai, UAE
        </footer>
      </div>
    );
  }

  // Render Login page if no session is set
  if (!session) {
    return (
      <div className="min-h-screen bg-[#F7F6F3] text-[#14171A] flex flex-col font-sans selection:bg-[#F2A93B]/30 selection:text-[#14171A]" id="admin-login-screen">
        
        {/* Navigation Header */}
        <header className="sticky top-0 z-50 bg-[#F7F6F3]/92 backdrop-blur-md border-b border-[#DDDAD3] px-4 md:px-8 py-3">
          <div className="max-w-[1100px] mx-auto flex items-center justify-between h-[58px] md:h-[68px]">
            <div className="flex items-center gap-2 font-black text-[0.98rem] text-[#14171A]">
              <div className="w-[9px] h-[9px] rounded-[3px] bg-[#F2A93B] rotate-45 flex-shrink-0" />
              <span>CallMe Tag</span>
            </div>
            <nav className="hidden md:flex items-center gap-[28px] text-[0.9rem] font-semibold text-[#7C8187]">
              <a href="#how" className="hover:text-[#14171A] transition-colors">How it works</a>
              <a href="#pricing" className="hover:text-[#14171A] transition-colors">Pricing</a>
              <a href="#faq" className="hover:text-[#14171A] transition-colors">FAQ</a>
            </nav>
            <div className="flex items-center gap-2">
              <button 
                type="button"
                onClick={() => {
                  setOwnerPairError('');
                  setOwnerPairSuccess('');
                  setShowOwnerPairModal(true);
                }}
                className="border border-[#DDDAD3] hover:border-[#14171A] text-[#14171A] px-[14px] py-[8px] md:px-[18px] md:py-[10px] rounded-full text-xs md:text-[0.88rem] font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Radio className="w-3.5 h-3.5 text-[#D98F1F]" />
                <span>Owner Monitor</span>
              </button>
              
              <button 
                type="button"
                onClick={() => {
                  setIsRegisterMode(false);
                  setLoginError('');
                  setRegError('');
                  setRegSuccess('');
                  setShowLoginModal(true);
                }}
                className="bg-[#14171A] text-[#F7F6F3] hover:bg-[#D98F1F] px-[16px] py-[8px] md:px-[22px] md:py-[10px] rounded-full text-xs md:text-[0.88rem] font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Login</span>
              </button>
            </div>
          </div>
        </header>

        {/* Core Layout - Full width website presentation */}
        <div className="flex-1 w-full bg-[#F7F6F3]" id="landing-full-layout">
          
          {/* Full Width website presentation */}
          <div className="flex-1 px-4 py-8 md:px-8 lg:px-12 text-left" id="marketing-scroll-pane">
            <div className="max-w-[840px] mx-auto space-y-16 pb-20">
              
              {/* HERO SECTION */}
              <section className="space-y-6 pt-4" id="hero">
                <div className="inline-flex items-center gap-1.5 text-[0.72rem] font-mono tracking-wider font-extrabold text-[#D98F1F] uppercase">
                  <span className="w-1.5 h-1.5 bg-[#F2A93B] rounded-full inline-block"></span>
                  Two tags · works with or without data
                </div>
                <h1 className="text-3xl md:text-5xl font-display font-black tracking-tight text-[#14171A] leading-tight max-w-[560px]">
                  Your number isn't on the windshield. <span className="text-[#D98F1F] underline decoration-[#F2A93B] decoration-3 underline-offset-3 inline-block">It's one tap away.</span>
                </h1>
                <p className="text-base text-[#454A50] leading-relaxed max-w-[520px] font-medium">
                  Scan tag one with data, and a quick page opens with Call and WhatsApp buttons — plus a ready-made message. No data? Tag two shows your number directly, no page needed, so they can still reach you.
                </p>
                
                <div className="flex flex-wrap gap-3 pt-3">
                  <a href="#pricing" className="bg-[#14171A] text-[#F7F6F3] px-5 py-3 rounded-full font-bold text-[0.9rem] flex items-center gap-2 hover:bg-[#D98F1F] transition-colors">
                    Get early access — AED 29/yr →
                  </a>
                  <button 
                    onClick={() => {
                      setOwnerPairError('');
                      setOwnerPairSuccess('');
                      setShowOwnerPairModal(true);
                    }}
                    className="border border-[#D98F1F] bg-amber-50/40 text-[#D98F1F] px-5 py-3 rounded-full font-bold text-[0.9rem] hover:bg-amber-50 transition-colors text-center flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Radio className="w-4 h-4 animate-pulse" />
                    <span>Live Shield Monitor</span>
                  </button>
                  <a href="#how" className="border border-[#DDDAD3] text-[#14171A] px-5 py-3 rounded-full font-bold text-[0.9rem] hover:border-[#14171A] transition-colors text-center">
                    See how it works
                  </a>
                </div>

                <div className="text-[0.76rem] font-mono text-[#7C8187] pt-2">
                  No app to install · Works without data · Built for UAE heat
                </div>

                <div className="pt-6">
                  <TagMockupSvg size={300} />
                </div>
              </section>

              {/* PROBLEM / SOUND FAMILIAR SECTION */}
              <section className="pt-4 border-t border-[#DDDAD3] space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                  
                  {/* Interactive mock toasts sequence */}
                  <div className="space-y-3">
                    <div className="text-[0.72rem] font-mono tracking-wider font-extrabold text-[#7C8187] uppercase inline-flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-[#7C8187] rounded-full inline-block"></span>
                      Sound familiar?
                    </div>
                    
                    <div className="space-y-2.5 max-w-[360px]" id="toastList">
                      <div className={`bg-white border border-[#DDDAD3] rounded-[14px] p-3.5 flex gap-3 items-start shadow-[0_1px_2px_rgba(20,23,26,0.04)] transition-all duration-500 ease-out ${
                        visibleToasts >= 1 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-20 translate-y-2 scale-98'
                      }`}>
                        <span className="text-xl">🚗</span>
                        <div className="text-left">
                          <strong className="block text-[0.78rem] text-[#7C8187] font-medium leading-none mb-1">Unknown · just now</strong>
                          <span className="text-[0.88rem] text-[#14171A] font-semibold leading-snug">You're blocking my exit — can you move?</span>
                        </div>
                      </div>

                      <div className={`bg-white border border-[#DDDAD3] rounded-[14px] p-3.5 flex gap-3 items-start shadow-[0_1px_2px_rgba(20,23,26,0.04)] transition-all duration-500 ease-out ${
                        visibleToasts >= 2 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-20 translate-y-2 scale-98'
                      }`}>
                        <span className="text-xl">🅿️</span>
                        <div className="text-left">
                          <strong className="block text-[0.78rem] text-[#7C8187] font-medium leading-none mb-1">Unknown · 2 min ago</strong>
                          <span className="text-[0.88rem] text-[#14171A] font-semibold leading-snug">Left a note on your wiper, please call when free</span>
                        </div>
                      </div>

                      <div className={`bg-white border border-[#DDDAD3] rounded-[14px] p-3.5 flex gap-3 items-start shadow-[0_1px_2px_rgba(20,23,26,0.04)] transition-all duration-500 ease-out ${
                        visibleToasts >= 3 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-20 translate-y-2 scale-98'
                      }`}>
                        <span className="text-xl">⚠️</span>
                        <div className="text-left">
                          <strong className="block text-[0.78rem] text-[#7C8187] font-medium leading-none mb-1">Unknown · 4 min ago</strong>
                          <span className="text-[0.88rem] text-[#14171A] font-semibold leading-snug">Small scratch on your bumper — sorry, here's my info</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Message Explanation */}
                  <div className="text-[1.15rem] md:text-xl font-display font-medium text-[#14171A] leading-relaxed">
                    Every one of these starts the same way — a stranger trying to find <span className="text-[#D98F1F] font-bold">a way to reach you</span>, with nothing but your plate to go on.
                  </div>

                </div>
              </section>

              {/* HOW IT WORKS SECTION */}
              <section className="bg-[#ECEAE5] rounded-3xl p-6 md:p-8 border border-[#DDDAD3] space-y-6" id="how">
                <div className="space-y-2">
                  <span className="text-[0.72rem] font-mono tracking-wider font-extrabold text-[#7C8187] uppercase inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-[#7C8187] rounded-full inline-block"></span>
                    How it works
                  </span>
                  <h2 className="text-xl md:text-3xl font-display font-black text-[#14171A]">Two tags. Two situations.</h2>
                  <p className="text-[0.92rem] text-[#7C8187] border-b border-dashed border-[#DDDAD3] pb-4">
                    Register your plate once, then stick the tag on your windshield — that part's the same either way.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Tag 1 Online */}
                  <div className="bg-white border border-[#DDDAD3] rounded-2xl p-5 space-y-3.5">
                    <span className="inline-flex items-center gap-1.5 text-[0.72rem] font-mono font-extrabold bg-[#F2A93B]/15 text-[#D98F1F] px-2.5 py-1 rounded-full tracking-wider">
                      ● TAG 1 — ONLINE
                    </span>
                    <h3 className="font-display font-bold text-base text-[#14171A]">When they have data</h3>
                    <ul className="space-y-2.5 text-xs text-[#3D4146]">
                      <li className="flex gap-2">
                        <span className="font-mono text-[#7C8187] font-semibold">01</span>
                        <span>They scan tag one with their phone camera.</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-mono text-[#7C8187] font-semibold">02</span>
                        <span>A simple page opens — Call and WhatsApp buttons, plus a message that's already written for them.</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-mono text-[#7C8187] font-semibold">03</span>
                        <span>Your number stays off the screen until they tap one of the buttons.</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-mono text-[#7C8187] font-semibold">04</span>
                        <span>Option to call registered family or emergency contacts with a single tap.</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-mono text-[#7C8187] font-semibold">05</span>
                        <span>Instant access to 24/7 Roadside Assistance support right on the portal.</span>
                      </li>
                    </ul>
                  </div>

                  {/* Tag 2 Offline */}
                  <div className="bg-white border border-[#DDDAD3] rounded-2xl p-5 space-y-3.5">
                    <span className="inline-flex items-center gap-1.5 text-[0.72rem] font-mono font-extrabold bg-[#ECEAE5] text-[#7C8187] px-2.5 py-1 rounded-full tracking-wider">
                      ● TAG 2 — OFFLINE
                    </span>
                    <h3 className="font-display font-bold text-base text-[#14171A]">When they don't</h3>
                    <ul className="space-y-2.5 text-xs text-[#3D4146]">
                      <li className="flex gap-2">
                        <span className="font-mono text-[#7C8187] font-semibold">01</span>
                        <span>They scan tag two — no internet connection needed.</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-mono text-[#7C8187] font-semibold">02</span>
                        <span>Your number shows up directly on their phone, no page in between.</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-mono text-[#7C8187] font-semibold">03</span>
                        <span>They call or message you straight from their dial pad.</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* BENEFITS SECTION */}
              <section className="space-y-8" id="benefits">
                <div className="space-y-2">
                  <span className="text-[0.72rem] font-mono tracking-wider font-extrabold text-[#7C8187] uppercase inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-[#7C8187] rounded-full inline-block"></span>
                    Why it works
                  </span>
                  <h2 className="text-xl md:text-3xl font-display font-black text-[#14171A]">Built for how parking actually goes in this city.</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  <div className="bg-[#ECEAE5] rounded-2xl p-5 space-y-2">
                    <div className="w-8 h-8 rounded-lg bg-[#14171A] text-[#F2A93B] flex items-center justify-center font-bold text-sm">●</div>
                    <h3 className="font-display font-bold text-sm text-[#14171A]">Off the glass, not off the call</h3>
                    <p className="text-xs text-[#7C8187] leading-relaxed">
                      Your number never appears on the sticker or the page. The moment they tap Call or WhatsApp, it's a normal call between you and them.
                    </p>
                  </div>

                  <div className="bg-[#ECEAE5] rounded-2xl p-5 space-y-2">
                    <div className="w-8 h-8 rounded-lg bg-[#14171A] text-[#F2A93B] flex items-center justify-center font-bold text-sm">▣</div>
                    <h3 className="font-display font-bold text-sm text-[#14171A]">Works without data</h3>
                    <p className="text-xs text-[#7C8187] leading-relaxed">
                      No signal, no problem. The second tag shows your number directly, so anyone can still reach you.
                    </p>
                  </div>

                  <div className="bg-[#ECEAE5] rounded-2xl p-5 space-y-2">
                    <div className="w-8 h-8 rounded-lg bg-[#14171A] text-[#F2A93B] flex items-center justify-center font-bold text-sm">☀</div>
                    <h3 className="font-display font-bold text-sm text-[#14171A]">Made for UAE sun</h3>
                    <p className="text-xs text-[#7C8187] leading-relaxed">
                      UV-cured laminate holds up to dashboard heat that fades ordinary stickers within a season.
                    </p>
                  </div>

                  <div className="bg-white border border-dashed border-[#DDDAD3] rounded-2xl p-5 space-y-2">
                    <span className="text-[0.66rem] font-mono tracking-wider font-extrabold text-[#D98F1F] block">COMING SOON</span>
                    <h3 className="font-display font-bold text-sm text-[#14171A]">Real call masking</h3>
                    <p className="text-xs text-[#7C8187] leading-relaxed">
                      We're building true number masking on top of this. Early users get it free when it launches.
                    </p>
                  </div>

                </div>
              </section>

              {/* PRICING SECTION */}
              <section className="bg-[#ECEAE5] rounded-3xl p-6 md:p-8 border border-[#DDDAD3] space-y-6" id="pricing">
                <div className="space-y-2">
                  <span className="text-[0.72rem] font-mono tracking-wider font-extrabold text-[#7C8187] uppercase inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-[#7C8187] rounded-full inline-block"></span>
                    Pricing
                  </span>
                  <h2 className="text-xl md:text-3xl font-display font-black text-[#14171A]">Early access, before call masking launches.</h2>
                </div>

                <div className="bg-white border border-[#DDDAD3] rounded-2xl p-6 md:p-8 flex flex-col md:flex-row gap-6 items-start md:items-center">
                  <div className="flex-1 space-y-4">
                    <span className="inline-block bg-[#F2A93B] text-[#14171A] text-[0.72rem] font-black tracking-wider px-2.5 py-1 rounded-full uppercase">
                      EARLY ACCESS
                    </span>
                    
                    <div className="flex items-baseline gap-2.5 flex-wrap">
                      <div className="text-3xl md:text-4xl font-display font-black text-[#14171A]">
                        AED 29<span className="text-xs font-semibold text-[#7C8187] ml-1">/ year</span>
                      </div>
                      <div className="text-sm text-[#7C8187] line-through">AED 49</div>
                    </div>

                    <ul className="space-y-2 text-xs text-[#3D4146]">
                      <li className="flex gap-2">
                        <span className="text-[#D98F1F] font-bold">✓</span>
                        <span>Both tags — online + offline, heat &amp; UV rated</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-[#D98F1F] font-bold">✓</span>
                        <span>One plate registration, swap anytime</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-[#D98F1F] font-bold">✓</span>
                        <span>Unlimited scans and messages</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-[#D98F1F] font-bold">✓</span>
                        <span>Free call-masking upgrade when it launches</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-[#D98F1F] font-bold">✓</span>
                        <span>This price locked for your first year</span>
                      </li>
                    </ul>

                    <div className="pt-2">
                      <a href="#landing-split-layout" className="bg-[#14171A] text-[#F7F6F3] inline-block px-5 py-3 rounded-full font-bold text-sm hover:bg-[#D98F1F] transition-colors">
                        Get early access →
                      </a>
                    </div>
                  </div>

                  <div className="w-full md:w-auto flex-shrink-0 mx-auto">
                    <TagMockupSvg size={140} />
                  </div>
                </div>
              </section>

              {/* FAQ SECTION */}
              <section className="space-y-6" id="faq">
                <div className="space-y-2">
                  <span className="text-[0.72rem] font-mono tracking-wider font-extrabold text-[#7C8187] uppercase inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-[#7C8187] rounded-full inline-block"></span>
                    Good to know
                  </span>
                  <h2 className="text-xl md:text-3xl font-display font-black text-[#14171A]">A few common questions</h2>
                </div>

                <div className="border-t border-[#DDDAD3] divide-y divide-[#DDDAD3]" id="faqList">
                  
                  {[
                    {
                      q: "Can someone see my number from the tag?",
                      a: "Not from tag one — your number stays off that page until they tap Call or WhatsApp. Tag two is built to work with zero data, so it does show your number directly the moment it's scanned."
                    },
                    {
                      q: "Why does tag two show my number directly?",
                      a: "It's built to work with no internet connection at all, so the QR encodes your number directly rather than linking to a page. That's the trade-off for working offline."
                    },
                    {
                      q: "What happens if I sell my car?",
                      a: "Unlink the plate from your account and both tags stop forwarding immediately — the old owner's tag, the new owner's silence."
                    },
                    {
                      q: "Does the person scanning need an app?",
                      a: "No. Either tag opens or resolves with a normal phone camera. No download on their end, either way."
                    }
                  ].map((faq, idx) => {
                    const isOpen = openFaq === idx;
                    return (
                      <div key={idx} className="py-1">
                        <button 
                          onClick={() => setOpenFaq(isOpen ? null : idx)}
                          className="w-full text-left py-4 flex justify-between items-center gap-4 font-display font-bold text-[0.94rem] text-[#14171A] hover:text-[#D98F1F] transition-colors"
                        >
                          <span>{faq.q}</span>
                          <span className="text-[#7C8187] text-base font-bold select-none">{isOpen ? '−' : '+'}</span>
                        </button>
                        <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-40 pb-4' : 'max-h-0'}`}>
                          <p className="text-xs text-[#7C8187] leading-relaxed pr-6 font-medium">
                            {faq.a}
                          </p>
                        </div>
                      </div>
                    );
                  })}

                </div>
              </section>

              {/* FINAL CTA BAND */}
              <section className="bg-[#21242A] text-[#F7F6F3] rounded-[22px] p-6 md:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6" id="final-cta">
                <div className="space-y-2">
                  <h2 className="text-xl md:text-2xl font-display font-bold text-white">Stop leaving your number on windshields.</h2>
                  <p className="text-sm text-[#A7ABB1] font-semibold">Two tags, AED 29 for your first year — works with or without data.</p>
                </div>
                <a href="#landing-split-layout" className="bg-[#F2A93B] text-[#14171A] hover:bg-white text-center whitespace-nowrap px-6 py-3 rounded-full font-bold text-[0.9rem] transition-colors">
                  Get early access →
                </a>
              </section>

              {/* FOOTER */}
              <footer className="pt-8 border-t border-[#DDDAD3] flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2 font-black text-xs text-[#14171A]">
                  <div className="w-[8px] h-[8px] rounded-[2.5px] bg-[#F2A93B] rotate-45 flex-shrink-0" />
                  <span>CallMe Tag</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.78rem] font-mono text-[#7C8187] font-semibold">
                  <button 
                    type="button" 
                    onClick={() => {
                      setIsRegisterMode(false);
                      setLoginError('');
                      setRegError('');
                      setRegSuccess('');
                      setShowLoginModal(true);
                    }}
                    className="hover:text-[#14171A] underline transition-all cursor-pointer"
                  >
                    Login
                  </button>
                  <span className="hidden sm:inline">·</span>
                  <span>Made for UAE roads · © 2026 CallMe Tag</span>
                </div>
              </footer>

            </div>
          </div>
        </div>

        {/* Google Sign In & Register Overlay Modal */}
        {showLoginModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn" id="login-modal-overlay">
            {/* Click backdrop to close */}
            <div className="absolute inset-0 cursor-pointer" onClick={() => setShowLoginModal(false)} />
            
            {/* Modal Box */}
            <div className="relative w-full max-w-[400px] bg-[#F7F6F3] border border-[#DDDAD3] rounded-3xl p-6 md:p-8 shadow-[0_20px_50px_rgba(20,23,26,0.15)] animate-zoomIn flex flex-col z-10" id="admin-login-card">
              
              {/* Close Button */}
              <button 
                type="button"
                onClick={() => setShowLoginModal(false)}
                className="absolute top-4 right-4 text-slate-500 hover:text-[#14171A] p-1.5 bg-slate-200/50 hover:bg-slate-200/80 rounded-full transition-all cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="text-center mb-6" id="login-header">
                <div className="bg-[#D98F1F]/10 text-[#D98F1F] inline-flex p-3.5 rounded-2xl mb-3 border border-[#D98F1F]/20 shadow-xs">
                  <QrCode className="w-7 h-7" />
                </div>
                <h1 className="text-xl font-display font-black text-[#14171A] tracking-tight">Login</h1>
                <p className="text-[11px] text-[#7C8187] mt-1 font-semibold uppercase tracking-wider">
                  {isRegisterMode ? 'Authorized Field Partner Registration' : 'Secure Field Agent Registry Admin'}
                </p>
              </div>

              {/* Tab Slider Selector */}
              <div className="flex bg-[#DDDAD3]/30 p-1 rounded-xl mb-6 border border-[#DDDAD3]/40" id="login-tabs">
                <button
                  id="tab-login-btn"
                  type="button"
                  onClick={() => {
                    setIsRegisterMode(false);
                    setLoginError('');
                    setRegError('');
                    setRegSuccess('');
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    !isRegisterMode
                      ? 'bg-[#14171A] text-[#F7F6F3] font-black shadow-xs'
                      : 'text-slate-600 hover:text-[#14171A]'
                  }`}
                >
                  Sign In
                </button>
                <button
                  id="tab-register-btn"
                  type="button"
                  onClick={() => {
                    setIsRegisterMode(true);
                    setLoginError('');
                    setRegError('');
                    setRegSuccess('');
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    isRegisterMode
                      ? 'bg-[#14171A] text-[#F7F6F3] font-black shadow-xs'
                      : 'text-slate-600 hover:text-[#14171A]'
                  }`}
                >
                  Register Agent
                </button>
              </div>

              {!isRegisterMode ? (
                /* Google Log In Card */
                <div className="space-y-4" id="login-form">
                  <p className="text-xs text-slate-500 font-semibold text-center leading-relaxed mb-4">
                    Log in securely with your Google Account. Only registered partner emails are allowed access.
                  </p>

                  {loginError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-700 text-[11px] rounded-xl font-medium flex items-center space-x-2 animate-shake" id="login-error-toast">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{loginError}</span>
                    </div>
                  )}

                  <button
                    id="submit-google-login-btn"
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={loginLoading}
                    className="w-full bg-[#14171A] hover:bg-[#D98F1F] disabled:bg-slate-400 text-[#F7F6F3] py-3 px-4 rounded-xl font-display font-black text-xs shadow-[0_4px_15px_rgba(20,23,26,0.1)] flex items-center justify-center space-x-2 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                  >
                    {loginLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-[#F7F6F3] border-t-transparent" />
                        <span>Connecting Google...</span>
                      </>
                    ) : (
                      <>
                        <LogIn className="w-4 h-4" />
                        <span>Sign In with Google Account</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                /* Google Register Card */
                <div className="space-y-4" id="register-form">
                  <p className="text-xs text-slate-500 font-semibold text-center leading-relaxed mb-4">
                    Instant single-click registration as a field agent using your Google Account. No external mail ID or phone number required.
                  </p>

                  {regError && (
                    <div className="p-2.5 bg-red-500/10 border border-red-500/20 text-red-700 text-[11px] rounded-xl font-medium flex items-center space-x-2" id="reg-error-toast">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{regError}</span>
                    </div>
                  )}

                  {regSuccess && (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] rounded-xl font-medium flex items-center space-x-2" id="reg-success-toast">
                      <Check className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{regSuccess}</span>
                    </div>
                  )}

                  <button
                    id="submit-google-register-btn"
                    type="button"
                    onClick={handleGoogleRegister}
                    disabled={regLoading}
                    className="w-full bg-[#14171A] hover:bg-[#D98F1F] disabled:bg-slate-400 text-[#F7F6F3] py-3 px-4 rounded-xl font-display font-black text-xs shadow-[0_4px_15px_rgba(20,23,26,0.1)] flex items-center justify-center space-x-2 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                  >
                    {regLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-[#F7F6F3] border-t-transparent" />
                        <span>Authorizing Google...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>Register Agent with Google</span>
                      </>
                    )}
                  </button>

                  <div className="text-[10px] text-slate-400 text-center font-medium">
                    Note: Default account state is pending administrator activation.
                  </div>
                </div>
              )}

              <div className="mt-5 text-center text-[9px] text-[#7C8187] leading-relaxed font-semibold border-t border-[#DDDAD3]/50 pt-3.5" id="login-footer">
                UAE QR Contact Management System • Version 1.5 <br />
                {isRegisterMode ? 'Already have credentials? Switch to the Sign In tab.' : 'Need credentials or help? Contact your Supervisor.'}
              </div>
            </div>
          </div>
        )}

        {/* Floating Toast Notification */}
        {toast && (
          <div className="fixed bottom-5 right-5 z-[9999] max-w-sm bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-800/80 p-4 flex items-start space-x-3 animate-in fade-in slide-in-from-bottom-5 duration-300" id="global-toast-msg">
            {toast.type === 'success' && (
              <span className="p-1 bg-emerald-500/10 text-emerald-400 rounded-lg">
                <Check className="w-4 h-4" />
              </span>
            )}
            {toast.type === 'error' && (
              <span className="p-1 bg-rose-500/10 text-rose-400 rounded-lg">
                <X className="w-4 h-4" />
              </span>
            )}
            {toast.type === 'info' && (
              <span className="p-1 bg-[#D98F1F]/10 text-[#D98F1F] rounded-lg">
                <Info className="w-4 h-4" />
              </span>
            )}
            <div className="flex-1 text-xs font-semibold leading-relaxed">
              {toast.message}
            </div>
            <button 
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-white p-0.5 rounded transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Owner Tag Pairing Modal */}
        {showOwnerPairModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn" id="owner-pair-modal-overlay">
            <div className="relative w-full max-w-[400px] bg-[#F7F6F3] border border-[#DDDAD3] rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col z-10" id="owner-pair-modal">
              
              {/* Close button */}
              <button
                id="close-owner-pair-modal-btn"
                onClick={() => setShowOwnerPairModal(false)}
                className="absolute top-4 right-4 p-2 text-[#7C8187] hover:text-[#14171A] hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="text-center mb-6" id="owner-pair-header">
                <div className="mx-auto w-12 h-12 bg-amber-500/10 text-[#D98F1F] rounded-2xl flex items-center justify-center border border-amber-500/20 mb-3 shadow-xs">
                  <Radio className="w-6 h-6 animate-pulse" />
                </div>
                <h3 className="text-lg font-display font-black text-[#14171A] tracking-tight">Pair Your CallMe Tag</h3>
                <p className="text-xs text-slate-500 font-semibold mt-1">
                  Link this browser/home-screen applet to your active windshield tag to receive live alarms.
                </p>
              </div>

              <div className="space-y-4" id="owner-pair-form">
                {ownerPairError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-700 text-[11px] rounded-xl font-semibold flex items-center space-x-2" id="owner-pair-error">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>{ownerPairError}</span>
                  </div>
                )}

                {ownerPairSuccess && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-[11px] rounded-xl font-semibold flex items-center space-x-2" id="owner-pair-success">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{ownerPairSuccess}</span>
                  </div>
                )}

                <div className="space-y-1" id="pair-plate-group">
                  <label className="block text-[10px] font-extrabold uppercase text-slate-400 tracking-wider" htmlFor="pair-plate-input">
                    UAE Plate Number
                  </label>
                  <input
                    id="pair-plate-input"
                    type="text"
                    placeholder="e.g. C54125 or DXB 4125"
                    value={ownerPlateInput}
                    onChange={(e) => setOwnerPlateInput(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-[#DDDAD3] rounded-xl font-mono text-sm text-[#14171A] uppercase font-black focus:ring-2 focus:ring-[#D98F1F] focus:border-transparent outline-none transition-all"
                  />
                </div>

                <div className="space-y-1" id="pair-phone-group">
                  <label className="block text-[10px] font-extrabold uppercase text-slate-400 tracking-wider" htmlFor="pair-phone-input">
                    Registered Mobile Number
                  </label>
                  <input
                    id="pair-phone-input"
                    type="text"
                    placeholder="e.g. +971501234567"
                    value={ownerPhoneInput}
                    onChange={(e) => setOwnerPhoneInput(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-[#DDDAD3] rounded-xl font-sans text-sm text-[#14171A] font-semibold focus:ring-2 focus:ring-[#D98F1F] focus:border-transparent outline-none transition-all"
                  />
                  <p className="text-[9px] text-slate-400 font-semibold italic">Must match the owner phone configured on registration.</p>
                </div>

                <button
                  id="submit-owner-pair-btn"
                  onClick={handlePairOwnerTag}
                  disabled={isPairingLoading}
                  className="w-full bg-[#14171A] hover:bg-[#D98F1F] text-white py-3.5 rounded-xl font-sans font-black text-xs shadow-md transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer flex items-center justify-center space-x-2 mt-2"
                >
                  {isPairingLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                      <span>Verifying Secure Tag pairing...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Verify & Pair Tag</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F6F3] font-sans flex flex-col md:flex-row" id="admin-main-screen">
      
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-[#14171A] text-[#F7F6F3] flex flex-col justify-between shadow-xl border-r border-[#DDDAD3]/20" id="admin-sidebar">
        <div id="sidebar-top">
          {/* Brand header */}
          <div className="p-6 border-b border-white/10 flex items-center space-x-3" id="sidebar-brand">
            <QrCode className="w-6.5 h-6.5 text-[#D98F1F]" />
            <div>
              <h1 className="text-lg font-black tracking-tight leading-none text-white">CallMe Tag</h1>
              <p className="text-[10px] text-[#7C8187] font-bold tracking-wider mt-1 uppercase">Workspace Admin</p>
            </div>
          </div>

          {/* User profile capsule info */}
          <div className="p-4 bg-white/5 m-3 rounded-xl border border-white/5 flex items-center space-x-3" id="sidebar-user">
            <div className="bg-white/10 p-2 rounded-lg text-[#D98F1F] flex-shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div className="overflow-hidden">
              <p className="text-xs text-slate-400 uppercase font-black tracking-wider leading-none">
                {session.role === 'super_admin' ? 'Super Admin' : 'Agent'}
              </p>
              <h3 className="text-sm font-semibold text-white mt-1 truncate">{session.username}</h3>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="p-3 space-y-1.5" id="sidebar-links">
            <button
              id="sidebar-tags-tab"
              onClick={() => setActiveTab('tags')}
              className={`w-full flex items-center space-x-3.5 px-4 py-3 rounded-xl text-xs font-bold tracking-wider uppercase transition-all ${
                activeTab === 'tags' 
                  ? 'bg-white/10 text-white font-black border-l-4 border-[#D98F1F] rounded-l-none' 
                  : 'hover:bg-white/5 text-slate-300 hover:text-white'
              }`}
            >
              <QrCode className="w-4.5 h-4.5" />
              <span>STicker Registry</span>
            </button>

            {session.role === 'super_admin' && (
              <button
                id="sidebar-resellers-tab"
                onClick={() => setActiveTab('resellers')}
                className={`w-full flex items-center space-x-3.5 px-4 py-3 rounded-xl text-xs font-bold tracking-wider uppercase transition-all ${
                  activeTab === 'resellers' 
                    ? 'bg-white/10 text-white font-black border-l-4 border-[#D98F1F] rounded-l-none' 
                    : 'hover:bg-white/5 text-slate-300 hover:text-white'
                }`}
              >
                <Users className="w-4.5 h-4.5" />
                <span>Field Resellers</span>
              </button>
            )}

            <button
              id="sidebar-static-qr-tab"
              onClick={() => setActiveTab('static_qr')}
              className={`w-full flex items-center space-x-3.5 px-4 py-3 rounded-xl text-xs font-bold tracking-wider uppercase transition-all ${
                activeTab === 'static_qr' 
                  ? 'bg-white/10 text-white font-black border-l-4 border-[#D98F1F] rounded-l-none' 
                  : 'hover:bg-white/5 text-slate-300 hover:text-white'
              }`}
            >
              <Printer className="w-4.5 h-4.5" />
              <span>On-Site Static QR</span>
            </button>
          </nav>
        </div>

        {/* Sidebar Log out footer */}
        <div className="p-4 border-t border-white/10 bg-black/20" id="sidebar-bottom">
          <button
            id="logout-btn"
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 px-3 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-[#D98F1F] border border-white/10 transition-all text-xs font-bold tracking-wider uppercase rounded-lg"
          >
            <LogOut className="w-4 h-4" />
            <span>Workspace Log Out</span>
          </button>
        </div>
      </aside>

      {/* Main Panel Frame */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto" id="admin-main-frame">
         {/* Dynamic Verification Alert Banner Block */}
         {session?.role === 'reseller' && session?.status !== 'active' && (() => {
           const rStatus = session?.status || 'pending';
           const loggedInResellerInfo = resellers.find(r => r.reseller_id === session.reseller_id);
           const customReason = loggedInResellerInfo?.status_reason;

           let bannerBg = "bg-amber-50 border-amber-200 text-amber-900";
           let badgeBg = "bg-amber-100 text-amber-850 border-amber-200";
           let btnBg = "bg-amber-600 hover:bg-amber-700 focus:ring-amber-200";
           let title = "Your Agent Account is Pending Verification";
           let description = "A registration request has been dispatched to our supervisor (artamil583@gmail.com). You can navigate the workspace but cannot register vehicles, write database entries, or print QR Codes until verified.";
           let iconBg = "bg-amber-100 text-amber-700";
           
           if (rStatus === 'details_required') {
             bannerBg = "bg-indigo-50 border-indigo-200 text-indigo-900";
             badgeBg = "bg-indigo-100 text-indigo-850 border-indigo-200";
             btnBg = "bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-250";
             title = "More Details Required For Verification";
             description = "Additional details are required from you. Please review the notice comments below and provide the requested information to artamil583@gmail.com.";
             iconBg = "bg-indigo-100 text-indigo-700";
           } else if (rStatus === 'suspended') {
             bannerBg = "bg-rose-50 border-rose-200 text-rose-900";
             badgeBg = "bg-rose-100 text-rose-850 border-rose-200";
             btnBg = "bg-rose-600 hover:bg-rose-700 focus:ring-rose-250";
             title = "Your Field Agent Station is Suspended";
             description = "This workstation has been temporarily suspended by our administrator. Actions are temporarily locked.";
             iconBg = "bg-rose-100 text-rose-700";
           } else if (rStatus === 'other') {
             bannerBg = "bg-slate-50 border-slate-205 text-slate-905";
             badgeBg = "bg-slate-100 text-slate-800 border-slate-200";
             btnBg = "bg-slate-600 hover:bg-slate-700 focus:ring-slate-250";
             title = "Verification Status Action Necessary";
             description = "Your workspace status has been custom flagged by an administrator. Review details below.";
             iconBg = "bg-slate-150 text-slate-700";
           }

           return (
             <div className={`mb-6 p-4 md:p-5 ${bannerBg} border rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs`} id="pending-agent-header-alert">
               <div className="flex items-start md:items-center space-x-3.5">
                 <div className={`p-2.5 ${iconBg} rounded-xl flex-shrink-0 animate-pulse`}>
                   <AlertTriangle className="w-5 h-5" />
                 </div>
                 <div>
                   <h4 className="font-sans font-extrabold text-sm leading-tight text-slate-950">{title}</h4>
                   <p className="font-sans text-xs mt-1 text-slate-700">
                     {description}
                   </p>
                   {customReason && (
                     <div className="mt-2.5 p-2 px-3 bg-white/70 border border-current/10 rounded-lg text-xs font-sans font-medium flex items-start space-x-2">
                       <span className="font-extrabold text-[#D98F1F]">Admin Notice:</span>
                       <span className="italic text-slate-800">{customReason}</span>
                     </div>
                   )}
                 </div>
               </div>
               <div className="flex items-center space-x-3 flex-shrink-0">
                 <span className={`px-3 py-1.5 ${badgeBg} border rounded-lg text-[10px] font-extrabold uppercase tracking-wider select-none`}>
                   {rStatus === 'details_required' ? 'Details Required' : rStatus === 'suspended' ? 'Suspended' : rStatus === 'other' ? 'Other Status' : 'Pending Approval'}
                 </span>
                 <button
                   onClick={fetchAppCoreData}
                   disabled={loadingData}
                   className={`p-1.5 px-3 whitespace-nowrap ${btnBg} text-white rounded-lg font-sans text-xs font-bold flex items-center space-x-1 active:scale-95 transition-all`}
                 >
                   <RefreshCw className={`w-3 h-3 ${loadingData ? 'animate-spin' : ''}`} />
                   <span>Check Status</span>
                 </button>
               </div>
             </div>
           );
         })()}
        
        {/* Analytics Hero Section */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 pb-5 border-b border-[#DDDAD3] gap-4" id="main-header">
          <div>
            <h2 className="text-2xl font-sans font-black text-[#14171A] tracking-tight" id="main-header-title">
              {activeTab === 'tags' 
                ? 'CallMe Tag Physical Stickers' 
                : activeTab === 'static_qr' 
                ? 'On-Site Standalone Static QR Code Printer' 
                : 'CallMe Field Agents / Resellers'}
            </h2>
            <p className="text-sm text-slate-500 font-medium" id="main-header-sub">
              {activeTab === 'tags' 
                ? 'Register vehicle owners and configure smart Dynamic QR2 cards.' 
                : activeTab === 'static_qr'
                ? 'Generate and print standalone offline Static QR codes (Direct Calls or vCard contacts) for on-site selling.'
                : 'Create and audit registered on-site agents and resellers.'}
            </p>
          </div>

          <div className="flex items-center space-x-3 self-start md:self-auto" id="header-actions">
            <button
              id="refresh-data-btn"
              onClick={fetchAppCoreData}
              disabled={loadingData}
              className="p-2.5 bg-white border border-[#DDDAD3] rounded-xl text-slate-500 hover:text-[#D98F1F] active:scale-95 disabled:opacity-50 transition-all hover:bg-slate-50"
              title="Refresh core data"
            >
              <RefreshCw className={`w-4 h-4 ${loadingData ? 'animate-spin' : ''}`} />
            </button>

            {activeTab === 'tags' && (() => {
              const isPending = session?.role === 'reseller' && session?.status !== 'active';
              return (
                <button
                  id="create-new-tag-btn"
                  onClick={isPending ? () => showToastMsg("Registration Pending: Your agent account is currently awaiting verification. Please wait for an administrator to activate your workspace.", "info") : handleOpenCreateTag}
                  className={`${
                    isPending 
                      ? 'bg-slate-200 border border-slate-300 text-slate-400 cursor-not-allowed opacity-85' 
                      : 'bg-[#14171A] hover:bg-[#D98F1F] text-[#F7F6F3] active:scale-95'
                  } px-4 py-2.5 rounded-xl font-sans text-xs font-bold tracking-wider uppercase shadow-xs flex items-center space-x-2 transition-all`}
                  title={isPending ? "Account Pending Activation - Registration Disabled" : "On-Site Registration"}
                >
                  <Plus className="w-4.5 h-4.5" />
                  <span>On-Site Registration</span>
                </button>
              );
            })()}

            {activeTab === 'resellers' && session.role === 'super_admin' && (
              <button
                id="add-reseller-btn"
                onClick={() => setShowResellerModal(true)}
                className="bg-[#14171A] hover:bg-[#D98F1F] text-[#F7F6F3] px-4 py-2.5 rounded-xl font-sans text-xs font-bold tracking-wider uppercase shadow-sm flex items-center space-x-2 active:scale-95 transition-all"
              >
                <Plus className="w-4.5 h-4.5" />
                <span>Add Reseller Agent</span>
              </button>
            )}
          </div>
        </header>

        {/* Stats Section Cards Header */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8" id="dashboard-stats-rows">
          <div className="bg-white p-5 rounded-2xl border border-[#DDDAD3] shadow-xs flex items-center justify-between" id="stat-total-tags">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">Registered Tags</p>
              <h3 className="text-2xl font-sans font-black text-[#14171A] mt-2">{stats.totalTags}</h3>
            </div>
            <div className="bg-[#D98F1F]/10 text-[#D98F1F] p-3 rounded-xl">
              <QrCode className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#DDDAD3] shadow-xs flex items-center justify-between" id="stat-active-tags">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">Active Connections</p>
              <h3 className="text-2xl font-sans font-black text-[#D98F1F] mt-2">{stats.activeTags}</h3>
            </div>
            <div className="bg-[#D98F1F]/5 text-[#D98F1F] p-3 rounded-xl">
              <Check className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#DDDAD3] shadow-xs flex items-center justify-between" id="stat-scans">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">QR2 Web Page Views</p>
              <h3 className="text-2xl font-sans font-black text-[#14171A] mt-2">{stats.totalScans}</h3>
            </div>
            <div className="bg-slate-100 text-slate-700 p-3 rounded-xl">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
        </section>

        {/* Tab 1: Tags Table */}
        {activeTab === 'tags' && (
          <div className="bg-white rounded-2xl border border-[#DDDAD3] shadow-xs overflow-hidden" id="tags-main-section">
            
            {/* Table Search & Filters */}
            <div className="p-4 border-b border-[#DDDAD3]/50 bg-[#F7F6F3]/50 flex flex-col md:flex-row md:items-center justify-between gap-3" id="filters-container">
              <div className="relative flex-1 flex gap-2" id="filter-search-group">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    id="tag-search-box"
                    type="text"
                    placeholder="Search by owner name, phone number, plate or QR ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9.5 pr-4 py-2.5 bg-white border border-[#DDDAD3] rounded-xl font-sans text-sm focus:outline-none focus:ring-2 focus:ring-[#D98F1F] focus:border-transparent transition-all"
                  />
                </div>
                
                <button
                  id="scan-lookup-btn"
                  type="button"
                  onClick={() => {
                    setShowScannerModal(true);
                    startScanner();
                  }}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-[#D98F1F]/10 hover:bg-[#D98F1F]/20 text-[#D98F1F] font-sans font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer border border-[#D98F1F]/20 shadow-xs"
                  title="Scan Tag QR to lookup & edit"
                >
                  <Camera className="w-4 h-4 animate-pulse" />
                  <span className="hidden sm:inline">Scan QR</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3" id="all-filters-inputs">
                {/* Status selector */}
                <div className="flex items-center space-x-2" id="filter-status-group">
                  <ListFilter className="w-4 h-4 text-slate-400" />
                  <select
                    id="filter-status-select"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="px-3 py-2 bg-white border border-[#DDDAD3] font-sans text-xs font-semibold uppercase tracking-wider rounded-xl text-[#14171A] focus:outline-none focus:ring-2 focus:ring-[#D98F1F]"
                  >
                    <option value="all">ALL STATUSES</option>
                    <option value="active">Active ONLY</option>
                    <option value="paused">Paused ONLY</option>
                  </select>
                </div>

                {/* Reseller filter (Super-admin only) */}
                {session.role === 'super_admin' && (
                  <select
                    id="filter-creator-select"
                    value={creatorFilter}
                    onChange={(e) => setCreatorFilter(e.target.value)}
                    className="px-3 py-2 bg-white border border-[#DDDAD3] font-sans text-xs font-semibold uppercase tracking-wider rounded-xl text-[#14171A] focus:outline-none focus:ring-2 focus:ring-[#D98F1F]"
                  >
                    <option value="all">ALL CREATING AGENTS</option>
                    <option value="admin">Admin Root</option>
                    {resellers.map((r) => (
                       <option key={r.reseller_id} value={r.reseller_id}>
                         Creator: {r.name}
                       </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Tags Registry Table */}
            <div className="overflow-x-auto" id="tags-table-wrapper">
              {loadingData ? (
                <div className="p-12 text-center" id="tags-loading-state">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#D98F1F] mx-auto" />
                  <p className="mt-3 text-sm text-slate-500 font-semibold uppercase tracking-widest leading-none">Fetching Registry...</p>
                </div>
              ) : filteredTags.length === 0 ? (
                <div className="p-16 text-center" id="tags-empty-state">
                  <AlertTriangle className="w-10 h-10 text-slate-350 mx-auto mb-3" />
                  <p className="text-slate-500 font-sans text-sm font-semibold">No vehicle tags match the filter parameters.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse" id="tags-data-table">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] text-slate-400 font-extrabold uppercase tracking-widest select-none" id="table-head-row">
                      <th className="py-4 px-5">QR ID</th>
                      <th className="py-4 px-5">Owner Metadata</th>
                      <th className="py-4 px-5">Plate Number</th>
                      <th className="py-4 px-5">Emergency Backups</th>
                      <th className="py-4 px-5">Creator Agent</th>
                      <th className="py-4 px-5">Status</th>
                      <th className="py-4 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100" id="table-body">
                    {filteredTags.map((tag) => {
                      const isPending = session?.role === 'reseller' && session?.status !== 'active';
                      return (
                        <tr key={tag.qr_id} className="hover:bg-slate-50/50 transition-colors" id={`row-${tag.qr_id}`}>
                        
                        {/* QR Identifier */}
                        <td className="py-4 px-5 align-middle">
                          <div className="flex flex-col space-y-1.5" id={`tagid-container-${tag.qr_id}`}>
                            <div className="inline-flex items-center space-x-1.5 font-mono text-sm font-extrabold text-[#D98F1F] bg-[#D98F1F]/5 p-2 px-3 rounded-lg border border-[#D98F1F]/10 w-fit" id={`tagid-${tag.qr_id}`}>
                              <span>{tag.qr_id}</span>
                            </div>
                            <a
                              id={`preview-link-table-${tag.qr_id}`}
                              href={`/?qr=${tag.qr_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-slate-500 hover:text-[#D98F1F] transition-colors w-fit flex items-center space-x-1 font-semibold pl-1"
                              title="View customer-facing web page"
                            >
                              <ExternalLink className="w-3 h-3 text-slate-400" />
                              <span>View Live Page</span>
                            </a>
                          </div>
                        </td>

                        {/* Owner Details */}
                        <td className="py-4 px-5 align-middle">
                          <p className="font-sans font-semibold text-slate-800 leading-tight" id={`owner-name-${tag.qr_id}`}>{tag.owner_name}</p>
                          <p className="font-mono text-xs text-slate-400 mt-0.5" id={`owner-phone-${tag.qr_id}`}>{tag.phone_number}</p>
                        </td>

                        {/* UAE Car Plate */}
                        <td className="py-4 px-5 align-middle">
                          {tag.plate_number ? (
                            <div className="inline-flex items-center bg-slate-100 border border-slate-200 text-slate-700 px-2.5 py-1 rounded font-mono text-xs font-bold uppercase tracking-wider" id={`tag-plate-${tag.qr_id}`}>
                              {tag.plate_number}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-300 italic">None</span>
                          )}
                        </td>

                        {/* Emergency Overrides */}
                        <td className="py-4 px-5 align-middle">
                          {tag.emergency_contact_name || tag.emergency_contact_number ? (
                            <div className="text-slate-500 font-sans" id={`emerg-details-${tag.qr_id}`}>
                              <p className="text-xs font-semibold leading-tight">{tag.emergency_contact_name || 'Emergency contact'}</p>
                              <p className="font-mono text-[10px] text-slate-400">{tag.emergency_contact_number || 'No number'}</p>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-300 italic">None</span>
                          )}
                        </td>

                        {/* Created By */}
                        <td className="py-4 px-5 align-middle">
                          <span className="text-xs font-semibold text-slate-500" id={`tag-creator-${tag.qr_id}`}>
                            {tag.created_by === 'admin' ? 'Root Administrator' : tag.created_by}
                          </span>
                        </td>

                        {/* Status badge */}
                        <td className="py-4 px-5 align-middle">
                          <span
                            id={`tag-status-${tag.qr_id}`}
                            className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                              tag.status === 'active' 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                : 'bg-amber-50 text-amber-600 border border-amber-100'
                            }`}
                          >
                            {tag.status}
                          </span>
                        </td>

                        {/* Action buttons */}
                        <td className="py-4 px-5 text-right align-middle">
                          <div className="flex items-center justify-end space-x-2" id={`actions-grp-${tag.qr_id}`}>
                             {/* Open Customer Scan Link */}
                            <a
                              id={`open-customer-page-btn-${tag.qr_id}`}
                              href={`/?qr=${tag.qr_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 bg-[#D98F1F]/10 border border-[#D98F1F]/20 text-[#D98F1F] hover:bg-[#D98F1F] hover:text-white rounded-lg active:scale-95 transition-all flex items-center justify-center"
                              title="Open Customer Landing Page (Scan Simulation)"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>

                            {/* QR Action trigger generator output */}
                            <button
                              id={`regenerate-qr-btn-${tag.qr_id}`}
                              disabled={isPending}
                              onClick={() => generateQRCodes(tag)}
                              className={`p-1.5 border rounded-lg active:scale-95 transition-all ${
                                isPending
                                  ? 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed opacity-60'
                                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-[#D98F1F] hover:bg-white'
                              }`}
                              title={isPending ? "Verification Pending - Output disabled" : "Print / Output QR Codes"}
                            >
                              <QrCode className="w-4 h-4" />
                            </button>

                            {/* Scan log tracker */}
                            <button
                              id={`view-logs-btn-${tag.qr_id}`}
                              onClick={() => handleViewLogs(tag)}
                              className="p-1.5 bg-slate-50 border border-slate-200 text-slate-600 hover:text-[#D98F1F] rounded-lg hover:bg-white active:scale-95 transition-all flex items-center space-x-1"
                              title="View scan history logs"
                            >
                              <Clock className="w-4 h-4" />
                              <span className="text-[10px] font-bold">
                                {scanLogs.filter(l => l.qr_id === tag.qr_id).length}
                              </span>
                            </button>

                            {/* Edit record metadata */}
                            <button
                              id={`edit-tag-btn-${tag.qr_id}`}
                              disabled={isPending}
                              onClick={() => handleOpenEditTag(tag)}
                              className={`p-1.5 border rounded-lg active:scale-95 transition-all ${
                                isPending
                                  ? 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed opacity-60'
                                  : 'bg-[#D98F1F]/5 text-[#D98F1F] border-[#D98F1F]/15 hover:bg-[#D98F1F] hover:text-white hover:border-transparent'
                              }`}
                              title={isPending ? "Verification Pending - Editing disabled" : "Edit tag information"}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            {/* Delete registry */}
                            <button
                              id={`delete-tag-btn-${tag.qr_id}`}
                              disabled={isPending}
                              onClick={() => handleDeleteTag(tag.qr_id)}
                              className={`p-1.5 border rounded-lg active:scale-95 transition-all ${
                                isPending
                                  ? 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed opacity-60'
                                  : 'bg-rose-50 border-rose-100 text-rose-500 hover:bg-rose-500 hover:text-white hover:border-transparent'
                              }`}
                              title={isPending ? "Verification Pending - Deletion disabled" : "Delete tag"}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>

                      </tr>
                    );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Reseller List (Super admin only) */}
        {activeTab === 'resellers' && session.role === 'super_admin' && (
          <div className="bg-white rounded-2xl border border-[#DDDAD3] shadow-xs overflow-hidden" id="resellers-main-section">
            <div className="overflow-x-auto" id="resellers-table-wrapper">
              {loadingData ? (
                <div className="p-12 text-center" id="resellers-loading-state">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#D98F1F] mx-auto" />
                  <p className="mt-3 text-sm text-slate-500 font-semibold uppercase tracking-widest">Fetching Registries...</p>
                </div>
              ) : resellers.length === 0 ? (
                <div className="p-16 text-center" id="resellers-empty">
                  <AlertTriangle className="w-10 h-10 text-slate-350 mx-auto mb-3" />
                  <p className="text-slate-500 font-sans text-sm font-semibold">No field agent partners registered yet.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse" id="resellers-data-table">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] text-slate-400 font-extrabold uppercase tracking-widest select-none" id="reseller-table-head">
                      <th className="py-4 px-5">Agent ID / username</th>
                      <th className="py-4 px-5">Agent Name</th>
                      <th className="py-4 px-5">Contact Details</th>
                      <th className="py-4 px-5">Total Tags Printed</th>
                      <th className="py-4 px-5">Activation Status</th>
                      <th className="py-4 px-5">Created date</th>
                      <th className="py-4 px-5 text-right font-extrabold">Management</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100" id="reseller-table-body">
                    {resellers.map((reseller) => {
                      const rStatus = reseller.status || 'active'; // Default to active for backward compatibility
                      return (
                        <tr key={reseller.reseller_id} className="hover:bg-slate-50/50 transition-colors" id={`reseller-row-${reseller.reseller_id}`}>
                          
                          {/* ID */}
                          <td className="py-4 px-5 align-middle">
                            <span className="font-mono text-xs font-extrabold text-[#D98F1F] bg-[#D98F1F]/5 p-2 px-3 rounded-lg border border-[#D98F1F]/10">
                              {reseller.reseller_id}
                            </span>
                          </td>

                          {/* Name */}
                          <td className="py-4 px-5 align-middle">
                            <p className="font-sans font-bold text-slate-800 leading-tight">{reseller.name}</p>
                          </td>

                          {/* Phone & Email Contact info */}
                          <td className="py-4 px-5 align-middle">
                            <div className="flex flex-col space-y-0.5">
                              <span className="font-mono text-xs text-slate-800 font-semibold">{reseller.contact}</span>
                              {reseller.email && (
                                <span className="font-sans text-[11px] text-[#D98F1F] font-medium hover:underline">
                                  <a href={`mailto:${reseller.email}`}>{reseller.email}</a>
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Generated tags */}
                          <td className="py-4 px-5 align-middle">
                            <span className="inline-flex bg-slate-100 border border-slate-200 text-slate-700 font-bold font-mono px-3 py-1 rounded-lg text-xs">
                              {resellerTagsCount[reseller.reseller_id] || 0} Tags
                            </span>
                          </td>

                           {/* Activation Status Badge */}
                           <td className="py-4 px-5 align-middle">
                             <div className="flex flex-col space-y-1 items-start">
                               {rStatus === 'pending' && (
                                 <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-100 animate-pulse">
                                   <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                   <span>Pending Approval</span>
                                 </span>
                               )}
                               {rStatus === 'active' && (
                                 <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-100">
                                   <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                   <span>Active / Verified</span>
                                 </span>
                               )}
                               {rStatus === 'details_required' && (
                                 <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100">
                                   <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                   <span>Details Required</span>
                                 </span>
                               )}
                               {rStatus === 'suspended' && (
                                 <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-100">
                                   <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                   <span>Suspended</span>
                                 </span>
                               )}
                               {rStatus === 'other' && (
                                 <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                                   <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                                   <span>Other Status</span>
                                 </span>
                               )}
                               {reseller.status_reason && (
                                 <p className="text-[10px] text-slate-500 italic mt-1 font-sans font-medium bg-slate-50 p-1 px-1.5 rounded-md border border-slate-100/60 max-w-[180px] break-words">
                                   Note: {reseller.status_reason}
                                 </p>
                               )}
                             </div>
                           </td>
 
                           {/* Registered date */}
                           <td className="py-4 px-5 align-middle">
                             <p className="text-xs text-slate-400 font-medium">
                               {reseller.created_at?.toDate()?.toLocaleDateString() || 'N/A'}
                             </p>
                           </td>
 
                           {/* Action status select dropdown and delete operations */}
                           <td className="py-4 px-5 text-right align-middle">
                             <div className="flex items-center justify-end space-x-2">
                               <select
                                 id={`status-select-${reseller.reseller_id}`}
                                 value={rStatus}
                                 onChange={(e) => {
                                   const nextVal = e.target.value as any;
                                   if (nextVal === 'other' || nextVal === 'details_required' || nextVal === 'suspended' || nextVal === 'pending') {
                                     setStatusModalAgentId(reseller.reseller_id);
                                     setStatusModalSelected(nextVal);
                                     setStatusModalReason(reseller.status_reason || '');
                                     setShowStatusModal(true);
                                   } else {
                                     handleUpdateResellerStatus(reseller.reseller_id, nextVal, '');
                                   }
                                 }}
                                 className="bg-white border border-[#DDDAD3] text-xs text-slate-800 rounded-lg p-1.5 px-2 font-bold focus:ring-2 focus:ring-[#D98F1F]/20 focus:border-[#D98F1F] transition-all outline-none cursor-pointer hover:bg-slate-50/50"
                               >
                                 <option value="active">Approve Agent</option>
                                 <option value="pending">Pending Approval</option>
                                 <option value="details_required">More Details Required</option>
                                 <option value="suspended">Suspend</option>
                                 <option value="other">Other Status...</option>
                               </select>
 
                               <button
                                 id={`delete-reseller-btn-${reseller.reseller_id}`}
                                 onClick={() => handleDeleteReseller(reseller.reseller_id)}
                                 className="p-1.5 px-3 bg-rose-50 border border-rose-100 text-rose-500 hover:bg-rose-500 hover:text-white rounded-lg active:scale-95 transition-all text-[11px] font-extrabold"
                                 title="Delete Agent Registry"
                               >
                                 Delete
                               </button>
                             </div>
                           </td>

                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Standalone Static Offline QR Generator */}
        {activeTab === 'static_qr' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="static-qr-main-section">
            
            {/* Left Column: Form Controls */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-[#DDDAD3] shadow-xs p-6 md:p-8 space-y-6" id="static-qr-form-card">
              <div>
                <h3 className="text-lg font-sans font-black text-slate-800 tracking-tight" id="static-form-title">
                  Static QR Parameters
                </h3>
                <p className="text-xs text-slate-500 mt-1 font-semibold leading-relaxed">
                  Enter on-site customer contact details below to instantly compile a completely offline, direct-action QR code sticker. No internet or database registration is required for scanning this sticker.
                </p>
              </div>

              <div className="space-y-4" id="static-form-fields">
                {/* QR Format Type Toggle Selector */}
                <div className="space-y-1.5" id="static-qr-type-group">
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest animate-pulse" htmlFor="static-qr-type-select">
                    Format Mode
                  </label>
                  <select
                    id="static-qr-type-select"
                    value={staticQRType}
                    onChange={(e) => {
                      setStaticQRType(e.target.value as 'vcard' | 'tel');
                      setGeneratedStaticQRUrl(''); // Reset stale preview
                    }}
                    className="w-full px-4 py-3 bg-slate-50 border border-[#DDDAD3] rounded-xl font-sans text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#D98F1F]"
                  >
                    <option value="vcard">💾 Multi-Contact Card (vCard format with backup numbers)</option>
                    <option value="tel">📞 Direct Mobile Call (Instant telephone dialer)</option>
                  </select>
                </div>

                {/* Primary Number Input */}
                <div className="space-y-1.5" id="static-primary-group">
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest" htmlFor="static-primary-input">
                    Primary Owner Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 font-bold text-xs select-none">
                      +971
                    </span>
                    <input
                      id="static-primary-input"
                      type="tel"
                      placeholder="50 123 4567"
                      value={staticPrimaryPhone}
                      onChange={(e) => {
                        setStaticPrimaryPhone(e.target.value);
                        setGeneratedStaticQRUrl(''); // Reset stale preview
                      }}
                      className="w-full pl-14 pr-4 py-2.5 bg-slate-50 border border-[#DDDAD3] rounded-xl font-sans text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#D98F1F] transition-all"
                    />
                  </div>
                  <p className="text-[9px] text-slate-400 font-semibold italic">Enter owner's mobile number. Direct call code formats instantly.</p>
                </div>

                {/* Emergency Secondary Input (Shown only if format is vcard) */}
                {staticQRType === 'vcard' && (
                  <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150" id="static-emergency-group">
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest" htmlFor="static-emergency-input">
                      Secondary Emergency Family Number (Optional)
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 font-bold text-xs select-none">
                        +971
                      </span>
                      <input
                        id="static-emergency-input"
                        type="tel"
                        placeholder="52 987 6543"
                        value={staticEmergencyPhone}
                        onChange={(e) => {
                          setStaticEmergencyPhone(e.target.value);
                          setGeneratedStaticQRUrl(''); // Reset stale preview
                        }}
                        className="w-full pl-14 pr-4 py-2.5 bg-slate-50 border border-[#DDDAD3] rounded-xl font-sans text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#D98F1F] transition-all"
                      />
                    </div>
                    <p className="text-[9px] text-slate-400 font-semibold italic">Secondary emergency family contact loaded directly onto the scanned vCard.</p>
                  </div>
                )}

                {/* Custom Label Text */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="static-metadata-row">
                  <div className="space-y-1.5" id="static-label-group">
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest" htmlFor="static-label-input">
                      Card Display Name Label
                    </label>
                    <input
                      id="static-label-input"
                      type="text"
                      placeholder="CallMe Tag - UAE"
                      value={staticLabel}
                      onChange={(e) => {
                        setStaticLabel(e.target.value);
                        setGeneratedStaticQRUrl(''); // Reset stale preview
                      }}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-[#DDDAD3] rounded-xl font-sans text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#D98F1F] transition-all"
                    />
                  </div>

                  <div className="space-y-1.5" id="static-plate-group">
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest" htmlFor="static-plate-input">
                      Vehicle Plate Number (Optional)
                    </label>
                    <input
                      id="static-plate-input"
                      type="text"
                      placeholder="e.g. DUBAI A 12345"
                      value={staticPlateNumber}
                      onChange={(e) => {
                        setStaticPlateNumber(e.target.value);
                        setGeneratedStaticQRUrl(''); // Reset stale preview
                      }}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-[#DDDAD3] rounded-xl font-sans text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#D98F1F] transition-all uppercase"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex" id="static-form-actions">
                <button
                  id="static-generate-btn"
                  type="button"
                  onClick={handleGenerateStaticQR}
                  disabled={isGeneratingStatic || !staticPrimaryPhone}
                  className="w-full bg-[#14171A] hover:bg-[#D98F1F] text-[#F7F6F3] py-3 px-6 rounded-xl font-sans font-black text-xs tracking-widest uppercase shadow-md flex items-center justify-center space-x-2 transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
                >
                  <Printer className="w-4.5 h-4.5" />
                  <span>{isGeneratingStatic ? 'Generating Barcode...' : 'Generate Offline QR Sticker'}</span>
                </button>
              </div>
            </div>

            {/* Right Column: Visual Preview & Guidelines Output */}
            <div className="lg:col-span-5 flex flex-col space-y-6" id="static-qr-preview-sidebar">
              
              {/* Sticker Box Frame */}
              <div className="bg-white rounded-2xl border border-[#DDDAD3] shadow-xs p-6 flex flex-col items-center justify-center text-center space-y-6 flex-1 min-h-[360px]" id="static-preview-panel">
                {generatedStaticQRUrl ? (
                  <div className="w-full flex flex-col items-center space-y-5 animate-in fade-in zoom-in-95 duration-150" id="static-active-preview">
                    <div>
                      <span className="text-[10px] bg-amber-50 text-[#D98F1F] font-extrabold p-1 px-3 rounded-full uppercase tracking-widest font-mono">
                        {staticQRType === 'vcard' ? 'vCard Offline Sticker' : 'Direct Call Sticker'}
                      </span>
                      <h4 className="text-sm font-sans font-black text-slate-800 tracking-tight mt-2" id="static-preview-headline">
                        Sticker Render Success
                      </h4>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border-2 border-[#D98F1F]/20 flex items-center justify-center shadow-md relative" id="static-qrcode-container">
                      <img
                        id="static-qr-rendered-img"
                        src={generatedStaticQRUrl}
                        alt="Standalone Static QR"
                        className="w-48 h-48 object-contain aspect-square referrerPolicy='no-referrer'"
                      />
                      {/* Technical visual corners */}
                      <span className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#D98F1F] rounded-tl"></span>
                      <span className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-[#D98F1F] rounded-tr"></span>
                      <span className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-[#D98F1F] rounded-bl"></span>
                      <span className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#D98F1F] rounded-br"></span>
                    </div>

                    <div className="w-full space-y-2" id="static-download-group">
                      <button
                        id="download-static-qr-btn"
                        onClick={handleDownloadStaticQR}
                        className="w-full bg-[#14171A] hover:bg-[#D98F1F] text-[#F7F6F3] py-2.5 px-4 rounded-xl font-sans font-extrabold text-xs tracking-wider uppercase shadow-xs flex items-center justify-center space-x-1.5 transition-all"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download Static PNG</span>
                      </button>
                      <p className="text-[9px] text-slate-400 font-semibold" id="static-size-note">
                        PNG Resolution: 354px x 354px (Optimized for standard 30x30mm thermal label sheets)
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center space-y-3 p-8 text-slate-350" id="static-empty-preview">
                    <div className="bg-slate-50 p-4 rounded-full border border-slate-100">
                      <Printer className="w-8 h-8 text-slate-400" />
                    </div>
                    <strong className="text-slate-600 font-sans text-xs uppercase tracking-wider">No Sticker Generated</strong>
                    <p className="text-[10px] text-slate-400 leading-relaxed max-w-[200px] font-medium">
                      Fill out the client contact info on the left and click generate to render your offline-capable sticker.
                    </p>
                  </div>
                )}
              </div>

              {/* Thermal Printer Label Guidelines */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/60 text-left space-y-3.5" id="static-printing-guidelines">
                <div className="flex items-center space-x-2 text-slate-800" id="guidelines-header">
                  <Info className="w-4.5 h-4.5 text-[#D98F1F]" />
                  <h4 className="text-xs font-black uppercase tracking-widest">Field Printing Guidelines</h4>
                </div>
                <ul className="space-y-2.5 text-[10px] text-slate-500 font-semibold leading-relaxed list-disc list-inside" id="guidelines-list">
                  <li>
                    <strong className="text-slate-700">Pre-Printed Rolls:</strong> Static offline stickers can be printed in bulk beforehand or dynamically customized for premium clients.
                  </li>
                  <li>
                    <strong className="text-slate-700">Universal Scans:</strong> Scanning a vCard sticker immediately prompts the phone to add a name, primary number, and secondary emergency family number.
                  </li>
                  <li>
                    <strong className="text-slate-700">Optimal Resolution:</strong> Generated PNGs adhere to standard square layouts ensuring barcode legibility on small vehicle tags.
                  </li>
                </ul>
              </div>

            </div>

          </div>
        )}

      </main>

      {/* MODAL 1: Create / Edit Tag metadata form layout */}
      {showTagModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto" id="tag-modal-container">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 md:p-8 shadow-2xl border border-slate-100 flex flex-col space-y-6" id="tag-modal-card">
            
            <header className="flex items-center justify-between border-b border-slate-100 pb-4" id="tag-modal-header">
              <h3 className="text-xl font-sans font-black text-slate-800 tracking-tight">
                {modalMode === 'create' ? 'UAE Vehicle On-Site Tag Registration' : 'Edit Registered CallMe Tag'}
              </h3>
              <button
                id="close-tag-modal-btn"
                onClick={() => setShowTagModal(false)}
                className="text-slate-400 hover:text-slate-600 font-sans font-black text-xl leading-none transition-colors"
              >
                ×
              </button>
            </header>

            <form onSubmit={handleSaveTag} className="space-y-4 font-sans" id="tag-modal-form">
              
              {tagError && (
                <div className="p-3.5 bg-rose-50 border border-rose-100 text-rose-800 text-xs rounded-xl flex items-start space-x-2.5 leading-relaxed" id="tag-error-banner">
                  <X className="w-4 h-4 flex-shrink-0 text-rose-600 mt-0.5" />
                  <div>
                    <strong className="font-extrabold uppercase block tracking-wider mb-0.5">Submission Blocked</strong>
                    {tagError}
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" id="form-customer-group">
                {/* Owner Name */}
                <div className="space-y-1" id="input-owner-name-group">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider" htmlFor="owner-name-input">
                    Vehicle Owner Name*
                  </label>
                  <input
                    id="owner-name-input"
                    type="text"
                    required
                    placeholder="e.g. Fareed Al Maktoom"
                    value={formFields.owner_name}
                    onChange={(e) => setFormFields({...formFields, owner_name: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#D98F1F] focus:border-transparent transition-all"
                  />
                </div>

                {/* Owner Phone */}
                <div className="space-y-1" id="input-owner-phone-group">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider" htmlFor="owner-phone-input">
                    Owner Phone WhatsApp*
                  </label>
                  <input
                    id="owner-phone-input"
                    type="tel"
                    required
                    placeholder="e.g. +971 50 123 4567"
                    value={formFields.phone_number}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormFields({...formFields, phone_number: val});
                      if (modalMode === 'edit') {
                        setPhoneChanged(val.trim() !== initialPhone.trim());
                      }
                    }}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#D98F1F] focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Special Warning on modifying registered on-site numbers */}
              {phoneChanged && (
                <div className="p-4 bg-amber-50 border border-amber-100 text-amber-700 text-xs rounded-xl flex items-start space-x-2.5 leading-relaxed" id="edit-phone-warning">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-500" />
                  <div>
                    <strong className="font-extrabold uppercase block tracking-wider mb-0.5">Contact Number Changed</strong>
                    Editing the phone number only updates QR2's lookup data. QR1 was already printed with the old number baked in and cannot be retroactively changed. You must print a new QR1 replacement label for the vehicle.
                  </div>
                </div>
              )}

              {/* UAE Registered Plate (Optional) */}
              <div className="space-y-1" id="input-plate-group">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider" htmlFor="plate-input">
                  UAE Plate Number <span className="text-slate-300 italic font-medium">(Optional)</span>
                </label>
                <input
                  id="plate-input"
                  type="text"
                  placeholder="e.g. UAE C - 73849"
                  value={formFields.plate_number}
                  onChange={(e) => setFormFields({...formFields, plate_number: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#D98F1F] focus:border-transparent transition-all"
                />
              </div>

              {/* Emergency Contacts Backup Info */}
              <div className="border-t border-slate-100 pt-3 space-y-4" id="emergency-contact-group">
                <h4 className="text-xs uppercase tracking-wider text-slate-400 font-bold" id="emerg-section-title">
                  Alternate Backups / Emergency contacts <span className="text-rose-500 font-extrabold">*</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" id="emerg-inputs-grid">
                  <div className="space-y-1" id="input-emerg-name-group">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans" htmlFor="emerg-name-input">
                      Contact Name <span className="text-rose-500 font-extrabold">*</span>
                    </label>
                    <input
                      id="emerg-name-input"
                      type="text"
                      placeholder="e.g. Spouse / Brother"
                      required
                      value={formFields.emergency_contact_name}
                      onChange={(e) => setFormFields({...formFields, emergency_contact_name: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#D98F1F] focus:border-transparent transition-all"
                    />
                  </div>

                  <div className="space-y-1" id="input-emerg-phone-group">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans" htmlFor="emerg-phone-input">
                      Contact Phone <span className="text-rose-500 font-extrabold">*</span>
                    </label>
                    <input
                      id="emerg-phone-input"
                      type="tel"
                      placeholder="e.g. +971 50 222 3333"
                      required
                      value={formFields.emergency_contact_number}
                      onChange={(e) => setFormFields({...formFields, emergency_contact_number: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#D98F1F] focus:border-transparent transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Status and creator */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-3" id="meta-inputs-grid">
                <div className="space-y-1" id="input-status-group">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider" htmlFor="status-select">
                    Tag Action Status
                  </label>
                  <select
                    id="status-select"
                    value={formFields.status}
                    onChange={(e) => setFormFields({...formFields, status: e.target.value as any})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#D98F1F] focus:border-transparent transition-all font-semibold"
                  >
                    <option value="active">🟢 Active Tracker</option>
                    <option value="paused">🟡 Paused contact</option>
                  </select>
                </div>

                <div className="space-y-1" id="input-creator-group">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider" htmlFor="creator-display">
                    Managing Reseller
                  </label>
                  <input
                    id="creator-display"
                    type="text"
                    disabled
                    value={formFields.created_by}
                    className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 text-slate-450 rounded-xl text-sm font-mono"
                  />
                </div>
              </div>

              <footer className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3" id="tag-modal-footer">
                <button
                  id="cancel-tag-btn"
                  type="button"
                  onClick={() => setShowTagModal(false)}
                  className="px-5 py-2.5 border border-slate-200 rounded-xl text-xs font-bold tracking-wider uppercase text-slate-600 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  id="save-tag-btn"
                  type="submit"
                  disabled={isSavingTag}
                  className="px-6 py-2.5 bg-[#14171A] hover:bg-[#D98F1F] text-[#F7F6F3] rounded-xl text-xs font-bold tracking-wider uppercase shadow-sm flex items-center space-x-2 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSavingTag ? (
                    <>
                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                      <span>Writing Tag...</span>
                    </>
                  ) : (
                    <span>{modalMode === 'create' ? 'Create & Render QR' : 'Update Record'}</span>
                  )}
                </button>
              </footer>

            </form>
          </div>
        </div>
      )}

      {/* MODAL: QR Scanner Look Up Screen */}
      {showScannerModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto" id="qr-scanner-container">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-100 flex flex-col space-y-5 animate-in fade-in zoom-in-95 duration-200" id="qr-scanner-card">
            
            <header className="flex items-center justify-between border-b border-slate-100 pb-3" id="qr-scanner-header">
              <div>
                <span className="text-[9px] bg-[#D98F1F]/10 text-[#D98F1F] font-extrabold p-1 px-2.5 rounded-full uppercase tracking-widest font-mono">
                  Administrative Tool
                </span>
                <h3 className="text-lg font-sans font-black text-slate-800 tracking-tight mt-1">
                  On-Site QR Lookup Scanner
                </h3>
              </div>
              <button
                id="close-scanner-btn"
                onClick={() => {
                  stopScanner();
                  setShowScannerModal(false);
                }}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-all font-sans font-black text-xl leading-none"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            <div className="space-y-4" id="qr-scanner-body">
              {/* Camera Source Selector if multiple */}
              {cameraDevices.length > 1 && (
                <div className="space-y-1" id="camera-selector-group">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider" htmlFor="camera-source-select">
                    Select Camera Source
                  </label>
                  <select
                    id="camera-source-select"
                    value={selectedCameraId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedCameraId(id);
                      startScanner(id);
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-sans text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#D98F1F]"
                  >
                    {cameraDevices.map((device, idx) => (
                      <option key={device.deviceId || idx} value={device.deviceId}>
                        {device.label || `Camera ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Video Camera Live Feed Area */}
              <div className="relative aspect-square w-full bg-black rounded-2xl overflow-hidden shadow-inner border border-slate-100 flex flex-col items-center justify-center" id="scanner-viewfinder">
                <video
                  ref={scannerVideoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />
                
                {/* Visual scan overlay targeting corners */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  {/* Scanner laser lines */}
                  <div className="w-[70%] h-[70%] border-2 border-[#D98F1F]/40 rounded-xl relative flex flex-col justify-between p-4">
                    <span className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-[#D98F1F] rounded-tl"></span>
                    <span className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-[#D98F1F] rounded-tr"></span>
                    <span className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-[#D98F1F] rounded-bl"></span>
                    <span className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-[#D98F1F] rounded-br"></span>
                    
                    {/* Pulsing Scan bar */}
                    <div className="w-full h-0.5 bg-[#D98F1F] animate-bounce opacity-70"></div>
                  </div>
                </div>

                {scannerError && (
                  <div className="absolute inset-0 bg-slate-900/90 text-white p-6 flex flex-col items-center justify-center text-center space-y-3" id="scanner-error-message">
                    <AlertTriangle className="w-8 h-8 text-[#D98F1F]" />
                    <p className="text-xs font-semibold leading-relaxed max-w-xs">{scannerError}</p>
                    <button
                      type="button"
                      onClick={() => startScanner(selectedCameraId)}
                      className="px-4 py-2 bg-[#D98F1F] text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-[#c47f1b] transition-colors"
                    >
                      Try Camera Again
                    </button>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="flex items-center text-slate-300 text-xs my-3" id="scanner-divider">
                <div className="flex-1 border-t border-slate-100"></div>
                <span className="px-3 text-[10px] uppercase font-bold text-slate-400 tracking-widest font-mono">OR</span>
                <div className="flex-1 border-t border-slate-100"></div>
              </div>

              {/* Upload QR Image file form input */}
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 text-center hover:border-[#D98F1F]/40 hover:bg-[#D98F1F]/5 transition-all relative flex flex-col items-center justify-center" id="upload-scanner-zone">
                <input
                  type="file"
                  id="scanner-file-input"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload className="w-5 h-5 text-slate-400 mb-1.5" />
                <p className="text-xs font-bold text-slate-600">Upload QR Image File</p>
                <p className="text-[10px] text-slate-400 mt-1">Select or drop a screenshot of the QR code</p>
              </div>

              {/* Instruction Note */}
              <p className="text-[10px] text-slate-400 text-center leading-relaxed font-medium" id="scanner-instructions-note">
                Scan Tag QR1 (direct tel) or QR2 (web link) to locate, open, and instantly edit the registered vehicle owner's tag details.
              </p>
            </div>

            <canvas ref={scannerCanvasRef} className="hidden" />

          </div>
        </div>
      )}

      {/* MODAL 2: QR Generated Output Screen for Download */}
      {showQROutputModal && lastGeneratedTag && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto" id="qr-output-container">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 md:p-8 shadow-2xl border border-slate-100 flex flex-col space-y-5" id="qr-output-card">
            
            <header className="flex items-center justify-between border-b border-slate-100 pb-3" id="qr-output-header">
              <div>
                <span className="text-[10px] bg-[#D98F1F]/10 text-[#D98F1F] font-bold p-1 px-2.5 rounded-full uppercase tracking-widest font-sans">
                  Ready for Local Label Printing
                </span>
                <h3 className="text-lg font-sans font-black text-slate-800 tracking-tight mt-1">
                  Tag Generated: <span className="text-[#D98F1F] font-mono">{lastGeneratedTag.qr_id}</span>
                </h3>
              </div>
              <button
                id="close-qr-output-btn"
                onClick={() => setShowQROutputModal(false)}
                className="text-slate-400 hover:text-slate-600 font-sans font-black text-xl transition-colors"
              >
                ×
              </button>
            </header>

            <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 text-[11px] rounded-xl flex items-start space-x-2.5 leading-relaxed" id="qr-output-success-banner">
              <Check className="w-4 h-4 flex-shrink-0 text-emerald-600 mt-0.5" />
              <div>
                <strong className="font-extrabold uppercase tracking-wider block mb-0.5">Registration Secured!</strong>
                Details for <strong className="font-bold">{lastGeneratedTag.owner_name}</strong> are synchronized. Download your dynamic portal QR sticker below.
              </div>
            </div>

            {/* Centered Single QR representation */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 text-center flex flex-col items-center space-y-4" id="qr-sticker-row">
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-[#14171A]">Dynamic Web Portal QR Code</h4>
                <p className="text-[10px] text-slate-400 font-semibold mt-1">Saves scan date & masks owner phone number</p>
                <p className="text-[9px] text-[#D98F1F] bg-amber-50 p-1 px-2.5 rounded-md font-sans mt-2 inline-block font-bold">Secure Masked Routing Page</p>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-center justify-center shadow-xs" id="qr2-sticker-box">
                <img
                  id="sticker-qr2-img"
                  src={currentQR2Url}
                  alt="Dynamic Web Portal QR Code"
                  className="w-40 h-40 object-contain aspect-square referrerPolicy='no-referrer'"
                />
              </div>

              <div className="flex flex-col space-y-2 w-full" id="qr2-action-group">
                <button
                  id="download-qr2-btn"
                  onClick={() => handleDownloadQR(currentQR2Url, 'QR2_dynamic')}
                  className="w-full bg-[#14171A] hover:bg-[#D98F1F] text-[#F7F6F3] py-2.5 px-4 rounded-xl font-sans font-extrabold text-xs tracking-wider uppercase shadow-xs flex items-center justify-center space-x-1.5 transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Download QR Code PNG</span>
                </button>
                <a
                  id="preview-new-qr2-live-btn"
                  href={`/?qr=${lastGeneratedTag.qr_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 px-4 rounded-xl font-sans font-bold text-xs tracking-wider uppercase shadow-xs flex items-center justify-center space-x-1.5 transition-all border border-slate-200"
                >
                  <ExternalLink className="w-4 h-4 text-slate-500" />
                  <span>Test / Preview Webpage</span>
                </a>
              </div>
            </div>

            {/* Offline Helper Notice */}
            <div className="p-3 bg-amber-50/70 border border-amber-100/70 text-slate-600 text-[10px] rounded-xl flex items-start space-x-2 leading-relaxed" id="qr-output-offline-help">
              <Info className="w-4.5 h-4.5 text-[#D98F1F] flex-shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold text-slate-700 block uppercase tracking-wider mb-0.5">Need a Standalone Offline Static QR?</strong>
                Bulk or customized offline static stickers (vCard contacts/direct call dialers) can be printed separately on demand from the <strong className="font-bold">On-Site Static QR</strong> tab in the sidebar navigation.
              </div>
            </div>

            <footer className="pt-3 border-t border-slate-100 flex justify-end" id="qr-output-footer">
              <button
                id="close-qr-output-footer-btn"
                onClick={() => setShowQROutputModal(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-sans font-bold text-xs uppercase tracking-wider px-5 py-2.5 rounded-xl transition-all"
              >
                Close Output Page
              </button>
            </footer>

          </div>
        </div>
      )}

      {/* MODAL 3: Create reseller agent */}
      {showResellerModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto" id="reseller-modal-container">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 md:p-8 shadow-2xl border border-slate-100 flex flex-col space-y-6" id="reseller-modal-card">
            
            <header className="flex items-center justify-between border-b border-slate-100 pb-4" id="reseller-modal-header">
              <h3 className="text-xl font-sans font-black text-slate-800 tracking-tight">
                Add Field Reseller Partner
              </h3>
              <button
                id="close-reseller-modal-btn"
                onClick={() => setShowResellerModal(false)}
                className="text-slate-400 hover:text-slate-600 font-sans font-black text-xl transition-colors"
              >
                ×
              </button>
            </header>

            <form onSubmit={handleCreateReseller} className="space-y-4 font-sans" id="reseller-modal-form">
              {/* Partner Google Email Address */}
              <div className="space-y-1" id="reseller-user-group">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider" htmlFor="reseller-user-input">
                  Partner Google Email Address*
                </label>
                <input
                  id="reseller-user-input"
                  type="email"
                  required
                  placeholder="e.g. partner@gmail.com"
                  value={resellerForm.username}
                  onChange={(e) => setResellerForm({...resellerForm, username: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#D98F1F] focus:border-transparent transition-all"
                />
              </div>

              {/* Real Name */}
              <div className="space-y-1" id="reseller-name-group">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider" htmlFor="reseller-name-input">
                  Partner real name*
                </label>
                <input
                  id="reseller-name-input"
                  type="text"
                  required
                  placeholder="e.g. Salim bin Zayed"
                  value={resellerForm.name}
                  onChange={(e) => setResellerForm({...resellerForm, name: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#D98F1F] focus:border-transparent transition-all"
                />
              </div>

              {/* Reseller contact */}
              <div className="space-y-1" id="reseller-phone-group">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider" htmlFor="reseller-phone-input">
                  Contact phone / WhatsApp <span className="text-rose-500 font-extrabold">*</span>
                </label>
                <input
                  id="reseller-phone-input"
                  type="tel"
                  required
                  placeholder="e.g. +971 50 999 9999"
                  value={resellerForm.contact}
                  onChange={(e) => setResellerForm({...resellerForm, contact: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#D98F1F] focus:border-transparent transition-all"
                />
              </div>

              {resellerError && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 text-xs rounded-lg font-semibold flex items-center space-x-2" id="reseller-error-box">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{resellerError}</span>
                </div>
              )}

              <footer className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3" id="reseller-modal-footer">
                <button
                  id="cancel-reseller-btn"
                  type="button"
                  onClick={() => setShowResellerModal(false)}
                  className="px-5 py-2.5 border border-slate-200 rounded-xl text-xs font-bold tracking-wider uppercase text-slate-600 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  id="save-reseller-btn"
                  type="submit"
                  disabled={isSavingReseller}
                  className="px-6 py-2.5 bg-[#14171A] hover:bg-[#D98F1F] text-[#F7F6F3] rounded-xl text-xs font-bold tracking-wider uppercase shadow-sm flex items-center space-x-2 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSavingReseller ? (
                    <>
                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Register Reseller</span>
                  )}
                </button>
              </footer>

            </form>
          </div>
        </div>
      )}

      {/* DRAWER / SLIDE-IN: Scan logs listing drawer per selected tag */}
      {selectedTagForLogs && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-end p-0 z-50 transition-all" id="scanlogs-drawer-container">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col justify-between border-l border-slate-100" id="scanlogs-drawer-card">
            
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50" id="scanlogs-drawer-header">
              <div>
                <span className="text-[10px] bg-[#D98F1F]/15 text-[#D98F1F] font-bold py-1 px-2.5 rounded-full uppercase tracking-wider">
                  Registry Activity Log
                </span>
                <h3 className="text-lg font-sans font-black text-slate-800 tracking-tight mt-1">
                  Tag: <span className="font-mono text-[#D98F1F]">{selectedTagForLogs.qr_id}</span>
                </h3>
                <p className="text-[11px] text-slate-400 font-medium font-sans mt-0.5">Owner: {selectedTagForLogs.owner_name}</p>
              </div>
              <button
                id="close-logs-drawer-btn"
                onClick={() => setSelectedTagForLogs(null)}
                className="text-slate-400 hover:text-slate-600 font-sans font-black text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4" id="scanlogs-drawer-body">
              <div className="space-y-1 pb-4 border-b border-dashed border-slate-100" id="scanlogs-stat-box">
                <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Aggregate Statistics</p>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div className="bg-amber-50/50 border border-amber-100 p-3 rounded-xl text-center">
                    <p className="text-[9px] font-bold text-amber-700 uppercase">Live QR2 Scans</p>
                    <p className="text-lg font-mono font-black text-[#D98F1F] mt-0.5">{tagLogs.length}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl text-center">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">QR1 Offline Calls</p>
                    <p className="text-xs text-slate-400 italic mt-2 leading-none">Not Logged (100% Offline)</p>
                  </div>
                </div>
              </div>

              {loadingTagLogs ? (
                <div className="p-8 text-center" id="logs-loading">
                  <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-[#D98F1F] mx-auto" />
                  <p className="mt-2 text-xs text-slate-400 font-semibold uppercase tracking-wider">Loading metrics...</p>
                </div>
              ) : tagLogs.length === 0 ? (
                <div className="p-12 text-center text-slate-400 border border-dotted border-slate-200 rounded-2xl bg-slate-50/20" id="logs-empty">
                  <Info className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-xs font-semibold">No digital scan logs available yet.</p>
                  <p className="text-[10px] text-slate-400 leading-relaxed mt-1">This sticker has not been scanned since registration.</p>
                </div>
              ) : (
                <div className="space-y-2.5" id="logs-list-wrapper">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Scan History Logs</p>
                  {tagLogs.map((log) => (
                    <div key={log.id} className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 flex items-center justify-between" id={`log-${log.id}`}>
                      <div className="flex items-center space-x-3">
                        <div className="bg-[#D98F1F]/15 text-[#D98F1F] p-2 rounded-lg">
                          <QrCode className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-extrabold text-[#D98F1F] leading-none uppercase">QR2 Digital View</p>
                          <p className="text-[10px] text-slate-400 font-semibold font-mono mt-1">UUID: {log.id.slice(0, 8)}...</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-slate-800 font-mono leading-none">
                          {log.scanned_at?.toDate()?.toLocaleTimeString() || 'N/A'}
                        </p>
                        <p className="text-[9px] text-slate-400 font-semibold mt-1">
                          {log.scanned_at?.toDate()?.toLocaleDateString() || 'N/A'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <footer className="p-5 border-t border-slate-100 bg-slate-50/50" id="scanlogs-drawer-footer">
              <button
                id="close-logs-drawer-footer-btn"
                onClick={() => setSelectedTagForLogs(null)}
                className="w-full bg-slate-800 hover:bg-slate-900 border border-slate-900 text-white font-sans font-bold text-xs uppercase tracking-wider py-3 rounded-xl transition-all"
              >
                Close Metrics Panel
              </button>
            </footer>

          </div>
        </div>
      )}
 
       {/* MODAL 3: Agent Status Custom Mutation Form with Reason */}
       {showStatusModal && (
         <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto" id="status-reason-modal-container">
           <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-100 flex flex-col space-y-5" id="status-reason-modal-card">
             
             <header className="flex items-center justify-between border-b border-slate-100 pb-3" id="status-reason-modal-header">
               <h3 className="text-lg font-sans font-black text-slate-800 tracking-tight">
                 Update Agent Verification Status
               </h3>
               <button
                 id="close-status-modal-btn"
                 onClick={() => setShowStatusModal(false)}
                 className="text-slate-400 hover:text-[#D98F1F] font-sans font-black text-xl leading-none transition-colors"
               >
                 ×
               </button>
             </header>
 
             <div className="space-y-4 font-sans text-sm">
               <p className="text-slate-500 font-medium leading-relaxed">
                 Configure the active workstation status for agent <span className="font-bold text-[#D98F1F] font-mono">{statusModalAgentId}</span>.
               </p>
 
               {/* Status Select dropdown */}
               <div className="space-y-1">
                 <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                   Verification Status
                 </label>
                 <select
                   value={statusModalSelected}
                   onChange={(e) => setStatusModalSelected(e.target.value as any)}
                   className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-[#D98F1F]/20 focus:border-[#D98F1F] transition-all outline-none"
                 >
                   <option value="active">Approved / Active Agent</option>
                   <option value="pending">Pending Admin Verification</option>
                   <option value="details_required">More Details Required</option>
                   <option value="suspended">Suspended / Deactivated</option>
                   <option value="other">Other Status Option</option>
                 </select>
               </div>
 
               {/* Conditionally display Status Reason text field */}
               {(statusModalSelected === 'details_required' || statusModalSelected === 'other' || statusModalSelected === 'suspended' || statusModalSelected === 'pending') && (
                 <div className="space-y-1">
                   <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                     Status Message / Reason*
                   </label>
                   <textarea
                     required
                     rows={3}
                     placeholder="e.g. Please provide a copy of your valid business license or Emirates ID."
                     value={statusModalReason}
                     onChange={(e) => setStatusModalReason(e.target.value)}
                     className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-850 focus:ring-2 focus:ring-[#D98F1F]/20 focus:border-[#D98F1F] transition-all outline-none"
                   />
                   <p className="text-[10px] text-slate-400 font-medium">
                     This note will be displayed directly on the field agent's active terminal header workspace.
                   </p>
                 </div>
               )}
 
               {statusModalSelected === 'active' && (
                 <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 text-xs leading-relaxed">
                   <strong>Notice:</strong> Approving this agent will instantly unlock all on-site registration capabilities, sticker activation mechanisms, and database writing features.
                 </div>
               )}
             </div>
 
             <footer className="flex items-center justify-end space-x-2 border-t border-slate-100 pt-3" id="status-reason-modal-footer">
               <button
                 id="cancel-status-btn"
                 type="button"
                 onClick={() => setShowStatusModal(false)}
                 className="px-4 py-2.5 bg-slate-100 hover:bg-slate-250 text-slate-600 rounded-xl text-xs font-extrabold font-sans uppercase tracking-wider transition-colors"
               >
                 Cancel
               </button>
               <button
                 id="commit-status-btn"
                 type="button"
                 disabled={statusModalIsSaving}
                 onClick={async () => {
                   setStatusModalIsSaving(true);
                   try {
                     await handleUpdateResellerStatus(statusModalAgentId, statusModalSelected, statusModalReason);
                     setShowStatusModal(false);
                   } finally {
                     setStatusModalIsSaving(false);
                   }
                 }}
                 className="px-4 py-2.5 bg-[#14171A] hover:bg-[#D98F1F] text-[#F7F6F3] rounded-xl text-xs font-bold font-sans uppercase tracking-wider transition-colors disabled:opacity-50"
               >
                 {statusModalIsSaving ? 'Applying...' : 'Apply Status'}
               </button>
             </footer>
 
           </div>
         </div>
       )}
 
     </div>
   );
 }
