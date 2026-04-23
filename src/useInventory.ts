import { useAuth } from './hooks/useAuth';
import { usePublicInventory } from './hooks/usePublicInventory';
import { useAdminInventory } from './hooks/useAdminInventory';
import { useInventoryOperations } from './hooks/useInventoryOperations';

export function useInventory() {
  // 1. Capa de Autenticación y Perfil
  const auth = useAuth();

  // 2. Capa de Datos Públicos (Catálogo, Campañas, Ofertas)
  const publicData = usePublicInventory(auth.isAuthReady);

  // 3. Capa de Datos Administrativos (Ventas, Clientes, Insumos)
  // CRÍTICO: El celular del cliente ya no descarga esta información
  const adminData = useAdminInventory(auth.isAdmin, auth.isAuthReady, publicData.products);

  // 4. Capa de Operaciones (Mutaciones y Lógica Transaccional)
  const operations = useInventoryOperations(
    auth.currentUser,
    auth.isAdmin,
    publicData.products,
    adminData.rawMaterials,
    adminData.sales,
    adminData.quotes,
    adminData.customers,
    adminData.users,
    adminData.productionOrders,
    adminData.auditLogs,
    adminData.coupons,
    publicData.storeSettings
  );

  // Retornamos la combinación de todos los módulos para mantener compatibilidad total
  return {
    ...auth,
    ...publicData,
    ...adminData,
    ...operations
  };
}
