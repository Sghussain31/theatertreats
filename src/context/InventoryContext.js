import React, { createContext, useState } from 'react';

export const InventoryContext = createContext();

export const InventoryProvider = ({ children }) => {
  const [products, setProducts] = useState([]);

  const toggleStock = (id) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, outOfStock: !p.outOfStock } : p));
  };

  const addProduct = (product) => {
    setProducts(prev => [...prev, { ...product, id: Math.random().toString(36).substr(2, 9), outOfStock: false }]);
  };

  return (
    <InventoryContext.Provider value={{ products, toggleStock, addProduct }}>
      {children}
    </InventoryContext.Provider>
  );
};
