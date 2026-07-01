import {
  MeshServices,
  OfflineProtocol,
  type DiagnosticEvent,
  type NeighborDiscoveredEvent,
  type NeighborLostEvent,
  type ServiceDiscoveredEvent,
  type ServiceRequestReceivedEvent,
  type ServiceResponseReceivedEvent,
} from '@offline-protocol/mesh-sdk';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { getOrCreateUserId } from '../identity/getOrCreateUserId';
import { requestBlePermissions } from '../permissions/requestBlePermissions';
import { getNotes, saveNote } from '../storage/noteStorage';
import type { Note, NoteType } from '../types/Note';

const NOTE_SERVICE_ID = 'offline-notes.v1';
const NOTE_SERVICE_VERSION = '1.0';
// Tuned for faster pickup during dev/testing — increase for production/battery.
const DISCOVERY_TIMEOUT_MS = 8000;
const SERVICE_REQUEST_TIMEOUT_MS = 8000;
const DISCOVERY_INTERVAL_MS = 12000;
const NEIGHBOR_DISCOVERY_DEBOUNCE_MS = 1500;

export const MAX_HOPS = 6;

export type MeshStatus = 'idle' | 'starting' | 'running' | 'error';

export interface MeshContextValue {
  protocol: OfflineProtocol | null;
  services: MeshServices | null;
  status: MeshStatus;
  peerCount: number;
  activePeerIds: string[];
  errorMessage: string | null;
  userId: string | null;
  myNotes: Note[];
  receivedNotes: Note[];
  allNotes: Note[];
  isDiscovering: boolean;
  loadMyNotes: () => Promise<void>;
  broadcastNote: (note: Note) => Promise<void>;
  startDiscovery: () => Promise<void>;
}

export const MeshContext = createContext<MeshContextValue | null>(null);

async function collectServiceDiscoveries(
  protocol: OfflineProtocol,
  startQuery: () => Promise<string>,
  timeoutMs: number,
): Promise<ServiceDiscoveredEvent[]> {
  const results: ServiceDiscoveredEvent[] = [];
  let queryId: string | null = null;

  const handler = (event: ServiceDiscoveredEvent) => {
    if (
      queryId &&
      event.query_id === queryId &&
      event.service_id === NOTE_SERVICE_ID
    ) {
      results.push(event);
    }
  };

  protocol.on('service_discovered', handler);

  try {
    queryId = await startQuery();
  } catch (error) {
    protocol.off('service_discovered', handler);
    throw error;
  }

  await new Promise<void>(resolve => {
    setTimeout(resolve, timeoutMs);
  });

  protocol.off('service_discovered', handler);
  return results;
}

function requestServiceBody(
  protocol: OfflineProtocol,
  services: MeshServices,
  provider: string,
  noteId: string,
  timeoutMs: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let requestId = '';
    let settled = false;

    const cleanup = (handler: (event: ServiceResponseReceivedEvent) => void) => {
      protocol.off('service_response_received', handler);
    };

    const handler = (event: ServiceResponseReceivedEvent) => {
      if (
        settled ||
        event.request_id !== requestId ||
        event.service_id !== NOTE_SERVICE_ID
      ) {
        return;
      }

      settled = true;
      cleanup(handler);

      if (event.status === 'ok') {
        resolve(event.body);
        return;
      }

      reject(new Error(`Service request failed: ${event.status}`));
    };

    protocol.on('service_response_received', handler);

    void services
      .sendServiceRequest(
        provider,
        NOTE_SERVICE_ID,
        'fetch',
        JSON.stringify({ noteId }),
      )
      .then(id => {
        requestId = id;
      })
      .catch(error => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup(handler);
        reject(error);
      });

    setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup(handler);
      reject(new Error('Service request timed out'));
    }, timeoutMs);
  });
}

function noteFromDiscovery(
  capabilities: Record<string, string>,
  body: string,
): Note {
  return {
    noteId: capabilities.noteId,
    type: capabilities.type as NoteType,
    title: capabilities.title,
    body,
    preview: capabilities.preview,
    authorId: capabilities.authorId,
    timestamp: capabilities.timestamp,
    hopOrigin: Number(capabilities.hopOrigin),
  };
}

function noteCapabilities(note: Note): Record<string, string> {
  return {
    noteId: note.noteId,
    type: note.type,
    title: note.title,
    preview: note.preview,
    authorId: note.authorId,
    timestamp: note.timestamp,
    hopOrigin: String(note.hopOrigin),
  };
}

