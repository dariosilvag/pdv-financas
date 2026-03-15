import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Store, WalletCards } from 'lucide-react-native';

// Telas
import PdvDashboardScreen from './src/screens/PdvDashboardScreen';
import FinancesScreen from './src/screens/FinancesScreen';

// Setup inicial do banco de dados (remover ou comentar depois da primeira execução)
import { seedDatabase } from './src/seedDatabase';

const Tab = createBottomTabNavigator();

// Tema Luxuoso Escuro Baseado no Web App
const BlatzTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#f97316', // Laranja accent
    background: '#0f172a', // Fundo principal escuro
    card: '#1e293b', // Fundo dos cards/TabBar
    text: '#f8fafc',
    border: '#334155',
  },
};

export default function App() {
  React.useEffect(() => {
    seedDatabase();
  }, []);

  return (
    <>
      <StatusBar style="light" backgroundColor="#0f172a" />
      <NavigationContainer theme={BlatzTheme}>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerStyle: { backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#334155' },
            headerTitleStyle: { fontWeight: 'bold', color: '#f8fafc' },
            tabBarStyle: {
              backgroundColor: '#1e293b',
              borderTopColor: '#334155',
              paddingBottom: 5,
              paddingTop: 5,
              height: 60,
            },
            tabBarActiveTintColor: '#f97316',
            tabBarInactiveTintColor: '#94a3b8',
            tabBarIcon: ({ color, size }) => {
              if (route.name === 'Dashboard Loja') {
                return <Store color={color} size={size} />;
              } else if (route.name === 'Gestão Pessoal') {
                return <WalletCards color={color} size={size} />;
              }
            },
          })}
        >
          <Tab.Screen name="Gestão Pessoal" component={FinancesScreen} />
          <Tab.Screen name="Dashboard Loja" component={PdvDashboardScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </>
  );
}
