<p align="center"><img src="docs/img/icon.png" width="96" alt="Fotoin icon" /></p>

# Fotoin

**Foto dia persis seperti referensinya.** Fotoin is a free, open-source camera
app that coaches you to photograph someone exactly like a reference pose (a
Pinterest save, an IG post, or an example photo you take in the app).

- The reference shows as a ghost overlay with its pose skeleton.
- A live match meter gives one hint at a time ("Mundur sedikit", "Geser HP ke
  kanan", "Angkat dagu sedikit") and shoots automatically at a score of 80.
- Works for full/half body, close-up faces, and groups of up to four people.
- iPhone-style viewfinder: grid, level, .5×/1×/2× lenses.
- Free, no ads, no account. Everything runs on the device; no photo or data
  ever leaves it.

Website & privacy policy: https://matthew-eucaristo.github.io/fotoin/

## Download

Android APKs are attached to [GitHub Releases](https://github.com/Matthew-Eucaristo/fotoin/releases).
Google Play is coming; iOS after that.

## Develop

Expo SDK 58 · React Native 0.88 · VisionCamera v5 · a local Nitro module for
pose/face detection (Apple Vision on iOS; Google MediaPipe + ML Kit on Android).

```bash
npm install
npx expo run:android   # or: npx expo run:ios (development build; Expo Go can't load the native modules)
npm run typecheck && npm run lint && npm test
```

See [`AGENTS.md`](AGENTS.md) for architecture, conventions and gotchas.
Contributions are welcome: open an issue or a pull request.

## License

[MIT](LICENSE). Archival photographs on the website are credited on the page.
