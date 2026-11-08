// Builds the Bilas iOS project: copies the web app into www/, creates or syncs the Capacitor iOS
// project, then applies the icon, splash, full-screen status bar and version. Signing is left to Xcode / the sideloader.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = path.resolve(root, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
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

// 1. The app itself: the same files GitHub Pages serves.
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
if (!fs.existsSync(path.join(root, 'ios'))) {
  run(['add', 'ios']);
}
run(['sync', 'ios']);

const app = path.join(root, 'ios/App/App');

// 3. Icon and splash.
const iconSet = path.join(app, 'Assets.xcassets/AppIcon.appiconset');
for (const name of fs.readdirSync(iconSet).filter(n => n.endsWith('.png'))) {
  fs.copyFileSync(path.join(root, 'resources/ios/AppIcon-1024.png'), path.join(iconSet, name));
}
const splashSet = path.join(app, 'Assets.xcassets/Splash.imageset');
if (fs.existsSync(splashSet)) {
  for (const name of fs.readdirSync(splashSet).filter(n => n.endsWith('.png'))) {
    fs.copyFileSync(path.join(root, 'resources/ios/splash-2732.png'), path.join(splashSet, name));
  }
}

// 4. Full screen: hide the status bar while the laundromat is open.
const plistPath = path.join(app, 'Info.plist');
let plist = fs.readFileSync(plistPath, 'utf8');
if (!plist.includes('UIStatusBarHidden')) {
  plist = plist.replace(/<dict>/, '<dict>\n\t<key>UIStatusBarHidden</key>\n\t<true/>\n\t<key>UIViewControllerBasedStatusBarAppearance</key>\n\t<false/>');
}
fs.writeFileSync(plistPath, plist);

// 5. Version from package.json.
const pbx = path.join(root, 'ios/App/App.xcodeproj/project.pbxproj');
const [major, minor, patch] = pkg.version.split('.').map(Number);
fs.writeFileSync(pbx, fs.readFileSync(pbx, 'utf8')
  .replace(/MARKETING_VERSION = [^;]+;/g, 'MARKETING_VERSION = ' + pkg.version + ';')
  .replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, 'CURRENT_PROJECT_VERSION = ' + (major * 1000000 + minor * 1000 + patch) + ';'));
console.log('iOS project ready: Bilas ' + pkg.version);
