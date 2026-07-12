// js/config/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDjF1illbzpLWtNkWLdaTkE3NH1GACkkWE",
  authDomain: "pamirnation.firebaseapp.com",
  projectId: "pamirnation",
  storageBucket: "pamirnation.firebasestorage.app",
  messagingSenderId: "556501098729",
  appId: "1:556501098729:web:2952079224ab1319731078",
  measurementId: "G-H0S60RS4NB"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
