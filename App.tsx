import { Alegreya_400Regular, Alegreya_600SemiBold, Alegreya_700Bold } from '@expo-google-fonts/alegreya';
import {
  Cinzel_600SemiBold,
  Cinzel_700Bold,
  Cinzel_800ExtraBold,
  Cinzel_900Black,
} from '@expo-google-fonts/cinzel';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CharacterSelectScreen } from '@/screens/CharacterSelectScreen';
import { GameScreen } from '@/screens/GameScreen';
import { MainMenuScreen } from '@/screens/MainMenuScreen';
import { useGameStore } from '@/store/useGameStore';
import { palette } from '@/theme/tokens';
import './global.css';

function Router() {
  const screen = useGameStore((s) => s.screen);
  if (screen === 'select') return <CharacterSelectScreen />;
  if (screen === 'game') return <GameScreen />;
  return <MainMenuScreen />;
}

export default function App() {
  const [loaded] = useFonts({
    Cinzel_600SemiBold,
    Cinzel_700Bold,
    Cinzel_800ExtraBold,
    Cinzel_900Black,
    Alegreya_400Regular,
    Alegreya_600SemiBold,
    Alegreya_700Bold,
  });

  if (!loaded) {
    return (
      <View style={[styles.loading, { backgroundColor: palette.stone[900] }]}>
        <ActivityIndicator color={palette.gold[400]} />
        <Text style={{ color: palette.parchment[400], marginTop: 10, fontFamily: 'Alegreya_400Regular', fontSize: 12 }}>
          Forging Ironhold…
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <Router />
      <StatusBar style="light" hidden />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
