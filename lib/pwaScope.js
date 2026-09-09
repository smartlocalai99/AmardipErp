// Every portal (customer, technician, store, admin) lives on one origin,
// but each needs to be an independently installable PWA on Android — Chrome
// tracks installed web apps per (scope, manifest id), so a single service
// worker registered at the root scope "/" made every portal's manifest look
// like it was competing to own the same one app, and Android's install/
// WebAPK system isn't built to hand out four separate installs in that
// situation (unlike iOS Safari's "Add to Home Screen", which just bookmarks
// a page regardless of manifest correctness).
//
// The fix: register the same sw.js file under each portal's own narrower
// scope, matching that portal's manifest scope exactly. Same script, same
// origin, but four independent service worker registrations — which is
// what actually gives Android four separate, non-colliding app identities.
export function getPortalScope(pathname) {
  const path = String(pathname || "");
  if (path.startsWith("/Customer")) return "/Customer";
  if (path.startsWith("/Technician")) return "/Technician";
  if (path.startsWith("/Store")) return "/Store";
  return "/";
}
