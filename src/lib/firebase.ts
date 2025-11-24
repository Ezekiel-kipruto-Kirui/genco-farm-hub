import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  query,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

// Load from .env (must use VITE_ prefix)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID,
  measurementId: import.meta.env.VITE_MEASUREMENT_ID,
};

// Initialize services
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Prevent analytics crash in non-browser environments
export const analytics =
  typeof window !== "undefined" ? getAnalytics(app) : null;

// Helper function to fetch any collection
export const fetchCollection = async (collectionName: string) => {
  try {
    const q = query(collection(db, collectionName));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (err) {
    console.error("Error fetching:", err);
    throw err;
  }
};

// Fetch all your collections at once
export const fetchData = async () => {
  try {
    const [
      livestock,
      fodder,
      infrastructure,
      BoreholeStorage,
      capacity,
      lofftake,
      fofftake,
      users,
    ] = await Promise.all([
      fetchCollection("Livestock Farmers"),
      fetchCollection("Fodder Farmers"),
      fetchCollection("Infrastructure Data"),
      fetchCollection("BoreholeStorage"),
      fetchCollection("Capacity Building"),
      fetchCollection("Livestock Offtake Data"),
      fetchCollection("Fodder Offtake Data"),
      fetchCollection("users"),
    ]);

    return {
      livestock,
      fodder,
      infrastructure,
      BoreholeStorage,
      capacity,
      lofftake,
      fofftake,
      users,
    };
  } catch (error) {
    console.error("Error fetching all data:", error);
    throw error;
  }
};
