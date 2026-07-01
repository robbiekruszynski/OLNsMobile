import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

const NODE_COUNT = 12;
const NODE_DIAMETER = 6;
const NODE_RADIUS = 3;
const ORIGIN_DIAMETER = 10;
const ORIGIN_RADIUS = 5;
const PACKET_DIAMETER = 3;
const PACKET_RADIUS = 1.5;
const PULSE_START_RADIUS = 5;
const PULSE_END_RADIUS = 80;
const BIRTH_RING_END_RADIUS = 28;
const CONNECTION_MAX_OPACITY = 0.25;
const MIN_ACTIVE_CONNECTIONS = 3;
const MAX_ACTIVE_CONNECTIONS = 5;
const MAX_SIMULTANEOUS_BIRTHS = 2;

type NodePhase = 'dormant' | 'birth' | 'life' | 'death';

const NODE_POSITIONS = [
  { x: 0.12, y: 0.06 },
  { x: 0.78, y: 0.09 },
  { x: 0.92, y: 0.31 },
  { x: 0.06, y: 0.38 },
  { x: 0.58, y: 0.15 },
  { x: 0.88, y: 0.55 },
  { x: 0.04, y: 0.65 },
  { x: 0.32, y: 0.75 },
  { x: 0.82, y: 0.71 },
  { x: 0.18, y: 0.91 },
  { x: 0.68, y: 0.88 },
  { x: 0.5, y: 0.31, isOrigin: true },
] as const;

const LANGUAGES = [
  { code: 'EN', label: 'English' },
  { code: 'ES', label: 'Español' },
  { code: 'FR', label: 'Français' },
  { code: 'PT', label: 'Português' },
  { code: 'DE', label: 'Deutsch' },
  { code: 'AR', label: 'العربية' },
  { code: 'ZH', label: '中文' },
  { code: 'JA', label: '日本語' },
] as const;

const HOW_IT_WORKS_STEPS = [
  {
    number: '01',
    title: 'BROADCAST',
    color: colors.typeEmergency,
    description:
      'Write a note and broadcast it onto the mesh. No internet needed — your message travels over Bluetooth.',
  },
  {
    number: '02',
    title: 'PROPAGATE',
    color: colors.typeInformation,
    description:
      'Nearby devices automatically pick up and relay your note, carrying it further across the mesh with each hop.',
  },
  {
    number: '03',
    title: 'PERSIST',
    color: colors.typeWaypoint,
    description:
      'Notes live on the network independently. Even after you leave, your message continues traveling through devices in the area.',
  },
  {
    number: '04',
    title: 'DISCOVER',
    color: colors.typeResource,
    description:
      'Open the feed to see notes from the mesh around you, from people nearby, or messages that have traveled through many hands to reach you.',
  },
] as const;

interface NodeData {
  id: number;
  x: number;
  y: number;
  isOrigin: boolean;
}

interface ActiveConnection {
  id: string;
  from: number;
  to: number;
  opacity: Animated.Value;
}

interface DataPacket {
  id: string;
  from: number;
  to: number;
  progress: Animated.Value;
  opacity: Animated.Value;
}

function getPairKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function createNodes(width: number, height: number): NodeData[] {
  return NODE_POSITIONS.map((position, id) => ({
    id,
    x: position.x * width,
    y: position.y * height,
    isOrigin: 'isOrigin' in position && position.isOrigin === true,
  }));
}

function DynamicConnectionLine({
  from,
  to,
  nodes,
  opacity,
}: {
  from: number;
  to: number;
  nodes: NodeData[];
  opacity: Animated.Value;
}) {
  const start = nodes[from];
  const end = nodes[to];
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;

  return (
    <Animated.View
      style={[
        styles.connectionLine,
        {
          left: midX - length / 2,
          top: midY - 0.25,
          width: length,
          opacity,
          transform: [{ rotate: `${angle}rad` }],
        },
      ]}
    />
  );
}

function DataPacketDot({
  packet,
  nodes,
}: {
  packet: DataPacket;
  nodes: NodeData[];
}) {
  const from = nodes[packet.from];
  const to = nodes[packet.to];
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;

  return (
    <Animated.View
      style={[
        styles.packet,
        {
          left: from.x - PACKET_RADIUS,
          top: from.y - PACKET_RADIUS,
          opacity: packet.opacity,
          transform: [
            { translateX: Animated.multiply(packet.progress, deltaX) },
            { translateY: Animated.multiply(packet.progress, deltaY) },
          ],
        },
      ]}
    />
  );
}

