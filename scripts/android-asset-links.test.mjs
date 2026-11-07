import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The customer Android app is a Trusted Web Activity for the host in
// android-customer-app/twa-manifest.json. Android (and Play Console's Deep
// links check) only verifies that host if public/.well-known/assetlinks.json
// names the same package and the SHA-256 of the certificate users' installs
// are signed with — with Play App Signing that is Google's app signing key,
// not just the local upload key.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const twa = JSON.parse(read("android-customer-app/twa-manifest.json"));
const gradle = read("android-customer-app/app/build.gradle");
const assetLinks = JSON.parse(read("public/.well-known/assetlinks.json"));

// The Android project agrees with itself on package and host.
assert.match(gradle, new RegExp(`applicationId "${twa.packageId.replaceAll(".", "\\.")}"`));
assert.match(gradle, new RegExp(`hostName: '${twa.host.replaceAll(".", "\\.")}'`));
assert.equal(twa.host, "amardip-erp.vercel.app");

// assetlinks.json grants that package full URL handling, with well-formed fingerprints.
assert.ok(Array.isArray(assetLinks) && assetLinks.length > 0, "assetlinks.json must be a non-empty array");
const statement = assetLinks.find((s) => s.target?.namespace === "android_app" && s.target?.package_name === twa.packageId);
assert.ok(statement, `assetlinks.json has no statement for ${twa.packageId}`);
assert.ok(statement.relation.includes("delegate_permission/common.handle_all_urls"));

const fingerprints = statement.target.sha256_cert_fingerprints;
assert.ok(Array.isArray(fingerprints) && fingerprints.length > 0, "at least one SHA-256 fingerprint is required");
for (const fp of fingerprints) {
  assert.match(fp, /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/, `not an upper-case colon-separated SHA-256 fingerprint: ${fp}`);
}
assert.equal(new Set(fingerprints).size, fingerprints.length, "duplicate fingerprint");

// SHA-256 certificates Play Console lists for this app (App signing page). Dropping
// these is what made Play Console report "domain not verified", so keep them listed.
const PLAY_CONSOLE_FINGERPRINTS = [
  "F8:36:F3:2E:30:75:CE:6E:3D:E3:F4:3B:FB:7A:E5:1F:6E:42:F2:EF:9C:8F:7F:6D:2C:95:FC:57:FF:1C:C9:9F",
  "61:B6:92:7A:37:DA:76:2F:5E:0C:3E:F2:9F:C5:7C:B6:53:18:03:44:9E:EE:77:C6:C1:C8:53:FD:F7:9F:BA:71",
  "51:E7:E6:FC:DA:7E:C3:94:6E:4A:21:0D:5F:3E:6E:D7:D1:ED:32:88:01:1F:F6:54:93:6D:C2:48:11:0C:41:AE",
];
for (const fp of PLAY_CONSOLE_FINGERPRINTS) {
  assert.ok(fingerprints.includes(fp), `assetlinks.json is missing Play Console certificate ${fp}`);
}

console.log("android asset links tests passed");
