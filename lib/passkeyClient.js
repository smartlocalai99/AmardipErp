export function browserSupportsPasskeys() {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined"
  );
}

export async function startPasskeyRegistration(options) {
  const { startRegistration } = await import("@simplewebauthn/browser");
  return startRegistration({ optionsJSON: options });
}

export async function startPasskeyAuthentication(options) {
  const { startAuthentication } = await import("@simplewebauthn/browser");
  return startAuthentication({ optionsJSON: options });
}
