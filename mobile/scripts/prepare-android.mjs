// Builds the Bilas Android project: copies the web app into www/, creates or syncs the
// Capacitor Android project, then applies icons, splash, fullscreen, version and release signing.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = path.resolve(root, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'capacitor.config.json'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const [major, minor, patch] = pkg.version.split('.').map(Number);
const versionCode = major * 1000000 + minor * 1000 + patch;
const cli = path.join(root, 'node_modules/@capacitor/cli/bin/capacitor');

function run(args) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, CAPACITOR_TELEMETRY_DISABLED: '1' }
  });
  if (result.status !== 0) {
    throw new Error('Capacitor failed: ' + args.join(' '));
  }
}

function edit(file, transform) {
  const before = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, transform(before));
}

function walk(folder, visit) {
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) {
      walk(full, visit);
    } else {
      visit(full);
    }
  }
}

// 1. The app itself: the same single-page build that GitHub Pages serves.
const www = path.join(root, 'www');
fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(www, { recursive: true });
for (const file of ['index.html', 'manifest.webmanifest', 'sw.js']) {
  fs.copyFileSync(path.join(site, file), path.join(www, file));
}
for (const folder of ['css', 'js', 'icons', 'assets']) {
  fs.cpSync(path.join(site, folder), path.join(www, folder), { recursive: true });
}

// 2. Native project.
if (!fs.existsSync(path.join(root, 'android'))) {
  run(['add', 'android']);
}
run(['sync', 'android']);

const android = path.join(root, 'android');
const main = path.join(android, 'app/src/main');
const res = path.join(main, 'res');

edit(path.join(main, 'AndroidManifest.xml'), manifest =>
  manifest.replace('android:allowBackup="true"', 'android:allowBackup="false"'));

// 3. Icons (adaptive washer porthole on slate) and splash.
fs.cpSync(path.join(root, 'resources/android'), res, { recursive: true });
const adaptive = '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@color/ic_launcher_background"/>\n    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n</adaptive-icon>\n';
fs.mkdirSync(path.join(res, 'mipmap-anydpi-v26'), { recursive: true });
fs.writeFileSync(path.join(res, 'mipmap-anydpi-v26/ic_launcher.xml'), adaptive);
fs.writeFileSync(path.join(res, 'mipmap-anydpi-v26/ic_launcher_round.xml'), adaptive);
fs.writeFileSync(path.join(res, 'values/ic_launcher_background.xml'), '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#151D20</color>\n</resources>\n');
walk(res, file => {
  if (path.basename(file) === 'splash.png') {
    fs.rmSync(file);
  }
});
fs.mkdirSync(path.join(res, 'drawable'), { recursive: true });
fs.writeFileSync(path.join(res, 'drawable/splash.xml'), '<?xml version="1.0" encoding="utf-8"?>\n<layer-list xmlns:android="http://schemas.android.com/apk/res/android">\n    <item android:drawable="@color/ic_launcher_background"/>\n    <item android:gravity="center" android:width="140dp" android:height="140dp" android:drawable="@drawable/splash_logo"/>\n</layer-list>\n');

// 4. Immersive fullscreen: hide the status and navigation bars while playing.
const javaDir = path.join(main, 'java', ...config.appId.split('.'));
fs.mkdirSync(javaDir, { recursive: true });
const activity = fs.readFileSync(path.join(root, 'native/MainActivity.java'), 'utf8')
  .replace(/^package [^;]+;/m, 'package ' + config.appId + ';');
fs.writeFileSync(path.join(javaDir, 'MainActivity.java'), activity);

// 5. Version and release signing (keystore path/password come from the environment, never the repo).
edit(path.join(android, 'app/build.gradle'), gradle => {
  let result = gradle
    .replace(/versionCode \d+/, 'versionCode ' + versionCode)
    .replace(/versionName "[^"]*"/, 'versionName "' + pkg.version + '"');
  if (!result.includes('bilasRelease')) {
    result = result.replace(/android \{/, `android {
    signingConfigs {
        bilasRelease {
            if (System.getenv("BILAS_ANDROID_KEYSTORE_PATH")) {
                storeFile file(System.getenv("BILAS_ANDROID_KEYSTORE_PATH"))
                storePassword System.getenv("BILAS_ANDROID_SIGNING_PASSWORD")
                keyAlias "bilas"
                keyPassword System.getenv("BILAS_ANDROID_SIGNING_PASSWORD")
                storeType "pkcs12"
            }
        }
    }`);
    result = result.replace(/release \{/, 'release {\n            if (System.getenv("BILAS_ANDROID_KEYSTORE_PATH")) signingConfig signingConfigs.bilasRelease');
  }
  return result;
});
console.log(`Android project ready: ${config.appName} ${pkg.version} (${versionCode}).`);
