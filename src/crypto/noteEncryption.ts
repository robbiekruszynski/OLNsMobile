import CryptoJS from 'crypto-js';
import nacl from 'tweetnacl';
import { decodeBase64, decodeUTF8, encodeBase64, encodeUTF8 } from 'tweetnacl-util';

const PBKDF2_ITERATIONS = 10_000;
const KEY_BYTES = 32;

export function deriveKey(password: string, salt: Uint8Array): Uint8Array {
  const saltWords = CryptoJS.lib.WordArray.create(Array.from(salt));
  const derived = CryptoJS.PBKDF2(password, saltWords, {
    keySize: KEY_BYTES / 4,
    iterations: PBKDF2_ITERATIONS,
    hasher: CryptoJS.algo.SHA256,
  });

  const key = new Uint8Array(KEY_BYTES);
  const latin1 = derived.toString(CryptoJS.enc.Latin1);
  for (let i = 0; i < KEY_BYTES; i++) {
    key[i] = latin1.charCodeAt(i) & 0xff;
  }
  return key;
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
