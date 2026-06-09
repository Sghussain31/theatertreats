import React, { useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Platform } from 'react-native';
import { UserContext } from '../context/UserContext';
import { colors } from '../theme/colors';

export default function SharedHeader() {
  const { userName, phoneNumber, theater, setTheater } = useContext(UserContext);

  const toggleTheater = () => {
    setTheater(theater === '35mm Screen Desk' ? '70mm Screen Desk' : '35mm Screen Desk');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.brandingBar}>
        <Text style={styles.brandingText}>TheaterTreats Controller</Text>
      </View>
      <View style={styles.container}>
        <View style={styles.userInfo}>
          <Text style={styles.greetingText}>Hi {userName}</Text>
          <Text style={styles.phoneText}>{phoneNumber}</Text>
        </View>
        <TouchableOpacity style={styles.selectorBtn} onPress={toggleTheater} activeOpacity={0.8}>
          <Text style={styles.selectorLabel}>THEATER</Text>
          <Text style={styles.selectorText}>{theater}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.white,
    paddingTop: Platform.OS === 'android' ? 35 : 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  brandingBar: {
    backgroundColor: '#FFD700',
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandingText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 1,
  },
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: colors.white,
  },
  userInfo: {
    flex: 1,
  },
  greetingText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 4,
  },
  phoneText: {
    fontSize: 14,
    color: colors.textDark,
    fontWeight: '400',
  },
  selectorBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorLabel: {
    color: colors.secondary,
    fontSize: 10,
    fontWeight: '400',
    marginBottom: 2,
  },
  selectorText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
});
