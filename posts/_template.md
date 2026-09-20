---
title: "{{title}}"
date: {{date}}
platform: Hack The Box
category: web
difficulty: easy
points:
tags: [linux, privesc]
summary: One sentence on what this box or challenge taught you.
# New posts start as drafts. Change to true when it is safe to publish
# (retired box, or the CTF has ended) and run: python3 build.py
published: false
---

Short intro: what this is, what the goal was, and what you ended up needing.

## Recon

```bash
nmap -sC -sV -oN nmap.txt 10.10.10.10
```

What the scan showed and what looked interesting.

## Foothold

How you got in. Show the request, payload, or exploit, and explain why it worked.

## Privilege escalation

```bash
sudo -l
```

## Flags

> [!FLAG]
> flag{replace_or_blur_this}

## Lessons learned

- What you would do faster next time
- What tool or technique was new to you
- How a defender would have stopped it
