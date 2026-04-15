import { getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'fruit-shooter-858d3',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '1:530612184013:web:b709bf2e66751504959a84',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? 'fruit-shooter-858d3.firebasestorage.app',
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'AIzaSyBC519zIgkr2d06n0Ivxx_F9-MzDR45w48',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'fruit-shooter-858d3.firebaseapp.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '530612184013',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? 'G-1SCEK12EMH',
  projectNumber: import.meta.env.VITE_FIREBASE_PROJECT_NUMBER ?? '530612184013',
  version: '2',
};

const databaseURL = import.meta.env.VITE_FIREBASE_DATABASE_URL;

const isConfigured = Boolean(
  firebaseConfig.apiKey
  && firebaseConfig.authDomain
  && firebaseConfig.projectId
  && firebaseConfig.appId
  && databaseURL,
);
const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);

export const firebaseApp = app;
export const auth = getAuth(app);
export const database = getDatabase(app, databaseURL);
export function hasFirebaseRuntimeConfig() {
  return isConfigured;
}