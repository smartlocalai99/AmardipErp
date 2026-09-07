import { TwaManifest, TwaGenerator, JdkHelper, KeyTool, Config, ConsoleLog } from "@bubblewrap/core";
import { resolve } from "node:path";
import { writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const targetDirectory = resolve(process.cwd());

// Built directly rather than fetched from the live manifest URL, so this
// doesn't depend on the Vercel deploy having landed yet. Keep these in sync
// with public/manifest-customer.webmanifest in the main repo.
const twaManifest = new TwaManifest({
  packageId: "com.amardipelevators.customer",
  host: "amardip-erp.vercel.app",
  name: "Amardip Elevators",
  launcherName: "Amardip",
  display: "standalone",
  orientation: "portrait",
  themeColor: "#0a649d",
  navigationColor: "#0a649d",
  backgroundColor: "#0a649d",
  enableNotifications: true,
  startUrl: "/Customerlogin",
  iconUrl: "https://amardip-erp.vercel.app/adlogo-pwa-512.png",
  maskableIconUrl: "https://amardip-erp.vercel.app/adlogo-pwa-512.png",
  splashScreenFadeOutDuration: 300,
  signingKey: {
    path: resolve(targetDirectory, "android-keystore.jks"),
    alias: "amardip-customer",
  },
  appVersionCode: 1,
  appVersion: "1.0.0",
  shortcuts: [],
  webManifestUrl: "https://amardip-erp.vercel.app/manifest-customer.webmanifest",
  fallbackType: "customtabs",
});

const err = twaManifest.validate();
if (err) {
  console.error("Invalid TWA manifest:", err);
  process.exit(1);
}

const config = new Config(
  "/Users/vardhanreddy/.bubblewrap/jdk/jdk-17.0.11+9",
  "/Users/vardhanreddy/.bubblewrap/android_sdk"
);

const manifestFile = resolve(targetDirectory, "twa-manifest.json");
await twaManifest.saveToFile(manifestFile);

const generator = new TwaGenerator();
const log = new ConsoleLog("generate");
try {
  await generator.createTwaProject(targetDirectory, twaManifest, log, (current, total) => {
    process.stdout.write(`\rGenerating project... ${Math.round((current / total) * 100)}%`);
  });
  console.log("\nProject generated.");
} catch (e) {
  // createTwaProject's very last step downloads webManifestUrl to bundle a copy
  // into res/raw — everything else (templates, java sources, icons) is already
  // written by this point. The production manifest isn't deployed yet, so write
  // that last file ourselves from the local source of truth instead of failing
  // the whole generation.
  if (!String(e.message).includes("Web Manifest")) throw e;
  console.warn("\nCould not fetch the live manifest yet — writing it from the local source file instead.");
  const localManifest = JSON.parse(
    await readFile(resolve(targetDirectory, "..", "public", "manifest-customer.webmanifest"), "utf8")
  );
  localManifest.start_url = twaManifest.startUrl;
  const rawResDir = resolve(targetDirectory, "app/src/main/res/raw");
  await import("node:fs/promises").then((m) => m.mkdir(rawResDir, { recursive: true }));
  await writeFile(resolve(rawResDir, "web_app_manifest.json"), JSON.stringify(localManifest));
}

// manifest-checksum.txt lets `bubblewrap build` skip its "manifest changed, update project?"
// interactive prompt on first build.
const manifestContents = await readFile(manifestFile);
const sum = createHash("sha1").update(manifestContents).digest("hex");
await writeFile(resolve(targetDirectory, "manifest-checksum.txt"), sum);

// Signing key — generated non-interactively. Passwords come from env so they're
// never hardcoded in this file or committed anywhere.
const keystorePassword = process.env.BUBBLEWRAP_KEYSTORE_PASSWORD;
const keyPassword = process.env.BUBBLEWRAP_KEY_PASSWORD;
if (!keystorePassword || !keyPassword) {
  console.error("Set BUBBLEWRAP_KEYSTORE_PASSWORD and BUBBLEWRAP_KEY_PASSWORD before running.");
  process.exit(1);
}

const jdkHelper = new JdkHelper(process, config);
const keyTool = new KeyTool(jdkHelper, log);
await keyTool.createSigningKey({
  path: twaManifest.signingKey.path,
  alias: twaManifest.signingKey.alias,
  password: keystorePassword,
  keypassword: keyPassword,
  fullName: "Amardip Elevators",
  organizationalUnit: "Amardip Elevators",
  organization: "Amardip Elevators",
  country: "IN",
});
console.log("Signing key created at", twaManifest.signingKey.path);

const keyInfo = await keyTool.keyInfo({
  path: twaManifest.signingKey.path,
  alias: twaManifest.signingKey.alias,
  password: keystorePassword,
  keypassword: keyPassword,
});
console.log("Fingerprints:", JSON.stringify(Object.fromEntries(keyInfo.fingerprints), null, 2));
