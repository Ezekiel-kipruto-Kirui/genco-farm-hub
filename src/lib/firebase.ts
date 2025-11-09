import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
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
