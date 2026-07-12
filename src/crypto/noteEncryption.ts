import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import nacl from 'tweetnacl';
import { decodeBase64, decodeUTF8, encodeBase64, encodeUTF8 } from 'tweetnacl-util';

const PBKDF2_ITERATIONS = 100_000;
const KEY_BYTES = 32;

export function deriveKey(password: string, salt: Uint8Array): Uint8Array {
  return pbkdf2(sha256, password, salt, {
    c: PBKDF2_ITERATIONS,
    dkLen: KEY_BYTES,
  });
}

export function encryptNoteContent(
  content: { title: string; body: string },
  password: string,
): { cipherText: string; salt: string; nonce: string } {
  const salt = nacl.randomBytes(16);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const key = deriveKey(password, salt);
  const message = decodeUTF8(JSON.stringify(content));
  const boxed = nacl.secretbox(message, nonce, key);

  return {
    cipherText: encodeBase64(boxed),
    salt: encodeBase64(salt),
    nonce: encodeBase64(nonce),
  };
}

export function decryptNoteContent(
  payload: { cipherText: string; salt: string; nonce: string },
  password: string,
): { title: string; body: string } | null {
  try {
    const salt = decodeBase64(payload.salt);
    const nonce = decodeBase64(payload.nonce);
    const cipher = decodeBase64(payload.cipherText);
    const key = deriveKey(password, salt);
    const opened = nacl.secretbox.open(cipher, nonce, key);

    if (!opened) {
      return null;
    }

    return JSON.parse(encodeUTF8(opened)) as { title: string; body: string };
  } catch {
    return null;
  }
}
