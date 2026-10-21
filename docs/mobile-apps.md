# iCoach mobile apps (Android and iOS)

The Android and iOS apps are native shells (Capacitor 8) around the live site,
`https://i-coach.vercel.app`. They open the same screens, call the same server functions and use the
same Supabase database as the website. A coach can plan a workout on a laptop and the athlete sees it
on their phone straight away, in either direction.

Because the screens come from the site, **a normal Vercel deploy updates both apps**. You only need
new app files after changing something native: `android/`, `ios/`, `capacitor.config.ts`, `mobile/`
or `assets/`.

## What the app adds on top of the website

| Area                 | What happens in the app                                                                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Front door           | Opens on `/app`: signed-in accounts go straight to their dashboard, everyone else chooses athlete or coach. The marketing page is not shown.                                                            |
| App tour             | First sign-in on a phone starts a guided tour of the real screens (coach and athlete versions, English and Arabic). Next / Back step by step, Skip all at any time. Replay it from **More → App tour**. |
| Sign-in              | The session is stored in native storage the OS never clears, so people stay signed in.                                                                                                                  |
| Android back button  | Closes the open sheet or dialog first, then goes back, then leaves the app from a home screen.                                                                                                          |
| iOS                  | Swipe from the edge to go back.                                                                                                                                                                         |
| Links                | Zoom links open the Zoom app; other web links open in an in-app browser; mail and phone links open Mail and Phone.                                                                                      |
| Zoom connect (coach) | Runs in the in-app browser, where Zoom's Google/Apple sign-in works, then returns to the app automatically (`icoach://zoom`).                                                                           |
| Screen edges         | Content clears the notch, status bar and home indicator; the tab bar hides while the keyboard is open.                                                                                                  |
| No network           | A built-in offline screen that reconnects by itself. Inside the app, a strip under the header says when the connection drops.                                                                           |
| Polish               | Dark splash and icon, light status-bar icons, haptic ticks on the tab bar and tour, no rubber-band scrolling or long-press callouts.                                                                    |

Native code lives in `src/lib/native.ts`, `src/components/icoach/native-bridge.tsx` and
`src/components/icoach/app-tour.tsx`. It does nothing on the website.

## Getting the install files

The GitHub Actions workflow `.github/workflows/mobile-apps.yml` builds both apps on GitHub's
machines (a Mac is needed for iOS) whenever native files change on `main` or `mobile-apps`. It can
also be started by hand from **Actions → Mobile apps → Run workflow**.

Each run publishes a **pre-release** named `iCoach mobile test build 1.0.<run>` on the repository's
Releases page with two files:

- `iCoach-android.apk`
- `iCoach-ios-unsigned.ipa`

## Install on Android

1. On the Android phone, open the release page and download `iCoach-android.apk`. You can also copy
   the file to the phone.
2. Open the file. When Android asks, allow your browser or file manager to install unknown apps.
3. Tap **Install**, then open iCoach.

Later builds install straight over this one: same key, higher version.

## Install on iPhone (free, no App Store)

Apple only installs signed apps. The `.ipa` is unsigned, so you sign it with your own Apple ID while
installing. With a free Apple ID the app works for 7 days, then you install it again the same way. A
paid developer account ($99/year) makes that one year.

1. On a Windows PC or Mac, install **Sideloadly** from sideloadly.io. On Windows also install
   **iTunes** and **iCloud** from apple.com, not the Microsoft Store versions.
2. Connect the iPhone with a cable and tap **Trust** on the phone.
3. Open Sideloadly, drag in `iCoach-ios-unsigned.ipa`, enter your Apple ID and press **Start**.
4. On the iPhone, open **Settings → Privacy & Security → Developer Mode**, turn it on and restart
   when asked. This is needed once on iOS 16 and later.
5. Then **Settings → General → VPN & Device Management**, tap your Apple ID and choose **Trust**.
6. Open iCoach.

**No computer at hand?** Open `https://i-coach.vercel.app/app` in Safari, then tap Share and choose
**Add to Home Screen**. It runs full-screen from the home screen with the same app tour. It has no
native extras such as haptics or the Zoom app hand-off.

## What to try on a device

- Sign in as a coach and as an athlete. The tour starts once per account. Try Next, Back, Skip all,
  swiping the card, and replaying it from More.
- Switch to Arabic and check the tour, the tab bar and a few screens in right-to-left.
- Pull the network (flight mode) on launch and while using the app, then turn it back on.
- Coach: Settings → Integrations → Connect Zoom, approve, and check you land back in the app showing
  it as connected. Start a meeting and check that the Zoom app opens.
- Athlete: join a meeting from the calendar; submit a check-in with a progress photo (camera and
  library); log a workout; send your coach a message with the keyboard open.
- Android: use the back button everywhere, including on open dialogs and the More sheet.
- Close the app for a day, reopen it, and check you are still signed in.

## Building locally (optional)

- Android: install Android Studio (JDK 21 included), then `bun install`,
  `bunx cap sync android` and `bunx cap open android`, or `cd android && ./gradlew assembleRelease`.
- iOS needs a Mac with Xcode 26 or later: `bun install`, `bunx cap sync ios`, `bunx cap open ios`.
- Point a build at another deployment (for example a Vercel preview) with
  `ICOACH_APP_URL=https://<preview-url> bunx cap sync`.
- After changing `assets/icon-only.png`, `icon-foreground.png`, `icon-background.png` or the splash
  images, regenerate the native sizes with `npx @capacitor/assets generate`.

## Before the stores

These builds are for testing. For Google Play and the App Store:

- **App ID:** `com.icoach.performance` (in `capacitor.config.ts`, `android/app/build.gradle` and the
  Xcode project). Change it before the first store upload if you want a different one; it can't
  change afterwards.
- **Android signing:** `android/app/test-signing.keystore` is a public test key. Create your own
  upload key (`keytool -genkeypair ...`), keep it out of the repository, sign an `.aab`
  (`./gradlew bundleRelease`) and enrol in Play App Signing. A Play developer account costs $25
  once.
- **iOS signing:** you need an Apple Developer Program membership ($99/year), a distribution
  certificate and an App Store provisioning profile. Then archive in Xcode, or add signing to the
  workflow, and upload to TestFlight.
- **Review:** both stores need a privacy policy URL, and the App Store needs a support URL.
  Apple's guideline 4.2 rejects apps that are only a website. The app's native features count in its
  favour (native session storage, Zoom app hand-off, haptics, back gestures, offline screen,
  in-app browser). Push notifications would make the case stronger and are the natural next feature.
