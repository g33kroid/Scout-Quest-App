import { hash, verify } from "@node-rs/argon2";

// docs/tasks/03-auth.md: "PIN hashes are argon2id and never logged." Never
// log or return a raw PIN or its hash anywhere outside this file.
// `2` is Algorithm.Argon2id — @node-rs/argon2 declares that enum `const`,
// which `isolatedModules` (tsconfig.json) forbids importing across modules.
const ARGON2_OPTIONS = { algorithm: 2 };

export function hashPin(pin: string): Promise<string> {
  return hash(pin, ARGON2_OPTIONS);
}

export function verifyPin(pinHash: string, pin: string): Promise<boolean> {
  return verify(pinHash, pin, ARGON2_OPTIONS);
}
