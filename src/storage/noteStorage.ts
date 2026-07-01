import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Note } from '../types/Note';

const NOTE_PREFIX = 'olns_note_';

export async function saveNote(note: Note): Promise<void> {
  await AsyncStorage.setItem(`${NOTE_PREFIX}${note.noteId}`, JSON.stringify(note));
}

export async function getNotes(): Promise<Note[]> {
  const keys = await AsyncStorage.getAllKeys();
  const noteKeys = keys.filter(key => key.startsWith(NOTE_PREFIX));
  const pairs = await AsyncStorage.multiGet(noteKeys);

  const notes = pairs
    .map(([, value]) => value)
    .filter((value): value is string => value != null)
    .map(value => JSON.parse(value) as Note);

  return notes.sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

export async function deleteNote(noteId: string): Promise<void> {
  await AsyncStorage.removeItem(`${NOTE_PREFIX}${noteId}`);
}
