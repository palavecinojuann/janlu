import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = 'Ha ocurrido un error inesperado.';
      let errorDetails = this.state.error?.message;

      try {
        if (errorDetails) {
          const parsedError = JSON.parse(errorDetails);
          if (parsedError.error) {
            if (parsedError.error.includes('permission-denied')) {
              errorMessage = 'No tienes permisos suficientes para acceder a esta información.';
            } else if (parsedError.error.includes('Quota limit exceeded') || parsedError.error.includes('Quota exceeded')) {
              errorMessage = 'Se ha alcanzado el límite de uso gratuito de la base de datos (Quota Exceeded). El servicio se restablecerá automáticamente mañana. Para un uso ilimitado, se recomienda activar un plan de pago en Firebase.';
            }
          }
        }
      } catch (e) {
        if (errorDetails?.includes('Quota limit exceeded') || errorDetails?.includes('Quota exceeded')) {
          errorMessage = 'Se ha alcanzado el límite de uso gratuito de la base de datos (Quota Exceeded). El servicio se restablecerá automáticamente mañana.';
        }
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-950 p-4">
          <div className="max-w-md w-full bg-white dark:bg-stone-900 rounded-2xl shadow-sm border border-stone-200 dark:border-stone-800 p-8 text-center">
            <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100 mb-2">¡Ups! Algo salió mal</h2>
            <p className="text-stone-600 dark:text-stone-400 mb-6">
              {errorMessage}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors"
            >
              Recargar página
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
