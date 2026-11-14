import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { colors } from './theme';
import { useFonts, Manrope_300Light, Manrope_400Regular } from '@expo-google-fonts/manrope';
import { DMSans_300Light, DMSans_400Regular, DMSans_500Medium } from '@expo-google-fonts/dm-sans';

export default function App() {
  const [loaded, error] = useFonts({ Manrope_300Light, Manrope_400Regular, DMSans_300Light, DMSans_400Regular, DMSans_500Medium });
  if (error) throw error;
  if (!loaded) return null;
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.header}><Text style={styles.brand}>CropTips</Text></View>
      <View style={styles.content} accessibilityLabel="Strona główna" />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { padding: 24, backgroundColor: colors.surface, borderBottomColor: colors.border, borderBottomWidth: 1 },
  brand: { fontSize: 24, fontFamily: 'Manrope_300Light', color: colors.primary },
  content: { flex: 1 },
});
