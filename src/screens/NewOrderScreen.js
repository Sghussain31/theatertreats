import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, Alert, Modal, RefreshControl } from 'react-native';
import { useMockContext } from '../context/MockContext';
import { styled } from 'nativewind';
import { Ionicons } from '@expo/vector-icons';
import { DEBUG } from '../utils/debug';
import { API_URL } from '../utils/api';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTextInput = styled(TextInput);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);

export default function NewOrderScreen({ navigation }) {
  const { products, setProducts, addOrder, isCanteenOpen, selectedTheatre } = useMockContext();

  const [mobile, setMobile] = useState('');
  const [seat, setSeat] = useState('');
  const [fulfillmentType, setFulfillmentType] = useState('Counter Pickup');
  const [cart, setCart] = useState({}); // { productId: quantity }
  const [itemFulfillment, setItemFulfillment] = useState({}); // { productId: 'Counter' | 'Seat' }
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    console.log("=== REFRESH TRIGGERED FROM SCREEN ===");
    setRefreshing(true);
    try {
      console.log(`[POS] Fetching products from ${API_URL}/api/products`);
      const response = await fetch(`${API_URL}/api/products?cache=${Date.now()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }
      const data = await response.json();
      const parsedData = data.map(item => {
        const url = item.imageUri || item.image_url;
        if (url) {
          try {
            const decoded = decodeURIComponent(url);
            const filenameWithExt = decoded.split('/').pop() || '';
            const awsFileName = filenameWithExt.split('.').slice(0, -1).join('.');
            if (awsFileName && awsFileName.includes('$#$')) {
              const cleanName = awsFileName.split('_')[0].replace(/[\$#]+$/, ''); // Drops trailing timestamp and strips trailing $ or #
              const parts = cleanName.split('$#$');
              if (parts.length >= 4) {
                item.id = parts[0].replace(/[\$#]+/g, '').trim();       // '1043'
                item.name = parts[1] ? parts[1].replace(/[\$#]+/g, '').replace(/-/g, ' ').trim() : ''; // Replace hyphens with spaces automatically for the UI layout display
                item.price = parseFloat(parts[2] ? parts[2].replace(/[\$#]+/g, '') : parts[2]) || parts[2];    // '150'
                item.status = parts[3] ? parts[3].replace(/[\$#]+/g, '').trim() : '';   // 'active'
                item.isAvailable = item.status === 'active';
              }
            }
          } catch (e) {
            console.error('[POS] S3 filename parsing error:', e);
          }
          if (url.startsWith('http')) {
            const baseUrl = url.split('?')[0].replace(/[\$#]+$/, ''); // Strip trailing $ or # from image URL
            item.imageUri = baseUrl;
            item.image_url = baseUrl;
          }
        }
        return item;
      });
      setProducts(parsedData);
    } catch (error) {
      console.error('[POS] Refresh failed:', error);
      Alert.alert('Error', 'Failed to refresh products list from server.');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (DEBUG) {
      debugger;
      console.log("[DEBUG] NewOrderScreen mounted");
    }
  }, []);

  const handleFulfillmentSelect = (type) => {
    if (DEBUG) {
      debugger;
      console.log(`[DEBUG] handleFulfillmentSelect: toggled to ${type}`);
    }
    setFulfillmentType(type);
    const targetFulfillment = type === 'Counter Pickup' ? 'Counter' : 'Seat';
    
    // Update fulfillment for all existing items in the cart to align with the new global default
    setItemFulfillment(prev => {
      const updated = { ...prev };
      Object.keys(cart).forEach(id => {
        updated[id] = targetFulfillment;
      });
      return updated;
    });
    console.log(`Fulfillment toggled: ${type}`);
  };

  const updateQuantity = (id, delta) => {
    if (DEBUG) {
      debugger;
      console.log(`[DEBUG] updateQuantity: id=${id}, delta=${delta}`);
    }
    setCart(prev => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      const newCart = { ...prev };
      if (next === 0) {
        delete newCart[id];
        setItemFulfillment(prevF => {
          const newF = { ...prevF };
          delete newF[id];
          return newF;
        });
      } else {
        newCart[id] = next;
        if (current === 0) {
          setItemFulfillment(prevF => ({
            ...prevF,
            [id]: fulfillmentType === 'Counter Pickup' ? 'Counter' : 'Seat'
          }));
        }
      }
      return newCart;
    });
  };

  const cartTotal = Object.entries(cart).reduce((total, [id, qty]) => {
    const product = products.find(p => p.id === id);
    return total + (product ? product.price * qty : 0);
  }, 0);

  const handleSubmitOrder = () => {
    if (DEBUG) {
      debugger;
      console.log("[DEBUG] handleSubmitOrder clicked");
    }
    if (!mobile) {
      Alert.alert('Validation Error', 'Please enter Mobile Number.');
      return;
    }
    if (mobile.length < 10) {
      Alert.alert('Validation Error', 'Please enter a valid 10-digit Mobile Number.');
      return;
    }
    if (Object.keys(cart).length === 0) {
      Alert.alert('Empty Cart', 'Please add at least one item.');
      return;
    }

    // Verify if any items are flagged for seat delivery, requiring seat number
    const hasSeatItems = Object.entries(cart).some(([id, qty]) => itemFulfillment[id] === 'Seat');
    if (hasSeatItems && !seat) {
      Alert.alert('Validation Error', 'Please enter Seat Number for items set to Seat Delivery.');
      return;
    }

    setConfirmVisible(true);
  };

  const placeSingleOrder = async (items, type, seatVal) => {
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const order_type = type === 'Counter Pickup' ? 'counter_pickup' : 'seat_delivery';
    const status = type === 'Counter Pickup' ? 'delivered' : 'pending';
    
    const payload = {
      items,
      total_price: total,
      order_type,
      seat_number: seatVal,
      theatre: selectedTheatre
    };

    try {
      console.log(`[POS] Dispatching ${type} order to ${API_URL}/api/orders/place...`);
      const response = await fetch(`${API_URL}/api/orders/place`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to checkout on backend');
      }
      
      const serverResult = await response.json();
      console.log('Backend response:', serverResult);
      
      return {
        id: serverResult.id || Math.random().toString(36).substr(2, 9),
        mobile,
        seat: seatVal,
        fulfillmentType: type,
        items,
        total,
        status,
        timestamp: Date.now(),
        theatre: selectedTheatre
      };
    } catch (error) {
      console.warn('[Network] POS backend dispatch failed. Recording locally:', error.message);
      
      return {
        id: 'offline_' + Math.random().toString(36).substr(2, 9),
        mobile,
        seat: seatVal,
        fulfillmentType: type,
        items,
        total,
        status,
        timestamp: Date.now(),
        theatre: selectedTheatre
      };
    }
  };

  const handleConfirmSubmit = async () => {
    setConfirmVisible(false);

    const counterItems = [];
    const seatItems = [];

    Object.entries(cart).forEach(([id, qty]) => {
      const product = products.find(p => p.id === id);
      if (product) {
        const item = { ...product, quantity: qty };
        if (itemFulfillment[id] === 'Seat') {
          seatItems.push(item);
        } else {
          counterItems.push(item);
        }
      }
    });

    try {
      const ordersPlaced = [];

      if (counterItems.length > 0) {
        const counterOrder = await placeSingleOrder(counterItems, 'Counter Pickup', null);
        ordersPlaced.push(counterOrder);
      }

      if (seatItems.length > 0) {
        const seatOrder = await placeSingleOrder(seatItems, 'Seat Delivery', seat);
        ordersPlaced.push(seatOrder);
      }

      // Add placed orders to local context state
      ordersPlaced.forEach(order => addOrder(order));

      Alert.alert(
        'Success',
        ordersPlaced.length > 1
          ? 'Split checkout successful! Seat items batched and sent to kitchen, counter items completed immediately.'
          : (seatItems.length > 0 ? 'Order sent to kitchen!' : 'Order completed immediately!')
      );

      // Clear checkout inputs
      setMobile('');
      setSeat('');
      setCart({});
      setItemFulfillment({});
    } catch (error) {
      console.error('[POS] checkout error:', error);
      Alert.alert('Error', 'An error occurred during split checkout.');
    }
  };

  return (
    <StyledView className="flex-1 bg-gray-50">
      {/* Header */}
      <StyledView className="bg-white pt-14 pb-4 px-6 shadow-sm z-10 flex-row items-center border-b border-gray-100">
        <Ionicons name="cart" size={28} color="#2563EB" />
        <StyledText className="text-xl font-bold text-gray-900 ml-3">Point of Sale</StyledText>
      </StyledView>

      {!isCanteenOpen ? (
        <StyledView className="flex-1 items-center justify-center px-6 pb-20">
          <StyledView className="bg-red-50 p-6 rounded-full mb-6 border border-red-100 shadow-sm">
            <Ionicons name="storefront-outline" size={64} color="#DC2626" />
          </StyledView>
          <StyledText className="text-2xl font-black text-gray-900 text-center mb-2">Canteen Closed</StyledText>
          <StyledText className="text-gray-500 text-center text-sm max-w-[280px]">
            Canteen Closed - Menu Offline
          </StyledText>
        </StyledView>
      ) : (
        <>
          {/* Global Default Toggle */}
          <StyledView className="bg-white px-6 py-4 flex-row justify-between z-0">
            <StyledTouchableOpacity
              className={`flex-1 py-3 rounded-xl items-center mr-2 border ${fulfillmentType === 'Counter Pickup' ? 'bg-primary border-primary' : 'bg-white border-gray-300'}`}
              onPress={() => handleFulfillmentSelect('Counter Pickup')}
            >
              <StyledText className={`font-bold ${fulfillmentType === 'Counter Pickup' ? 'text-white' : 'text-gray-700'}`}>Counter Pickup</StyledText>
            </StyledTouchableOpacity>
            <StyledTouchableOpacity
              className={`flex-1 py-3 rounded-xl items-center ml-2 border ${fulfillmentType === 'Seat Delivery' ? 'bg-primary border-primary' : 'bg-white border-gray-300'}`}
              onPress={() => handleFulfillmentSelect('Seat Delivery')}
            >
              <StyledText className={`font-bold ${fulfillmentType === 'Seat Delivery' ? 'text-white' : 'text-gray-700'}`}>Seat Delivery</StyledText>
            </StyledTouchableOpacity>
          </StyledView>

          {/* Customer Details */}
          <StyledView className="bg-white px-6 py-4 shadow-sm mb-2 z-0">
            <StyledView className="flex-row space-x-4">
              <StyledView className="flex-1 mr-2">
                <StyledText className="text-xs font-semibold text-gray-500 mb-1 ml-1 uppercase tracking-wide">Mobile Number</StyledText>
                <StyledView className="bg-gray-100 rounded-xl px-3 py-2 flex-row items-center">
                  <Ionicons name="call-outline" size={16} color="#6B7280" />
                  <StyledTextInput
                    className="flex-1 ml-2 text-gray-900 text-base"
                    placeholder="10-digit number"
                    keyboardType="phone-pad"
                    value={mobile}
                    onChangeText={setMobile}
                  />
                </StyledView>
              </StyledView>
              <StyledView className="flex-1 ml-2">
                <StyledText className="text-xs font-semibold text-gray-500 mb-1 ml-1 uppercase tracking-wide">Seat Number</StyledText>
                <StyledView className="bg-gray-100 rounded-xl px-3 py-2 flex-row items-center">
                  <Ionicons name="apps-outline" size={16} color="#6B7280" />
                  <StyledTextInput
                    className="flex-1 ml-2 text-gray-900 text-base"
                    placeholder="e.g. A12"
                    autoCapitalize="characters"
                    value={seat}
                    onChangeText={setSeat}
                  />
                </StyledView>
              </StyledView>
            </StyledView>
          </StyledView>

          {/* Cart Ledger Section */}
          {Object.keys(cart).length > 0 && (
            <StyledView className="bg-white border-b border-gray-200 px-6 py-4">
              <StyledText className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Cart Ledger</StyledText>
              <StyledScrollView style={{ maxHeight: 150 }} showsVerticalScrollIndicator={true}>
                {Object.entries(cart).map(([id, qty]) => {
                  const product = products.find(p => p.id === id);
                  if (!product) return null;
                  const fulfillment = itemFulfillment[id] || 'Counter';
                  return (
                    <StyledView key={id} className="flex-row items-center justify-between py-2 border-b border-gray-50">
                      <StyledView className="flex-1 mr-2">
                        <StyledText className="font-bold text-gray-800 text-sm">{product.name}</StyledText>
                        <StyledText className="text-gray-400 text-xs">₹{product.price} each</StyledText>
                      </StyledView>
                      
                      {/* Quantity Selector */}
                      <StyledView className="flex-row items-center mr-4 bg-gray-100 rounded-lg p-0.5">
                        <StyledTouchableOpacity 
                          className="bg-white w-6 h-6 rounded items-center justify-center"
                          onPress={() => updateQuantity(id, -1)}
                        >
                          <Ionicons name="remove" size={14} color="#374151" />
                        </StyledTouchableOpacity>
                        <StyledText className="font-bold text-gray-950 mx-2 text-sm">{qty}</StyledText>
                        <StyledTouchableOpacity 
                          className="bg-primary w-6 h-6 rounded items-center justify-center"
                          onPress={() => updateQuantity(id, 1)}
                        >
                          <Ionicons name="add" size={14} color="#FFFFFF" />
                        </StyledTouchableOpacity>
                      </StyledView>

                      {/* Segmented Switch for Override */}
                      <StyledView className="flex-row bg-gray-100 p-0.5 rounded-lg border border-gray-200">
                        <StyledTouchableOpacity
                          className={`px-3 py-1 rounded-md ${fulfillment === 'Counter' ? 'bg-white shadow-sm' : ''}`}
                          onPress={() => setItemFulfillment(prev => ({ ...prev, [id]: 'Counter' }))}
                        >
                          <StyledText className={`text-[10px] font-bold ${fulfillment === 'Counter' ? 'text-primary' : 'text-gray-500'}`}>Counter</StyledText>
                        </StyledTouchableOpacity>
                        <StyledTouchableOpacity
                          className={`px-3 py-1 rounded-md ${fulfillment === 'Seat' ? 'bg-white shadow-sm' : ''}`}
                          onPress={() => setItemFulfillment(prev => ({ ...prev, [id]: 'Seat' }))}
                        >
                          <StyledText className={`text-[10px] font-bold ${fulfillment === 'Seat' ? 'text-primary' : 'text-gray-500'}`}>Seat</StyledText>
                        </StyledTouchableOpacity>
                      </StyledView>
                    </StyledView>
                  );
                })}
              </StyledScrollView>
            </StyledView>
          )}

          {/* Product Grid */}
          <StyledScrollView 
            className="flex-1 px-4 pt-4"
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            <StyledView className="flex-row flex-wrap justify-between pb-56">
              {(() => {
                // Filter to only ACTIVE products - customers should not see inactive items
                const activeProducts = products.filter(p => 
                  p && p.isAvailable === true
                );
                
                if (activeProducts.length === 0) {
                  return (
                    <StyledView className="flex-1 items-center justify-center pt-20 w-full">
                      <Ionicons name="fast-food-outline" size={64} color="#D1D5DB" />
                      <StyledText className="text-gray-400 text-lg mt-4 font-semibold">No items available</StyledText>
                    </StyledView>
                  );
                }
                
                return activeProducts.map(item => {
                  const qty = cart[item.id] || 0;
                  return (
                    <StyledView key={item.id} className="w-[48%] bg-white rounded-xl p-3 mb-4 shadow-sm border border-gray-100">
                      <StyledView className="relative items-center">
                        <Image 
                          source={
                            item.imageUri 
                              ? { uri: item.imageUri } 
                              : require('../../assets/images/icon.png')
                          } 
                          defaultSource={require('../../assets/images/icon.png')}
                          style={{ width: 100, height: 100, borderRadius: 16, marginBottom: 12, backgroundColor: '#F3F4F6' }}
                          resizeMode="cover"
                        />
                      </StyledView>
                      <StyledText className="font-bold text-gray-900 mb-1" numberOfLines={1}>{item.name}</StyledText>
                      <StyledText className="text-primary font-bold mb-3">₹{item.price}</StyledText>
                      
                      {qty === 0 ? (
                        <StyledTouchableOpacity 
                          className="py-2 rounded-xl items-center border bg-blue-50 border-blue-100"
                          onPress={() => updateQuantity(item.id, 1)}
                        >
                          <StyledText className="text-primary font-bold text-sm">
                            Add to Cart
                          </StyledText>
                        </StyledTouchableOpacity>
                      ) : (
                        <StyledView className="flex-row items-center justify-between bg-gray-100 rounded-xl p-1">
                          <StyledTouchableOpacity 
                            className="bg-white w-8 h-8 rounded-lg items-center justify-center shadow-sm"
                            onPress={() => updateQuantity(item.id, -1)}
                          >
                            <Ionicons name="remove" size={20} color="#374151" />
                          </StyledTouchableOpacity>
                          <StyledText className="font-bold text-gray-900">{qty}</StyledText>
                          <StyledTouchableOpacity 
                            className="bg-primary w-8 h-8 rounded-lg items-center justify-center shadow-sm"
                            onPress={() => updateQuantity(item.id, 1)}
                          >
                            <Ionicons name="add" size={20} color="#FFFFFF" />
                          </StyledTouchableOpacity>
                        </StyledView>
                      )}
                    </StyledView>
                  );
                });
              })()}
            </StyledView>
          </StyledScrollView>
        </>
      )}

      {/* Fixed Bottom Containers */}
      <StyledView className="absolute bottom-0 left-0 right-0 z-20">
        {/* Checkout Footer */}
        {isCanteenOpen && Object.keys(cart).length > 0 && (
          <StyledView className="bg-white border-t border-gray-200 px-6 py-4 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] flex-row items-center justify-between">
            <StyledView>
              <StyledText className="text-gray-500 text-sm font-medium">Grand Total</StyledText>
              <StyledText className="text-2xl font-black text-gray-900">₹{cartTotal}</StyledText>
            </StyledView>
            <StyledTouchableOpacity 
              className="bg-primary px-8 py-4 rounded-2xl flex-row items-center shadow-md shadow-blue-500/30"
              onPress={handleSubmitOrder}
            >
              <StyledText className="text-white font-bold text-lg mr-2">Submit Order</StyledText>
              <Ionicons name="arrow-forward" size={20} color="white" />
            </StyledTouchableOpacity>
          </StyledView>
        )}

        {/* Taskbar Navigation */}
        <StyledView className="bg-white border-t border-gray-200 shadow-sm flex-row items-center justify-between px-8 pt-4 pb-8">
          <StyledTouchableOpacity 
            className="items-center justify-center"
            onPress={() => navigation.navigate('Dashboard')}
          >
            <Ionicons name="home" size={28} color="#2563EB" />
          </StyledTouchableOpacity>
          {/* Balanced empty space for future central buttons */}
          <StyledView className="flex-1" />
          <StyledTouchableOpacity 
            className="items-center justify-center"
            onPress={() => navigation.navigate('Management')}
          >
            <Ionicons name="person" size={28} color="#6B7280" />
          </StyledTouchableOpacity>
        </StyledView>
      </StyledView>

      {/* Checkout Confirmation Modal (Split Summary Overlay) */}
      <Modal
        visible={confirmVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setConfirmVisible(false)}
      >
        <StyledView className="flex-1 bg-black/50 justify-end">
          <StyledView className="bg-white rounded-t-[32px] p-6 pb-10 shadow-2xl border-t border-gray-100 max-h-[85%]">
            <StyledView className="items-center mb-6">
              <StyledView className="w-12 h-1.5 bg-gray-200 rounded-full mb-4" />
              <StyledText className="text-xl font-extrabold text-gray-900">Checkout Confirmation</StyledText>
            </StyledView>

            <StyledScrollView showsVerticalScrollIndicator={false} className="mb-6">
              {/* Customer Details */}
              <StyledView className="bg-gray-50 rounded-2xl p-4 mb-4 border border-gray-100">
                <StyledText className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Customer Info</StyledText>
                <StyledText className="text-gray-800 text-sm font-semibold mb-1">📞 Mobile: {mobile}</StyledText>
                {seat ? (
                  <StyledText className="text-gray-800 text-sm font-semibold">💺 Seat: {seat}</StyledText>
                ) : null}
              </StyledView>

              {/* Counter Items Split */}
              {Object.entries(cart).some(([id, qty]) => itemFulfillment[id] === 'Counter') && (
                <StyledView className="mb-4">
                  <StyledView className="flex-row items-center mb-2">
                    <StyledView className="bg-blue-100 px-2 py-0.5 rounded mr-2">
                      <StyledText className="text-blue-700 text-[10px] font-black tracking-wider">COUNTER</StyledText>
                    </StyledView>
                    <StyledText className="text-sm font-bold text-gray-900">Handover Immediately</StyledText>
                  </StyledView>
                  <StyledView className="bg-blue-50/50 rounded-2xl p-3 border border-blue-100/50">
                    {Object.entries(cart).map(([id, qty]) => {
                      if (itemFulfillment[id] !== 'Counter') return null;
                      const product = products.find(p => p.id === id);
                      return (
                        <StyledView key={id} className="flex-row justify-between py-1">
                          <StyledText className="text-gray-700 text-sm">{qty}x {product?.name}</StyledText>
                          <StyledText className="text-gray-900 font-bold text-sm">₹{(product?.price || 0) * qty}</StyledText>
                        </StyledView>
                      );
                    })}
                  </StyledView>
                </StyledView>
              )}

              {/* Seat Items Split */}
              {Object.entries(cart).some(([id, qty]) => itemFulfillment[id] === 'Seat') && (
                <StyledView className="mb-4">
                  <StyledView className="flex-row items-center mb-2">
                    <StyledView className="bg-orange-100 px-2 py-0.5 rounded mr-2">
                      <StyledText className="text-orange-700 text-[10px] font-black tracking-wider">KITCHEN</StyledText>
                    </StyledView>
                    <StyledText className="text-sm font-bold text-gray-900">Deliver to Seat {seat ? `(${seat})` : ''}</StyledText>
                  </StyledView>
                  <StyledView className="bg-orange-50/50 rounded-2xl p-3 border border-orange-100/50">
                    {Object.entries(cart).map(([id, qty]) => {
                      if (itemFulfillment[id] !== 'Seat') return null;
                      const product = products.find(p => p.id === id);
                      return (
                        <StyledView key={id} className="flex-row justify-between py-1">
                          <StyledText className="text-gray-700 text-sm">{qty}x {product?.name}</StyledText>
                          <StyledText className="text-gray-900 font-bold text-sm">₹{(product?.price || 0) * qty}</StyledText>
                        </StyledView>
                      );
                    })}
                  </StyledView>
                </StyledView>
              )}
            </StyledScrollView>

            {/* Total */}
            <StyledView className="border-t border-gray-200 pt-4 flex-row items-center justify-between mb-6">
              <StyledView>
                <StyledText className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Total Amount</StyledText>
                <StyledText className="text-3xl font-black text-gray-900">₹{cartTotal}</StyledText>
              </StyledView>
            </StyledView>

            {/* Actions */}
            <StyledView className="flex-row">
              <StyledTouchableOpacity 
                className="flex-1 bg-gray-100 py-4 rounded-2xl items-center mr-2 border border-gray-200"
                onPress={() => setConfirmVisible(false)}
              >
                <StyledText className="text-gray-700 font-bold text-base">Cancel</StyledText>
              </StyledTouchableOpacity>
              <StyledTouchableOpacity 
                className="flex-[2] bg-primary py-4 rounded-2xl items-center shadow-lg shadow-blue-500/20"
                onPress={handleConfirmSubmit}
              >
                <StyledText className="text-white font-extrabold text-base">Confirm & Submit</StyledText>
              </StyledTouchableOpacity>
            </StyledView>
          </StyledView>
        </StyledView>
      </Modal>
    </StyledView>
  );
}
