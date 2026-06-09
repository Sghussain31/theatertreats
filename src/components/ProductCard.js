import React, { useContext, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { colors } from '../theme/colors';
import { CartContext } from '../context/CartContext';

export default function ProductCard({ item }) {
  const { cart, handleAdd, handleRemove } = useContext(CartContext);
  const [imageError, setImageError] = useState(false);
  const qty = cart[item.id] || 0;

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <View style={[styles.card, item.outOfStock && styles.outOfStockCard]}>
      {qty > 0 && (
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{qty}</Text>
        </View>
      )}

      {imageError ? (
        <View style={styles.fallbackContainer}>
          <Text style={styles.fallbackText}>{getInitials(item.name)}</Text>
        </View>
      ) : (
        <Image 
          source={item.image} 
          style={styles.productImage} 
          resizeMode={item.category === 'Beverages' ? 'contain' : 'cover'}
          onError={() => setImageError(true)}
        />
      )}
      
      <View style={styles.infoContainer}>
        <Text style={styles.category}>{item.category}</Text>
        <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.price}>₹{item.price}</Text>
      </View>
      
      {item.outOfStock ? (
        <View style={styles.outOfStockBadge}>
          <Text style={styles.outOfStockText}>Out of Stock</Text>
        </View>
      ) : (
        <View style={styles.qtyContainer}>
          <TouchableOpacity style={styles.minusBtn} onPress={() => handleRemove(item.id)} activeOpacity={0.7}>
            <Text style={styles.minusBtnText}>-</Text>
          </TouchableOpacity>
          <Text style={styles.qtyText}>{qty}</Text>
          <TouchableOpacity style={styles.plusBtn} onPress={() => handleAdd(item.id)} activeOpacity={0.7}>
            <Text style={styles.plusBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    margin: 8,
    backgroundColor: colors.white,
    borderRadius: 15, 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 5,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  outOfStockCard: {
    opacity: 0.6,
  },
  countBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: colors.primary,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderWidth: 2,
    borderColor: colors.white,
  },
  countBadgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  productImage: {
    width: '100%',
    height: 120,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    marginBottom: 8,
  },
  fallbackContainer: {
    width: '100%',
    height: 120,
    borderRadius: 10,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  fallbackText: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 2,
  },
  infoContainer: {
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  category: {
    fontSize: 12,
    color: colors.textLight,
    marginBottom: 2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textDark,
    marginBottom: 4,
    textAlign: 'center',
    minHeight: 40,
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
  },
  qtyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 10,
  },
  minusBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e0e0e0', // Light grey for hierarchy
    justifyContent: 'center',
    alignItems: 'center',
  },
  minusBtnText: {
    color: colors.textDark,
    fontWeight: 'bold',
    fontSize: 22,
    lineHeight: 24,
  },
  plusBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary, // Solid Primary Blue
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusBtnText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 22,
    lineHeight: 24,
  },
  qtyText: {
    fontWeight: 'bold',
    fontSize: 18,
    color: colors.textDark,
  },
  outOfStockBadge: {
    backgroundColor: colors.danger,
    paddingVertical: 10,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  outOfStockText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 12,
  },
});
