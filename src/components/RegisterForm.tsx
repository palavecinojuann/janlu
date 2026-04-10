import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { generateNextCustomerNumber } from '../useCustomer';
import { Mail, Lock, User, Phone, Calendar, AlertCircle, Loader2 } from 'lucide-react';

interface RegisterFormProps {
  onSuccess?: () => void;
  onSwitchToLogin?: () => void;
}

export default function RegisterForm({ onSuccess, onSwitchToLogin }: RegisterFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Generate correlative customer number
      const customerNumber = await generateNextCustomerNumber();

      // 3. Create customer document in Firestore
      const now = new Date();
      const expiresAt = new Date();
      expiresAt.setDate(now.getDate() + 7); // 7 days later

      const customerData = {
        id: user.uid,
        name: firstName,
        surname: lastName,
        email: email,
        phone: phone,
        birthDate: birthDate,
        customerNumber: customerNumber,
        registeredAt: now.toISOString(),
        createdAt: now.toISOString(),
        discountExpiresAt: expiresAt.toISOString(),
        welcomeDiscountUsed: false,
        discountPercentage: 10,
        customerType: 'retail'
      };

      await setDoc(doc(db, 'customers', user.uid), customerData);

      // 4. Also create a user profile for the dashboard if needed
      // (The useInventory hook handles this automatically onAuthStateChanged, 
      // but we can pre-populate it here to be faster)
      await setDoc(doc(db, 'users', user.uid), {
        id: user.uid,
        uid: user.uid,
        email: email,
        role: 'customer',
        createdAt: now.toISOString(),
        name: `${firstName} ${lastName}`,
        level: 'bronce',
        referralCode: `JANLU-${user.uid.substring(0, 4).toUpperCase()}`,
        referralPoints: 0,
        joinedAt: now.toISOString(),
      });

      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error("Registration error:", err);
      let message = "Error al registrarse. Por favor, intenta de nuevo.";
      
      if (err.code === 'auth/email-already-in-use') {
        message = "Este correo electrónico ya está registrado.";
      } else if (err.code === 'auth/weak-password') {
        message = "La contraseña es muy débil. Debe tener al menos 6 caracteres.";
      } else if (err.code === 'auth/invalid-email') {
        message = "El correo electrónico no es válido.";
      }
      
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white dark:bg-stone-800 p-8 rounded-2xl shadow-xl">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-cinzel font-bold text-stone-900 dark:text-white">Únete a Janlu</h2>
        <p className="text-stone-500 dark:text-stone-400 mt-2">Regístrate y obtén un 10% de descuento de bienvenida</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl flex items-start gap-3 text-sm">
          <AlertCircle className="shrink-0 mt-0.5" size={18} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleRegister} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-stone-500 ml-1">Nombre</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="Juan"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-stone-500 ml-1">Apellido</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="Pérez"
              />
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-stone-500 ml-1">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="tu@email.com"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-stone-500 ml-1">Contraseña</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="••••••••"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-stone-500 ml-1">Teléfono</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="11 2233 4455"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-stone-500 ml-1">F. Nacimiento</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
              <input
                type="date"
                required
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-4"
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              <span>Creando cuenta...</span>
            </>
          ) : (
            <span>Registrarme</span>
          )}
        </button>
      </form>

      <div className="mt-8 text-center">
        <p className="text-stone-500 dark:text-stone-400 text-sm">
          ¿Ya tienes una cuenta?{' '}
          <button
            onClick={onSwitchToLogin}
            className="text-indigo-600 font-semibold hover:underline"
          >
            Inicia sesión
          </button>
        </p>
      </div>
    </div>
  );
}
