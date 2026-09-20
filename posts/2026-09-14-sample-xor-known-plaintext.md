---
title: "Sample: XOR with a known plaintext"
date: 2026-09-14
platform: picoCTF
category: crypto
difficulty: medium
points: 100
tags: [xor, python, known-plaintext]
---

A single-byte-key XOR ciphertext, where the flag format gives away the key. This is a second sample so the filters have something to filter.

## Approach

The flag starts with `picoCTF{`, so XORing the first ciphertext byte with `p` recovers the key.

```python
ct = bytes.fromhex("3e0a1c...")
key = ct[0] ^ ord("p")
print(bytes(b ^ key for b in ct).decode())
```

## Takeaway

Any known prefix leaks the key when the key is short. Never reuse a repeating key on predictable data.
