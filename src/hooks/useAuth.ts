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
            }

            setIsAdmin(role === 'admin' || role === 'superadmin' || role === 'collaborator');
            setUserProfile(finalUserProfile);
          } else {
            // Si no está en users, buscamos en preAuthorizedAdmins por su email
            if (user.email) {
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
            } else {
              setIsAdmin(false);
            }
          }
          setIsAuthReady(true);
        });

        // Aseguramos que el cliente también exista en la colección de clientes
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
