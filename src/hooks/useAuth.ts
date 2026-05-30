import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, DocumentSnapshot, DocumentData } from 'firebase/firestore';
import { UserProfile } from '../types';
import { generateNextCustomerNumber } from '../useCustomer';
import { cleanObject } from '../utils/firebaseHelpers';

export function useAuth() {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    let unsubUserDoc: (() => void) | null = null;

    console.log("[DEBUG-FIRESTORE] Registering onAuthStateChanged listener...");
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("[DEBUG-FIRESTORE] onAuthStateChanged fired. User:", user?.email || "none");
      setCurrentUser(user);
      if (user) {
        const userEmail = user.email ? user.email.toLowerCase().trim() : '';
        let resolvedIsAdmin = false;

        // TAREA 1: Normalización de entrada y consulta dinámica a la lista blanca
        if (userEmail) {
          if (userEmail === 'palavecinojuann@gmail.com') {
            resolvedIsAdmin = true;
          } else {
            try {
              console.log(`[DEBUG-FIRESTORE] getDoc 'preAuthorizedAdmins/${userEmail}'...`);
              const preAuthSnap = await getDoc(doc(db, 'preAuthorizedAdmins', userEmail));
              if (preAuthSnap.exists()) {
                resolvedIsAdmin = true;
              }
            } catch (e) {
              // TAREA 1: Sanitización de permisos (captura silenciosa)
              resolvedIsAdmin = false;
            }
          }
        }

        console.log("[DEBUG-FIRESTORE] Auth evaluation: isAdmin =", resolvedIsAdmin);
        setIsAdmin(resolvedIsAdmin);

        const userRef = doc(db, 'users', user.uid);
        console.log(`[DEBUG-FIRESTORE] Subscribing to user doc snapshot 'users/${user.uid}'...`);
        unsubUserDoc = onSnapshot(userRef, async (docSnap) => {
          console.log(`[DEBUG-FIRESTORE] 'users/${user.uid}' doc snapshot callback fired. Exists:`, docSnap.exists());
          if (docSnap.exists()) {
            const userData = docSnap.data();
            let role = userData.role;
            let finalUserProfile = { ...userData } as UserProfile;

            // Sincronizar rol de administrador en base de datos si es necesario
            if (resolvedIsAdmin && role !== 'admin' && role !== 'superadmin' && role !== 'collaborator') {
              try {
                let preAuthRole: any = 'admin';
                if (userEmail !== 'palavecinojuann@gmail.com') {
                  const preAuthSnap = await getDoc(doc(db, 'preAuthorizedAdmins', userEmail));
                  if (preAuthSnap.exists()) {
                    preAuthRole = preAuthSnap.data().role || 'admin';
                  }
                } else {
                  preAuthRole = 'superadmin';
                }
                role = preAuthRole;
                await setDoc(userRef, { role: preAuthRole }, { merge: true });
                finalUserProfile.role = preAuthRole;
              } catch (e) {
                console.warn("Could not check/sync preAuthorizedAdmins role for existing user:", e);
              }
            }

            setIsAdmin(resolvedIsAdmin);
            setUserProfile(finalUserProfile);
          } else {
            // Si no está en users, y es admin pre-autorizado, creamos el perfil oficial
            if (resolvedIsAdmin && userEmail) {
              try {
                let preAuthRole: any = 'admin';
                if (userEmail !== 'palavecinojuann@gmail.com') {
                  const preAuthSnap = await getDoc(doc(db, 'preAuthorizedAdmins', userEmail));
                  if (preAuthSnap.exists()) {
                    preAuthRole = preAuthSnap.data().role || 'admin';
                  }
                } else {
                  preAuthRole = 'superadmin';
                }
                
                // Creamos el perfil de usuario oficial
                const newUser = {
                  id: user.uid,
                  uid: user.uid,
                  email: user.email,
                  role: preAuthRole,
                  createdAt: new Date().toISOString(),
                  name: user.displayName || 'Administrador',
                  level: 'bronce',
                  referralCode: `JANLU-${user.uid.substring(0, 4).toUpperCase()}`,
                  referralPoints: 0,
                  joinedAt: new Date().toISOString()
                };
                await setDoc(userRef, newUser);
              } catch (e) {
                console.warn("Could not check/sync preAuthorizedAdmins role for new user:", e);
              }
            }
          }
          setIsAuthReady(true);
        });

      } else {
        setIsAdmin(false);
        setUserProfile(null);
        if (unsubUserDoc) unsubUserDoc();
        setIsAuthReady(true);
      }
    });

    return () => {
      unsubscribe();
      if (unsubUserDoc) unsubUserDoc();
    };
  }, []);

  return {
    currentUser,
    userProfile,
    isAdmin,
    isAuthReady,
    setUserProfile
  };
}
