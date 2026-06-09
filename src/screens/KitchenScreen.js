import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Animated, RefreshControl } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useMockContext } from '../context/MockContext';
import { styled } from 'nativewind';
import { Ionicons } from '@expo/vector-icons';
import { DEBUG } from '../utils/debug';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledScrollView = styled(ScrollView);
const StyledTouchableOpacity = styled(TouchableOpacity);

const Timer = ({ timestamp }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - timestamp) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [timestamp]);

  const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const secs = (elapsed % 60).toString().padStart(2, '0');
  
  const isWarning = elapsed > 300; // 5 mins

  return (
    <StyledView className={`flex-row items-center px-2 py-1 rounded-md ${isWarning ? 'bg-red-100' : 'bg-green-100'}`}>
      <Ionicons name="time-outline" size={14} color={isWarning ? '#DC2626' : '#16A34A'} />
      <StyledText className={`text-xs font-bold ml-1 ${isWarning ? 'text-red-700' : 'text-green-700'}`}>
        {mins}:{secs}
      </StyledText>
    </StyledView>
  );
};

export default function KitchenScreen() {
  const [activeTab, setActiveTab] = useState('pending');
  const { orders: ordersState, moveOrder, selectedTheatre, fetchOrders } = useMockContext();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchOrders();
    } catch (e) {
      console.warn('[Kitchen] Pull-to-refresh failed:', e.message);
    } finally {
      setRefreshing(false);
    }
  };

  const orders = (ordersState[activeTab] || []).filter(o => o.theatre === selectedTheatre);

  useEffect(() => {
    if (DEBUG) {
      debugger;
      console.log("[DEBUG] KitchenScreen mounted / orders updated");
    }
    console.log(`[THEATERTREATS-DEBUG] KITCHEN REFRESHED - Pending Orders: ${(ordersState.pending || []).filter(o => o.theatre === selectedTheatre).length}`);
  }, [ordersState.pending, selectedTheatre]);

  const handleMove = (orderId, fromStatus, toStatus) => {
    if (DEBUG) {
      debugger;
      console.log(`[DEBUG] handleMove: moving order ${orderId} from ${fromStatus} to ${toStatus}`);
    }
    moveOrder(orderId, fromStatus, toStatus);
  };

  const handleTabChange = (tabKey) => {
    if (DEBUG) {
      debugger;
      console.log(`[DEBUG] KitchenScreen tab changed to: ${tabKey}`);
    }
    setActiveTab(tabKey);
  };

  const tabs = [
    { key: 'pending', label: 'Pending', count: (ordersState.pending || []).filter(o => o.theatre === selectedTheatre).length },
    { key: 'cooking', label: 'Cooking', count: (ordersState.cooking || []).filter(o => o.theatre === selectedTheatre).length },
    { key: 'ready', label: 'Ready', count: (ordersState.ready || []).filter(o => o.theatre === selectedTheatre).length },
  ];

  const renderOrderCard = (order) => {
    const isPending = activeTab === 'pending';
    const isCooking = activeTab === 'cooking';

    const renderLeftActions = (progress, dragX) => {
      const scale = dragX.interpolate({
        inputRange: [0, 80],
        outputRange: [0, 1],
        extrapolate: 'clamp',
      });
      return (
        <StyledView className="bg-green-500 rounded-xl justify-center px-6 flex-1 shadow-sm">
          <Animated.View style={{ transform: [{ scale }] }} className="flex-row items-center">
            <Ionicons name="restaurant-outline" size={26} color="white" />
            <StyledText className="text-white font-bold ml-2 text-lg">Start Cooking</StyledText>
          </Animated.View>
        </StyledView>
      );
    };

    const renderCookingLeftActions = (progress, dragX) => {
      const scale = dragX.interpolate({
        inputRange: [0, 80],
        outputRange: [0, 1],
        extrapolate: 'clamp',
      });
      return (
        <StyledView className="bg-amber-500 rounded-xl justify-center px-6 flex-1 shadow-sm">
          <Animated.View style={{ transform: [{ scale }] }} className="flex-row items-center">
            <Ionicons name="checkmark-circle-outline" size={26} color="white" />
            <StyledText className="text-white font-bold ml-2 text-lg">Mark as Ready</StyledText>
          </Animated.View>
        </StyledView>
      );
    };

    const cardContent = (
      <StyledView className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <StyledView className="flex-row justify-between items-start mb-4 border-b border-gray-100 pb-3">
          <StyledView>
            <StyledText className="text-xl font-black text-gray-900">
              {order.fulfillmentType === 'Counter Pickup' ? 'PICKUP' : `SEAT: ${order.seat}`}
            </StyledText>
            <StyledText className="text-gray-500 text-xs">ID: #{order.id} • {order.mobile}</StyledText>
          </StyledView>
          <Timer timestamp={order.timestamp} />
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

        {activeTab === 'ready' && order.fulfillmentType === 'Counter Pickup' && (
          <StyledTouchableOpacity 
            className="bg-primary py-3 rounded-xl items-center shadow-sm flex-row justify-center mt-4"
            onPress={() => handleMove(order.id, 'ready', 'delivered')}
          >
            <Ionicons name="checkmark-done" size={18} color="white" className="mr-2" />
            <StyledText className="text-white font-bold ml-2">Mark Delivered</StyledText>
          </StyledTouchableOpacity>
        )}
      </StyledView>
    );

    if (isPending) {
      return (
        <StyledView key={order.id} className="mb-4">
          <Swipeable
            renderLeftActions={renderLeftActions}
            onSwipeableWillOpen={() => handleMove(order.id, 'pending', 'cooking')}
            overshootLeft={false}
            friction={2}
          >
            {cardContent}
          </Swipeable>
        </StyledView>
      );
    }

    if (isCooking) {
      return (
        <StyledView key={order.id} className="mb-4">
          <Swipeable
            renderLeftActions={renderCookingLeftActions}
            onSwipeableWillOpen={() => handleMove(order.id, 'cooking', 'ready')}
            overshootLeft={false}
            friction={2}
          >
            {cardContent}
          </Swipeable>
        </StyledView>
      );
    }

    return (
      <StyledView key={order.id} className="mb-4">
        {cardContent}
      </StyledView>
    );
  };

  return (
    <StyledView className="flex-1 bg-gray-50">
      {/* Header */}
      <StyledView className="bg-white pt-14 pb-4 px-6 shadow-sm z-10 flex-row items-center border-b border-gray-100">
        <Ionicons name="restaurant" size={28} color="#2563EB" />
        <StyledText className="text-xl font-bold text-gray-900 ml-3">Kitchen Display</StyledText>
      </StyledView>

      {/* Tabs */}
      <StyledView className="flex-row bg-white px-4 py-2 shadow-sm border-b border-gray-100">
        {tabs.map(tab => (
          <StyledTouchableOpacity 
            key={tab.key}
            className={`flex-1 py-3 items-center border-b-2 ${activeTab === tab.key ? 'border-primary' : 'border-transparent'}`}
            onPress={() => handleTabChange(tab.key)}
          >
            <StyledView className="flex-row items-center">
              <StyledText className={`font-bold ${activeTab === tab.key ? 'text-primary' : 'text-gray-500'}`}>
                {tab.label}
              </StyledText>
              <StyledView className={`ml-2 px-2 py-0.5 rounded-full ${activeTab === tab.key ? 'bg-blue-100' : 'bg-gray-100'}`}>
                <StyledText className={`text-xs font-bold ${activeTab === tab.key ? 'text-blue-700' : 'text-gray-600'}`}>
                  {tab.count}
                </StyledText>
              </StyledView>
            </StyledView>
          </StyledTouchableOpacity>
        ))}
      </StyledView>

      <StyledScrollView 
        className="flex-1 px-4 pt-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {orders.length === 0 ? (
          <StyledView className="items-center justify-center py-20">
            <Ionicons name="checkmark-circle-outline" size={64} color="#D1D5DB" />
            <StyledText className="text-gray-400 mt-4 text-lg font-medium">No {activeTab} orders</StyledText>
          </StyledView>
        ) : activeTab === 'ready' ? (
          <StyledView>
            <StyledText className="text-lg font-bold text-gray-900 mb-3 mt-2">Pickup Ready</StyledText>
            {orders.filter(o => o.fulfillmentType === 'Counter Pickup').map(order => renderOrderCard(order))}
            {orders.filter(o => o.fulfillmentType === 'Counter Pickup').length === 0 && <StyledText className="text-gray-500 italic mb-4">No pickup orders ready</StyledText>}

            <StyledText className="text-lg font-bold text-gray-900 mb-3 mt-4">Delivery Ready</StyledText>
            {orders.filter(o => o.fulfillmentType === 'Seat Delivery').map(order => renderOrderCard(order))}
            {orders.filter(o => o.fulfillmentType === 'Seat Delivery').length === 0 && <StyledText className="text-gray-500 italic mb-4">No delivery orders ready</StyledText>}
          </StyledView>
        ) : (
          orders.map(order => renderOrderCard(order))
        )}
        <StyledView className="h-20" />
      </StyledScrollView>
    </StyledView>
  );
}
