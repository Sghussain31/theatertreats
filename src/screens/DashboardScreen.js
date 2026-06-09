import React, { useContext, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch } from 'react-native';
import { UserContext } from '../context/UserContext';
import { useMockContext } from '../context/MockContext';
import { colors } from '../theme/colors';
import { styled } from 'nativewind';
import { Ionicons } from '@expo/vector-icons';
import { DEBUG } from '../utils/debug';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledScrollView = styled(ScrollView);

export default function DashboardScreen() {
  const { userRole, setUserRole } = useContext(UserContext);
  const { orders: ordersState } = useMockContext();

  useEffect(() => {
    if (DEBUG) {
      debugger;
      console.log("[DEBUG] DashboardScreen mounted");
    }
  }, []);

  const toggleRole = () => {
    setUserRole(userRole === 'Admin' ? 'Staff' : 'Admin');
  };

  // Combine all orders for stats
  const allOrders = [
    ...ordersState.pending,
    ...ordersState.cooking,
    ...ordersState.ready,
    ...ordersState.delivered,
  ];

  const salesToday = allOrders.reduce((sum, order) => sum + order.total, 0);
  const activeOrdersCount = ordersState.pending.length + ordersState.cooking.length + ordersState.ready.length;

  const renderOrder = (order) => {
    const isPickup = order.fulfillmentType === 'Counter Pickup';
    return (
      <StyledView key={order.id} className="bg-white p-5 rounded-xl mb-4 shadow-sm border border-gray-100 flex-row justify-between items-start">
        <StyledView className="flex-1 mr-4">
          <StyledView className="flex-row items-center mb-2">
            <StyledText className="text-lg font-bold text-gray-900 mr-3">#{order.id}</StyledText>
            {isPickup ? (
              <StyledView className="bg-blue-100 px-2 py-1 rounded border border-blue-300">
                <StyledText className="text-blue-700 text-xs font-black tracking-widest">COUNTER PICKUP</StyledText>
              </StyledView>
            ) : (
              <StyledView className="bg-green-100 px-2 py-1 rounded border border-green-300">
                <StyledText className="text-green-700 text-xs font-black tracking-widest">SEAT DELIVERY</StyledText>
              </StyledView>
            )}
          </StyledView>
          
          <StyledText className="text-gray-600 font-medium mb-1">{order.mobile}</StyledText>
          
          {!isPickup && (
            <StyledText className="text-gray-800 font-bold mb-3">Seat: {order.seat}</StyledText>
          )}
          {isPickup && (
            <StyledView className="mb-3" />
          )}

          <StyledView>
            {order.items.map((item, idx) => (
              <StyledText key={idx} className="text-gray-500 text-sm">{item.quantity}x {item.name}</StyledText>
            ))}
          </StyledView>
        </StyledView>

        <StyledView className="items-end">
          <StyledText className="text-2xl font-black text-primary">₹{order.total}</StyledText>
          <StyledText className="mt-2 text-xs font-bold uppercase text-orange-500">
            {order.status || 'PENDING'}
          </StyledText>
        </StyledView>
      </StyledView>
    );
  };

  return (
    <StyledScrollView className="flex-1 bg-gray-50">
      <StyledView className="p-5">
        <View style={styles.roleToggle}>
          <Text style={styles.roleText}>Current Role: {userRole}</Text>
          <Switch 
            value={userRole === 'Admin'} 
            onValueChange={toggleRole} 
            trackColor={{ false: '#ccc', true: colors.primary }}
            thumbColor={colors.white}
          />
        </View>

        <StyledView className="flex-row justify-between mb-8">
          <StyledView className="bg-white p-5 rounded-xl flex-1 mr-2 shadow-sm border-l-4 border-primary">
            <StyledText className="text-gray-500 text-sm mb-1 font-bold">Sales Today</StyledText>
            <StyledText className="text-3xl font-black text-primary">₹{salesToday}</StyledText>
          </StyledView>
          <StyledView className="bg-white p-5 rounded-xl flex-1 ml-2 shadow-sm border-l-4 border-primary">
            <StyledText className="text-gray-500 text-sm mb-1 font-bold">Active Orders</StyledText>
            <StyledText className="text-3xl font-black text-primary">{activeOrdersCount}</StyledText>
          </StyledView>
        </StyledView>

        <StyledText className="text-2xl font-black text-gray-900 mb-4">New Orders</StyledText>
        
        {ordersState.pending.length === 0 ? (
          <StyledView className="items-center py-10 bg-white rounded-xl shadow-sm border border-gray-100">
            <Ionicons name="receipt-outline" size={48} color="#D1D5DB" />
            <StyledText className="text-gray-400 mt-2 font-medium">No active orders right now.</StyledText>
          </StyledView>
        ) : (
          ordersState.pending.map(renderOrder)
        )}
        
        <StyledView className="h-20" />
      </StyledView>
    </StyledScrollView>
  );
}

const styles = StyleSheet.create({
  roleToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.secondary,
    padding: 20,
    borderRadius: 12,
    marginBottom: 25,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  roleText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
  }
});
