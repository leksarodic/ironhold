import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import './global.css';

export default function App() {
  return (
    <SafeAreaProvider>
      <View className="flex-1 items-center justify-center bg-stone-800">
        <Text className="font-display text-2xl text-gold-300">Ironhold</Text>
        <Text className="font-body text-parchment-300">Co-op action RPG</Text>
      </View>
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
