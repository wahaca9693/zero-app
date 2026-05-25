import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyD14MBCXN9FiTqJjUqTUQY5mt6XdHdh-TE",
  authDomain: "rwaq-1ec72.firebaseapp.com",
  databaseURL: "https://rwaq-1ec72-default-rtdb.firebaseio.com",
  projectId: "rwaq-1ec72",
  storageBucket: "rwaq-1ec72.appspot.com",
  messagingSenderId: "711828603817",
  appId: "1:711828603817:web:7e23007cc21ca3271e7ab8"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
export const storage = getStorage(app);
