export interface Tag {
  qr_id: string;
  owner_name: string;
  phone_number: string;
  plate_number?: string;
  emergency_contact_name?: string;
  emergency_contact_number?: string;
  status: 'active' | 'paused';
  created_by: string; // reseller_id or "admin"
  created_at: any; // firestore timestamp
  updated_at: any; // firestore timestamp
}

export interface ScanLog {
  id: string;
  qr_id: string;
  scanned_at: any; // firestore timestamp
  qr_type: 'qr2_webapp';
}

export interface Reseller {
  reseller_id: string; // firestore doc ID (also used as login username/ID)
  name: string;
  contact: string;
  email?: string;
  status?: 'active' | 'pending' | 'details_required' | 'suspended' | 'other';
  status_reason?: string;
  created_at: any; // firestore timestamp
}

export interface UserSession {
  username: string;
  role: 'super_admin' | 'reseller';
  reseller_id?: string;
  status?: 'active' | 'pending' | 'details_required' | 'suspended' | 'other';
}
