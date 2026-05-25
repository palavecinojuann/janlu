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

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        unsubUserDoc = onSnapshot(userRef, async (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data();
            let role = userData.role;
            let finalUserProfile = { ...userData } as UserProfile;

            // Si ya existe pero no es admin, comprobamos si fue pre-autorizado por las dudas
            if (role !== 'admin' && role !== 'superadmin' && role !== 'collaborator' && user.email) {
              try {
                const exactEmail = user.email.trim();
                const lowerEmail = user.email.toLowerCase().trim();
                
                let preAuthRole = null;
                const exactSnap = await getDoc(doc(db, 'preAuthorizedAdmins', exactEmail));
                if (exactSnap.exists()) preAuthRole = exactSnap.data().role || 'admin';
                
                if (!preAuthRole && lowerEmail !== exactEmail) {
                  const lowerSnap = await getDoc(doc(db, 'preAuthorizedAdmins', lowerEmail));
                  if (lowerSnap.exists()) preAuthRole = lowerSnap.data().role || 'admin';
                }

                if (preAuthRole) {
                  role = preAuthRole;
                  await setDoc(userRef, { role: preAuthRole }, { merge: true });
                  finalUserProfile.role = preAuthRole;
                }
              } catch (e) {
                console.warn("Could not check preAuthorizedAdmins for existing user:", e);
              }
            }

            setIsAdmin(role === 'admin' || role === 'superadmin' || role === 'collaborator');
            setUserProfile(finalUserProfile);
          } else {
            // Si no está en users, buscamos en preAuthorizedAdmins por su email
            if (user.email) {
              try {
                const exactEmail = user.email.trim();
                const lowerEmail = user.email.toLowerCase().trim();
                
                let preAuthRole = null;
                const exactSnap = await getDoc(doc(db, 'preAuthorizedAdmins', exactEmail));
                if (exactSnap.exists()) preAuthRole = exactSnap.data().role || 'admin';
                
                if (!preAuthRole && lowerEmail !== exactEmail) {
                  const lowerSnap = await getDoc(doc(db, 'preAuthorizedAdmins', lowerEmail));
                  if (lowerSnap.exists()) preAuthRole = lowerSnap.data().role || 'admin';
                }

                if (preAuthRole) {
                  setIsAdmin(preAuthRole === 'admin' || preAuthRole === 'superadmin');
                  
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
                } else {
                  setIsAdmin(false);
                }
              } catch (e) {
                console.warn("Could not check preAuthorizedAdmins for new user:", e);
                setIsAdmin(false);
              }
            } else {
              setIsAdmin(false);
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
