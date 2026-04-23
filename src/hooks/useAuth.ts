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

      if (unsubUserDoc) {
        unsubUserDoc();
        unsubUserDoc = null;
      }

      if (user) {
        // Optimistic admin grant for the owner
        if (user.email === 'palavecinojuann@gmail.com') {
          setIsAdmin(true);
        }

        try {
          const userRef = doc(db, 'users', user.uid);
          const getDocPromise = getDoc(userRef);
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout fetching user role')), 5000)
          );

          const userDoc = await Promise.race([getDocPromise, timeoutPromise]) as DocumentSnapshot<DocumentData>;

          if (!userDoc.exists()) {
            if (user.email === 'palavecinojuann@gmail.com') {
              const newAdmin = {
                id: user.uid,
                uid: user.uid,
                email: user.email,
                role: 'admin',
                createdAt: new Date().toISOString(),
                name: user.displayName || 'Juan Palavecino',
                level: 'bronce',
                referralCode: `JANLU-${user.uid.substring(0, 4).toUpperCase()}`,
                referralPoints: 0,
                joinedAt: new Date().toISOString(),
              };
              await setDoc(userRef, newAdmin);
            } else {
              let preAuthRole: string | null = null;
              if (user.email) {
                try {
                  const preAuthDoc = await getDoc(doc(db, 'preAuthorizedAdmins', user.email));
                  if (preAuthDoc.exists()) {
                    preAuthRole = preAuthDoc.data().role || 'admin';
                  }
                } catch (e) {
                  console.error("Error checking pre-auth:", e);
                }
              }

              const newUser = {
                id: user.uid,
                uid: user.uid,
                email: user.email,
                role: preAuthRole || 'customer',
                createdAt: new Date().toISOString(),
                name: user.displayName || 'Nuevo Usuario',
                level: 'bronce',
                referralCode: `JANLU-${user.uid.substring(0, 4).toUpperCase()}`,
                referralPoints: 0,
                joinedAt: new Date().toISOString(),
              };
              await setDoc(userRef, newUser);
            }
          }

          unsubUserDoc = onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
              const profile = docSnap.data() as UserProfile;
              setUserProfile(profile);
              const adminStatus = profile.role === 'admin' || profile.role === 'collaborator';
              setIsAdmin(adminStatus);
            }
          });

        } catch (err) {
          console.error("Error checking admin status:", err);
          if (user.email === 'palavecinojuann@gmail.com') {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
          }
        }

        // Ensure customer doc exists
        const checkCustomer = async () => {
          try {
            const customerRef = doc(db, 'customers', user.uid);
            const customerDoc = await getDoc(customerRef);
            if (!customerDoc.exists()) {
              const customerNumber = await generateNextCustomerNumber();
              const newCustomer = {
                id: user.uid,
                name: user.displayName?.split(' ')[0] || 'Nuevo',
                surname: user.displayName?.split(' ').slice(1).join(' ') || 'Usuario',
                email: user.email || '',
                phone: '',
                customerNumber,
                registeredAt: new Date().toISOString(),
                discountExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                welcomeDiscountUsed: false,
                discountPercentage: 10,
                assignedOffers: [],
                createdAt: new Date().toISOString()
              };
              await setDoc(customerRef, cleanObject(newCustomer));
            }
          } catch (e) {
            console.warn("Could not check/create customer doc:", e);
          }
        };
        checkCustomer();

      } else {
        setIsAdmin(false);
        setUserProfile(null);
      }

      setIsAuthReady(true);
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
