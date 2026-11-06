# Ironhold — Co-op Action RPG

A mobile-first, WoW-Classic-inspired co-op Action-RPG for iOS, built with **React Native + Expo + TypeScript**,
styled with **NativeWind**, driven by **Zustand** state, and networked with **serverless WebRTC P2P** data channels.

> No central game server. One device hosts the session and others join peer-to-peer, synchronizing
> movement, combat, enemy AI state and loot over encrypted data channels.

## Stack

| Concern | Choice |
| --- | --- |
| Runtime | Expo SDK 54 / React Native 0.81 (New Architecture) |
| Language | TypeScript (strict, `noUncheckedIndexedAccess`) |
| Styling | NativeWind v4 + Tailwind CSS |
| State | Zustand |
| Networking | `react-native-webrtc` (native) / browser `RTCPeerConnection` (web dev preview) |
| Audio/Haptics | `expo-haptics` |
| Testing | `node:test` via `tsx` on the framework-free engine layer |

## Getting started

```bash
npm install
npm run ios        # requires Xcode + CocoaPods for the native WebRTC module
npm run web        # browser preview of the UI (development only)
npm run typecheck
npm test
```

## Architecture

```
src/
  engine/     pure TypeScript simulation — deterministic, unit tested
    rng.ts          seeded xorshift RNG (shared loot / enemy rolls)
    world.ts        authoritative-ish simulation step (movement, abilities, enemies)
    protocol.ts     wire message schema + encoding
  net/        WebRTC transport (signaling, peer, host, mesh relay)
  store/      Zustand stores bridging engine <-> UI
  ui/         presentational components (HUD, panels, joystick)
  screens/    Main Menu, Character Select, Game
  game/       static data (classes, abilities, items)
```

The engine is deliberately free of React Native imports: it runs in `node:test`, in the host and in
every client, so movement and combat math can be verified without a device.

### Networking model

* **Host** creates a peer connection per joiner; the room code is a compressed SDP offer.
* **Joiners** paste the host code, produce an answer code, and send it back out-of-band (iMessage, clipboard, QR).
* All peers exchange a single ordered-reliable + unreliable-unordered data channel pair.
* The host relays state between joiners, forming a star mesh; the simulation stays consistent because
  every peer runs the same deterministic rules and the host is the tie-breaker.

## Milestones

1. Project setup, TypeScript, NativeWind, git
2. Classic HUD, character selection, game view
3. WebRTC P2P core
4. Movement, abilities, synchronized PvE
5. Grid inventory + P2P loot
