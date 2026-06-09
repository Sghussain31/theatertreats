import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  pending: [],
  cooking: [],
  ready: [],
  delivered: [],
};

const ordersSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    addOrder: (state, action) => {
      state.pending.push(action.payload);
    },
    moveOrder: (state, action) => {
      const { orderId, fromStatus, toStatus } = action.payload;
      const orderIndex = state[fromStatus].findIndex(o => o.id === orderId);
      if (orderIndex !== -1) {
        const [order] = state[fromStatus].splice(orderIndex, 1);
        state[toStatus].push({ ...order, status: toStatus, updatedAt: Date.now() });
      }
    },
    setOrders: (state, action) => {
      state.pending = action.payload.pending || [];
      state.cooking = action.payload.cooking || [];
      state.ready = action.payload.ready || [];
      state.delivered = action.payload.delivered || [];
    }
  },
});

export const { addOrder, moveOrder, setOrders } = ordersSlice.actions;
export default ordersSlice.reducer;
