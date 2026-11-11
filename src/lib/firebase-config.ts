/** Firebase web config for the safe-ride project. These values are public by design (they ship to every browser). */
export const firebaseConfig = {
  apiKey: "AIzaSyAYayZdBAeaoMs2hEkv2Y7C-tCM5GOc-AE",
  authDomain: "safe-ride-b10f8.firebaseapp.com",
  databaseURL: "https://safe-ride-b10f8-default-rtdb.firebaseio.com",
  projectId: "safe-ride-b10f8",
  storageBucket: "safe-ride-b10f8.firebasestorage.app",
  messagingSenderId: "38340951191",
  appId: "1:38340951191:web:aafe6fb308d3918c3efdd2",
  measurementId: "G-TVHE1GTK35",
};

/** The user's own R2 upload worker (token lives in the R2_UPLOAD_TOKEN secret, server-side only). */
export const UPLOAD_BASE = "https://moviemax-upload.nexusplatformafrica.workers.dev";
