import { database, hasFirebaseRuntimeConfig } from '../firebase';

export function hasFirebaseConfig() {
  return hasFirebaseRuntimeConfig();
}

export function getFirebaseDatabase() {
  if (!hasFirebaseRuntimeConfig()) return null;
  return database;
}
