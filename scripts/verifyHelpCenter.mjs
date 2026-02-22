import { initializeApp } from "firebase/app";
import { collection, getDocs, getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyDKAvnU3DwhQbGI8ay1mscdU0tVl51QTIQ",
    authDomain: "ruvo-app-99c85.firebaseapp.com",
    projectId: "ruvo-app-99c85",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function verify() {
    console.log("Reading help_categories...");
    const snap = await getDocs(collection(db, "help_categories"));
    console.log(`Found ${snap.size} categories`);
    snap.forEach(doc => console.log(doc.id));
    process.exit(0);
}

verify();
