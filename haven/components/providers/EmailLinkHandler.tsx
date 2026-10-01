"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiSend, errorMessage } from "@/lib/client/api";
import { useViewer } from "@/lib/client/hooks";
import type { Viewer } from "@/lib/types";
import { useToast } from "./ToastProvider";

/**
 * Finishes email sign-in when someone taps the link in Supabase's email.
 * Supabase sends them back with the result in the URL fragment
 * (#access_token=… or #error=…), on /auth/callback or, if that path isn't in
 * the project's redirect list, on the site root. Runs once on any page.
 */
export function EmailLinkHandler() {
  const router = useRouter();
  const toast = useToast();
  const { mutate } = useViewer();
  const done = useRef(false);

  useEffect(() => {
    if (done.current || typeof window === "undefined") return;
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const token = hash.get("access_token");
    const err = hash.get("error_description") ?? hash.get("error");
    if (!token && !err) return;
    done.current = true;
    // Drop the token from the address bar and history right away.
    window.history.replaceState(null, "", window.location.pathname === "/auth/callback" ? "/profile" : window.location.pathname);
    if (!token) {
      toast(/expired/i.test(err ?? "") ? "That sign-in link expired. Request a new one." : "That sign-in link didn't work. Request a new one.", "error");
      router.replace("/profile");
      return;
    }
    apiSend<{ viewer: Viewer }>("/api/auth/email/link", "POST", { accessToken: token })
      .then(async (r) => {
        await mutate({ viewer: r.viewer }, { revalidate: false });
        toast(`Signed in as ${r.viewer.email}`, "success");
        router.replace("/profile");
      })
      .catch((e) => {
        toast(errorMessage(e), "error");
        router.replace("/profile");
      });
  }, [mutate, router, toast]);

  return null;
}
