import React, { useContext, useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { InventoryContext } from '../context/InventoryContext';
import { CartContext } from '../context/CartContext';
import ProductCard from '../components/ProductCard';
import { colors } from '../theme/colors';
import { DEBUG } from '../utils/debug';

export default function POSTerminalScreen() {
  const { products } = useContext(InventoryContext);
  const { cart, clearCart, placeOrder } = useContext(CartContext);
  const [activeTab, setActiveTab] = useState('S');

  const totalAmount = products.reduce((sum, item) => sum + (cart[item.id] || 0) * item.price, 0);

  useEffect(() => {
    if (DEBUG) {
      debugger;
      console.log("[DEBUG] POSTerminalScreen mounted");
    }
  }, []);

  const handleProceed = () => {
    if (DEBUG) {
      debugger;
      console.log("[DEBUG] handleProceed clicked. Total:", totalAmount);
    }
    if (totalAmount === 0) return;
    const itemsArray = products
      .filter(p => cart[p.id] > 0)
      .map(p => ({ ...p, qty: cart[p.id] }));
    
    if (DEBUG) console.log("[DEBUG] Placing order with items:", itemsArray);
    placeOrder(totalAmount, itemsArray);
    Alert.alert("Success", `Order Placed! Total: ₹${totalAmount}`);
  };

  const handleClearCart = () => {
    if (DEBUG) {
      debugger;
      console.log("[DEBUG] Clearing cart");
    }
    clearCart();
  };

  const renderContent = () => {
    if (activeTab === 'A') {
      return (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>All Transactions Ledger view</Text>
        </View>
      );
    }
    
    // Default to 'S' (Sell). C and P are typically handled in Kitchen Screen.
    if (activeTab === 'C' || activeTab === 'P') {
       return (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>Please navigate to the Kitchen module from the bottom tabs for Cook & Pick-up displays.</Text>
        </View>
      );
    }

    return (
      <>
        <FlatList
          data={products}
          renderItem={({ item }) => <ProductCard item={item} />}
          keyExtractor={item => item.id}
          numColumns={2}
          contentContainerStyle={styles.gridContainer}
        />
        <View style={styles.paymentSummary}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Due</Text>
            <Text style={styles.totalValue}>₹{totalAmount}</Text>
          </View>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.clearBtn} onPress={handleClearCart} activeOpacity={0.7}>
              <Text style={styles.clearBtnText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.proceedBtn, totalAmount === 0 && styles.proceedBtnDisabled]} 
              onPress={handleProceed}
              disabled={totalAmount === 0}
              activeOpacity={0.7}
            >
              <Text style={styles.proceedBtnText}>Charge ₹{totalAmount}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabsBar}>
        {['(S)ell', '(C)ook', '(P)ick-up', '(A)ll-Trans'].map((tab, idx) => {
          const tabKey = tab.charAt(1);
          const isActive = activeTab === tabKey;
          return (
            <TouchableOpacity 
              key={idx} 
              style={[styles.tabBtn, isActive && styles.tabBtnActive]}
              onPress={() => setActiveTab(tabKey)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {renderContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  tabsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.white,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
  },
  tabBtnActive: {
    backgroundColor: colors.secondary,
    borderColor: colors.primary,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.textLight,
  },
  tabTextActive: {
    color: colors.primary,
  },
  gridContainer: { padding: 8, paddingBottom: 20 },
  paymentSummary: {
    backgroundColor: colors.white,
    padding: 15,
    borderTopWidth: 3,
    borderTopColor: colors.primary,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.textDark,
  },
  totalValue: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.primary,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  clearBtn: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.danger,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginRight: 10,
  },
  clearBtnText: {
    color: colors.danger,
    fontSize: 18,
    fontWeight: '900',
  },
  proceedBtn: {
    flex: 2,
    backgroundColor: colors.primary,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000080',
  },
  proceedBtnDisabled: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  proceedBtnText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '900',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  placeholderText: {
    color: colors.textLight,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
  }
});