function randomRelayDelay(): Promise<void> {
  const delayMs = 200 + Math.random() * 600;
  return new Promise(resolve => setTimeout(resolve, delayMs));
}

export function MeshProvider({ children }: { children: ReactNode }) {
  const [protocol, setProtocol] = useState<OfflineProtocol | null>(null);
  const [services, setServices] = useState<MeshServices | null>(null);
  const [status, setStatus] = useState<MeshStatus>('idle');
  const [peerCount, setPeerCount] = useState(0);
  const [activePeerIds, setActivePeerIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [myNotes, setMyNotes] = useState<Note[]>([]);
  const [receivedNotes, setReceivedNotes] = useState<Note[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);

  const serviceListenerRegistered = useRef(false);
  const protocolRef = useRef<OfflineProtocol | null>(null);
  const servicesRef = useRef<MeshServices | null>(null);
  const userIdRef = useRef<string>('');
  const myNotesRef = useRef<Note[]>([]);
  const receivedNotesRef = useRef<Note[]>([]);
  const discoveryInFlightRef = useRef(false);
  const relayedNoteIdsRef = useRef<Set<string>>(new Set());
  const activePeerIdsRef = useRef<Set<string>>(new Set());
  const activeAuthorIdsRef = useRef<Set<string>>(new Set());
  const peerIdToAuthorIdRef = useRef<Map<string, string>>(new Map());
  const neighborDiscoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const startDiscoveryRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    protocolRef.current = protocol;
  }, [protocol]);

  useEffect(() => {
    servicesRef.current = services;
  }, [services]);

  useEffect(() => {
    myNotesRef.current = myNotes;
  }, [myNotes]);

  useEffect(() => {
    receivedNotesRef.current = receivedNotes;
  }, [receivedNotes]);

  const syncActivePeerIds = useCallback(() => {
    setActivePeerIds(Array.from(activeAuthorIdsRef.current));
  }, []);

  const allNotes = useMemo(() => {
    const byId = new Map<string, Note>();

    for (const note of [...myNotes, ...receivedNotes]) {
      byId.set(note.noteId, note);
    }

    return Array.from(byId.values()).sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [myNotes, receivedNotes]);

  const loadMyNotes = useCallback(async () => {
    const currentUserId = userIdRef.current || (await getOrCreateUserId());
    userIdRef.current = currentUserId;
    setUserId(currentUserId);

    const notes = await getNotes();
    setMyNotes(notes.filter(note => note.authorId === currentUserId));
    setReceivedNotes(notes.filter(note => note.authorId !== currentUserId));
  }, []);

  const registerServiceRequestListener = useCallback(
    (activeProtocol: OfflineProtocol, meshServices: MeshServices) => {
      if (serviceListenerRegistered.current) {
        return;
      }

      serviceListenerRegistered.current = true;

      activeProtocol.on(
        'service_request_received',
        async (event: ServiceRequestReceivedEvent) => {
          if (event.service_id !== NOTE_SERVICE_ID) {
            return;
          }

          const notes = await getNotes();
          let note: Note | undefined;

          try {
            const requestBody = JSON.parse(event.body || '{}') as {
              noteId?: string;
            };
            if (requestBody.noteId) {
              note = notes.find(item => item.noteId === requestBody.noteId);
            }
          } catch {
            // Request body is not JSON — fall through to single-note lookup.
          }

          if (!note && notes.length === 1) {
            note = notes[0];
          }

          if (!note) {
            return;
          }

          await meshServices.respondToServiceRequest(
            event.request_id,
            event.sender,
            event.service_id,
            'ok',
            JSON.stringify({ body: note.body }),
          );
        },
      );
    },
    [],
  );

  const relayNote = useCallback(
    async (note: Note) => {
      const currentUserId = userIdRef.current;
      const activeServices = servicesRef.current;
      const activeProtocol = protocolRef.current;

      if (!currentUserId || !activeServices || !activeProtocol) {
        return;
      }

      if (note.authorId === currentUserId) {
        return;
      }

      if (relayedNoteIdsRef.current.has(note.noteId)) {
        return;
      }

      if (note.hopOrigin >= MAX_HOPS) {
        return;
      }

      await randomRelayDelay();

      const relayHop = note.hopOrigin + 1;
      const relayedBy = [...(note.relayedBy ?? []), currentUserId];
      const relayedNote: Note = {
        ...note,
        hopOrigin: relayHop,
        relayedBy,
      };

      await activeServices.registerService(
        NOTE_SERVICE_ID,
        NOTE_SERVICE_VERSION,
        noteCapabilities(relayedNote),
      );

      relayedNoteIdsRef.current.add(note.noteId);
      registerServiceRequestListener(activeProtocol, activeServices);

      const storedNote: Note = {
        ...note,
        relayedBy,
      };
      await saveNote(storedNote);

      setReceivedNotes(prev =>
        prev.map(existing =>
          existing.noteId === note.noteId ? storedNote : existing,
        ),
      );

      if (__DEV__) {
        console.log(`[OLNs] Relaying note ${note.noteId} at hop ${relayHop}`);
      }
    },
    [registerServiceRequestListener],
  );

  const startDiscovery = useCallback(async () => {
    const activeProtocol = protocolRef.current;
    const activeServices = servicesRef.current;
    const currentUserId = userIdRef.current;

    if (
      !activeProtocol ||
      !activeServices ||
      !currentUserId ||
      discoveryInFlightRef.current
    ) {
      return;
    }

    discoveryInFlightRef.current = true;
    setIsDiscovering(true);

    try {
      const discoveries = await collectServiceDiscoveries(
        activeProtocol,
        () => activeServices.discoverServices(NOTE_SERVICE_ID),
        DISCOVERY_TIMEOUT_MS,
      );

      const seenNoteIds = new Set<string>([
        ...myNotesRef.current.map(note => note.noteId),
        ...receivedNotesRef.current.map(note => note.noteId),
      ]);

      for (const discovery of discoveries) {
        const { capabilities, provider_peer_id: peer } = discovery;
        const noteId = capabilities.noteId;

        if (!noteId || seenNoteIds.has(noteId)) {
          continue;
        }

        if (capabilities.authorId === currentUserId) {
          continue;
        }

        try {
          const responseBody = await requestServiceBody(
            activeProtocol,
            activeServices,
            peer,
            noteId,
            SERVICE_REQUEST_TIMEOUT_MS,
          );
          const parsed = JSON.parse(responseBody) as { body?: string };

          if (!parsed.body) {
            continue;
          }

          const note = noteFromDiscovery(capabilities, parsed.body);
          await saveNote(note);
          seenNoteIds.add(note.noteId);

          setReceivedNotes(prev => [
            note,
            ...prev.filter(existing => existing.noteId !== note.noteId),
          ]);

          peerIdToAuthorIdRef.current.set(
            discovery.provider_peer_id,
            capabilities.authorId,
          );
          if (activePeerIdsRef.current.has(discovery.provider_peer_id)) {
            activeAuthorIdsRef.current.add(capabilities.authorId);
            syncActivePeerIds();
          }

          void relayNote(note).catch(error => {
            if (__DEV__) {
              console.log('[OLNs] relay failed', error);
            }
          });
        } catch (error) {
          if (__DEV__) {
            console.log('[mesh discovery] failed to fetch note', error);
          }
        }
      }
    } catch (error) {
      if (__DEV__) {
        console.log('[mesh discovery] scan failed', error);
      }
    } finally {
      discoveryInFlightRef.current = false;
      setIsDiscovering(false);
    }
  }, [relayNote]);

  useEffect(() => {
    startDiscoveryRef.current = startDiscovery;
  }, [startDiscovery]);

  const broadcastNote = useCallback(
    async (note: Note) => {
      if (!protocol || !services) {
        throw new Error('Mesh not ready');
      }

      await services.registerService(
        NOTE_SERVICE_ID,
        NOTE_SERVICE_VERSION,
        noteCapabilities(note),
      );

      await saveNote(note);
      setMyNotes(prev => [
        note,
        ...prev.filter(existing => existing.noteId !== note.noteId),
      ]);
      registerServiceRequestListener(protocol, services);
    },
    [protocol, services, registerServiceRequestListener],
  );

  useEffect(() => {
    let activeProtocol: OfflineProtocol | null = null;
    let activeServices: MeshServices | null = null;
    let cancelled = false;

    const onNeighborDiscovered = (event: NeighborDiscoveredEvent) => {
      activePeerIdsRef.current.add(event.peer_id);
      const authorId = peerIdToAuthorIdRef.current.get(event.peer_id);
      if (authorId) {
        activeAuthorIdsRef.current.add(authorId);
        syncActivePeerIds();
      }
      setPeerCount(prev => prev + 1);

      if (neighborDiscoveryTimerRef.current) {
        clearTimeout(neighborDiscoveryTimerRef.current);
      }

      neighborDiscoveryTimerRef.current = setTimeout(() => {
        void startDiscoveryRef.current();
      }, NEIGHBOR_DISCOVERY_DEBOUNCE_MS);
    };

    const onNeighborLost = (event: NeighborLostEvent) => {
      activePeerIdsRef.current.delete(event.peer_id);
      const authorId = peerIdToAuthorIdRef.current.get(event.peer_id);
      if (authorId) {
        activeAuthorIdsRef.current.delete(authorId);
        syncActivePeerIds();
      }
      setPeerCount(prev => Math.max(0, prev - 1));
    };

    const onDiagnostic = (event: DiagnosticEvent) => {
      if (__DEV__) {
        console.log('[mesh diagnostic]', event);
      }
    };

    async function startMesh() {
      try {
        const currentUserId = await getOrCreateUserId();
        userIdRef.current = currentUserId;
        setUserId(currentUserId);

        const granted = await requestBlePermissions();

        if (cancelled) {
          return;
        }

        if (!granted) {
          setStatus('error');
          setErrorMessage('Bluetooth permissions denied');
          return;
        }

        activeProtocol = new OfflineProtocol({
          appId: 'olns',
          userId: currentUserId,
          newArchEnabled: false,
          transports: {
            ble: { enabled: true },
          },
          relay: {
            allowRelay: true,
            minBatteryForRelay: 20,
            relayPriority: 'auto',
          },
        } as ConstructorParameters<typeof OfflineProtocol>[0]);

        activeServices = new MeshServices();

        activeProtocol.on('neighbor_discovered', onNeighborDiscovered);
        activeProtocol.on('neighbor_lost', onNeighborLost);
        activeProtocol.on('diagnostic', onDiagnostic);

        setProtocol(activeProtocol);
        setServices(activeServices);
        protocolRef.current = activeProtocol;
        servicesRef.current = activeServices;
        setStatus('starting');

        await activeProtocol.start();

        if (cancelled) {
          return;
        }

        registerServiceRequestListener(activeProtocol, activeServices);
        setStatus('running');
        await loadMyNotes();

        if (cancelled) {
          return;
        }

        await startDiscovery();
      } catch (error) {
        if (cancelled) {
          return;
        }

        setStatus('error');
        setErrorMessage(
          error instanceof Error ? error.message : 'Failed to start mesh',
        );
      }
    }

    startMesh();

    return () => {
      cancelled = true;
      serviceListenerRegistered.current = false;
      relayedNoteIdsRef.current.clear();
      activePeerIdsRef.current.clear();
      activeAuthorIdsRef.current.clear();
      peerIdToAuthorIdRef.current.clear();

      if (neighborDiscoveryTimerRef.current) {
        clearTimeout(neighborDiscoveryTimerRef.current);
        neighborDiscoveryTimerRef.current = null;
      }

      if (activeProtocol) {
        activeProtocol.removeAllListeners();
        void activeProtocol
          .stop()
          .then(() => activeProtocol?.destroy())
          .finally(() => {
            setProtocol(null);
            setServices(null);
            protocolRef.current = null;
            servicesRef.current = null;
            setPeerCount(0);
            setActivePeerIds([]);
            setMyNotes([]);
            setReceivedNotes([]);
            setUserId(null);
            userIdRef.current = '';
            setStatus('idle');
          });
      }
    };
  }, [loadMyNotes, registerServiceRequestListener, startDiscovery, syncActivePeerIds]);

  useEffect(() => {
    if (status !== 'running') {
      return;
    }

    const intervalId = setInterval(() => {
      void startDiscovery();
    }, DISCOVERY_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [status, startDiscovery]);

  return (
    <MeshContext.Provider
      value={{
        protocol,
        services,
        status,
        peerCount,
        activePeerIds,
        errorMessage,
        userId,
        myNotes,
        receivedNotes,
        allNotes,
        isDiscovering,
        loadMyNotes,
        broadcastNote,
        startDiscovery,
      }}>
      {children}
    </MeshContext.Provider>
  );
}

export function useMesh(): MeshContextValue {
  const value = useContext(MeshContext);

  if (!value) {
    throw new Error('useMesh must be used within MeshProvider');
  }

  return value;
}
