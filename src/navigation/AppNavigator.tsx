import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Text } from 'react-native';

import ComposeScreen from '../screens/ComposeScreen';
import FeedScreen from '../screens/FeedScreen';
import HomeScreen from '../screens/HomeScreen';
import { colors } from '../theme/colors';

export type RootTabParamList = {
  Feed: undefined;
  Compose: undefined;
};

export type RootStackParamList = {
  Home: undefined;
  Main: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const RootStack = createStackNavigator<RootStackParamList>();

function TabIcon({
  glyph,
  focused,
  fontSize,
}: {
  glyph: string;
  focused: boolean;
  fontSize: number;
}) {
  return (
    <Text
      style={{
        fontSize,
        color: focused ? colors.accent : colors.textMeta,
      }}>
      {glyph}
    </Text>
  );
}

function TabNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="Feed"
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 60,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMeta,
      }}>
      <Tab.Screen
        name="Feed"
        component={FeedScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon glyph="▣" focused={focused} fontSize={18} />
          ),
        }}
      />
      <Tab.Screen
        name="Compose"
        component={ComposeScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon glyph="⊕" focused={focused} fontSize={22} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="Home" component={HomeScreen} />
      <RootStack.Screen name="Main" component={TabNavigator} />
    </RootStack.Navigator>
  );
}

export default RootNavigator;
