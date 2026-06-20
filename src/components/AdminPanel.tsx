import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
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
  Timestamp 
} from 'firebase/firestore';
import QRCode from 'qrcode';
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
  Mail
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
  alert(`Firestore Database Error (${operationType} @ ${path}): ${error instanceof Error ? error.message : String(error)}`);
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

export default function AdminPanel() {
  // Session handling
  const [session, setSession] = useState<UserSession | null>(() => {
    const saved = localStorage.getItem('callme_tag_session');
    return saved ? JSON.parse(saved) : null;
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

  // Application data lists
  const [tags, setTags] = useState<Tag[]>([]);
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [resellerTagsCount, setResellerTagsCount] = useState<Record<string, number>>({});
  const [scanLogs, setScanLogs] = useState<ScanLog[]>([]);

  // Page level navigation & feedback
  const [activeTab, setActiveTab] = useState<'tags' | 'resellers' | 'logs'>('tags');
  const [loadingData, setLoadingData] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all');
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

  // Authenticate user
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!usernameInput || !passwordInput) {
      setLoginError('Username and password are required.');
      return;
    }

    // Direct fallback if user uses default administrator credentials, ensuring login succeeds offline.
    if (usernameInput.trim().toLowerCase() === 'admin' && passwordInput === 'Ashik1432@') {
      const userSec: UserSession = {
        username: 'admin',
        role: 'super_admin'
      };
      localStorage.setItem('callme_tag_session', JSON.stringify(userSec));
      setSession(userSec);
      
      // Seed asynchronously in the background so it doesn't block the user
      setDoc(doc(db, 'admins', 'admin'), {
        password: 'Ashik1432@',
        is_admin: true
      }).catch(err => {
        console.warn("Could not sync admin credentials with Firestore (likely offline):", err);
      });
      return;
    }

    try {
      setLoginLoading(true);

      // 1. Check if super admin
      const adminDocRef = doc(db, 'admins', usernameInput.trim().toLowerCase());
      const adminSnap = await getDoc(adminDocRef);

      if (adminSnap.exists()) {
        const adminData = adminSnap.data();
        if (adminData.password === passwordInput) {
          const userSec: UserSession = {
            username: usernameInput.trim().toLowerCase(),
            role: 'super_admin'
          };
          localStorage.setItem('callme_tag_session', JSON.stringify(userSec));
          setSession(userSec);
          return;
        } else {
          setLoginError('Incorrect password.');
          return;
        }
      }

      // 2. Check if reseller
      const resellerDocRef = doc(db, 'resellers', usernameInput.trim().toLowerCase());
      const resellerSnap = await getDoc(resellerDocRef);

      if (resellerSnap.exists()) {
        const resellerData = resellerSnap.data();
        if (resellerData.password === passwordInput) {
          const accountStatus = resellerData.status || 'active'; // Default to active for backward compatibility

          const userSec: UserSession = {
            username: usernameInput.trim().toLowerCase(),
            role: 'reseller',
            reseller_id: usernameInput.trim().toLowerCase(),
            status: accountStatus
          };
          localStorage.setItem('callme_tag_session', JSON.stringify(userSec));
          setSession(userSec);
          return;
        } else {
          setLoginError('Incorrect password.');
          return;
        }
      }

      setLoginError('Account not found.');
    } catch (err) {
      console.error("Login failure:", err);
      setLoginError('Network error during login checkout. Check connectivity.');
    } finally {
      setLoginLoading(false);
    }
  };

  // Agent self-registration handler
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setRegSuccess('');

    const userLower = regUsername.trim().toLowerCase();
    const nameTrim = regName.trim();
    const emailTrim = regEmail.trim().toLowerCase();
    const contactTrim = regContact.trim();

    if (!userLower || !nameTrim || !emailTrim || !contactTrim || !regPassword) {
      setRegError('All fields including Username, Name, Email, Mobile and Password are required.');
      return;
    }

    // Verify legitimacy of Email address with robust regex pattern
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrim)) {
      setRegError('Please specify a legitimate email address (e.g. name@domain.com).');
      return;
    }

    // Verify legitimacy of Mobile number
    const contactValidation = validatePhoneNumber(contactTrim);
    if (!contactValidation.isValid) {
      setRegError(`Invalid Contact Number: ${contactValidation.error}`);
      return;
    }

    if (userLower.length < 3) {
      setRegError('Username/Agent ID must be at least 3 characters.');
      return;
    }

    try {
      setRegLoading(true);

      // Check if username already exists in resellers collection
      const resellerRef = doc(db, 'resellers', userLower);
      const testSnap = await getDoc(resellerRef);
      if (testSnap.exists()) {
        setRegError('Username already registered. Please choose another.');
        setRegLoading(false);
        return;
      }

      // Check if username is taken in admins collection
      const adminRef = doc(db, 'admins', userLower);
      const testAdmin = await getDoc(adminRef);
      if (testAdmin.exists()) {
        setRegError('This username is reserved as an administrator username.');
        setRegLoading(false);
        return;
      }

      // Safe to write registration record - default status is pending
      await setDoc(resellerRef, {
        name: nameTrim,
        email: emailTrim,
        contact: contactTrim,
        password: regPassword,
        status: 'pending',
        created_at: Timestamp.now()
      });

      // Try triggering the backend API endpoint to notify administrator email "artamil583@gmail.com"
      try {
        const response = await fetch('/api/send-registration-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            username: userLower,
            name: nameTrim,
            email: emailTrim,
            contact: contactTrim
          })
        });
        const resData = await response.json();
        console.log("Email notifications dispatch query result:", resData);
      } catch (mailFetchErr) {
        console.error("Failed to make webhook fetch call to registration notifier API:", mailFetchErr);
      }

      setRegSuccess('Registration submitted! Account pending administrator activation.');
      
      // Auto fill the login form with the newly created account
      setUsernameInput(userLower);
      setPasswordInput(regPassword);
      
      // Clear registration form fields
      setRegUsername('');
      setRegName('');
      setRegEmail('');
      setRegContact('');
      setRegPassword('');
      
      // Auto-toggle back to login after 3 seconds so they can read response
      setTimeout(() => {
        setIsRegisterMode(false);
        setRegSuccess('');
      }, 3000);

    } catch (err) {
      console.error("Agent self-registration failure:", err);
      setRegError('Connection/Database error occurred during registration.');
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

  // Handle open tag modal for creation
  const handleOpenCreateTag = () => {
    setModalMode('create');
    setPhoneChanged(false);
    setInitialPhone('');
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

    // Prevent non-active resellers from submitting tag registrations
    if (session?.role === 'reseller' && session?.status !== 'active') {
      alert("Registration Restricted: Your agent account is currently not active or registered details require review. Action restricted.");
      return;
    }

    if (!formFields.owner_name || !formFields.phone_number || !formFields.emergency_contact_name || !formFields.emergency_contact_number) {
      alert("Owner name, Phone Number, and Emergency Contact Name & Phone are required");
      return;
    }

    const ownerPhoneCheck = validatePhoneNumber(formFields.phone_number);
    if (!ownerPhoneCheck.isValid) {
      alert(`Invalid Owner Phone Number: ${ownerPhoneCheck.error}`);
      return;
    }

    const emergPhoneCheck = validatePhoneNumber(formFields.emergency_contact_number);
    if (!emergPhoneCheck.isValid) {
      alert(`Invalid Emergency Contact Phone Number: ${emergPhoneCheck.error}`);
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

    } catch (err) {
      console.error("Error saving vehicle metadata:", err);
      alert("Could not commit database transactions.");
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

  // Delete a tag
  const handleDeleteTag = async (qrId: string) => {
    try {
      await deleteDoc(doc(db, 'tags', qrId));
      fetchAppCoreData();
    } catch (err) {
      alert("Error deleting tag registration.");
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
    const userLower = resellerForm.username.trim().toLowerCase();
    
    if (!userLower || !resellerForm.name || !resellerForm.contact || !resellerForm.password) {
      setResellerError('Username/ID, Name, Contact Phone, and Password are all required.');
      return;
    }

    const contactVal = validatePhoneNumber(resellerForm.contact);
    if (!contactVal.isValid) {
      setResellerError(`Invalid Contact Phone: ${contactVal.error}`);
      return;
    }

    try {
      setIsSavingReseller(true);

      // Check username isn't taken in resellers collection
      const resellerRef = doc(db, 'resellers', userLower);
      const testSnap = await getDoc(resellerRef);
      if (testSnap.exists()) {
        setResellerError('Username already exists. Please choose another.');
        setIsSavingReseller(false);
        return;
      }

      // Check username isn't taken in admins collection
      const adminRef = doc(db, 'admins', userLower);
      const testAdmin = await getDoc(adminRef);
      if (testAdmin.exists()) {
        setResellerError('This username is reserved as an administrator username.');
        setIsSavingReseller(false);
        return;
      }

      await setDoc(resellerRef, {
        name: resellerForm.name.trim(),
        contact: resellerForm.contact.trim(),
        password: resellerForm.password,
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
    } catch (err) {
      alert("Failed to remove reseller registration.");
    }
  };

  // Update reseller activation status with custom reason compatibility
  const handleUpdateResellerStatus = async (
    resellerId: string, 
    newStatus: 'active' | 'pending' | 'details_required' | 'suspended' | 'other',
    reason?: string
  ) => {
    // BACKEND VERIFICATION FLOW TRACING LOGS
    console.log(`%c[VERIFICATION FLOW TRACE - START]`, "color: #0F6E56; font-weight: bold; font-size: 13px;");
    console.log(`[VERIFICATION TRACE] Initiating agent activation status transition...`);
    console.log(`[VERIFICATION TRACE] --- Target Agent Username/ID: "${resellerId}"`);
    console.log(`[VERIFICATION TRACE] --- Transiting to new status: "${newStatus}"`);
    console.log(`[VERIFICATION TRACE] --- Included Reason/Rejection Text: "${reason || 'None provided'}"`);
    console.log(`[VERIFICATION TRACE] --- Initiated by logged in user: "${session?.username}" with role: "${session?.role}"`);

    // Requester authorization check
    if (session?.role !== 'super_admin') {
      const authErr = `Unauthorized status transition request by non-admin identity user "${session?.username}".`;
      console.error(`[VERIFICATION TRACE - ERROR] SECURITY POLICY BREACH:`, authErr);
      alert("Verification Failed: You must be signed in with a Super Admin identity block to approve or suspend field agent rosters.");
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

  // Render Login page if no session is set
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6" id="admin-login-screen">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 border border-slate-100 shadow-md flex flex-col animate-fade-in" id="admin-login-card">
          <div className="text-center mb-6" id="login-header">
            <div className="bg-[#0F6E56]/10 text-[#0F6E56] inline-flex p-4 rounded-2xl mb-4 shadow-3xs" id="login-logo-circle">
              <QrCode className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-sans font-black text-slate-800 tracking-tight" id="login-title">CallMe Tag</h1>
            <p className="text-xs text-slate-500 font-sans font-semibold mt-2" id="login-sub">
              {isRegisterMode ? 'Authorized Field Partner Registration' : 'Secure Field Agent Registry Admin'}
            </p>
          </div>

          {/* Tab Slider Selector */}
          <div className="flex bg-slate-100 p-1 rounded-xl mb-6 border border-slate-200/40" id="login-tabs">
            <button
              id="tab-login-btn"
              type="button"
              onClick={() => {
                setIsRegisterMode(false);
                setLoginError('');
                setRegError('');
                setRegSuccess('');
              }}
              className={`flex-1 py-2 text-xs font-bold font-sans rounded-lg transition-all ${
                !isRegisterMode
                  ? 'bg-white text-[#0F6E56] shadow-xs font-extrabold'
                  : 'text-slate-500 hover:text-slate-800'
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
              className={`flex-1 py-2 text-xs font-bold font-sans rounded-lg transition-all ${
                isRegisterMode
                  ? 'bg-white text-[#0F6E56] shadow-xs font-extrabold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Register Agent
            </button>
          </div>

          {!isRegisterMode ? (
            /* Log In Form */
            <form onSubmit={handleLogin} className="space-y-5" id="login-form">
              <div className="space-y-1.5 align-left text-left" id="login-user-group">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider text-left" htmlFor="username-input">
                  Username / Agent ID
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <User className="h-4 w-4" />
                  </span>
                  <input
                    id="username-input"
                    type="text"
                    placeholder="e.g. agent_dubai"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-sans text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6E56] focus:border-transparent transition-all"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5 text-left" id="login-pass-group">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider text-left" htmlFor="password-input">
                  Access Password
                </label>
                <input
                  id="password-input"
                  type="password"
                  placeholder="••••••••"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-sans text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6E56] focus:border-transparent transition-all"
                  required
                />
              </div>

              {loginError && (
                <div className="p-3 bg-rose-50 border border-rose-100/80 text-rose-600 text-xs rounded-lg font-medium flex items-center space-x-2" id="login-error-toast">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <button
                id="submit-login-btn"
                type="submit"
                disabled={loginLoading}
                className="w-full bg-[#0F6E56] hover:bg-[#0b5c47] text-white py-3 px-4 rounded-xl font-sans font-bold text-sm shadow-sm flex items-center justify-center space-x-2 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                {loginLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Enter Security Workspace</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Register Form */
            <form onSubmit={handleRegister} className="space-y-4" id="register-form">
              <div className="space-y-1.5 text-left" id="reg-user-group">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider text-left" htmlFor="reg-username">
                  Desired Username / Agent ID
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <User className="h-4 w-4" />
                  </span>
                  <input
                    id="reg-username"
                    type="text"
                    placeholder="e.g. agent_dubai"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-250 rounded-xl font-sans text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6E56] focus:border-transparent transition-all"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5 text-left" id="reg-name-group">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider text-left" htmlFor="reg-name">
                  Full Name / Agency Name
                </label>
                <input
                  id="reg-name"
                  type="text"
                  placeholder="e.g. Dubai Automobile Ltd"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-250 rounded-xl font-sans text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6E56] focus:border-transparent transition-all"
                  required
                />
              </div>

              <div className="space-y-1.5 text-left" id="reg-email-group">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider text-left" htmlFor="reg-email">
                  Email Address
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <Mail className="h-4 w-4" />
                  </span>
                  <input
                    id="reg-email"
                    type="email"
                    placeholder="e.g. agent@agency.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-250 rounded-xl font-sans text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6E56] focus:border-transparent transition-all"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5 text-left" id="reg-contact-group">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider text-left" htmlFor="reg-contact">
                  Mobile Phone Number
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <Phone className="h-4 w-4" />
                  </span>
                  <input
                    id="reg-contact"
                    type="tel"
                    placeholder="e.g. +971 50 123 4567"
                    value={regContact}
                    onChange={(e) => setRegContact(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-250 rounded-xl font-sans text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6E56] focus:border-transparent transition-all"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5 text-left" id="reg-pass-group">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider text-left" htmlFor="reg-password">
                  Choose Account Password
                </label>
                <input
                  id="reg-password"
                  type="password"
                  placeholder="••••••••"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-sans text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6E56] focus:border-transparent transition-all"
                  required
                />
              </div>

              {regError && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 text-xs rounded-lg font-medium flex items-center space-x-2" id="reg-error-toast">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{regError}</span>
                </div>
              )}

              {regSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs rounded-lg font-medium flex items-center space-x-2 animate-pulse" id="reg-success-toast">
                  <Check className="w-4 h-4 flex-shrink-0" />
                  <span>{regSuccess}</span>
                </div>
              )}

              <button
                id="submit-register-btn"
                type="submit"
                disabled={regLoading}
                className="w-full bg-[#0F6E56] hover:bg-[#0b5c47] text-white py-3 px-4 rounded-xl font-sans font-bold text-sm shadow-sm flex items-center justify-center space-x-2 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                {regLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Become Registered Partner</span>
                  </>
                )}
              </button>
            </form>
          )}

          <div className="mt-6 text-center text-[10px] text-slate-400 leading-relaxed font-semibold border-t border-slate-50 pt-4" id="login-footer">
            Dubai QR Contact Management System • Version 1.5 <br />
            {isRegisterMode ? 'Already have credentials? Switch to the Sign In tab.' : 'Need credentials or help? Contact your Supervisor.'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col md:flex-row" id="admin-main-screen">
      
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-[#0F6E56] text-white flex flex-col justify-between shadow-md" id="admin-sidebar">
        <div id="sidebar-top">
          {/* Brand header */}
          <div className="p-6 border-b border-white/10 flex items-center space-x-3" id="sidebar-brand">
            <QrCode className="w-6.5 h-6.5 text-teal-200" />
            <div>
              <h1 className="text-lg font-black tracking-tight leading-none">CallMe Tag</h1>
              <p className="text-[10px] text-teal-150 font-bold tracking-wider mt-1 uppercase opacity-80">Workspace Admin</p>
            </div>
          </div>

          {/* User profile capsule info */}
          <div className="p-4 bg-teal-850/30 m-3 rounded-xl border border-white/5 flex items-center space-x-3" id="sidebar-user">
            <div className="bg-white/10 p-2 rounded-lg text-teal-100 flex-shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div className="overflow-hidden">
              <p className="text-xs text-teal-200 uppercase font-black tracking-wider leading-none">
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
                  ? 'bg-white text-[#0F6E56] shadow-sm font-black' 
                  : 'hover:bg-white/5 text-teal-100'
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
                    ? 'bg-white text-[#0F6E56] shadow-sm font-black' 
                    : 'hover:bg-white/5 text-teal-100'
                }`}
              >
                <Users className="w-4.5 h-4.5" />
                <span>Field Resellers</span>
              </button>
            )}
          </nav>
        </div>

        {/* Sidebar Log out footer */}
        <div className="p-4 border-t border-white/10 bg-black/5" id="sidebar-bottom">
          <button
            id="logout-btn"
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 px-3 py-2.5 bg-white/10 hover:bg-white/15 text-white hover:text-red-200 transition-colors text-xs font-bold tracking-wider uppercase rounded-lg"
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
                       <span className="font-extrabold text-[#0F6E56]">Admin Notice:</span>
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
        <header className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 pb-5 border-b border-slate-200 gap-4" id="main-header">
          <div>
            <h2 className="text-2xl font-sans font-black text-slate-800 tracking-tight" id="main-header-title">
              {activeTab === 'tags' ? 'CallMe Tag Physical Stickers' : 'CallMe Field Agents / Resellers'}
            </h2>
            <p className="text-sm text-slate-500 font-medium" id="main-header-sub">
              {activeTab === 'tags' 
                ? 'Register vehicle owners, print offline QR1 tel codes, and configure smart Dynamic QR2 cards.' 
                : 'Create and audit registered on-site agents and resellers.'}
            </p>
          </div>

          <div className="flex items-center space-x-3 self-start md:self-auto" id="header-actions">
            <button
              id="refresh-data-btn"
              onClick={fetchAppCoreData}
              disabled={loadingData}
              className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-[#0F6E56] active:scale-95 disabled:opacity-50 transition-all hover:bg-slate-50"
              title="Refresh core data"
            >
              <RefreshCw className={`w-4 h-4 ${loadingData ? 'animate-spin' : ''}`} />
            </button>

            {activeTab === 'tags' && (() => {
              const isPending = session?.role === 'reseller' && session?.status !== 'active';
              return (
                <button
                  id="create-new-tag-btn"
                  onClick={isPending ? () => alert("Registration Pending: Your agent account is currently awaiting verification. Please wait for an administrator to activate your workspace.") : handleOpenCreateTag}
                  className={`${
                    isPending 
                      ? 'bg-slate-200 border border-slate-300 text-slate-400 cursor-not-allowed opacity-85' 
                      : 'bg-[#0F6E56] hover:bg-[#0b5c47] text-white active:scale-95'
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
                className="bg-[#0F6E56] hover:bg-[#0b5c47] text-white px-4 py-2.5 rounded-xl font-sans text-xs font-bold tracking-wider uppercase shadow-sm flex items-center space-x-2 active:scale-95 transition-all"
              >
                <Plus className="w-4.5 h-4.5" />
                <span>Add Reseller Agent</span>
              </button>
            )}
          </div>
        </header>

        {/* Stats Section Cards Header */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8" id="dashboard-stats-rows">
          <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-xs flex items-center justify-between" id="stat-total-tags">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">Registered Tags</p>
              <h3 className="text-2xl font-sans font-black text-slate-800 mt-2">{stats.totalTags}</h3>
            </div>
            <div className="bg-[#0F6E56]/10 text-[#0F6E56] p-3 rounded-xl">
              <QrCode className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-xs flex items-center justify-between" id="stat-active-tags">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">Active Connections</p>
              <h3 className="text-2xl font-sans font-black text-emerald-750 mt-2">{stats.activeTags}</h3>
            </div>
            <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl">
              <Check className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-xs flex items-center justify-between" id="stat-scans">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">QR2 Web Page Views</p>
              <h3 className="text-2xl font-sans font-black text-indigo-750 mt-2">{stats.totalScans}</h3>
            </div>
            <div className="bg-indigo-50 text-indigo-600 p-3 rounded-xl">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
        </section>

        {/* Tab 1: Tags Table */}
        {activeTab === 'tags' && (
          <div className="bg-white rounded-2xl border border-slate-150 shadow-xs overflow-hidden" id="tags-main-section">
            
            {/* Table Search & Filters */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3" id="filters-container">
              <div className="relative flex-1" id="filter-search-group">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  id="tag-search-box"
                  type="text"
                  placeholder="Search by owner name, phone number, plate or QR ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9.5 pr-4 py-2.5 bg-white border border-slate-250 rounded-xl font-sans text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6E56] focus:border-transparent transition-all"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3" id="all-filters-inputs">
                {/* Status selector */}
                <div className="flex items-center space-x-2" id="filter-status-group">
                  <ListFilter className="w-4 h-4 text-slate-400" />
                  <select
                    id="filter-status-select"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="px-3 py-2 bg-white border border-slate-200 font-sans text-xs font-semibold uppercase tracking-wider rounded-xl text-slate-600 focus:outline-none"
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
                    className="px-3 py-2 bg-white border border-slate-200 font-sans text-xs font-semibold uppercase tracking-wider rounded-xl text-slate-600 focus:outline-none"
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
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#0F6E56] mx-auto" />
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
                            <div className="inline-flex items-center space-x-1.5 font-mono text-sm font-extrabold text-[#0F6E56] bg-[#0F6E56]/5 p-2 px-3 rounded-lg border border-[#0F6E56]/10 w-fit" id={`tagid-${tag.qr_id}`}>
                              <span>{tag.qr_id}</span>
                            </div>
                            <a
                              id={`preview-link-table-${tag.qr_id}`}
                              href={`/?qr=${tag.qr_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-slate-500 hover:text-[#0F6E56] transition-colors w-fit flex items-center space-x-1 font-semibold pl-1"
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

                        {/* Dubai Car Plate */}
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
                              className="p-1.5 bg-[#0F6E56]/10 border border-[#0F6E56]/20 text-[#0F6E56] hover:bg-[#0F6E56] hover:text-white rounded-lg active:scale-95 transition-all flex items-center justify-center"
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
                                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-[#0F6E56] hover:bg-white'
                              }`}
                              title={isPending ? "Verification Pending - Output disabled" : "Print / Output QR Codes"}
                            >
                              <QrCode className="w-4 h-4" />
                            </button>

                            {/* Scan log tracker */}
                            <button
                              id={`view-logs-btn-${tag.qr_id}`}
                              onClick={() => handleViewLogs(tag)}
                              className="p-1.5 bg-slate-50 border border-slate-200 text-slate-600 hover:text-[#0F6E56] rounded-lg hover:bg-white active:scale-95 transition-all flex items-center space-x-1"
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
                                  : 'bg-[#0F6E56]/5 text-[#0F6E56] border-[#0F6E56]/15 hover:bg-[#0F6E56] hover:text-white hover:border-transparent'
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
          <div className="bg-white rounded-2xl border border-slate-150 shadow-xs overflow-hidden" id="resellers-main-section">
            <div className="overflow-x-auto" id="resellers-table-wrapper">
              {loadingData ? (
                <div className="p-12 text-center" id="resellers-loading-state">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#0F6E56] mx-auto" />
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
                            <span className="font-mono text-xs font-extrabold text-[#0F6E56] bg-[#0F6E56]/5 p-2 px-3 rounded-lg border border-[#0F6E56]/10">
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
                                <span className="font-sans text-[11px] text-[#0F6E56] font-medium hover:underline">
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
                                 className="bg-white border border-slate-250 text-xs text-slate-800 rounded-lg p-1.5 px-2 font-bold focus:ring-2 focus:ring-[#0F6E56]/20 focus:border-[#0F6E56] transition-all outline-none cursor-pointer hover:bg-slate-50/50"
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

      </main>

      {/* MODAL 1: Create / Edit Tag metadata form layout */}
      {showTagModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto" id="tag-modal-container">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 md:p-8 shadow-2xl border border-slate-100 flex flex-col space-y-6" id="tag-modal-card">
            
            <header className="flex items-center justify-between border-b border-slate-100 pb-4" id="tag-modal-header">
              <h3 className="text-xl font-sans font-black text-slate-800 tracking-tight">
                {modalMode === 'create' ? 'Dubaian Vehicle On-Site Tag Registration' : 'Edit Registered CallMe Tag'}
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
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F6E56] focus:border-transparent transition-all"
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
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F6E56] focus:border-transparent transition-all"
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

              {/* Dubai Registered Plate (Optional) */}
              <div className="space-y-1" id="input-plate-group">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider" htmlFor="plate-input">
                  Dubai Plate Number <span className="text-slate-300 italic font-medium">(Optional)</span>
                </label>
                <input
                  id="plate-input"
                  type="text"
                  placeholder="e.g. DUBAI C - 73849"
                  value={formFields.plate_number}
                  onChange={(e) => setFormFields({...formFields, plate_number: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F6E56] focus:border-transparent transition-all"
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
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F6E56] focus:border-transparent transition-all"
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
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F6E56] focus:border-transparent transition-all"
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
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F6E56] focus:border-transparent transition-all font-semibold"
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
                  className="px-6 py-2.5 bg-[#0F6E56] hover:bg-[#0b5c47] text-white rounded-xl text-xs font-bold tracking-wider uppercase shadow-sm flex items-center space-x-2 transition-all active:scale-95 disabled:opacity-50"
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

      {/* MODAL 2: QR Generated Output Screen for Download */}
      {showQROutputModal && lastGeneratedTag && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto" id="qr-output-container">
          <div className="bg-white rounded-3xl w-full max-w-2xl p-6 md:p-8 shadow-2xl border border-slate-100 flex flex-col space-y-6" id="qr-output-card">
            
            <header className="flex items-center justify-between border-b border-slate-100 pb-4" id="qr-output-header">
              <div>
                <span className="text-[10px] bg-[#0F6E56]/10 text-[#0F6E56] font-bold p-1 px-2.5 rounded-full uppercase tracking-widest font-sans">
                  Ready for Local Label Printing
                </span>
                <h3 className="text-xl font-sans font-black text-slate-800 tracking-tight mt-1">
                  Tag Generated: <span className="text-[#0F6E56] font-mono">{lastGeneratedTag.qr_id}</span>
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

            <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs rounded-2xl flex items-start space-x-2.5 leading-relaxed" id="qr-output-success-banner">
              <Check className="w-5 h-5 flex-shrink-0 text-emerald-600 mt-0.5" />
              <div>
                <strong className="font-extrabold uppercase tracking-wider block mb-0.5">Physical Stickers Generated!</strong>
                Details for <strong className="font-bold">{lastGeneratedTag.owner_name}</strong> are secured. Download the matching high-resolution PNG stickers sized perfectly for standard 30mm x 30mm label printing.
              </div>
            </div>

            {/* Split Row representing printed stickers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2" id="qr-sticker-row">
              {/* QR1 Sticker */}
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-center flex flex-col items-center justify-between space-y-4" id="qr1-display-card">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-[#0F6E56]">STICKER 1: Static QR</h4>
                  <p className="text-[10px] text-slate-400 font-semibold mt-1">Encoded Direct Call: <span className="font-mono">{lastGeneratedTag.phone_number}</span></p>
                  <p className="text-[9px] text-amber-600 bg-amber-50 p-1 px-2 rounded font-sans mt-2 inline-block">100% Offline-Capable</p>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200.5 flex items-center justify-center shadow-xs" id="qr1-sticker-box">
                  <img
                    id="sticker-qr1-img"
                    src={currentQR1Url}
                    alt="QR1 (Static)"
                    className="w-40 h-40 object-contain aspect-square referrerPolicy='no-referrer'"
                  />
                </div>

                <button
                  id="download-qr1-btn"
                  onClick={() => handleDownloadQR(currentQR1Url, 'QR1_static')}
                  className="w-full bg-[#0F6E56] hover:bg-[#0b5c47] text-white py-2.5 px-4 rounded-xl font-sans font-extrabold text-xs tracking-wider uppercase shadow-xs flex items-center justify-center space-x-1.5 transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Download QR1 PNG</span>
                </button>
              </div>

              {/* QR2 Sticker */}
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-center flex flex-col items-center justify-between space-y-4" id="qr2-display-card">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-[#0F6E56]">STICKER 2: Dynamic Web Portal</h4>
                  <p className="text-[10px] text-slate-400 font-semibold mt-1">Saves scan date & masks user phone number</p>
                  <p className="text-[9px] text-[#0F6E56] bg-teal-50 p-1 px-2 rounded font-sans mt-2 inline-block">Secure Masked Routing Page</p>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-205 flex items-center justify-center shadow-xs" id="qr2-sticker-box">
                  <img
                    id="sticker-qr2-img"
                    src={currentQR2Url}
                    alt="QR2 (Dynamic)"
                    className="w-40 h-40 object-contain aspect-square referrerPolicy='no-referrer'"
                  />
                </div>

                <div className="flex flex-col space-y-2 w-full" id="qr2-action-group">
                  <button
                    id="download-qr2-btn"
                    onClick={() => handleDownloadQR(currentQR2Url, 'QR2_dynamic')}
                    className="w-full bg-[#0F6E56] hover:bg-[#0b5c47] text-white py-2.5 px-4 rounded-xl font-sans font-extrabold text-xs tracking-wider uppercase shadow-xs flex items-center justify-center space-x-1.5 transition-all"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download QR2 PNG</span>
                  </button>
                  <a
                    id="preview-new-qr2-live-btn"
                    href={`/?qr=${lastGeneratedTag.qr_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 px-4 rounded-xl font-sans font-bold text-xs tracking-wider uppercase shadow-xs flex items-center justify-center space-x-1.5 transition-all border border-slate-200"
                  >
                    <ExternalLink className="w-4 h-4 text-slate-500" />
                    <span>Test / Preview Webpage</span>
                  </a>
                </div>
              </div>
            </div>

            <footer className="pt-4 border-t border-slate-100 flex justify-end" id="qr-output-footer">
              <button
                id="close-qr-output-footer-btn"
                onClick={() => setShowQROutputModal(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-sans font-bold text-xs uppercase tracking-wider px-6 py-2.5 rounded-xl transition-all"
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
              {/* Username ID */}
              <div className="space-y-1" id="reseller-user-group">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider" htmlFor="reseller-user-input">
                  Partner login username/ID*
                </label>
                <input
                  id="reseller-user-input"
                  type="text"
                  required
                  placeholder="e.g. agent_jebelali"
                  value={resellerForm.username}
                  onChange={(e) => setResellerForm({...resellerForm, username: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F6E56] focus:border-transparent transition-all"
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
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F6E56] focus:border-transparent transition-all"
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
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F6E56] focus:border-transparent transition-all"
                />
              </div>

              {/* Reseller Password */}
              <div className="space-y-1" id="reseller-pass-group">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider" htmlFor="reseller-pass-input">
                  Agent login password*
                </label>
                <input
                  id="reseller-pass-input"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={resellerForm.password}
                  onChange={(e) => setResellerForm({...resellerForm, password: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6E56] focus:border-transparent transition-all"
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
                  className="px-6 py-2.5 bg-[#0F6E56] hover:bg-[#0b5c47] text-white rounded-xl text-xs font-bold tracking-wider uppercase shadow-sm flex items-center space-x-2 transition-all active:scale-95 disabled:opacity-50"
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
                <span className="text-[10px] bg-[#0F6E56]/15 text-[#0F6E56] font-bold py-1 px-2.5 rounded-full uppercase tracking-wider">
                  Registry Activity Log
                </span>
                <h3 className="text-lg font-sans font-black text-slate-800 tracking-tight mt-1">
                  Tag: <span className="font-mono text-[#0F6E56]">{selectedTagForLogs.qr_id}</span>
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
                  <div className="bg-emerald-50/50 border border-emerald-100 p-3 rounded-xl text-center">
                    <p className="text-[9px] font-bold text-emerald-600 uppercase">Live QR2 Scans</p>
                    <p className="text-lg font-mono font-black text-[#0F6E56] mt-0.5">{tagLogs.length}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl text-center">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">QR1 Offline Calls</p>
                    <p className="text-xs text-slate-400 italic mt-2 leading-none">Not Logged (100% Offline)</p>
                  </div>
                </div>
              </div>

              {loadingTagLogs ? (
                <div className="p-8 text-center" id="logs-loading">
                  <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-[#0F6E56] mx-auto" />
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
                        <div className="bg-[#0F6E56]/15 text-[#0F6E56] p-2 rounded-lg">
                          <QrCode className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-extrabold text-[#0F6E56] leading-none uppercase">QR2 Digital View</p>
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
                 className="text-slate-400 hover:text-[#0F6E56] font-sans font-black text-xl leading-none transition-colors"
               >
                 ×
               </button>
             </header>
 
             <div className="space-y-4 font-sans text-sm">
               <p className="text-slate-500 font-medium leading-relaxed">
                 Configure the active workstation status for agent <span className="font-bold text-[#0F6E56] font-mono">{statusModalAgentId}</span>.
               </p>
 
               {/* Status Select dropdown */}
               <div className="space-y-1">
                 <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                   Verification Status
                 </label>
                 <select
                   value={statusModalSelected}
                   onChange={(e) => setStatusModalSelected(e.target.value as any)}
                   className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-[#0F6E56]/20 focus:border-[#0F6E56] transition-all outline-none"
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
                     className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-850 focus:ring-2 focus:ring-[#0F6E56]/20 focus:border-[#0F6E56] transition-all outline-none"
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
                 className="px-4 py-2.5 bg-[#0F6E56] hover:bg-[#0b5c47] text-white rounded-xl text-xs font-bold font-sans uppercase tracking-wider transition-colors disabled:opacity-50"
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
