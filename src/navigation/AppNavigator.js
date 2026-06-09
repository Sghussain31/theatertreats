import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useMockContext } from '../context/MockContext';
import AdminScreen from '../screens/AdminScreen';
import DeliveryScreen from '../screens/DeliveryScreen';
import HomeScreen from '../screens/HomeScreen';
import KitchenScreen from '../screens/KitchenScreen';
import LoginScreen from '../screens/LoginScreen';
import NewOrderScreen from '../screens/NewOrderScreen';
import SplashScreen from '../screens/SplashScreen';
import TheatreSelectionScreen from '../screens/TheatreSelectionScreen';

const Stack = createNativeStackNavigator();

function MainStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Dashboard" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="NewOrder" component={NewOrderScreen} options={{ title: 'New Order' }} />
      <Stack.Screen name="Kitchen" component={KitchenScreen} options={{ title: 'Kitchen Queue' }} />
      <Stack.Screen name="Delivery" component={DeliveryScreen} options={{ title: 'Delivery Status' }} />
      <Stack.Screen name="Management" component={AdminScreen} options={{ title: 'Admin Panel' }} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { user, selectedTheatre } = useMockContext();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <>
          <Stack.Screen name="Splash" component={SplashScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
        </>
      ) : !selectedTheatre ? (
        <Stack.Screen name="TheatreSelection" component={TheatreSelectionScreen} />
      ) : (
        <Stack.Screen name="Main" component={MainStackNavigator} />
      )}
    </Stack.Navigator>
  );
}
