import React, { useState } from 'react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { Mail, Lock, AlertCircle, Loader2 } from 'lucide-react';

interface LoginFormProps {
  onSuccess?: () => void;
  onSwitchToRegister?: () => void;
}

export default function LoginForm({ onSuccess, onSwitchToRegister }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error("Login error:", err);
      let message = "Error al iniciar sesión. Por favor, revisa tus credenciales.";
      
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        message = "Email o contraseña incorrectos.";
      } else if (err.code === 'auth/too-many-requests') {
        message = "Demasiados intentos fallidos. Por favor, intenta más tarde.";
      }
      
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error("Google login error:", err);
      let message = "Error al iniciar sesión con Google.";
      if (err.code === 'auth/popup-blocked') {
        message = "El navegador bloqueó la ventana emergente. Por favor, permítela.";
      } else if (err.code === 'auth/popup-closed-by-user') {
        message = "Cerraste la ventana de inicio de sesión antes de terminar.";
      }
      setError(message);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white dark:bg-stone-800 p-8 rounded-2xl shadow-xl">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-cinzel font-bold text-stone-900 dark:text-white">Bienvenido</h2>
        <p className="text-stone-500 dark:text-stone-400 mt-2">Inicia sesión para continuar</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl flex items-start gap-3 text-sm">
          <AlertCircle className="shrink-0 mt-0.5" size={18} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="••••••••"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || googleLoading}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-4"
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              <span>Iniciando sesión...</span>
            </>
          ) : (
            <span>Iniciar Sesión</span>
          )}
        </button>
      </form>

      <div className="relative my-8">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-stone-200 dark:border-stone-700"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-white dark:bg-stone-800 text-stone-500">O continúa con</span>
        </div>
      </div>

      <button
        onClick={handleGoogleLogin}
        disabled={loading || googleLoading}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 font-medium rounded-xl hover:bg-stone-50 dark:hover:bg-stone-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {googleLoading ? (
          <Loader2 className="animate-spin" size={20} />
        ) : (
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
        )}
        <span>Google</span>
      </button>

      <div className="mt-8 text-center">
        <p className="text-stone-500 dark:text-stone-400 text-sm">
          ¿No tienes una cuenta?{' '}
          <button
            onClick={onSwitchToRegister}
            className="text-indigo-600 font-semibold hover:underline"
          >
            Regístrate ahora
          </button>
        </p>
      </div>
    </div>
  );
}
