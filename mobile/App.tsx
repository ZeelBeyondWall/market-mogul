import { useEffect, Component, type ReactNode } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { supabase } from './src/net/supabase';
import { useGame } from './src/store/game';
import { connect } from './src/net/ws';
import { AuthScreen } from './src/screens/AuthScreen';
import { MarketsScreen } from './src/screens/MarketsScreen';
import { TradeScreen } from './src/screens/TradeScreen';
import { PositionsScreen } from './src/screens/PositionsScreen';
import { AccountScreen } from './src/screens/AccountScreen';
import { LeaderboardScreen } from './src/screens/LeaderboardScreen';
import { StoreScreen } from './src/screens/StoreScreen';

// Emoji tab icons — bulletproof (system font, no native icon module to break).
const TAB_ICON: Record<string, string> = {
  Markets: '📊',
  Trade: '📈',
  Positions: '💼',
  Ranks: '🏆',
  Store: '🛒',
  Account: '👤',
};
import { COLORS } from './src/config';

const Tab = createBottomTabNavigator();

// Shows the error on screen instead of a blank crash, so issues are reportable.
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <ScrollView style={{ flex: 1, backgroundColor: COLORS.bg }} contentContainerStyle={{ padding: 24, paddingTop: 80 }}>
          <Text style={{ color: COLORS.red, fontSize: 18, fontWeight: '800', marginBottom: 12 }}>App Error</Text>
          <Text style={{ color: COLORS.text, fontSize: 13 }}>{String(this.state.error?.message || this.state.error)}</Text>
          <Text selectable style={{ color: COLORS.dim, fontSize: 11, marginTop: 16 }}>{this.state.error?.stack}</Text>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

const navTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    background: COLORS.bg,
    card: COLORS.panel,
    text: COLORS.text,
    border: COLORS.borderDim,
    primary: COLORS.gold,
  },
};

function Toast() {
  const toast = useGame((s) => s.toast);
  const clearToast = useGame((s) => s.clearToast);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(clearToast, 2600);
    return () => clearTimeout(id);
  }, [toast, clearToast]);
  if (!toast) return null;
  const color = toast.kind === 'ok' ? COLORS.green : toast.kind === 'err' ? COLORS.red : COLORS.cyan;
  return (
    <View style={[styles.toast, { borderColor: color }]} pointerEvents="none">
      <Text style={[styles.toastTxt, { color }]}>{toast.msg}</Text>
    </View>
  );
}

export default function App() {
  const session = useGame((s) => s.session);
  const setSession = useGame((s) => s.setSession);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) connect();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => {
      setSession(sess);
      if (sess) connect();
    });
    return () => sub.subscription.unsubscribe();
  }, [setSession]);

  return (
    <ErrorBoundary>
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <StatusBar style="light" />
      {!session ? (
        <AuthScreen />
      ) : (
        <NavigationContainer theme={navTheme}>
          <Tab.Navigator
            screenOptions={({ route }) => ({
              headerStyle: { backgroundColor: COLORS.bg },
              headerTintColor: '#fff',
              tabBarStyle: { backgroundColor: COLORS.panel, borderTopColor: COLORS.borderDim, height: 58, paddingBottom: 6, paddingTop: 4 },
              tabBarActiveTintColor: COLORS.gold,
              tabBarInactiveTintColor: COLORS.dim,
              tabBarLabelStyle: { fontSize: 9.5, fontWeight: '700' },
              tabBarIcon: ({ focused }) => (
                <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.55 }}>{TAB_ICON[route.name] || '•'}</Text>
              ),
            })}
          >
            <Tab.Screen name="Markets" component={MarketsScreen} />
            <Tab.Screen name="Trade" component={TradeScreen} />
            <Tab.Screen name="Positions" component={PositionsScreen} />
            <Tab.Screen name="Ranks" component={LeaderboardScreen} />
            <Tab.Screen name="Store" component={StoreScreen} />
            <Tab.Screen name="Account" component={AccountScreen} />
          </Tab.Navigator>
        </NavigationContainer>
      )}
      <Toast />
    </SafeAreaProvider>
    </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute', bottom: 90, left: 20, right: 20,
    backgroundColor: 'rgba(11,16,32,0.96)', borderWidth: 1, borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center',
  },
  toastTxt: { fontWeight: '700', fontSize: 13, textAlign: 'center' },
});
