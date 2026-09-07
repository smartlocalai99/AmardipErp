# Amardip Elevators — customer Android app

This is a Trusted Web Activity (TWA) — the Google-recommended way to wrap a
web app as a real Android app for the Play Store. It's a thin native shell
around `https://amardip-erp.vercel.app/Customerlogin` — it opens
full-screen with no browser address bar, gets its own launcher icon, and can
push notifications, because it uses the same Chrome the phone already has
rather than shipping a bundled web view.

## What's already done

- `app-release-bundle.aab` — the signed Android App Bundle. **This is the
  file you upload to Play Console.**
- `app-release-signed.apk` — a signed APK, useful only for installing on a
  test phone directly (`adb install app-release-signed.apk`) before you
  publish. Play Store wants the `.aab`, not this.
- `android-keystore.jks` + `KEYSTORE_PASSWORDS.txt` — the signing key.
  **Back these up somewhere outside this repo right now** (password
  manager, private cloud folder). They are deliberately not committed to
  git. If this key is ever lost, this app listing can never be updated
  again — Google would treat any rebuild as a different app and you'd have
  to publish under a new package name from scratch.
- Package name: `com.amardipelevators.customer` — permanent once you
  publish, cannot be changed later.
- The web app itself now has a dedicated manifest
  (`public/manifest-customer.webmanifest`) and a Digital Asset Links file
  (`public/.well-known/assetlinks.json`) already pushed to `main`. The
  asset links file tells Android "this app and this website are run by the
  same people," which is what removes the address bar.

## Before you upload — verify the site changes are actually live

Check these two URLs return real content (not a 404):
- https://amardip-erp.vercel.app/manifest-customer.webmanifest
- https://amardip-erp.vercel.app/.well-known/assetlinks.json

If either 404s, the Vercel deploy for the `main` branch hasn't gone out —
check the Vercel dashboard for a stuck or failed build before submitting
the app, otherwise the app will fall back to showing a browser-style
address bar instead of running full-screen.

## Uploading to Play Console (smartlocal account)

1. Go to https://play.google.com/console, use the existing account.
2. Create app → name "Amardip Elevators" → default language English (India)
   → App (not game) → Free.
3. Complete the required setup sections in the left sidebar in order —
   Play Console won't let you release until each is filled in:
   - **App content** → Privacy policy: paste
     `https://amardip-erp.vercel.app/privacy-policy`
   - **App content** → Data safety: use `PLAY_STORE_LISTING.md` in this
     folder — it lists exactly what to declare.
   - **App content** → Content rating: fill the questionnaire — see notes
     in `PLAY_STORE_LISTING.md` (expect "Everyone").
   - **App content** → Target audience: not aimed at children.
   - **Store listing** → use the copy in `PLAY_STORE_LISTING.md` for the
     short/full description; upload the screenshots and feature graphic
     listed there once you've taken them.
   - **App icon**: reuse `public/adlogo-pwa-512.png` from the main repo.
4. **Production** (left sidebar) → Create new release.
   - Upload `app-release-bundle.aab`.
   - Play Console will auto-detect the signing certificate from the AAB
     the first time — accept it (this becomes "app signing by Google
     Play," which is normal and recommended; keep your own `.jks` safe
     regardless, you still need it to build the *next* upload).
   - Release name / notes: "1.0.0 — initial release".
5. Submit for review. First-time app reviews typically take a few hours to
   a couple of days.

## If you need to rebuild after a web app change

From this folder:

```
BUBBLEWRAP_KEYSTORE_PASSWORD=<see KEYSTORE_PASSWORDS.txt> \
BUBBLEWRAP_KEY_PASSWORD=<see KEYSTORE_PASSWORDS.txt> \
npx bubblewrap build
```

This re-packages the same signing key and the same `twa-manifest.json` —
you do NOT need to regenerate the project or the key for routine web
changes (copy edits, new features inside the web app itself all show up
automatically next time the app opens, since it's just loading the live
site — a rebuild is only needed to bump the version number for a Play
Store update, change the app icon/name, or after an Android-side setting
changes).

To publish an update: bump `appVersionCode` and `appVersionName` in
`twa-manifest.json`, run the build command above, and upload the new
`.aab` as a new Production release.

If `./gradlew assembleRelease` times out trying to download Gradle itself
(a sandboxed/restricted network can block `services.gradle.org` for Java
specifically even though a browser or `curl` works fine), download
https://github.com/gradle/gradle-distributions/releases/download/v8.11.1/gradle-8.11.1-bin.zip
manually and point `gradle/wrapper/gradle-wrapper.properties`'s
`distributionUrl` at the local file, e.g.
`distributionUrl=file:/full/path/to/gradle-8.11.1-bin.zip`, then re-run.

## iOS

Not part of this pass — the user said Play Store first, App Store later
(needs a native wrapper or a Capacitor/PWA-in-WKWebView build, plus an
Apple Developer account, which is separate work).
