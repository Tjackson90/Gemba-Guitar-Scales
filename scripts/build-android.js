#!/usr/bin/env node
/**
 * Builds the Android debug APK from the command line.
 *
 * Two things this handles that a plain `cd android && ./gradlew` does not:
 *   1. npm runs scripts through cmd.exe on Windows, where "./gradlew" is not a
 *      valid command - the wrapper has to be picked per platform.
 *   2. Android Gradle Plugin 8.x needs JDK 17+. A machine whose PATH java is
 *      older still builds fine using the JDK bundled with Android Studio.
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ANDROID = path.join(ROOT, "android");
const isWin = process.platform === "win32";

function javaMajor(javaHome) {
  const bin = path.join(javaHome, "bin", isWin ? "java.exe" : "java");
  if (!fs.existsSync(bin)) return null;

  const out = spawnSync(bin, ["-version"], { encoding: "utf8" });
  const text = (out.stderr || "") + (out.stdout || "");
  const m = text.match(/version "(\d+)(?:\.(\d+))?/);
  if (!m) return null;

  // "1.8.0" is Java 8; anything else reports its major directly.
  const major = Number(m[1]);
  return major === 1 ? Number(m[2]) : major;
}

/** Android Studio ships a JetBrains Runtime that is always new enough. */
const STUDIO_JBR = [
  "C:\\Program Files\\Android\\Android Studio\\jbr",
  "C:\\Program Files\\Android\\Android Studio1\\jbr",
  path.join(process.env.LOCALAPPDATA || "", "Programs", "Android Studio", "jbr"),
  "/Applications/Android Studio.app/Contents/jbr/Contents/Home",
  "/opt/android-studio/jbr",
  path.join(process.env.HOME || "", "android-studio", "jbr")
];

function findJdk() {
  if (process.env.JAVA_HOME) {
    const v = javaMajor(process.env.JAVA_HOME);
    if (v && v >= 17) return { home: process.env.JAVA_HOME, version: v, source: "JAVA_HOME" };
  }

  for (const candidate of STUDIO_JBR) {
    if (!candidate || !fs.existsSync(candidate)) continue;
    const v = javaMajor(candidate);
    if (v && v >= 17) return { home: candidate, version: v, source: "Android Studio JBR" };
  }

  return null;
}

/**
 * Windows needs a shell to run .bat and npx shims, but passing an args array
 * together with shell:true is deprecated - so the command is assembled into a
 * single quoted string there, and passed as argv everywhere else.
 */
function run(cmd, args, opts = {}) {
  const res = isWin
    ? spawnSync([quote(cmd), ...args.map(quote)].join(" "), {
        stdio: "inherit", shell: true, cwd: ROOT, ...opts
      })
    : spawnSync(cmd, args, { stdio: "inherit", cwd: ROOT, ...opts });

  if (res.status !== 0) process.exit(res.status === null ? 1 : res.status);
}

function quote(part) {
  return /[\s&|<>^]/.test(part) ? `"${part}"` : part;
}

/* ------------------------------------------------------------------ main */

if (!fs.existsSync(ANDROID)) {
  console.error("No android/ directory. Run: npx cap add android");
  process.exit(1);
}

const jdk = findJdk();
if (!jdk) {
  console.error(
    "\nNo JDK 17+ found.\n" +
    "  Android Gradle Plugin 8.x requires JDK 17 or newer.\n" +
    "  Fix: install Android Studio (it bundles one), or set JAVA_HOME to a JDK 17+.\n" +
    (process.env.JAVA_HOME
      ? `  JAVA_HOME is currently: ${process.env.JAVA_HOME}\n`
      : "  JAVA_HOME is not set.\n")
  );
  process.exit(1);
}

console.log(`Using JDK ${jdk.version} (${jdk.source})\n  ${jdk.home}\n`);

console.log("Copying web assets into the Android project...");
run("npx", ["cap", "sync", "android"]);

const RELEASE = process.argv.includes("--release");
const BUNDLE = process.argv.includes("--bundle");

const task = BUNDLE
  ? (RELEASE ? "bundleRelease" : "bundleDebug")
  : (RELEASE ? "assembleRelease" : "assembleDebug");

// A release build with no keystore would silently produce an unsigned
// artifact, so fail loudly instead.
if (RELEASE && !fs.existsSync(path.join(ROOT, "keystore.properties"))) {
  console.error(
    "\nkeystore.properties not found - a release build would be unsigned." +
    "\nCopy keystore.properties.example and fill it in (see RELEASE.md).\n"
  );
  process.exit(1);
}

console.log(`\nRunning ${task} (first run downloads Gradle, be patient)...`);
// Absolute path: cmd.exe does not reliably resolve a wrapper from cwd.
const wrapper = path.join(ANDROID, isWin ? "gradlew.bat" : "gradlew");
run(wrapper, [task], {
  cwd: ANDROID,
  env: { ...process.env, JAVA_HOME: jdk.home }
});

const variant = RELEASE ? "release" : "debug";
const out = BUNDLE
  ? path.join(ANDROID, "app", "build", "outputs", "bundle", variant, `app-${variant}.aab`)
  : path.join(ANDROID, "app", "build", "outputs", "apk", variant, `app-${variant}.apk`);

if (fs.existsSync(out)) {
  const kb = Math.round(fs.statSync(out).size / 1024);
  console.log(`\n${BUNDLE ? "AAB" : "APK"} ready (${kb} KB):\n  ${out}\n`);

  console.log(BUNDLE
    ? "Upload this .aab to the Play Console.\n"
    : "Install on a connected phone with:\n  adb install -r \"" + out + "\"\n");
} else {
  console.log(`\nBuild finished but nothing was found at:\n  ${out}`);
}