export default function HomeScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const [isJoining, setIsJoining] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('EN');
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [showLanguage, setShowLanguage] = useState(false);
  const [activeConnections, setActiveConnections] = useState<ActiveConnection[]>(
    [],
  );
  const [dataPackets, setDataPackets] = useState<DataPacket[]>([]);

  const nodes = useMemo(() => createNodes(width, height), [width, height]);
  const originNode = nodes.find(node => node.isOrigin) ?? nodes[0];

  const nodeOpacities = useRef(
    Array.from({ length: NODE_COUNT }, () => new Animated.Value(0)),
  ).current;
  const birthRingScales = useRef(
    Array.from({ length: NODE_COUNT }, () => new Animated.Value(0)),
  ).current;
  const birthRingOpacities = useRef(
    Array.from({ length: NODE_COUNT }, () => new Animated.Value(0)),
  ).current;
  const pulseProgress = useRef(new Animated.Value(0)).current;
  const pulseRingOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(1)).current;

  const nodePhaseRef = useRef<NodePhase[]>(
    Array.from({ length: NODE_COUNT }, () => 'dormant' as NodePhase),
  );
  const nodeMetaRef = useRef(
    Array.from({ length: NODE_COUNT }, () => ({
      settled: 0.75,
      breathDuration: 3000,
    })),
  );
  const connectionsRef = useRef<Map<string, ActiveConnection>>(new Map());
  const breathLoops = useRef<Array<Animated.CompositeAnimation | null>>(
    Array.from({ length: NODE_COUNT }, () => null),
  );
  const nodeTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const birthingCountRef = useRef(0);
  const connectionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const pulseIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const packetIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const joinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const isNodeInLifePhase = useCallback((index: number) => {
    return nodePhaseRef.current[index] === 'life';
  }, []);

  const scheduleNodeTimeout = useCallback((callback: () => void, delay: number) => {
    const timeout = setTimeout(callback, delay);
    nodeTimeoutsRef.current.push(timeout);
    return timeout;
  }, []);

  const stopNodeBreath = useCallback((index: number) => {
    breathLoops.current[index]?.stop();
    breathLoops.current[index] = null;
  }, []);

  const startNodeBreath = useCallback((index: number) => {
    const { settled, breathDuration } = nodeMetaRef.current[index];
    stopNodeBreath(index);
    nodeOpacities[index].setValue(settled);

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(nodeOpacities[index], {
          toValue: Math.min(settled + 0.2, 1),
          duration: breathDuration / 2,
          useNativeDriver: true,
        }),
        Animated.timing(nodeOpacities[index], {
          toValue: Math.max(settled - 0.2, 0),
          duration: breathDuration / 2,
          useNativeDriver: true,
        }),
      ]),
    );

    breathLoops.current[index] = loop;
    loop.start();
  }, [nodeOpacities, stopNodeBreath]);

  const startConnection = useCallback(
    (from: number, to: number) => {
      if (!isNodeInLifePhase(from) || !isNodeInLifePhase(to)) {
        return;
      }

      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const opacity = new Animated.Value(0);
      const connection: ActiveConnection = { id, from, to, opacity };

      connectionsRef.current.set(id, connection);
      setActiveConnections(Array.from(connectionsRef.current.values()));

      const holdDuration = 600 + Math.random() * 600;

      Animated.sequence([
        Animated.timing(opacity, {
          toValue: CONNECTION_MAX_OPACITY,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.delay(holdDuration),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished || !isMountedRef.current) {
          return;
        }

        connectionsRef.current.delete(id);
        setActiveConnections(Array.from(connectionsRef.current.values()));
      });
    },
    [isNodeInLifePhase],
  );

  const spawnConnections = useCallback(() => {
    const activeCount = connectionsRef.current.size;
    if (activeCount >= MAX_ACTIVE_CONNECTIONS) {
      return;
    }

    const activePairs = new Set(
      Array.from(connectionsRef.current.values()).map(connection =>
        getPairKey(connection.from, connection.to),
      ),
    );

    const targetCount =
      activeCount < MIN_ACTIVE_CONNECTIONS
        ? MIN_ACTIVE_CONNECTIONS
        : activeCount + 1;
    const toAdd = Math.min(
      targetCount - activeCount,
      MAX_ACTIVE_CONNECTIONS - activeCount,
    );

    for (let index = 0; index < toAdd; index += 1) {
      const candidates: [number, number][] = [];

      for (let i = 0; i < NODE_COUNT; i += 1) {
        for (let j = i + 1; j < NODE_COUNT; j += 1) {
          if (
            !activePairs.has(getPairKey(i, j)) &&
            isNodeInLifePhase(i) &&
            isNodeInLifePhase(j)
          ) {
            candidates.push([i, j]);
          }
        }
      }

      if (candidates.length === 0) {
        break;
      }

      const pair = candidates[Math.floor(Math.random() * candidates.length)];
      activePairs.add(getPairKey(pair[0], pair[1]));
      startConnection(pair[0], pair[1]);
    }
  }, [isNodeInLifePhase, startConnection]);

  const spawnDataPacket = useCallback(() => {
    const connections = Array.from(connectionsRef.current.values()).filter(
      connection =>
        isNodeInLifePhase(connection.from) && isNodeInLifePhase(connection.to),
    );
    if (connections.length === 0) {
      return;
    }

    const connection =
      connections[Math.floor(Math.random() * connections.length)];
    const progress = new Animated.Value(0);
    const opacity = new Animated.Value(0.7);
    const id = `packet-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const travelDuration = 600 + Math.random() * 400;
    const packet: DataPacket = {
      id,
      from: connection.from,
      to: connection.to,
      progress,
      opacity,
    };

    setDataPackets(current => [...current, packet]);

    Animated.parallel([
      Animated.timing(progress, {
        toValue: 1,
        duration: travelDuration,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: travelDuration,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished || !isMountedRef.current) {
        return;
      }

      setDataPackets(current => current.filter(item => item.id !== id));
    });
  }, [isNodeInLifePhase]);

  useEffect(() => {
    isMountedRef.current = true;
    nodeTimeoutsRef.current = [];
    birthingCountRef.current = 0;
    nodePhaseRef.current = Array.from(
      { length: NODE_COUNT },
      () => 'dormant' as NodePhase,
    );

    const birthNode = (index: number) => {
      if (!isMountedRef.current || nodes[index].isOrigin) {
        return;
      }

      if (birthingCountRef.current >= MAX_SIMULTANEOUS_BIRTHS) {
        scheduleNodeTimeout(() => birthNode(index), 250);
        return;
      }

      birthingCountRef.current += 1;
      nodePhaseRef.current[index] = 'birth';

      const settled = 0.6 + Math.random() * 0.3;
      const breathDuration = 2500 + Math.random() * 2000;
      const lifespan = 6000 + Math.random() * 8000;
      nodeMetaRef.current[index] = { settled, breathDuration };

      nodeOpacities[index].setValue(0);
      birthRingScales[index].setValue(NODE_RADIUS / BIRTH_RING_END_RADIUS);
      birthRingOpacities[index].setValue(0.6);

      Animated.parallel([
        Animated.timing(nodeOpacities[index], {
          toValue: 0.8,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(birthRingScales[index], {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(birthRingOpacities[index], {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        birthingCountRef.current = Math.max(0, birthingCountRef.current - 1);

        if (!finished || !isMountedRef.current) {
          return;
        }

        nodePhaseRef.current[index] = 'life';
        startNodeBreath(index);

        scheduleNodeTimeout(() => {
          if (nodePhaseRef.current[index] !== 'life') {
            return;
          }

          nodePhaseRef.current[index] = 'death';
          stopNodeBreath(index);

          Animated.timing(nodeOpacities[index], {
            toValue: 0,
            duration: 800,
            useNativeDriver: true,
          }).start(({ finished: deathFinished }) => {
            if (!deathFinished || !isMountedRef.current) {
              return;
            }

            nodePhaseRef.current[index] = 'dormant';
            scheduleNodeTimeout(
              () => birthNode(index),
              1000 + Math.random() * 2000,
            );
          });
        }, lifespan);
      });
    };

    const startOriginLife = () => {
      const originIndex = nodes.findIndex(node => node.isOrigin);
      if (originIndex < 0) {
        return;
      }

      nodePhaseRef.current[originIndex] = 'life';
      nodeMetaRef.current[originIndex] = {
        settled: 1,
        breathDuration: 2500 + Math.random() * 2000,
      };
      nodeOpacities[originIndex].setValue(1);
      startNodeBreath(originIndex);
    };

    function runOriginPulse() {
      pulseProgress.setValue(0);
      pulseRingOpacity.setValue(0.5);

      Animated.parallel([
        Animated.timing(pulseProgress, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseRingOpacity, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ]).start();
    }

    startOriginLife();
    runOriginPulse();
    pulseIntervalRef.current = setInterval(runOriginPulse, 4000);

    let staggerDelay = 0;
    nodes.forEach(node => {
      if (node.isOrigin) {
        return;
      }

      scheduleNodeTimeout(() => birthNode(node.id), staggerDelay);
      staggerDelay += 300;
    });

    spawnConnections();
    connectionIntervalRef.current = setInterval(spawnConnections, 1200);
    packetIntervalRef.current = setInterval(spawnDataPacket, 2500);

    return () => {
      isMountedRef.current = false;
      nodeTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      nodeTimeoutsRef.current = [];
      breathLoops.current.forEach(loop => loop?.stop());
      if (connectionIntervalRef.current) {
        clearInterval(connectionIntervalRef.current);
      }
      if (pulseIntervalRef.current) {
        clearInterval(pulseIntervalRef.current);
      }
      if (packetIntervalRef.current) {
        clearInterval(packetIntervalRef.current);
      }
      if (joinTimeoutRef.current) {
        clearTimeout(joinTimeoutRef.current);
      }
      nodeOpacities.forEach(opacity => opacity.stopAnimation());
      birthRingScales.forEach(scale => scale.stopAnimation());
      birthRingOpacities.forEach(opacity => opacity.stopAnimation());
      pulseProgress.stopAnimation();
      pulseRingOpacity.stopAnimation();
      connectionsRef.current.clear();
    };
  }, [
    birthRingOpacities,
    birthRingScales,
    nodeOpacities,
    nodes,
    pulseProgress,
    pulseRingOpacity,
    scheduleNodeTimeout,
    spawnConnections,
    spawnDataPacket,
    startNodeBreath,
    stopNodeBreath,
  ]);

  const pulseScale = pulseProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [PULSE_START_RADIUS / PULSE_END_RADIUS, 1],
  });

  function handleJoinMesh() {
    if (isJoining) {
      return;
    }

    setIsJoining(true);

    Animated.timing(buttonOpacity, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();

    Animated.parallel(
      nodeOpacities.map(opacity =>
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ),
    ).start();

    joinTimeoutRef.current = setTimeout(() => {
      navigation.replace('Main');
    }, 400);
  }

  return (
    <View style={styles.container}>
      <View style={[styles.meshCanvas, { width, height }]}>
        {activeConnections.map(connection => (
          <DynamicConnectionLine
            key={connection.id}
            from={connection.from}
            to={connection.to}
            nodes={nodes}
            opacity={connection.opacity}
          />
        ))}

        <Animated.View
          style={[
            styles.pulseRing,
            {
              left: originNode.x - PULSE_END_RADIUS,
              top: originNode.y - PULSE_END_RADIUS,
              opacity: pulseRingOpacity,
              transform: [{ scale: pulseScale }],
            },
          ]}
        />

        {dataPackets.map(packet => (
          <DataPacketDot key={packet.id} packet={packet} nodes={nodes} />
        ))}

        {nodes.map((node, index) => {
          if (node.isOrigin) {
            return null;
          }

          return (
            <Animated.View
              key={`birth-ring-${node.id}`}
              style={[
                styles.birthRing,
                {
                  left: node.x - BIRTH_RING_END_RADIUS,
                  top: node.y - BIRTH_RING_END_RADIUS,
                  opacity: birthRingOpacities[index],
                  transform: [{ scale: birthRingScales[index] }],
                },
              ]}
            />
          );
        })}

        {nodes.map((node, index) => {
          const nodeRadius = node.isOrigin ? ORIGIN_RADIUS : NODE_RADIUS;
          const nodeDiameter = node.isOrigin ? ORIGIN_DIAMETER : NODE_DIAMETER;

          return (
            <Animated.View
              key={node.id}
              style={[
                styles.node,
                node.isOrigin && styles.originNode,
                {
                  left: node.x - nodeRadius,
                  top: node.y - nodeRadius,
                  width: nodeDiameter,
                  height: nodeDiameter,
                  borderRadius: nodeRadius,
                  opacity: nodeOpacities[index],
                },
              ]}
            />
          );
        })}
      </View>

      <Pressable
        style={[styles.languageButton, { top: insets.top + 16 }]}
        onPress={() => setShowLanguage(true)}
        hitSlop={8}>
        <Text style={styles.languageButtonLabel}>{selectedLanguage}</Text>
      </Pressable>

      <Pressable
        style={[styles.helpButton, { top: insets.top + 16 }]}
        onPress={() => setShowHowItWorks(true)}
        hitSlop={8}>
        <Text style={styles.helpButtonLabel}>?</Text>
      </Pressable>

      <View
        style={[
          styles.identityOverlay,
          { top: height * 0.5, transform: [{ translateY: -115 }] },
        ]}
        pointerEvents="none">
        <View style={styles.brandBlock}>
          <Image
            source={require('../../assets/OLNsLogo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.wordmark}>OLNs</Text>
        </View>
        <Text style={styles.subtitle}>OFFLINE NOTE NETWORK</Text>
        <Text style={styles.tagline}>
          peer-to-peer · mesh relay · no infrastructure
        </Text>
      </View>

      <View style={[styles.bottomSection, { bottom: insets.bottom + 48 }]}>
        <Text style={styles.hint}>BLE · MESH · OFFLINE</Text>
        <Animated.View style={{ opacity: buttonOpacity }}>
          <Pressable
            onPress={handleJoinMesh}
            disabled={isJoining}
            style={({ pressed }) => [
              styles.joinButton,
              pressed && styles.joinButtonPressed,
            ]}>
            {({ pressed }) => (
              <Text
                style={[
                  styles.joinLabel,
                  pressed && styles.joinLabelPressed,
                ]}>
                JOIN MESH
              </Text>
            )}
          </Pressable>
        </Animated.View>
      </View>

      <Modal
        visible={showHowItWorks}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowHowItWorks(false)}>
        <SafeAreaView style={styles.howItWorksModalContainer}>
          <View style={styles.howItWorksModalHeader}>
            <Text style={styles.howItWorksModalHeaderTitle}>
              HOW IT WORKS
            </Text>
            <Pressable
              onPress={() => setShowHowItWorks(false)}
              hitSlop={8}
              style={styles.howItWorksModalCloseButton}>
              <Text style={styles.howItWorksModalCloseLabel}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.howItWorksScrollContent}
            showsVerticalScrollIndicator={false}>
            {HOW_IT_WORKS_STEPS.map((step, index) => (
              <View key={step.number}>
                {index > 0 && <View style={styles.stepDivider} />}
                <View style={styles.stepRow}>
                  <View
                    style={[
                      styles.stepAccentBar,
                      { backgroundColor: step.color },
                    ]}
                  />
                  <View style={styles.stepContent}>
                    <Text
                      style={[styles.stepNumber, { color: step.color }]}>
                      {step.number}
                    </Text>
                    <Text style={styles.stepTitle}>{step.title}</Text>
                    <Text style={styles.stepDescription}>
                      {step.description}
                    </Text>
                  </View>
                </View>
              </View>
            ))}

            <Text style={styles.modalFooter}>
              OLNs works without WiFi, cellular, or any infrastructure. Pure
              peer-to-peer mesh networking.
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={showLanguage}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowLanguage(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderTitle}>LANGUAGE</Text>
            <Pressable
              onPress={() => setShowLanguage(false)}
              hitSlop={8}
              style={styles.modalCloseButton}>
              <Text style={styles.modalCloseLabel}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={false}>
            {LANGUAGES.map(language => {
              const selected = selectedLanguage === language.code;

              return (
                <Pressable
                  key={language.code}
                  onPress={() => {
                    setSelectedLanguage(language.code);
                    setShowLanguage(false);
                  }}
                  style={styles.languageRow}>
                  <Text style={styles.languageCode}>{language.code}</Text>
                  <Text style={styles.languageName}>{language.label}</Text>
                  {selected && <Text style={styles.languageCheck}>✓</Text>}
                </Pressable>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  meshCanvas: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  connectionLine: {
    position: 'absolute',
    height: 0.5,
    backgroundColor: colors.accent,
  },
  pulseRing: {
    position: 'absolute',
    width: PULSE_END_RADIUS * 2,
    height: PULSE_END_RADIUS * 2,
    borderRadius: PULSE_END_RADIUS,
    borderWidth: 1,
    borderColor: colors.hopIndicator,
    backgroundColor: 'transparent',
  },
  birthRing: {
    position: 'absolute',
    width: BIRTH_RING_END_RADIUS * 2,
    height: BIRTH_RING_END_RADIUS * 2,
    borderRadius: BIRTH_RING_END_RADIUS,
    borderWidth: 0.8,
    borderColor: colors.accent,
    backgroundColor: 'transparent',
  },
  packet: {
    position: 'absolute',
    width: PACKET_DIAMETER,
    height: PACKET_DIAMETER,
    borderRadius: PACKET_RADIUS,
    backgroundColor: colors.accent,
  },
  node: {
    position: 'absolute',
    backgroundColor: colors.accent,
  },
  originNode: {
    backgroundColor: colors.hopIndicator,
  },
  languageButton: {
    position: 'absolute',
    left: 20,
    zIndex: 10,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  languageButtonLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.textSecondary,
    letterSpacing: 2,
  },
  helpButton: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpButtonLabel: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  identityOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 5,
  },
  brandBlock: {
    alignItems: 'center',
  },
  logo: {
    width: 300,
    height: 120,
    resizeMode: 'contain',
    marginBottom: 8,
  },
  wordmark: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.accent,
    letterSpacing: 4,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 12,
    fontFamily: fonts.displayRegular,
    fontSize: 11,
    color: colors.textSecondary,
    letterSpacing: 4,
  },
  tagline: {
    marginTop: 8,
    fontFamily: fonts.displayRegular,
    fontSize: 9,
    color: colors.textMeta,
    letterSpacing: 2,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  bottomSection: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 9,
    color: colors.textMeta,
    letterSpacing: 3,
    marginBottom: 12,
  },
  joinButton: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 4,
    paddingVertical: 14,
    paddingHorizontal: 48,
    backgroundColor: colors.accentDim,
  },
  joinButtonPressed: {
    backgroundColor: colors.accent,
  },
  joinLabel: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.accent,
    letterSpacing: 4,
  },
  joinLabelPressed: {
    color: colors.background,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  howItWorksModalContainer: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  howItWorksModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 0,
    marginBottom: 28,
    backgroundColor: colors.surface,
  },
  howItWorksModalHeaderTitle: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.accent,
    letterSpacing: 3,
  },
  howItWorksModalCloseButton: {
    padding: 12,
  },
  howItWorksModalCloseLabel: {
    fontFamily: fonts.regular,
    fontSize: 20,
    color: colors.textSecondary,
  },
  howItWorksScrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  modalHeaderTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.accent,
    letterSpacing: 2,
  },
  modalCloseButton: {
    padding: 8,
  },
  modalCloseLabel: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.textSecondary,
  },
  modalScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  stepAccentBar: {
    width: 3,
    borderRadius: 2,
    marginRight: 16,
  },
  stepContent: {
    flex: 1,
  },
  stepDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 28,
  },
  stepNumber: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 3,
    marginBottom: 6,
  },
  stepTitle: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.textPrimary,
    letterSpacing: 1,
    marginBottom: 10,
  },
  stepDescription: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 24,
    letterSpacing: 0.3,
    color: colors.textSecondary,
  },
  modalFooter: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMeta,
    textAlign: 'center',
    lineHeight: 20,
    letterSpacing: 0.5,
    paddingHorizontal: 24,
    marginTop: 32,
  },
  languageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  languageCode: {
    width: 40,
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.accent,
    letterSpacing: 1,
  },
  languageName: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textPrimary,
  },
  languageCheck: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.hopIndicator,
  },
});
