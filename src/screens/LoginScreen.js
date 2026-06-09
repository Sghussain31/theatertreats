import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useMockContext } from '../context/MockContext';
import { styled } from 'nativewind';
import { Ionicons } from '@expo/vector-icons';
import { DEBUG } from '../utils/debug';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTextInput = styled(TextInput);
const StyledTouchableOpacity = styled(TouchableOpacity);

export default function LoginScreen() {
  const [username, setUsername] = useState('admin');
  const [phone, setPhone] = useState('1234567890');
  const [errorMsg, setErrorMsg] = useState('');
  const { login } = useMockContext();

  useEffect(() => {
    if (DEBUG) {
      console.log("[DEBUG] LoginScreen mounted");
    }
  }, []);

  const handleLogin = async () => {
    if (DEBUG) {
      console.log("[DEBUG] handleLogin triggered with params:", { username, phone });
    }
    setErrorMsg('');

    if (username.trim() && phone.trim()) {
      if (DEBUG) console.log("[DEBUG] Calling login context method");
      const success = await login(username, phone);
      if (DEBUG) console.log("[DEBUG] login context method returned:", success);
      
      if (!success) {
        setErrorMsg('Access Denied: Mobile number or username not recognized. Please contact your Admin.');
        Alert.alert(
          'Access Denied',
          'Mobile number or username not recognized. Please contact your Admin.'
        );
      }
    } else {
      Alert.alert('Error', 'Please enter username and mobile number');
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-gray-50"
    >
      <StyledView className="flex-1 justify-center items-center p-6">
        <StyledView className="w-full max-w-md bg-white p-8 rounded-3xl shadow-lg">
          <StyledView className="items-center mb-8">
            <StyledView className="w-20 h-20 bg-blue-100 rounded-full items-center justify-center mb-4">
              <Ionicons name="film-outline" size={40} color="#2563EB" />
            </StyledView>
            <StyledText className="text-3xl font-extrabold text-gray-900">
              Welcome Back
            </StyledText>
            <StyledText className="text-gray-500 mt-2">
              Sign in to Enterprise Canteen System
            </StyledText>
          </StyledView>

          <StyledView className="space-y-4">
            <StyledView>
              <StyledText className="text-sm font-semibold text-gray-700 mb-1 ml-1">Username</StyledText>
              <StyledView className="flex-row items-center bg-gray-100 rounded-xl px-4 py-3">
                <Ionicons name="person-outline" size={20} color="#6B7280" />
                <StyledTextInput
                  className="flex-1 ml-3 text-base text-gray-900"
                  placeholder="Enter username"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                />
              </StyledView>
            </StyledView>

            <StyledView>
              <StyledText className="text-sm font-semibold text-gray-700 mb-1 ml-1 mt-4">Mobile Number</StyledText>
              <StyledView className="flex-row items-center bg-gray-100 rounded-xl px-4 py-3">
                <Ionicons name="call-outline" size={20} color="#6B7280" />
                <StyledTextInput
                  className="flex-1 ml-3 text-base text-gray-900"
                  placeholder="Enter mobile number"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                />
              </StyledView>
            </StyledView>

            {errorMsg ? (
              <StyledView className="bg-red-50 border border-red-200 rounded-xl p-3 mt-4">
                <StyledText className="text-red-700 text-sm font-medium text-center">
                  {errorMsg}
                </StyledText>
              </StyledView>
            ) : null}

            <StyledTouchableOpacity 
              className="bg-primary py-4 rounded-xl items-center mt-6 shadow-md"
              onPress={handleLogin}
            >
              <StyledText className="text-white font-bold text-lg">
                Sign In
              </StyledText>
            </StyledTouchableOpacity>
          </StyledView>
        </StyledView>
      </StyledView>
    </KeyboardAvoidingView>
  );
}
