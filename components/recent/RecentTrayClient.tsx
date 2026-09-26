"use client";

import { useRouter } from "next/navigation";
import { RecentTray } from "./RecentTray";

/** Client wrapper so the server-rendered homepage can show local recent items. */
export function RecentTrayClient() {
  const router = useRouter();
  return (
    <RecentTray
      onSelectFile={(id) => router.push(`/files?preview=${id}`)}
      onSelectPost={(id) => router.push(`/posts?post=${id}`)}
    />
  );
}
