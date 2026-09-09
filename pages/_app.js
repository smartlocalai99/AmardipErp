import Head from "next/head";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { getPortalScope } from "@/lib/pwaScope";
import SplashScreen from "@/components/SplashScreen";
import "@/styles/globals.css";

// How long the splash stays up at minimum, so a fast load doesn't just
// flash it for 20ms — and how long a route change has to take before the
// splash bothers showing at all, so instant client-side navigations never
// see it flicker in and back out.
const MIN_VISIBLE_MS = 500;
const SHOW_DELAY_MS = 200;

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const [showSplash, setShowSplash] = useState(true);
  const shownAtRef = useRef(Date.now());
  const showTimerRef = useRef(null);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      const scope = getPortalScope(window.location.pathname);
      navigator.serviceWorker.register("/sw.js", { scope }).catch(() => {});
    }
  }, []);

  function hideSplashRespectingMinimum() {
    clearTimeout(showTimerRef.current);
    const elapsed = Date.now() - shownAtRef.current;
    const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);
    setTimeout(() => setShowSplash(false), remaining);
  }

  // Cold-load: the splash is already visible (initial state, matching SSR)
  // the instant the HTML paints — this just decides when to let it go.
  useEffect(() => {
    hideSplashRespectingMinimum();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Page-to-page navigation: only bother showing the splash again if the
  // transition is slow enough for a blank gap to actually appear.
  useEffect(() => {
    function handleStart() {
      showTimerRef.current = setTimeout(() => {
        shownAtRef.current = Date.now();
        setShowSplash(true);
      }, SHOW_DELAY_MS);
    }
    function handleDone() {
      hideSplashRespectingMinimum();
    }
    router.events.on("routeChangeStart", handleStart);
    router.events.on("routeChangeComplete", handleDone);
    router.events.on("routeChangeError", handleDone);
    return () => {
      router.events.off("routeChangeStart", handleStart);
      router.events.off("routeChangeComplete", handleDone);
      router.events.off("routeChangeError", handleDone);
    };
  }, [router]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <SplashScreen visible={showSplash} />
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
        <meta name="application-name" content="Amardip Lifts ERP" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Amardip" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#0a649d" />
        <link key="manifest" rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/adlogo-pwa.png" />
        <link rel="icon" href="/adlogo-pwa.png" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
