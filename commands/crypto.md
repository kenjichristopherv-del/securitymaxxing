---
description: Review cryptography and data protection — algorithm choice, key management, randomness, TLS, and what shouldn't be stored at all.
argument-hint: "[path or crypto module] (optional)"
allowed-tools: Read, Grep, Glob, Bash(rg:*), Bash(find:*)
---

# Cryptography and data protection review

Cryptography fails quietly: the code runs, the tests pass, and the protection isn't there.
Follow `security-review-method`. **Read-only.**

Scope: $ARGUMENTS

Start by finding every use of a crypto library, `random`, hashing, encoding, and TLS
configuration. Note that base64 and hex are **encoding, not encryption** — if you find them
used as a "protection" measure, that's a finding.

## 1. Algorithm and mode choice

- **Symmetric encryption**: AES-GCM, ChaCha20-Poly1305, or another AEAD. Flag ECB mode
  (leaks plaintext structure), CBC without a separate MAC (padding oracle), DES/3DES/RC4/Blowfish.
- **Hashing**: SHA-256+ for integrity. Flag MD5 and SHA-1 anywhere a collision matters.
- **Passwords**: bcrypt/scrypt/argon2id only — never a general-purpose hash, even salted.
- **Signatures**: Ed25519 or ECDSA P-256+ or RSA-PSS ≥2048. Flag RSA with PKCS#1 v1.5 for new code.
- **Key derivation**: HKDF for key material from a strong secret; PBKDF2/scrypt/argon2 with a
  high iteration count for anything derived from a password.
- Any hand-rolled construction — custom "encryption", XOR obfuscation, home-made MACs, or
  encrypt-then-hash-with-no-key. Cryptography written in-house is a finding by default; say so.

## 2. The details that actually break it

- **IV/nonce reuse.** A hardcoded IV, an all-zero IV, or a counter that resets. GCM nonce reuse
  is catastrophic — it leaks the authentication key. Confirm the IV is random (or a guaranteed-unique
  counter) per encryption and stored alongside the ciphertext.
- **Missing authentication.** Encryption without integrity means an attacker can modify
  ciphertext. Use an AEAD, or encrypt-then-MAC.
- **Non-constant-time comparison** of MACs, tokens, signatures, and API keys. Use
  `hmac.compare_digest` / `crypto.timingSafeEqual` / `subtle.ConstantTimeCompare`, not `==`.
- **Weak randomness.** `Math.random()`, `random.random()`, `rand()`, or time-seeded PRNGs used
  for tokens, session IDs, password resets, OTPs, salts, IVs, or nonces. Require a CSPRNG:
  `crypto.randomBytes`, `secrets.token_bytes`, `crypto/rand`. This is one of the most common
  real findings.
- **Predictable identifiers** used as security tokens: UUIDv1 (encodes MAC + timestamp),
  sequential IDs, `timestamp + userId` hashes.
- Truncated hashes or tokens shortened "to look nicer".

## 3. Key management — usually worse than the algorithm

- Where do keys come from? Hardcoded, environment, KMS/HSM, derived from a password?
- Is the encryption key stored next to the encrypted data (in the same database, the same
  config, the same repo)? Then the encryption protects against approximately nothing — say so plainly.
- Are different keys used for different purposes (encryption vs signing vs sessions)?
- Is there a rotation mechanism? Is there a key **version/ID stored with the ciphertext** so
  rotation is even possible without decrypting everything at once?
- Key access scope: which services and which humans can read the key?
- Are keys ever logged, or included in error reports and crash dumps?

## 4. Transport

- TLS everywhere, including internal service-to-service hops and database connections.
- **Certificate verification disabled** anywhere: `rejectUnauthorized: false`, `verify=False`,
  `InsecureSkipVerify: true`, `curl -k`, a custom trust-everything `TrustManager` or
  `ServerTrustEvaluator`. This is common in code that once had a staging cert problem, and it
  turns TLS into no protection at all.
- Minimum version TLS 1.2+, sensible cipher suites, no compression.
- HSTS on browser-facing hosts; certificate pinning for mobile, if the threat model needs it.

## 5. Data protection at rest and in scope

- What is encrypted at rest, and against which threat? Full-disk encryption doesn't protect
  against SQL injection; application-level field encryption does. Be precise about what a given
  control actually mitigates.
- Which fields hold regulated or high-sensitivity data (payment data, government IDs, health
  data, precise location, biometrics, private messages) and how are they protected?
- **What is stored that shouldn't be stored at all?** Raw card numbers/CVV, full ID numbers,
  plaintext third-party credentials, unnecessary PII, indefinite retention. Not storing it is
  the strongest control available.
- Backups and exports: encrypted, access-controlled, retention-limited?
- Data in logs, analytics, error trackers, and support tooling — often the real leak.
- Deletion: when a user deletes their account, what actually gets deleted, and what remains in
  backups, caches, search indexes, and third-party processors?

## Report

Standard finding format. For each finding state **what protection the reader believes they
have, and what they actually have** — that gap is the finding. Where the fix requires
re-encrypting existing data or rotating a key, say so and outline the migration; a crypto fix
that ignores existing ciphertext is not a fix.

## Recommended next step

Close by printing one line — `→ Recommended next: …`: `/securitymaxxing:fix` for the code changes — and flag explicitly where a fix requires re-encrypting existing data or rotating a key, since that's a migration, not a patch.
