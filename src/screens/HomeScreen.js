import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, Alert } from 'react-native';
import { useMockContext } from '../context/MockContext';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { DEBUG } from '../utils/debug';

export default function HomeScreen() {
  const { user, selectedTheatre, logout, activeRole, setActiveRole } = useMockContext();
  const navigation = useNavigation();
  const [accessDeniedVisible, setAccessDeniedVisible] = useState(false);
  const [profileSettingsVisible, setProfileSettingsVisible] = useState(false);
  const [viewingPrivacyPolicy, setViewingPrivacyPolicy] = useState(false);
  const [viewingTermsOfService, setViewingTermsOfService] = useState(false);

  useEffect(() => {
    if (DEBUG) {
      debugger;
      console.log("[DEBUG] HomeScreen mounted");
    }
  }, []);

  const handleLogout = () => {
    if (DEBUG) {
      debugger;
      console.log("[DEBUG] Logging out from Home");
    }
    logout();
  };

  const handleDeleteAccountRequest = () => {
    Alert.alert(
      "Request Account Deletion",
      "As an enterprise staff account, your access is managed by theater administration. Requesting account deletion will flag your profile for suspension and notify your Canteen Administrator. Proceed?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Confirm Request", 
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Request Submitted",
              "Deletion request submitted. Your Canteen Administrator has been notified to disable your credentials."
            );
          }
        }
      ]
    );
  };

  const navigateTo = (screenName) => {
    if (DEBUG) {
      debugger;
      console.log(`[DEBUG] Navigating to ${screenName}`);
    }
    navigation.navigate(screenName);
  };

  const userRoles = user?.roles || (user?.role ? [user.role] : []);
  const isAdminUser = userRoles.includes('Admin');

  const isTileAccessible = (tileRole) => {
    if (isAdminUser) return true; // Admins bypass all guards
    if (tileRole === 'Admin') return false; // Non-admins can never access Admin screen
    return activeRole === tileRole;
  };

  const handleTilePress = (screenName, requiredRole) => {
    const isAccessible = isTileAccessible(requiredRole);
    if (isAccessible) {
      navigateTo(screenName);
    } else {
      setAccessDeniedVisible(true);
    }
  };

  const renderCard = (screenName, requiredRole, iconName, iconColor, bgColor, title, desc) => {
    const isAccessible = isTileAccessible(requiredRole);
    return (
      <TouchableOpacity 
        style={[styles.card, !isAccessible && styles.lockedCard]} 
        onPress={() => handleTilePress(screenName, requiredRole)} 
        activeOpacity={0.8}
      >
        <View style={[styles.iconContainer, { backgroundColor: isAccessible ? bgColor : '#F3F4F6' }]}>
          <Ionicons name={iconName} size={32} color={isAccessible ? iconColor : '#9CA3AF'} />
        </View>
        <Text style={[styles.cardTitle, !isAccessible && { color: '#6B7280' }]}>{title}</Text>
        <Text style={styles.cardDesc}>{desc}</Text>
        {!isAccessible && (
          <View style={styles.lockBadge}>
            <Ionicons name="lock-closed" size={12} color="#9CA3AF" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Dashboard</Text>
          <Text style={styles.headerSubtitle}>{selectedTheatre || 'Select Location'}</Text>
        </View>
        <TouchableOpacity style={styles.profileIcon} onPress={() => setProfileSettingsVisible(true)}>
          <Ionicons name="person-circle-outline" size={36} color="#1F2937" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
        {/* Daily Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusGreeting}>Hello, {user?.name || 'Staff'}!</Text>
            <View style={styles.badge}>
              <Ionicons name="shield-checkmark" size={14} color="#1E40AF" />
              <Text style={styles.badgeText}>Active Role: {activeRole || 'None'}</Text>
            </View>
          </View>
          
          <View style={styles.statusDetails}>
            <Text style={styles.detailsText}>
              📍 <Text style={{ fontWeight: '600' }}>Theatre:</Text> {selectedTheatre}
            </Text>
            <Text style={styles.detailsText}>
              👤 <Text style={{ fontWeight: '600' }}>Assigned Roles:</Text> {userRoles.join(', ')}
            </Text>
          </View>

          {/* Role Switcher Bar */}
          {userRoles.length > 1 && (
            <View style={styles.switcherContainer}>
              <Text style={styles.switcherLabel}>Switch Active Role for Today:</Text>
              <View style={styles.switcherChips}>
                {userRoles.map((role) => {
                  const isActive = activeRole === role;
                  return (
                    <TouchableOpacity
                      key={role}
                      style={[styles.chip, isActive && styles.activeChip]}
                      onPress={() => setActiveRole(role)}
                    >
                      <Text style={[styles.chipText, isActive && styles.activeChipText]}>
                        {role}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </View>

        {/* Dashboard Grid */}
        <View style={styles.gridContainer}>
          {renderCard('NewOrder', 'Cashier', 'cart', '#2563EB', '#EFF6FF', 'New Order', 'POS Terminal')}
          {renderCard('Kitchen', 'Kitchen', 'restaurant', '#DC2626', '#FEF2F2', 'Kitchen Queue', 'Manage Food Orders')}
          {renderCard('Delivery', 'Delivery', 'bicycle', '#059669', '#ECFDF5', 'Delivery Status', 'Seat Deliveries')}
          {renderCard('Management', 'Admin', 'settings', '#4B5563', '#F3F4F6', 'Admin Panel', 'Products & Staff')}
        </View>
      </ScrollView>

      {/* Access Denied Custom Modal */}
      <Modal
        visible={accessDeniedVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setAccessDeniedVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconContainer}>
              <Ionicons name="lock-closed" size={32} color="#DC2626" />
            </View>
            <Text style={styles.modalTitle}>Access Denied</Text>
            <Text style={styles.modalMessage}>
              You do not have access to this role. Contact Admin.
            </Text>
            <TouchableOpacity 
              style={styles.modalButton} 
              onPress={() => setAccessDeniedVisible(false)}
            >
              <Text style={styles.modalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Profile & Settings Modal */}
      <Modal
        visible={profileSettingsVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setProfileSettingsVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 360, paddingVertical: 20 }]}>
            <View style={styles.profileModalHeader}>
              <Text style={styles.profileModalTitle}>Staff Profile & Settings</Text>
              <TouchableOpacity onPress={() => setProfileSettingsVisible(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.profileInfoContainer}>
              <View style={styles.profileAvatarContainer}>
                <Ionicons name="person-circle" size={64} color="#2563EB" />
              </View>
              
              <View style={styles.profileRow}>
                <Text style={styles.profileLabel}>Username:</Text>
                <Text style={styles.profileValue}>{user?.name || 'Staff'}</Text>
              </View>
              <View style={styles.profileRow}>
                <Text style={styles.profileLabel}>Mobile Number:</Text>
                <Text style={styles.profileValue}>{user?.phone || 'N/A'}</Text>
              </View>
              <View style={styles.profileRow}>
                <Text style={styles.profileLabel}>Active Theater:</Text>
                <Text style={styles.profileValue}>{selectedTheatre || 'N/A'}</Text>
              </View>
              <View style={styles.profileRow}>
                <Text style={styles.profileLabel}>Roles Bound:</Text>
                <Text style={styles.profileValue}>{userRoles.join(', ')}</Text>
              </View>
            </View>

            {/* Action Toggles for Compliance Documents */}
            <View style={styles.legalSection}>
              <Text style={styles.legalSectionTitle}>Legal & Compliance</Text>
              
              <TouchableOpacity 
                style={styles.legalOptionButton}
                onPress={() => setViewingPrivacyPolicy(true)}
              >
                <View style={styles.legalOptionLeft}>
                  <Ionicons name="shield-half-outline" size={20} color="#4B5563" />
                  <Text style={styles.legalOptionText}>Privacy Policy</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.legalOptionButton}
                onPress={() => setViewingTermsOfService(true)}
              >
                <View style={styles.legalOptionLeft}>
                  <Ionicons name="document-text-outline" size={20} color="#4B5563" />
                  <Text style={styles.legalOptionText}>Terms & Conditions</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* Account Deletion and Logout Actions */}
            <View style={styles.profileActionContainer}>
              <TouchableOpacity 
                style={styles.profileDeleteButton}
                onPress={handleDeleteAccountRequest}
              >
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
                <Text style={styles.profileDeleteButtonText}>Request Account Deletion</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.profileLogoutButton}
                onPress={() => {
                  setProfileSettingsVisible(false);
                  handleLogout();
                }}
              >
                <Ionicons name="log-out-outline" size={18} color="#4B5563" />
                <Text style={styles.profileLogoutButtonText}>Log Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Privacy Policy Modal */}
      <Modal
        visible={viewingPrivacyPolicy}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setViewingPrivacyPolicy(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 360, maxHeight: '80%' }]}>
            <View style={styles.profileModalHeader}>
              <Text style={styles.profileModalTitle}>Privacy Policy</Text>
              <TouchableOpacity onPress={() => setViewingPrivacyPolicy(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.legalScrollView} showsVerticalScrollIndicator={true}>
              <Text style={styles.legalTextHeader}>Last Updated: May 22, 2026</Text>
              <Text style={styles.legalTextBody}>
                This Privacy Policy explains how {"\""}TheaterTreats{"\""} ({"\""}we,{"\""} {"\""}us,{"\""} or {"\""}our{"\""}) collects, uses, stores, and protects information relating to staff members and operations.{"\n\n"}
                The App is an internal workflow tool deployed for employees operating at {"\""}35mm Screen Desk{"\""} and {"\""}70mm Screen Desk{"\""} theater facilities.{"\n\n"}
                <Text style={{ fontWeight: 'bold' }}>1. Information We Collect:</Text>{"\n"}
                • Mobile Number for account setup and verification.{"\n"}
                • Username / Name for account profiling and operational labeling.{"\n"}
                • Credentials for login authentication.{"\n"}
                • Auditorium Seat numbers (e.g., {"\""}F12{"\""}) solely for delivering orders in seats (no GPS/fine location tracking is performed).{"\n"}
                • Purchase History and transaction logs for financial audit records.{"\n"}
                • System logs, operating system versions, and backend query metrics.{"\n\n"}
                <Text style={{ fontWeight: 'bold' }}>2. Storage & Security:</Text>{"\n"}
                Data is securely transmitted via HTTPS/TLS and saved in secure backend relational databases (MySQL) and S3 storage instances. Role-Based Access Control is enforced.{"\n\n"}
                <Text style={{ fontWeight: 'bold' }}>3. Data Sharing:</Text>{"\n"}
                We do not sell, rent, trade, or share staff or customer data with third-party advertisers or marketing networks. All data is processed internally.{"\n\n"}
                <Text style={{ fontWeight: 'bold' }}>4. Retention & Deletion:</Text>{"\n"}
                Data is retained for the duration of your staff employment. You may request account deletion directly from the Profile Settings screen.
              </Text>
            </ScrollView>
            <TouchableOpacity 
              style={[styles.modalButton, { backgroundColor: '#2563EB', marginTop: 16 }]} 
              onPress={() => setViewingPrivacyPolicy(false)}
            >
              <Text style={styles.modalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Terms of Service Modal */}
      <Modal
        visible={viewingTermsOfService}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setViewingTermsOfService(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 360, maxHeight: '80%' }]}>
            <View style={styles.profileModalHeader}>
              <Text style={styles.profileModalTitle}>Terms & Conditions</Text>
              <TouchableOpacity onPress={() => setViewingTermsOfService(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.legalScrollView} showsVerticalScrollIndicator={true}>
              <Text style={styles.legalTextHeader}>Last Updated: May 22, 2026</Text>
              <Text style={styles.legalTextBody}>
                These Terms govern the use of the {"\""}TheaterTreats{"\""} App by staff at {"\""}35mm Screen Desk{"\""} and {"\""}70mm Screen Desk{"\""} theater facilities.{"\n\n"}
                <Text style={{ fontWeight: 'bold' }}>1. Account Credentials & Security:</Text>{"\n"}
                Access is restricted to authorized personnel. Users are responsible for maintaining credential secrecy and preventing unauthorized use.{"\n\n"}
                <Text style={{ fontWeight: 'bold' }}>2. Role Access (RBAC):</Text>{"\n"}
                Users are strictly limited to features matching their daily active role (Admin, Cashier, Kitchen, or Delivery). Bypassing access guards is a violation of policy. Admin accounts bypass all controls.{"\n\n"}
                <Text style={{ fontWeight: 'bold' }}>3. Order Operations & Accuracy:</Text>{"\n"}
                • Cashiers must verify transaction details, split fulfillment modes (Counter vs. Seat), and input correct seat coordinates.{"\n"}
                • Kitchen staff must utilize gesture-driven swipe actions immediately to keep order lists accurate.{"\n"}
                • Delivery staff must locate the exact seat coordinates to complete handoffs.{"\n\n"}
                <Text style={{ fontWeight: 'bold' }}>4. Canteen Operations Lockout:</Text>{"\n"}
                POS terminals will be disabled and display {"\""}Canteen Closed{"\""} when the Admin toggles operations off at night. Staff must respect this schedule.{"\n\n"}
                <Text style={{ fontWeight: 'bold' }}>5. Disclaimers:</Text>{"\n"}
                The App is provided {"\""}as-is{"\""}. We are not liable for inventory discrepancies or delivery delays caused by connectivity issues or incorrect data entry.
              </Text>
            </ScrollView>
            <TouchableOpacity 
              style={[styles.modalButton, { backgroundColor: '#2563EB', marginTop: 16 }]} 
              onPress={() => setViewingTermsOfService(false)}
            >
              <Text style={styles.modalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
    marginTop: 2,
  },
  profileIcon: {
    padding: 4,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusGreeting: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E40AF',
    marginLeft: 4,
  },
  statusDetails: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12,
  },
  detailsText: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 4,
  },
  switcherContainer: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12,
  },
  switcherLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  switcherChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    marginRight: 8,
    marginBottom: 8,
  },
  activeChip: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  activeChipText: {
    color: '#FFFFFF',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    backgroundColor: '#FFFFFF',
    width: '48%',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    position: 'relative',
  },
  lockedCard: {
    opacity: 0.55,
    borderColor: '#E5E7EB',
    borderWidth: 1,
    backgroundColor: '#F9FAFB',
    shadowOpacity: 0.02,
    elevation: 1,
  },
  lockBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    maxWidth: 340,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  modalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  modalButton: {
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  profileModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 12,
    marginBottom: 16,
  },
  profileModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  profileInfoContainer: {
    width: '100%',
    alignItems: 'stretch',
    marginBottom: 20,
  },
  profileAvatarContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  profileLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  profileValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  legalSection: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 16,
    marginBottom: 20,
  },
  legalSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 10,
  },
  legalOptionButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    marginBottom: 8,
  },
  legalOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legalOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
    marginLeft: 8,
  },
  profileActionContainer: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 16,
    alignItems: 'center',
  },
  profileDeleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    marginBottom: 12,
  },
  profileDeleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
    marginLeft: 8,
  },
  profileLogoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  profileLogoutButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
    marginLeft: 8,
  },
  legalScrollView: {
    maxHeight: 250,
    width: '100%',
    marginVertical: 12,
  },
  legalTextHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 12,
  },
  legalTextBody: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
});
