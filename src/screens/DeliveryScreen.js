import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useMockContext } from '../context/MockContext';
import { styled } from 'nativewind';
import { Ionicons } from '@expo/vector-icons';
import { DEBUG } from '../utils/debug';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledScrollView = styled(ScrollView);
const StyledTouchableOpacity = styled(TouchableOpacity);

export default function DeliveryScreen() {
  const { orders: ordersState, moveOrder, selectedTheatre, fetchOrders } = useMockContext();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchOrders();
    } catch (e) {
      console.warn('[Delivery] Pull-to-refresh failed:', e.message);
    } finally {
      setRefreshing(false);
    }
  };

  const deliveryOrders = (ordersState.ready || []).filter(o => o.fulfillmentType === 'Seat Delivery' && o.theatre === selectedTheatre);

  useEffect(() => {
    if (DEBUG) {
      debugger;
      console.log("[DEBUG] DeliveryScreen mounted");
    }
  }, []);

  const handleDeliver = (orderId) => {
    if (DEBUG) {
      debugger;
      console.log(`[DEBUG] handleDeliver clicked for orderId: ${orderId}`);
    }
    moveOrder(orderId, 'ready', 'delivered');
  };

  return (
    <StyledView className="flex-1 bg-gray-50">
      <StyledView className="bg-white pt-14 pb-4 px-6 shadow-sm z-10 flex-row items-center border-b border-gray-100">
        <Ionicons name="bicycle" size={28} color="#2563EB" />
        <StyledText className="text-xl font-bold text-gray-900 ml-3">Delivery Queue</StyledText>
      </StyledView>

      <StyledScrollView 
        className="flex-1 px-4 pt-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {deliveryOrders.length === 0 ? (
          <StyledView className="items-center justify-center py-20">
            <Ionicons name="checkmark-circle-outline" size={64} color="#D1D5DB" />
            <StyledText className="text-gray-400 mt-4 text-lg font-medium">No deliveries pending</StyledText>
          </StyledView>
        ) : (
          deliveryOrders.map(order => (
            <StyledView key={order.id} className="bg-white rounded-xl p-5 mb-4 shadow-sm border border-gray-100">
              <StyledView className="flex-row justify-between items-start mb-4 border-b border-gray-100 pb-3">
                <StyledView className="flex-1">
                  <StyledText className="text-xl font-black text-gray-900">SEAT: {order.seat}</StyledText>
                  <StyledText className="text-gray-500 text-xs">ID: #{order.id} • {order.mobile}</StyledText>
                  <StyledView className="flex-row items-center mt-2 bg-blue-50/60 self-start px-2.5 py-1 rounded-lg border border-blue-100">
                    <Ionicons name="person-outline" size={14} color="#2563EB" />
                    <StyledText className="text-primary font-bold text-xs ml-1">
                      Delivery Man: {order.deliveryMan || 'Ramesh Kumar'}
                    </StyledText>
                  </StyledView>
                </StyledView>
                <StyledView className="bg-amber-50 border border-amber-200 px-3 py-1 rounded-full flex-row items-center shadow-sm">
                  <Ionicons name="bicycle-outline" size={14} color="#D97706" />
                  <StyledText className="text-amber-700 font-extrabold text-[10px] uppercase tracking-wider ml-1">
                    In Transit
                  </StyledText>
                </StyledView>
              </StyledView>
              
              <StyledView className="space-y-2 mb-4">
                {order.items.map((item, idx) => (
                  <StyledView key={idx} className="flex-row items-center">
                    <StyledView className="w-6 h-6 bg-blue-50 rounded-md items-center justify-center mr-3 border border-blue-100">
                      <StyledText className="text-primary font-bold text-xs">{item.quantity}x</StyledText>
                    </StyledView>
                    <StyledText className="text-gray-800 font-medium text-base">{item.name}</StyledText>
                  </StyledView>
                ))}
              </StyledView>

              <StyledTouchableOpacity 
                className="bg-primary py-3 rounded-xl items-center shadow-sm flex-row justify-center"
                onPress={() => handleDeliver(order.id)}
              >
                <Ionicons name="checkmark-done" size={18} color="white" className="mr-2" />
                <StyledText className="text-white font-bold ml-2">Mark Delivered</StyledText>
              </StyledTouchableOpacity>
            </StyledView>
          ))
        )}
        <StyledView className="h-20" />
      </StyledScrollView>
    </StyledView>
  );
}
