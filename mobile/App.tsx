import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { supabase } from './src/net/supabase';
import { useGame } from './src/store/game';
import { connect } from './src/net/ws';
import { AuthScreen } from './src/screens/AuthScreen';
import { MarketsScreen } from './src/screens/MarketsScreen';
import { TradeScreen } from './src/screens/TradeScreen';
import { PositionsScreen } from './src/screens/PositionsScreen';
import { COLORS } from './src/config';

const Tab = createBottomTabNavigator();

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
    <SafeAreaProvider>
      <StatusBar style="light" />
      {!session ? (
        <AuthScreen />
      ) : (
        <NavigationContainer theme={navTheme}>
          <Tab.Navigator
            screenOptions={{
              headerStyle: { backgroundColor: COLORS.bg },
              headerTintColor: '#fff',
              tabBarStyle: { backgroundColor: COLORS.panel, borderTopColor: COLORS.borderDim },
              tabBarActiveTintColor: COLORS.gold,
              tabBarInactiveTintColor: COLORS.dim,
            }}
          >
            <Tab.Screen name="Markets" component={MarketsScreen} />
            <Tab.Screen name="Trade" component={TradeScreen} />
            <Tab.Screen name="Positions" component={PositionsScreen} />
          </Tab.Navigator>
        </NavigationContainer>
      )}
      <Toast />
    </SafeAreaProvider>
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
