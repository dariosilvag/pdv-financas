import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyDl-QOb_ipTKoIM2hqtN6Vo-YAdSnHFJ4w",
  authDomain: "pdv-financas.firebaseapp.com",
  projectId: "pdv-financas",
  storageBucket: "pdv-financas.firebasestorage.app",
  messagingSenderId: "23783995955",
  appId: "1:23783995955:web:28a9b81cc6c047b4df0146"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Storage
export const storage = getStorage(app);

// Initialize Auth with persistence (even if not fully used yet, good for future)
// export const auth = initializeAuth(app, {
//   persistence: getReactNativePersistence(AsyncStorage)
// });

export default app;
