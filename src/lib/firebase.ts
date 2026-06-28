import { initializeApp } from 'firebase/app';
import { initializeFirestore, memoryLocalCache } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  projectId: "quaint-entropy-bd2jw",
  appId: "1:836500436144:web:775686f640ebe25b2a3775",
  apiKey: "AIzaSyCZbYbo9Vc3niycYSe8E9TwebVlQXwWCNA",
  authDomain: "quaint-entropy-bd2jw.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-63101162-0252-45aa-a16b-3173d54f0814",
  storageBucket: "quaint-entropy-bd2jw.firebasestorage.app",
  messagingSenderId: "836500436144",
  measurementId: ""
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with the explicit databaseId, forcing long polling and using memory-only cache
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  localCache: memoryLocalCache()
}, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth(app);

