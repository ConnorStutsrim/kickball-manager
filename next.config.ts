import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Turbopack persists compiled dev output to .next/dev/cache/turbopack
    // by default (as of Next.js 16.1) specifically so a restarted dev
    // server can reuse it instead of recompiling from scratch. That's
    // exactly what caused this project's repeated stale-dev-server issue
    // (issue #15): a restart after switching branches or pulling would
    // still read cached output built from the previous branch's files,
    // not a truly clean recompile. Disabling it trades a slightly slower
    // cold start for every restart always compiling from current source.
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;
