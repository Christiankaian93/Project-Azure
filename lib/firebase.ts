import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDzuXLV_1paZH9h4Nm9W_xFHa7FT_F5oxA",
  authDomain: "jtsproject-32d8c.firebaseapp.com",
  projectId: "jtsproject-32d8c",
  storageBucket: "jtsproject-32d8c.firebasestorage.app",
  messagingSenderId: "794321751172",
  appId: "1:794321751172:web:4f26b387383d58756ac6d1",
  measurementId: "G-PMP3CB3ERG"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
