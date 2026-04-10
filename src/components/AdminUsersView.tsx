import React, { useState } from 'react';
import { Shield, User as UserIcon, Search, Check, X } from 'lucide-react';
import { User, PreAuthorizedAdmin } from '../types';
import { User as FirebaseUser } from 'firebase/auth';

interface AdminUsersViewProps {
  users: User[];
  preAuthorizedAdmins: PreAuthorizedAdmin[];
  currentUser: FirebaseUser | null;
  onUpdateRole: (uid: string, role: string) => void;
  onAddPreAuth: (email: string, role: string) => void;
  onUpdatePreAuthRole: (email: string, role: string) => void;
  onRemovePreAuth: (email: string) => void;
}

export default function AdminUsersView({ 
  users, 
  preAuthorizedAdmins, 
  currentUser, 
  onUpdateRole,
  onAddPreAuth,
  onUpdatePreAuthRole,
  onRemovePreAuth
}: AdminUsersViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [newPreAuthEmail, setNewPreAuthEmail] = useState('');
  const [newPreAuthRole, setNewPreAuthRole] = useState('admin');

  const filteredUsers = users.filter(user => 
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddPreAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPreAuthEmail.trim()) {
      onAddPreAuth(newPreAuthEmail.trim(), newPreAuthRole);
      setNewPreAuthEmail('');
      setNewPreAuthRole('admin');
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-6">
      <div className="flex-none flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-stone-800 dark:text-white">Usuarios y Permisos</h2>
          <p className="text-stone-500 dark:text-stone-400">Gestiona los permisos de acceso al sistema</p>
        </div>
      </div>

      <div className="flex-none bg-white dark:bg-stone-800 rounded-2xl shadow-sm border border-stone-200 dark:border-stone-700 overflow-hidden">
        <div className="p-6 border-b border-stone-200 dark:border-stone-700">
          <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-2">Pre-autorizar Usuario</h3>
          <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">
            Ingresa el correo electrónico de la persona que quieres que tenga acceso a la app. 
            Cuando inicien sesión con este correo, se les asignará el rol seleccionado automáticamente.
          </p>
          <form onSubmit={handleAddPreAuth} className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              placeholder="correo@ejemplo.com"
              value={newPreAuthEmail}
              onChange={(e) => setNewPreAuthEmail(e.target.value)}
              className="flex-1 px-4 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:text-white"
              required
            />
            <select
              value={newPreAuthRole}
              onChange={(e) => setNewPreAuthRole(e.target.value)}
              className="px-4 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:text-white"
            >
              <option value="admin">Administrador</option>
              <option value="collaborator">Colaborador</option>
              <option value="customer">Cliente</option>
            </select>
            <button
              type="submit"
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors"
            >
              Pre-autorizar
            </button>
          </form>
        </div>

        {preAuthorizedAdmins.length > 0 && (
          <div className="p-6 bg-stone-50 dark:bg-stone-900/50 border-t border-stone-200 dark:border-stone-700">
            <h4 className="text-sm font-semibold text-stone-600 dark:text-stone-400 uppercase tracking-wider mb-3">Correos Pre-autorizados</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {preAuthorizedAdmins.map((admin) => (
                <div key={admin.email} className="flex items-center justify-between p-3 bg-white dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700">
                  <div className="flex flex-col overflow-hidden mr-2">
                    <span className="text-sm text-stone-700 dark:text-stone-200 truncate">{admin.email}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={admin.role || 'admin'}
                      onChange={(e) => onUpdatePreAuthRole(admin.email, e.target.value)}
                      className="text-xs px-2 py-1 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:text-white"
                    >
                      <option value="admin">Admin</option>
                      <option value="collaborator">Colab</option>
                      <option value="customer">Cliente</option>
                    </select>
                    <button
                      onClick={() => onRemovePreAuth(admin.email)}
                      className="p-1.5 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                      title="Eliminar pre-autorización"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 bg-white dark:bg-stone-800 rounded-2xl shadow-sm border border-stone-200 dark:border-stone-700 flex flex-col min-h-0">
        <div className="flex-none p-4 border-b border-stone-200 dark:border-stone-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
            <input
              type="text"
              placeholder="Buscar usuarios por email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:text-white"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse relative">
            <thead className="sticky top-0 z-10 bg-stone-50 dark:bg-stone-900/50 shadow-sm">
              <tr className="border-b border-stone-200 dark:border-stone-700">
                <th className="p-4 text-sm font-semibold text-stone-600 dark:text-stone-300">Usuario</th>
                <th className="p-4 text-sm font-semibold text-stone-600 dark:text-stone-300">Rol</th>
                <th className="p-4 text-sm font-semibold text-stone-600 dark:text-stone-300">Fecha de Registro</th>
                <th className="p-4 text-sm font-semibold text-stone-600 dark:text-stone-300">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 dark:divide-stone-700">
              {filteredUsers.map((user) => (
                <tr key={user.uid} className="hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                        <UserIcon size={20} />
                      </div>
                      <div>
                        <div className="font-medium text-stone-900 dark:text-white">
                          {user.email}
                          {user.uid === currentUser?.uid && (
                            <span className="ml-2 text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 px-2 py-0.5 rounded-full">
                              Tú
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-stone-500 dark:text-stone-400 font-mono text-xs">
                          {user.uid}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      user.role === 'admin' 
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : user.role === 'collaborator'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300'
                    }`}>
                      {user.role === 'admin' ? <Shield size={14} /> : <UserIcon size={14} />}
                      {user.role === 'admin' ? 'Administrador' : user.role === 'collaborator' ? 'Colaborador' : 'Cliente'}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-stone-600 dark:text-stone-300">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-4">
                    {user.uid !== currentUser?.uid && user.email !== 'palavecinojuann@gmail.com' && (
                      <div className="flex items-center gap-2">
                        <select
                          value={user.role || 'customer'}
                          onChange={(e) => onUpdateRole(user.uid, e.target.value)}
                          className="text-xs px-2 py-1 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:text-white"
                        >
                          <option value="admin">Administrador</option>
                          <option value="collaborator">Colaborador</option>
                          <option value="customer">Cliente</option>
                        </select>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-stone-500 dark:text-stone-400">
                    No se encontraron usuarios
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
