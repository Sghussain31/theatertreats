import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Image, Switch, Modal, RefreshControl, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { useMockContext } from '../context/MockContext';
import * as ImagePicker from 'expo-image-picker';
import { styled } from 'nativewind';
import { Ionicons } from '@expo/vector-icons';
import { DEBUG } from '../utils/debug';
import { API_URL } from '../utils/api';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledScrollView = styled(ScrollView);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledTextInput = styled(TextInput);
const StyledImage = styled(Image);
const StyledSwitch = styled(Switch);

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
const EditProductModal = ({ visible, product, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [image, setImage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (product) {
      setName(product.name);
      setPrice(product.price.toString());
      setImage(product.image_url || product.imageUri);
    } else {
      setName('');
      setPrice('');
      setImage('');
    }
  }, [product]);

  const pickEditImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const handleEditProduct = async () => {
    if (!name || !price || !image) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }
    setIsSubmitting(true);
    try {
      await onSave(product.id, {
        name: name,
        price: parseFloat(price),
        imageUri: image
      });
      Alert.alert('Success', 'Product updated successfully');
      onClose();
    } catch (err) {
      console.error('Error during handleEditProduct:', err);
      Alert.alert('Update Failed', err.message || 'Error occurred while updating product.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <StyledView className="flex-1 bg-black/50 justify-center items-center p-4">
        <StyledView className="bg-white rounded-2xl w-full p-6 shadow-lg">
          <StyledView className="flex-row justify-between items-center mb-5">
            <StyledText className="text-xl font-bold text-gray-900">Edit Product</StyledText>
            <StyledTouchableOpacity onPress={onClose}>
              <Ionicons name="close-outline" size={28} color="#4B5563" />
            </StyledTouchableOpacity>
          </StyledView>
          
          <StyledView className="space-y-4">
            <StyledTextInput
              className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900 mb-3"
              placeholder="Product Name"
              value={name}
              onChangeText={setName}
            />
            <StyledTextInput
              className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900 mb-3"
              placeholder="Price (₹)"
              keyboardType="numeric"
              value={price}
              onChangeText={setPrice}
            />
            <StyledTouchableOpacity 
              className="bg-gray-200 py-3 rounded-xl items-center mb-3 flex-row justify-center"
              onPress={pickEditImage}
            >
              <Ionicons name="image-outline" size={20} color="#4B5563" className="mr-2" />
              <StyledText className="text-gray-700 font-bold ml-2">Change Image</StyledText>
            </StyledTouchableOpacity>
            {image ? (
              <StyledImage source={{ uri: image }} className="w-24 h-24 rounded-xl mb-4 self-center" resizeMode="cover" />
            ) : null}
            
            <StyledTouchableOpacity 
              className={`py-4 rounded-xl items-center shadow-sm ${isSubmitting ? 'bg-gray-400' : 'bg-primary'}`}
              onPress={handleEditProduct}
              disabled={isSubmitting}
            >
              <StyledText className="text-white font-bold text-base">
                {isSubmitting ? 'Saving Changes...' : 'Save Changes'}
              </StyledText>
            </StyledTouchableOpacity>
          </StyledView>
        </StyledView>
      </StyledView>
    </Modal>
  );
};

const AddProductForm = ({ onAdd }) => {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [image, setImage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pickImage = async () => {
    if (DEBUG) {
      // console.log("[DEBUG] pickImage clicked");
    }
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const handleAddProduct = async () => {
    if (DEBUG) {
      // console.log("[DEBUG] handleAddProduct clicked", { name, price });
    }
    if (!name || !price || !image) {
      Alert.alert('Error', 'Please fill all product fields');
      return;
    }
    setIsSubmitting(true);
    const newProduct = {
      id: Math.random().toString(36).substr(2, 9),
      name: name,
      price: parseFloat(price),
      imageUri: image,
      category: 'General',
      isAvailable: true
    };
    try {
      await onAdd(newProduct);
      setName('');
      setPrice('');
      setImage('');
      Alert.alert('Success', 'Product registered successfully');
    } catch (err) {
      console.error('Error during handleAddProduct:', err);
      Alert.alert('Registration Failed', err.message || 'Error occurred while registering product.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <StyledView className="bg-white rounded-xl p-5 mb-6 shadow-sm border border-gray-100">
      <StyledText className="text-lg font-bold text-gray-900 mb-4">Add New Product</StyledText>
      
      <StyledView className="space-y-3">
        <StyledTextInput
          className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900 mb-3"
          placeholder="Product Name"
          value={name}
          onChangeText={setName}
        />
        <StyledTextInput
          className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900 mb-3"
          placeholder="Price (₹)"
          keyboardType="numeric"
          value={price}
          onChangeText={setPrice}
        />
        <StyledTouchableOpacity 
          className="bg-gray-200 py-3 rounded-xl items-center mb-3 flex-row justify-center"
          onPress={pickImage}
        >
          <Ionicons name="image-outline" size={20} color="#4B5563" className="mr-2" />
          <StyledText className="text-gray-700 font-bold ml-2">
            {image ? 'Change Image' : 'Upload Image'}
          </StyledText>
        </StyledTouchableOpacity>
        {image ? (
          <StyledImage source={{ uri: image }} className="w-20 h-20 rounded-xl mb-3 self-center" resizeMode="cover" />
        ) : null}
        <StyledTouchableOpacity 
          className={`py-3 rounded-xl items-center mt-2 shadow-sm ${isSubmitting ? 'bg-gray-400' : 'bg-primary'}`}
          onPress={handleAddProduct}
          disabled={isSubmitting}
        >
          <StyledText className="text-white font-bold">
            {isSubmitting ? 'Uploading to S3...' : 'Add Product'}
          </StyledText>
        </StyledTouchableOpacity>
      </StyledView>
    </StyledView>
  );
};

const EditStaffModal = ({ visible, member, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [roles, setRoles] = useState([]);
  const [theatres, setTheatres] = useState([]);

  const availableRoles = ['Admin', 'Cashier', 'Kitchen', 'Delivery'];
  const availableTheatres = ['35mm Screen Desk', '70mm Screen Desk'];

  useEffect(() => {
    if (member) {
      setName(member.name);
      setPhone(member.phone);
      setRoles(member.roles || (member.role ? [member.role] : []));
      setTheatres(member.theatres || ['35mm Screen Desk', '70mm Screen Desk']);
    } else {
      setName('');
      setPhone('');
      setRoles([]);
      setTheatres([]);
    }
  }, [member]);

  const toggleRole = (role) => {
    setRoles(prev => {
      const nextRoles = prev.includes(role) 
        ? prev.filter(r => r !== role) 
        : [...prev, role];
      if (nextRoles.includes('Admin')) {
        setTheatres(['35mm Screen Desk', '70mm Screen Desk']);
      }
      return nextRoles;
    });
  };

  const toggleTheatre = (theatre) => {
    if (roles.includes('Admin')) {
      Alert.alert('Admin Access', 'Admin users must have access to both theatres.');
      return;
    }
    setTheatres(prev => 
      prev.includes(theatre) 
        ? prev.filter(t => t !== theatre) 
        : [...prev, theatre]
    );
  };

  const handleEditStaff = () => {
    if (!name || !phone) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }
    if (roles.length === 0) {
      Alert.alert('Error', 'Please select at least one role');
      return;
    }
    if (theatres.length === 0) {
      Alert.alert('Error', 'Please select at least one theatre');
      return;
    }
    onSave(member.id, {
      name: name,
      phone: phone,
      role: roles[0],
      roles: roles,
      theatres: theatres
    });
    Alert.alert('Success', 'Staff details updated');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <StyledView className="flex-1 bg-black/50 justify-center items-center p-4">
        <StyledView className="bg-white rounded-2xl w-full p-6 shadow-lg max-h-[90%]">
          <StyledView className="flex-row justify-between items-center mb-5">
            <StyledText className="text-xl font-bold text-gray-900">Edit Staff Member</StyledText>
            <StyledTouchableOpacity onPress={onClose}>
              <Ionicons name="close-outline" size={28} color="#4B5563" />
            </StyledTouchableOpacity>
          </StyledView>
          
          <StyledScrollView showsVerticalScrollIndicator={false} className="space-y-4">
            <StyledText className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 ml-1">Username</StyledText>
            <StyledTextInput
              className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900 mb-3"
              placeholder="Staff Name"
              value={name}
              onChangeText={setName}
              autoCapitalize="none"
            />
            <StyledText className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 ml-1">Phone Number</StyledText>
            <StyledTextInput
              className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900 mb-3"
              placeholder="Phone Number"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
            
            <StyledText className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 ml-1">Roles</StyledText>
            <StyledView className="flex-row flex-wrap mb-3">
              {availableRoles.map(role => {
                const isSelected = roles.includes(role);
                return (
                  <StyledTouchableOpacity
                    key={role}
                    onPress={() => toggleRole(role)}
                    className={`px-3 py-2 rounded-xl mr-2 mb-2 border ${isSelected ? 'bg-blue-500 border-blue-500' : 'bg-gray-100 border-gray-200'}`}
                  >
                    <StyledText className={`font-bold text-xs ${isSelected ? 'text-white' : 'text-gray-600'}`}>{role}</StyledText>
                  </StyledTouchableOpacity>
                );
              })}
            </StyledView>
            
            <StyledText className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 ml-1">Bound Theatres</StyledText>
            <StyledView className="flex-row flex-wrap mb-4">
              {availableTheatres.map(theatre => {
                const isSelected = theatres.includes(theatre);
                return (
                  <StyledTouchableOpacity
                    key={theatre}
                    onPress={() => toggleTheatre(theatre)}
                    className={`px-3 py-2 rounded-xl mr-2 mb-2 border ${isSelected ? 'bg-purple-600 border-purple-600' : 'bg-gray-100 border-gray-200'}`}
                  >
                    <StyledText className={`font-bold text-xs ${isSelected ? 'text-white' : 'text-gray-600'}`}>{theatre}</StyledText>
                  </StyledTouchableOpacity>
                );
              })}
            </StyledView>
            
            <StyledTouchableOpacity 
              className="py-4 rounded-xl items-center shadow-sm bg-primary mb-4"
              onPress={handleEditStaff}
            >
              <StyledText className="text-white font-bold text-base">Save Changes</StyledText>
            </StyledTouchableOpacity>
          </StyledScrollView>
        </StyledView>
      </StyledView>
    </Modal>
  );
};

const AddStaffForm = ({ onAdd }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [roles, setRoles] = useState(['Cashier']);
  const [theatres, setTheatres] = useState(['35mm Screen Desk']);

  const availableRoles = ['Admin', 'Cashier', 'Kitchen', 'Delivery'];
  const availableTheatres = ['35mm Screen Desk', '70mm Screen Desk'];

  const toggleRole = (role) => {
    setRoles(prev => {
      const nextRoles = prev.includes(role) 
        ? prev.filter(r => r !== role) 
        : [...prev, role];
      if (nextRoles.includes('Admin')) {
        setTheatres(['35mm Screen Desk', '70mm Screen Desk']);
      }
      return nextRoles;
    });
  };

  const toggleTheatre = (theatre) => {
    if (roles.includes('Admin')) {
      Alert.alert('Admin Access', 'Admin users must have access to both theatres.');
      return;
    }
    setTheatres(prev => 
      prev.includes(theatre) 
        ? prev.filter(t => t !== theatre) 
        : [...prev, theatre]
    );
  };

  const handleAddStaff = () => {
    if (DEBUG) {
      // console.log("[DEBUG] handleAddStaff clicked", { name, roles, theatres });
    }
    if (!name || !phone) {
      Alert.alert('Error', 'Please enter staff name and phone');
      return;
    }
    if (roles.length === 0) {
      Alert.alert('Error', 'Please select at least one role');
      return;
    }
    if (theatres.length === 0) {
      Alert.alert('Error', 'Please select at least one theatre');
      return;
    }
    const newStaffMember = {
      id: Math.random().toString(36).substr(2, 9),
      name: name,
      phone: phone,
      role: roles[0],
      roles: roles,
      theatres: theatres
    };
    onAdd(newStaffMember);
    setName('');
    setPhone('');
    setRoles(['Cashier']);
    setTheatres(['35mm Screen Desk']);
    Alert.alert('Success', 'Staff added successfully');
  };

  return (
    <StyledView className="bg-white rounded-xl p-5 mb-6 shadow-sm border border-gray-100">
      <StyledText className="text-lg font-bold text-gray-900 mb-4">Add New Staff</StyledText>
      
      <StyledView className="space-y-3">
        <StyledTextInput
          className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900 mb-3"
          placeholder="Staff Name (Username)"
          value={name}
          onChangeText={setName}
          autoCapitalize="none"
        />
        <StyledTextInput
          className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900 mb-3"
          placeholder="Phone Number"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />
        
        <StyledText className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 ml-1">Select Roles</StyledText>
        <StyledView className="flex-row flex-wrap mb-3">
          {availableRoles.map(role => {
            const isSelected = roles.includes(role);
            return (
              <StyledTouchableOpacity
                key={role}
                onPress={() => toggleRole(role)}
                className={`px-3 py-2 rounded-xl mr-2 mb-2 border ${isSelected ? 'bg-blue-500 border-blue-500' : 'bg-gray-100 border-gray-200'}`}
              >
                <StyledText className={`font-bold text-xs ${isSelected ? 'text-white' : 'text-gray-600'}`}>{role}</StyledText>
              </StyledTouchableOpacity>
            );
          })}
        </StyledView>

        <StyledText className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 ml-1">Select Theatres</StyledText>
        <StyledView className="flex-row flex-wrap mb-3">
          {availableTheatres.map(theatre => {
            const isSelected = theatres.includes(theatre);
            return (
              <StyledTouchableOpacity
                key={theatre}
                onPress={() => toggleTheatre(theatre)}
                className={`px-3 py-2 rounded-xl mr-2 mb-2 border ${isSelected ? 'bg-purple-600 border-purple-600' : 'bg-gray-100 border-gray-200'}`}
              >
                <StyledText className={`font-bold text-xs ${isSelected ? 'text-white' : 'text-gray-600'}`}>{theatre}</StyledText>
              </StyledTouchableOpacity>
            );
          })}
        </StyledView>

        <StyledTouchableOpacity 
          className="bg-primary py-3 rounded-xl items-center mt-2 shadow-sm"
          onPress={handleAddStaff}
        >
          <StyledText className="text-white font-bold">Add Staff Member</StyledText>
        </StyledTouchableOpacity>
      </StyledView>
    </StyledView>
  );
};

const StaffInputCard = React.memo(({ item, onEdit, onDelete }) => {
  const roles = item.roles || (item.role ? [item.role] : []);
  const theatres = item.theatres || ['35mm Screen Desk', '70mm Screen Desk'];
  return (
    <StyledView className="bg-white rounded-xl p-4 mb-3 shadow-sm flex-row items-center justify-between border border-gray-100">
      <StyledView className="flex-row items-center flex-1 mr-2">
        <StyledView className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center mr-3">
          <Ionicons name="person" size={18} color="#6B7280" />
        </StyledView>
        <StyledView className="flex-1">
          <StyledText className="font-bold text-gray-900 text-base">{item.username || item.name}</StyledText>
          <StyledText className="text-gray-500 text-xs mb-1">{item.mobile || item.phone}</StyledText>
          <StyledText className="text-gray-400 text-[11px] font-semibold">📍 {theatres.join(', ')}</StyledText>
        </StyledView>
      </StyledView>
      
      <StyledView className="items-end">
        <StyledView className="flex-row flex-wrap justify-end mb-2 max-w-[150px]">
          {roles.map(r => {
            let badgeBg = 'bg-blue-50 border-blue-100';
            let badgeText = 'text-blue-700';
            if (r === 'Admin') {
              badgeBg = 'bg-gray-100 border-gray-200';
              badgeText = 'text-gray-700';
            } else if (r === 'Kitchen') {
              badgeBg = 'bg-amber-50 border-amber-100';
              badgeText = 'text-amber-700';
            } else if (r === 'Delivery') {
              badgeBg = 'bg-green-50 border-green-100';
              badgeText = 'text-green-700';
            }
            return (
              <StyledView key={r} className={`px-2 py-0.5 rounded-md border ${badgeBg} ml-1 mb-1`}>
                <StyledText className={`font-bold text-[10px] ${badgeText}`}>{r}</StyledText>
              </StyledView>
            );
          })}
        </StyledView>
        
        <StyledView className="flex-row items-center">
          <StyledTouchableOpacity 
            className="p-2 bg-blue-50 rounded-full mr-2"
            onPress={() => onEdit(item)}
          >
            <Ionicons name="pencil-outline" size={18} color="#2563EB" />
          </StyledTouchableOpacity>
          <StyledTouchableOpacity 
            className="p-2 bg-red-50 rounded-full"
            onPress={() => {
              Alert.alert('Remove Staff', 'Are you sure?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: () => onDelete(item.id) }
              ]);
            }}
          >
            <Ionicons name="trash-outline" size={18} color="#DC2626" />
          </StyledTouchableOpacity>
        </StyledView>
      </StyledView>
    </StyledView>
  );
});
StaffInputCard.displayName = 'StaffInputCard';

const ProductCard = React.memo(({ 
  product, 
  onToggleAvailability, 
  onEdit, 
  onDelete, 
  onMoveUp, 
  onMoveDown,
  isFirst,
  isLast
}) => {
  const imageUrl = product.image_url || product.imageUri;
  const cleanImageUri = imageUrl ? imageUrl.split('?')[0].replace(/[\$#]+$/, '') : null;

  return (
    <StyledView 
      className={`bg-white rounded-xl p-4 mb-3 shadow-sm flex-row items-center border border-gray-100 ${!product.isAvailable ? 'opacity-70' : ''}`}
      style={!product.isAvailable ? { backgroundColor: '#F9FAFB' } : {}}
    >
      {/* Reordering Buttons */}
      <StyledView className="flex-col mr-3 justify-center items-center">
        <StyledTouchableOpacity 
          onPress={onMoveUp}
          disabled={isFirst}
          className={`p-1.5 rounded-lg mb-1 ${isFirst ? 'opacity-20' : 'bg-gray-100'}`}
        >
          <Ionicons name="arrow-up" size={14} color={isFirst ? '#9CA3AF' : '#4B5563'} />
        </StyledTouchableOpacity>
        <StyledTouchableOpacity 
          onPress={onMoveDown}
          disabled={isLast}
          className={`p-1.5 rounded-lg ${isLast ? 'opacity-20' : 'bg-gray-100'}`}
        >
          <Ionicons name="arrow-down" size={14} color={isLast ? '#9CA3AF' : '#4B5563'} />
        </StyledTouchableOpacity>
      </StyledView>

      <StyledImage 
        source={
          cleanImageUri
            ? { uri: cleanImageUri }
            : require('../../assets/images/icon.png')
        } 
        className={`w-16 h-16 rounded-xl bg-gray-100 mr-4 ${!product.isAvailable ? 'opacity-40' : ''}`}
        style={!product.isAvailable ? { filter: 'grayscale(100%)' } : {}}
      />
      <StyledView className="flex-1">
        <StyledText className={`font-bold text-base ${!product.isAvailable ? 'text-gray-400' : 'text-gray-900'}`}>{product.name}</StyledText>
        <StyledText className={`font-bold ${!product.isAvailable ? 'text-gray-400' : 'text-primary'}`}>₹{product.price}</StyledText>
        <StyledText className="text-[10px] text-gray-400 mt-0.5">Pos: {product.displayOrder || 1}</StyledText>
        {!product.isAvailable && (
          <StyledText className="text-xs text-red-500 font-semibold mt-1">Out of Stock</StyledText>
        )}
      </StyledView>
      <StyledView className="items-center mr-2">
        <StyledText className="text-xs text-gray-500 mb-1">In Stock</StyledText>
        <StyledSwitch 
          value={product.isAvailable}
          onValueChange={onToggleAvailability}
          trackColor={{ false: "#D1D5DB", true: "#93C5FD" }}
          thumbColor={product.isAvailable ? "#2563EB" : "#F3F4F6"}
          disabled={false}
        />
      </StyledView>

      <StyledView className="flex-col justify-center items-center">
        <StyledTouchableOpacity 
          className={`p-2 rounded-full mb-2 ${!product.isAvailable ? 'bg-gray-100' : 'bg-blue-50'}`}
          onPress={onEdit}
        >
          <Ionicons name="pencil-outline" size={18} color={!product.isAvailable ? '#D1D5DB' : '#2563EB'} />
        </StyledTouchableOpacity>

        <StyledTouchableOpacity 
          className="p-2 rounded-full bg-red-50"
          onPress={onDelete}
        >
          <Ionicons name="trash-outline" size={18} color="#DC2626" />
        </StyledTouchableOpacity>
      </StyledView>
    </StyledView>
  );
});
ProductCard.displayName = 'ProductCard';


export default function AdminScreen() {
  const [activeTab, setActiveTab] = useState('products'); // products, staff, monitor
  const [isOpsOpen, setIsOpsOpen] = useState(false);
  const [isAlreadyLoaded, setIsAlreadyLoaded] = useState(false);
  const { 
    products, 
    setProducts,
    addProduct, 
    staff, 
    addStaff, 
    removeStaff, 
    editProduct, 
    updateStaffMember,
    isCanteenOpen,
    setIsCanteenOpen,
    orders,
    adminViewMode,
    setAdminViewMode,
    fetchProducts,
    fetchOrders,
    fetchCanteenStatus,
    removeProduct,
    reorderProducts
  } = useMockContext();

  const allOrders = [
    ...(orders.pending || []),
    ...(orders.cooking || []),
    ...(orders.ready || []),
    ...(orders.delivered || [])
  ];

  const monitorOrders = adminViewMode === 'Consolidated' 
    ? allOrders 
    : allOrders.filter(o => o.theatre === adminViewMode);

  const totalSales = monitorOrders.reduce((sum, o) => sum + o.total, 0);
  const totalOrdersCount = monitorOrders.length;

  const sales35mm = allOrders.filter(o => o.theatre === '35mm Screen Desk').reduce((sum, o) => sum + o.total, 0);
  const sales70mm = allOrders.filter(o => o.theatre === '70mm Screen Desk').reduce((sum, o) => sum + o.total, 0);

  const kitchenMonitorOrders = [
    ...(orders.pending || []).map(o => ({ ...o, status: 'pending' })),
    ...(orders.cooking || []).map(o => ({ ...o, status: 'cooking' }))
  ].filter(o => adminViewMode === 'Consolidated' ? true : o.theatre === adminViewMode);

  const deliveryMonitorOrders = (orders.ready || [])
    .filter(o => o.fulfillmentType === 'Seat Delivery')
    .filter(o => adminViewMode === 'Consolidated' ? true : o.theatre === adminViewMode);

  const sortedTransactions = [...monitorOrders].sort((a, b) => b.timestamp - a.timestamp);

  // Edit Product Modal State
  const [editingProduct, setEditingProduct] = useState(null);

  const openEditModal = (product) => {
    setEditingProduct(product);
  };

  const closeEditModal = () => {
    setEditingProduct(null);
  };

  // Edit Staff Modal State
  const [editingStaff, setEditingStaff] = useState(null);

  const openEditStaffModal = (member) => {
    setEditingStaff(member);
  };

  const closeEditStaffModal = () => {
    setEditingStaff(null);
  };

  const handleMoveProduct = async (index, direction) => {
    const newProducts = [...products];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= newProducts.length) return;

    // Swap the items
    const temp = newProducts[index];
    newProducts[index] = newProducts[targetIdx];
    newProducts[targetIdx] = temp;

    // Recalculate displayOrder values based on new indices
    newProducts.forEach((p, idx) => {
      p.displayOrder = idx + 1;
    });

    // Update frontend state instantly for zero-lag feeling
    setProducts([...newProducts]);

    // Send to backend
    try {
      await reorderProducts(newProducts);
    } catch (err) {
      console.warn('[Admin] Failed to reorder on server:', err.message);
    }
  };

  const handleDeleteProduct = (productId) => {
    Alert.alert(
      'Delete Product',
      'Are you sure you want to permanently delete this product?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: async () => {
            // Optimistic Update: instantly filter out of the screen array
            setProducts(prev => prev.filter(p => p.id !== productId));
            try {
              await removeProduct(productId);
            } catch (err) {
              Alert.alert('Error', 'Failed to delete product: ' + err.message);
            }
          }
        }
      ]
    );
  };

  const handleToggleAvailability = async (productId) => {
    const targetProduct = products.find(p => p.id === productId || p.id === productId.toString());
    if (!targetProduct) return;
    const newAvailability = !targetProduct.isAvailable;

    // 1. HARDFRONTEND OPTIMISTIC LOCK: Update the local component UI state IMMEDIATELY
    setProducts(prev => prev.map(p => 
      (p.id === productId || p.id === productId.toString()) 
        ? { ...p, isAvailable: newAvailability, status: newAvailability ? 'active' : 'inactive' } 
        : p
    ));

    try {
      // console.log(`[Admin] Toggling status for ID: ${productId}`);
      const response = await fetch(`${API_URL}/api/products/toggle-s3-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Server rejected toggle status.');
      }

      const result = await response.json();
      // console.log(`[Admin] S3 status toggle response:`, result);

      // Explicitly update only the image URLs to prevent rendering stale cache,
      // but do not reload or override the availability status.
      if (result.success && result.image_url) {
        setProducts(prev => prev.map(p => 
          (p.id === productId || p.id === productId.toString()) 
            ? { ...p, image_url: result.image_url, imageUri: result.image_url } 
            : p
        ));
      }
    } catch (err) {
      console.error(`[Admin] Toggle status failed, rolling back UI:`, err.message);
      // Rollback optimistic state
      setProducts(prev => prev.map(p => 
        (p.id === productId || p.id === productId.toString()) 
          ? { ...p, isAvailable: !newAvailability, status: !newAvailability ? 'active' : 'inactive' } 
          : p
      ));
      Alert.alert('Status Change Failed', err.message);
    }
  };

  const loadProducts = async () => {
    if (isAlreadyLoaded) {
      // console.log('[Admin] Products already loaded, skipping fetch.');
      return;
    }
    try {
      // console.log(`[Admin] Fetching products from ${API_URL}/api/products`);
      const response = await fetch(`${API_URL}/api/products?t=${Date.now()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }
      const data = await response.json();
      
      // Map incoming S3 payload directly to the screen state variable
      setProducts(data);
      setIsAlreadyLoaded(true);
    } catch (error) {
      console.error('[Admin] Load failed:', error);
    }
  };

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchProducts(),
        fetchOrders(),
        fetchCanteenStatus()
      ]);
      setIsAlreadyLoaded(true);
    } catch (e) {
      console.warn('[Admin] Pull-to-refresh failed:', e.message);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (DEBUG) {
      // console.log("[DEBUG] AdminScreen mounted");
    }
  }, []);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <StyledView className="flex-1 bg-gray-50">
        <EditProductModal
          visible={!!editingProduct}
          product={editingProduct}
          onClose={closeEditModal}
          onSave={editProduct}
        />
        {/* Header */}
        <StyledView className="bg-white pt-14 pb-4 px-6 shadow-sm z-10 flex-row items-center border-b border-gray-100">
          <Ionicons name="settings" size={28} color="#2563EB" />
          <StyledText className="text-xl font-bold text-gray-900 ml-3">Admin Portal</StyledText>
        </StyledView>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >

      {/* Collapsible Canteen Management & Operations Bar */}
      <StyledTouchableOpacity
        onPress={() => setIsOpsOpen(!isOpsOpen)}
        className="bg-white p-4 mx-4 mt-4 rounded-xl shadow-sm border border-gray-100 flex-row justify-between items-center"
      >
        <StyledText className="text-base font-extrabold text-gray-800">⚙️ Canteen Management & Operations</StyledText>
        <Ionicons name={isOpsOpen ? "chevron-up" : "chevron-down"} size={20} color="#4B5563" />
      </StyledTouchableOpacity>

      {isOpsOpen && (
        <StyledView className="bg-white mx-4 mt-2 p-4 rounded-2xl shadow-sm border border-gray-100">
          {/* View Mode Segment Switch (Moved Inside) */}
          <StyledView className="flex-row items-center justify-between pb-4 mb-4 border-b border-gray-100">
            <StyledText className="text-xs font-bold text-gray-500 uppercase tracking-wide">View Mode:</StyledText>
            <StyledView className="flex-row bg-gray-100 p-1 rounded-xl">
              {[
                { key: '35mm Screen Desk', label: '35mm' },
                { key: '70mm Screen Desk', label: '70mm' },
                { key: 'Consolidated', label: 'View Both Consolidated' }
              ].map(opt => {
                const isActive = adminViewMode === opt.key;
                return (
                  <StyledTouchableOpacity
                    key={opt.key}
                    onPress={() => setAdminViewMode(opt.key)}
                    className={`px-3 py-1.5 rounded-lg ${isActive ? 'bg-primary shadow-sm' : 'bg-transparent'}`}
                  >
                    <StyledText className={`font-extrabold text-[11px] ${isActive ? 'text-white' : 'text-gray-600'}`}>
                      {opt.label}
                    </StyledText>
                  </StyledTouchableOpacity>
                );
              })}
            </StyledView>
          </StyledView>

          <StyledText className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Add Product</StyledText>
          <AddProductForm onAdd={addProduct} />
        </StyledView>
      )}

      {/* Static Controls (Clear All Products, Load Products) */}
      <StyledView className="bg-white mx-4 mt-4 p-4 rounded-2xl shadow-sm border border-gray-100">
        <StyledText className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Master Controls</StyledText>
        <StyledView className="flex-row justify-between">
          <StyledTouchableOpacity
            onPress={() => {
              setProducts([]);
              setIsAlreadyLoaded(false);
            }}
            className="flex-1 py-3 border-2 border-red-500 bg-transparent rounded-xl items-center justify-center mr-2"
          >
            <StyledText className="text-red-500 font-extrabold text-sm">Clear All Products</StyledText>
          </StyledTouchableOpacity>
          <StyledTouchableOpacity
            onPress={loadProducts}
            className="flex-1 py-3 bg-blue-600 rounded-xl items-center justify-center ml-2"
          >
            <StyledText className="text-white font-extrabold text-sm">Load Products</StyledText>
          </StyledTouchableOpacity>
        </StyledView>
      </StyledView>

      {/* Canteen operations toggle */}
      <StyledView className="bg-white mx-4 mt-4 p-4 rounded-2xl shadow-sm border border-gray-100 flex-row items-center justify-between">
        <StyledView className="flex-row items-center flex-1 mr-4">
          <StyledView className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${isCanteenOpen ? 'bg-green-50' : 'bg-red-50'}`}>
            <Ionicons name="storefront" size={20} color={isCanteenOpen ? '#16A34A' : '#DC2626'} />
          </StyledView>
          <StyledView className="flex-1">
            <StyledText className="font-extrabold text-gray-900 text-sm">Canteen Operations</StyledText>
            <StyledText className="text-gray-500 text-xs mt-0.5">
              {isCanteenOpen ? 'Menu Online — Accepting orders' : 'Menu Offline — Canteen closed'}
            </StyledText>
          </StyledView>
        </StyledView>
        <StyledSwitch
          value={isCanteenOpen}
          onValueChange={setIsCanteenOpen}
          trackColor={{ false: "#FDA4AF", true: "#86EFAC" }}
          thumbColor={isCanteenOpen ? "#16A34A" : "#DC2626"}
        />
      </StyledView>

      {/* Tabs */}
      <StyledView className="flex-row bg-white px-4 py-2 shadow-sm border-b border-gray-100">
        <StyledTouchableOpacity 
          className={`flex-1 py-3 items-center border-b-2 ${activeTab === 'products' ? 'border-primary' : 'border-transparent'}`}
          onPress={() => setActiveTab('products')}
        >
          <StyledText className={`font-bold ${activeTab === 'products' ? 'text-primary' : 'text-gray-500'}`}>Products</StyledText>
        </StyledTouchableOpacity>
        <StyledTouchableOpacity 
          className={`flex-1 py-3 items-center border-b-2 ${activeTab === 'staff' ? 'border-primary' : 'border-transparent'}`}
          onPress={() => setActiveTab('staff')}
        >
          <StyledText className={`font-bold ${activeTab === 'staff' ? 'text-primary' : 'text-gray-500'}`}>Staff Roles</StyledText>
        </StyledTouchableOpacity>
        <StyledTouchableOpacity 
          className={`flex-1 py-3 items-center border-b-2 ${activeTab === 'monitor' ? 'border-primary' : 'border-transparent'}`}
          onPress={() => setActiveTab('monitor')}
        >
          <StyledText className={`font-bold ${activeTab === 'monitor' ? 'text-primary' : 'text-gray-500'}`}>Live Monitor</StyledText>
        </StyledTouchableOpacity>
      </StyledView>

      <StyledView className="flex-1 px-4 pt-4">
        {activeTab === 'products' ? (
          <>
            {/* Product List */}
            <StyledText className="text-lg font-bold text-gray-900 mb-4 ml-1">Current Menu</StyledText>
            {products.length === 0 ? (
              <StyledView className="bg-white rounded-xl p-6 mb-8 shadow-sm border border-gray-100 items-center justify-center">
                <Ionicons name="file-tray-outline" size={48} color="#D1D5DB" />
                <StyledText className="text-gray-400 text-base mt-2 font-medium">No items available</StyledText>
              </StyledView>
            ) : (
              products.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onToggleAvailability={() => handleToggleAvailability(product.id)}
                  onEdit={() => openEditModal(product)}
                  onDelete={() => handleDeleteProduct(product.id)}
                  onMoveUp={() => handleMoveProduct(index, 'up')}
                  onMoveDown={() => handleMoveProduct(index, 'down')}
                  isFirst={index === 0}
                  isLast={index === products.length - 1}
                />
              ))
            )}
          </>
        ) : activeTab === 'staff' ? (
          /* Staff Management */
          <StyledView>
            <EditStaffModal
              visible={!!editingStaff}
              member={editingStaff}
              onClose={closeEditStaffModal}
              onSave={updateStaffMember}
            />

            <AddStaffForm onAdd={addStaff} />

            <StyledView className="bg-blue-50 p-4 rounded-xl mb-6 border border-blue-100 flex-row items-center">
              <Ionicons name="information-circle-outline" size={24} color="#2563EB" />
              <StyledText className="text-blue-800 ml-3 flex-1 text-sm">
                Add staff members with multiple roles and theatre bindings. Click the edit pencil to update roles and theatres.
              </StyledText>
            </StyledView>

            <StyledText className="text-lg font-bold text-gray-900 mb-4 ml-1">Staff Directory</StyledText>
            <FlatList
              data={staff}
              keyExtractor={item => item.username || item.name || item.mobile || item.phone}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <StaffInputCard
                  item={item}
                  onEdit={openEditStaffModal}
                  onDelete={removeStaff}
                />
              )}
            />
          </StyledView>
        ) : (
          /* Live Monitor Screen */
          <StyledView>
            {/* Sales Ledger figures card */}
            <StyledView className="bg-white rounded-2xl p-5 mb-6 shadow-sm border border-gray-100">
              <StyledText className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Today&apos;s Sales Ledger</StyledText>
              <StyledView className="flex-row justify-between items-center mb-4">
                <StyledView>
                  <StyledText className="text-gray-400 text-xs font-medium">Total Revenue</StyledText>
                  <StyledText className="text-3xl font-black text-primary">₹{totalSales.toFixed(2)}</StyledText>
                </StyledView>
                <StyledView className="bg-blue-50 border border-blue-100 px-4 py-2 rounded-xl items-center">
                  <StyledText className="text-gray-400 text-xs font-medium">Total Orders</StyledText>
                  <StyledText className="text-xl font-bold text-primary">{totalOrdersCount}</StyledText>
                </StyledView>
              </StyledView>

              {adminViewMode === 'Consolidated' && (
                <StyledView className="border-t border-gray-100 pt-3 flex-row justify-between">
                  <StyledView className="flex-row items-center">
                    <StyledView className="w-2.5 h-2.5 bg-orange-500 rounded-full mr-2" />
                    <StyledText className="text-gray-600 text-xs font-medium">35mm: <StyledText className="font-bold">₹{sales35mm.toFixed(2)}</StyledText></StyledText>
                  </StyledView>
                  <StyledView className="flex-row items-center">
                    <StyledView className="w-2.5 h-2.5 bg-purple-600 rounded-full mr-2" />
                    <StyledText className="text-gray-600 text-xs font-medium">70mm: <StyledText className="font-bold">₹{sales70mm.toFixed(2)}</StyledText></StyledText>
                  </StyledView>
                </StyledView>
              )}
            </StyledView>

            {/* Kitchen Queue Monitor */}
            <StyledView className="mb-6">
              <StyledView className="flex-row items-center mb-3">
                <Ionicons name="restaurant-outline" size={20} color="#2563EB" />
                <StyledText className="text-lg font-bold text-gray-900 ml-2">Live Kitchen Queue ({kitchenMonitorOrders.length})</StyledText>
              </StyledView>

              {kitchenMonitorOrders.length === 0 ? (
                <StyledView className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 items-center justify-center">
                  <StyledText className="text-gray-400 text-sm font-medium">No active kitchen orders</StyledText>
                </StyledView>
              ) : (
                kitchenMonitorOrders.map(order => {
                  const is35mm = order.theatre === '35mm Screen Desk';
                  const isCooking = order.status === 'cooking';
                  return (
                    <StyledView key={order.id} className="bg-white rounded-xl p-4 mb-3 shadow-sm border border-gray-100">
                      <StyledView className="flex-row justify-between items-start mb-3 pb-2 border-b border-gray-100">
                        <StyledView className="flex-1 mr-2">
                          <StyledText className="text-base font-black text-gray-900">
                            {order.fulfillmentType === 'Counter Pickup' ? 'PICKUP' : `SEAT: ${order.seat}`}
                          </StyledText>
                          <StyledText className="text-gray-400 text-[10px] mt-0.5">ID: #{order.id} • {order.mobile}</StyledText>
                        </StyledView>
                        <StyledView className="flex-row items-center space-x-1.5 flex-wrap justify-end">
                          <Timer timestamp={order.timestamp} />
                          <StyledView className={`px-2 py-0.5 rounded-full border ${isCooking ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
                            <StyledText className={`text-[9px] font-extrabold uppercase ${isCooking ? 'text-amber-700' : 'text-blue-700'}`}>
                              {order.status}
                            </StyledText>
                          </StyledView>
                          <StyledView className={`px-2.5 py-0.5 rounded-full ${is35mm ? 'bg-orange-100' : 'bg-purple-100'}`}>
                            <StyledText className={`text-[9px] font-extrabold ${is35mm ? 'text-orange-700' : 'text-purple-700'}`}>
                              {is35mm ? '35mm' : '70mm'}
                            </StyledText>
                          </StyledView>
                        </StyledView>
                      </StyledView>

                      <StyledView className="space-y-1">
                        {order.items.map((item, idx) => (
                          <StyledView key={idx} className="flex-row items-center">
                            <StyledText className="text-primary font-bold text-xs mr-2">{item.quantity}x</StyledText>
                            <StyledText className="text-gray-700 text-sm font-medium">{item.name}</StyledText>
                          </StyledView>
                        ))}
                      </StyledView>
                    </StyledView>
                  );
                })
              )}
            </StyledView>

            {/* Delivery Queue Monitor */}
            <StyledView className="mb-6">
              <StyledView className="flex-row items-center mb-3">
                <Ionicons name="bicycle-outline" size={20} color="#2563EB" />
                <StyledText className="text-lg font-bold text-gray-900 ml-2">Active Delivery Status ({deliveryMonitorOrders.length})</StyledText>
              </StyledView>

              {deliveryMonitorOrders.length === 0 ? (
                <StyledView className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 items-center justify-center">
                  <StyledText className="text-gray-400 text-sm font-medium">No deliveries in transit</StyledText>
                </StyledView>
              ) : (
                deliveryMonitorOrders.map(order => {
                  const is35mm = order.theatre === '35mm Screen Desk';
                  return (
                    <StyledView key={order.id} className="bg-white rounded-xl p-4 mb-3 shadow-sm border border-gray-100">
                      <StyledView className="flex-row justify-between items-start mb-3 pb-2 border-b border-gray-100">
                        <StyledView className="flex-1 mr-2">
                          <StyledText className="text-base font-black text-gray-900">SEAT: {order.seat}</StyledText>
                          <StyledText className="text-gray-400 text-[10px] mt-0.5">ID: #{order.id} • {order.mobile}</StyledText>
                          <StyledView className="flex-row items-center mt-1 bg-blue-50/60 px-2 py-0.5 rounded-lg border border-blue-100 self-start">
                            <Ionicons name="person-outline" size={10} color="#2563EB" />
                            <StyledText className="text-primary font-bold text-[10px] ml-1">
                              Courier: {order.deliveryMan || 'Ramesh Kumar'}
                            </StyledText>
                          </StyledView>
                        </StyledView>
                        <StyledView className="flex-row items-center space-x-1.5 flex-wrap justify-end">
                          <Timer timestamp={order.timestamp} />
                          <StyledView className={`px-2.5 py-0.5 rounded-full ${is35mm ? 'bg-orange-100' : 'bg-purple-100'}`}>
                            <StyledText className={`text-[9px] font-extrabold ${is35mm ? 'text-orange-700' : 'text-purple-700'}`}>
                              {is35mm ? '35mm' : '70mm'}
                            </StyledText>
                          </StyledView>
                        </StyledView>
                      </StyledView>

                      <StyledView className="space-y-1">
                        {order.items.map((item, idx) => (
                          <StyledView key={idx} className="flex-row items-center">
                            <StyledText className="text-primary font-bold text-xs mr-2">{item.quantity}x</StyledText>
                            <StyledText className="text-gray-700 text-sm font-medium">{item.name}</StyledText>
                          </StyledView>
                        ))}
                      </StyledView>
                    </StyledView>
                  );
                })
              )}
            </StyledView>

            {/* Transaction Ledger */}
            <StyledView className="mb-6">
              <StyledView className="flex-row items-center mb-3">
                <Ionicons name="newspaper-outline" size={20} color="#2563EB" />
                <StyledText className="text-lg font-bold text-gray-900 ml-2">Transaction Ledger ({sortedTransactions.length})</StyledText>
              </StyledView>

              {sortedTransactions.length === 0 ? (
                <StyledView className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 items-center justify-center">
                  <StyledText className="text-gray-400 text-sm font-medium">No transactions recorded today</StyledText>
                </StyledView>
              ) : (
                sortedTransactions.map(order => {
                  const is35mm = order.theatre === '35mm Screen Desk';
                  const isDelivered = order.status === 'delivered';
                  const formattedTime = new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  return (
                    <StyledView key={order.id} className="bg-white rounded-xl p-4 mb-3 shadow-sm border border-gray-100 flex-row items-center justify-between">
                      <StyledView className="flex-1 mr-4">
                        <StyledView className="flex-row items-center flex-wrap mb-1">
                          <StyledText className="font-bold text-gray-900 mr-2 text-sm">#{order.id}</StyledText>
                          <StyledView className={`px-2 py-0.5 rounded-full border ${isDelivered ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'} mr-1`}>
                            <StyledText className={`text-[9px] font-extrabold uppercase ${isDelivered ? 'text-green-700' : 'text-blue-700'}`}>
                              {order.status}
                            </StyledText>
                          </StyledView>
                          <StyledView className={`px-2.5 py-0.5 rounded-full ${is35mm ? 'bg-orange-100' : 'bg-purple-100'} mr-1`}>
                            <StyledText className={`text-[9px] font-extrabold ${is35mm ? 'text-orange-700' : 'text-purple-700'}`}>
                              {is35mm ? '35mm' : '70mm'}
                            </StyledText>
                          </StyledView>
                        </StyledView>
                        <StyledText className="text-gray-500 text-xs mb-1">
                          {formattedTime} • {order.fulfillmentType} • {order.mobile}
                        </StyledText>
                        <StyledText className="text-gray-400 text-[11px] leading-tight" numberOfLines={1}>
                          {order.items.map(item => `${item.quantity}x ${item.name}`).join(', ')}
                        </StyledText>
                      </StyledView>
                      <StyledView className="items-end">
                        <StyledText className="font-extrabold text-gray-900 text-base">₹{order.total}</StyledText>
                      </StyledView>
                    </StyledView>
                  );
                })
              )}
            </StyledView>
          </StyledView>
        )}
        <StyledView className="h-20" />
        </StyledView>
      </ScrollView>
    </StyledView>
  </KeyboardAvoidingView>
  );
}
