import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import ComposeScreen from '../screens/ComposeScreen';
import FeedScreen from '../screens/FeedScreen';
import HomeScreen from '../screens/HomeScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { colors } from '../theme/colors';

export type RootTabParamList = {
  Feed: undefined;
  Compose: undefined;
  Settings: undefined;
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

function ComposeTabBarButton(props: BottomTabBarButtonProps) {
  const focused = props.accessibilityState?.selected ?? false;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      accessibilityRole={props.accessibilityRole}
      accessibilityState={props.accessibilityState}
      accessibilityLabel={props.accessibilityLabel}
      testID={props.testID}
      onPress={props.onPress ?? undefined}
      onLongPress={props.onLongPress ?? undefined}
      style={[props.style, styles.composeTabButton]}>
      <View
        style={[
          styles.composeTabDisc,
          focused && styles.composeTabDiscFocused,
        ]}>
        <Text
          style={[
            styles.composeTabGlyph,
            { color: focused ? colors.accent : colors.textMeta },
          ]}>
          ⊕
        </Text>
      </View>
    </TouchableOpacity>
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
          height: 64,
          paddingBottom: 6,
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
          tabBarButton: props => <ComposeTabBarButton {...props} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon glyph="⚙" focused={focused} fontSize={18} />
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

const styles = StyleSheet.create({
  composeTabButton: {
    top: -16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  composeTabDisc: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.background,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 8,
  },
  composeTabDiscFocused: {
    borderColor: colors.accent,
    backgroundColor: colors.accentDim,
  },
  composeTabGlyph: {
    fontSize: 30,
    lineHeight: 34,
    marginTop: -1,
  },
});

export default RootNavigator;
