import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useMockContext } from '../context/MockContext';
import { styled } from 'nativewind';
import { Ionicons } from '@expo/vector-icons';
import { DEBUG } from '../utils/debug';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);

export default function TheatreSelectionScreen() {
  const { user, setSelectedTheatre, logout } = useMockContext();

  useEffect(() => {
    if (DEBUG) {
      debugger;
      console.log("[DEBUG] TheatreSelectionScreen mounted");
    }
  }, []);

  const handleLogout = () => {
    if (DEBUG) {
      debugger;
      console.log("[DEBUG] Logging out user");
    }
    logout();
  };

  const handleTheatreSelect = (theatre) => {
    if (DEBUG) {
      debugger;
      console.log("[DEBUG] Theatre selected:", theatre);
    }
    setSelectedTheatre(theatre);
  };

  const userTheatres = user?.theatres || ['35mm Screen Desk', '70mm Screen Desk'];

  return (
    <StyledView className="flex-1 bg-gray-50">
      <StyledView className="bg-primary pt-16 pb-8 px-6 rounded-b-[40px] shadow-lg flex-row justify-between items-center">
        <StyledView>
          <StyledText className="text-blue-100 text-lg font-medium">Welcome back,</StyledText>
          <StyledText className="text-white text-3xl font-extrabold mt-1">{user?.name}</StyledText>
        </StyledView>
        <StyledTouchableOpacity 
          onPress={handleLogout}
          className="bg-blue-700 p-3 rounded-full"
        >
          <Ionicons name="log-out-outline" size={24} color="white" />
        </StyledTouchableOpacity>
      </StyledView>

      <StyledView className="flex-1 px-6 pt-10">
        <StyledText className="text-2xl font-bold text-gray-800 mb-6">Select Theatre Location</StyledText>
        
        <StyledScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {userTheatres.includes('35mm Screen Desk') && (
            <StyledTouchableOpacity 
              className="bg-white rounded-3xl p-6 mb-6 shadow-sm border border-gray-100 items-center justify-center flex-row"
              onPress={() => handleTheatreSelect('35mm Screen Desk')}
              activeOpacity={0.8}
            >
              <StyledView className="bg-orange-100 w-16 h-16 rounded-2xl items-center justify-center mr-6">
                <Ionicons name="film" size={32} color="#EA580C" />
              </StyledView>
              <StyledView className="flex-1">
                <StyledText className="text-xl font-bold text-gray-900 mb-1">35mm Screen Desk</StyledText>
                <StyledText className="text-gray-500">TheaterTreats Controller</StyledText>
              </StyledView>
              <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />
            </StyledTouchableOpacity>
          )}

          {userTheatres.includes('70mm Screen Desk') && (
            <StyledTouchableOpacity 
              className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 items-center justify-center flex-row"
              onPress={() => handleTheatreSelect('70mm Screen Desk')}
              activeOpacity={0.8}
            >
              <StyledView className="bg-purple-100 w-16 h-16 rounded-2xl items-center justify-center mr-6">
                <Ionicons name="film" size={32} color="#9333EA" />
              </StyledView>
              <StyledView className="flex-1">
                <StyledText className="text-xl font-bold text-gray-900 mb-1">70mm Screen Desk</StyledText>
                <StyledText className="text-gray-500">TheaterTreats Controller</StyledText>
              </StyledView>
              <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />
            </StyledTouchableOpacity>
          )}
        </StyledScrollView>
      </StyledView>
    </StyledView>
  );
}
