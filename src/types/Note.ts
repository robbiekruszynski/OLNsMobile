export type NoteType = 'emergency' | 'resource' | 'information' | 'waypoint';

export const ENCRYPTED_NOTE_TITLE = 'Encrypted message';

export interface Note {
  noteId: string;
  type: NoteType;
  title: string;
  body: string;
  preview: string;
  authorId: string;
  timestamp: string;
  hopOrigin: number;
  relayedBy?: string[];
  encrypted: boolean;
  cipherText?: string;
  salt?: string;
  nonce?: string;
}
