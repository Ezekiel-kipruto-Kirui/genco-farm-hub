import { initializeApp } from "firebase/app";
import { getFirestore,collection,
    getDocs,
    query, } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";


const firebaseConfig = {
  apiKey: "AIzaSyD8_g861hnTB35O9ZPuUqsQN1C8M_i9voY",
  authDomain: "genco-company.firebaseapp.com",
  projectId: "genco-company",
  storageBucket: "genco-company.appspot.com",
  messagingSenderId: "941079884478",
  appId: "1:941079884478:web:38a203fa4b588a620a64ef",
  measurementId: "G-RS4R639KKY",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const analytics = getAnalytics(app);


// Helper function to fetch data from Firestore
export const fetchCollection = async (collectionName) => {
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


// Fetch data from specific collections
export const fetchData = async () => {
    try {
        const [livestock, fodder, infrastructure, capacity, offtake, offtake0, users] = await Promise.all([
            fetchCollection("Livestock Farmers"),
            fetchCollection("Fodder Farmers"),
            fetchCollection("Infrastructure Data"),
            fetchCollection("Capacity Building"),
            fetchCollection("Livestock Offtake Data"),
            fetchCollection("Fodder Offtake Data"),
            fetchCollection("users"), // Fetch users collection
          
        ]);

        return { livestock, fodder, infrastructure, capacity, offtake, offtake0, users};
    } catch (error) {
        console.error("Error fetching all data:", error);
        throw error;
    }
};