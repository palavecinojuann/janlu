import React, { createContext, useContext } from 'react';
import { useInventory } from '../useInventory';

// 1. Creamos el contexto vacío
const InventoryContext = createContext<ReturnType<typeof useInventory> | null>(null);

// 2. Creamos el Proveedor (La Antena Central)
export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const inventory = useInventory(); // Aquí se ejecuta el hook real UNA SOLA VEZ
  return (
    <InventoryContext.Provider value={inventory}>
      {children}
    </InventoryContext.Provider>
  );
};

// 3. Creamos el Hook Consumidor (Los Receptores)
export const useInventoryContext = () => {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventoryContext debe usarse dentro de un InventoryProvider');
  }
  return context;
};
