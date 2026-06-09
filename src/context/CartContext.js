import React, { createContext, useState } from 'react';

export const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState({});
  const [orders, setOrders] = useState([]);

  const handleAdd = (id) => {
    setCart(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  };

  const handleRemove = (id) => {
    setCart(prev => {
      const current = prev[id] || 0;
      if (current <= 1) {
        const newCart = { ...prev };
        delete newCart[id];
        return newCart;
      }
      return { ...prev, [id]: current - 1 };
    });
  };

  const clearCart = () => setCart({});

  const placeOrder = (totalAmount, itemsArray) => {
    const newOrder = {
      id: Math.random().toString(36).substr(2, 6).toUpperCase(),
      items: itemsArray,
      total: totalAmount,
      status: 'pending',
      timestamp: new Date().toISOString(),
    };
    setOrders(prev => [newOrder, ...prev]);
    clearCart();
  };

  const updateOrderStatus = (orderId, status) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
  };

  return (
    <CartContext.Provider value={{ cart, handleAdd, handleRemove, clearCart, orders, placeOrder, updateOrderStatus }}>
      {children}
    </CartContext.Provider>
  );
};
