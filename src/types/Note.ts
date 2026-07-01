export type NoteType = 'emergency' | 'resource' | 'information' | 'waypoint';

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
}
