import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { styled } from 'nativewind';
import { DEBUG } from '../utils/debug';

const StyledView = styled(View);
const StyledText = styled(Text);

export default function SplashScreen() {
  const navigation = useNavigation();

  useEffect(() => {
    if (DEBUG) {
      debugger;
      console.log("[DEBUG] SplashScreen mounted");
    }
    // Simulate connectivity check and token validity check
    const timer = setTimeout(() => {
      if (DEBUG) {
        console.log("[DEBUG] Navigating from Splash to Login");
      }
      navigation.replace('Login');
      if (DEBUG) {
        console.log("[DEBUG] Navigated to Login");
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <StyledView className="flex-1 justify-center items-center bg-primary">
      <StyledText className="text-4xl font-bold text-white mb-4">
        TheaterTreats
      </StyledText>
      <ActivityIndicator size="large" color="#ffffff" />
      <StyledText className="text-white mt-4 text-lg">
        Initializing System...
      </StyledText>
    </StyledView>
  );
}
