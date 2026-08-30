import stripAnsi from "strip-ansi";

export interface DiagnosticSignal {
  severity: "info" | "warning" | "critical";
  code: string;
  title: string;
  evidence: string;
  suggestion: string;
}

const rules: Array<{
  pattern: RegExp;
  signal: Omit<DiagnosticSignal, "evidence">;
}> = [
  {
    pattern: /OutOfMemoryError|Java heap space|GC overhead limit exceeded/i,
    signal: {
      severity: "critical",
      code: "out-of-memory",
      title: "Java ran out of memory",
      suggestion: "Review RAM allocation, mod memory usage, and the activity immediately before the crash."
    }
  },
  {
    pattern: /Mixin.*(?:failed|error)|MixinApplyError|InvalidMixinException/i,
    signal: {
      severity: "critical",
      code: "mixin-failure",
      title: "A mod mixin failed",
      suggestion: "Identify the mod named near this line and verify its Minecraft, loader, and dependency versions."
    }
  },
  {
    pattern: /Missing.*(?:mod|dependency)|requires.+(?:version|mod)|ModResolutionException/i,
    signal: {
      severity: "critical",
      code: "mod-dependency",
      title: "A mod dependency is missing or incompatible",
      suggestion: "Check the named mod's required dependencies and version constraints."
    }
  },
  {
    pattern: /Can't keep up!|Is the server overloaded/i,
    signal: {
      severity: "warning",
      code: "tick-lag",
      title: "The server is falling behind",
      suggestion: "Correlate these timestamps with player activity, chunk generation, entities, and memory pressure."
    }
  },
  {
    pattern: /Exception in server tick loop|crash report saved to/i,
    signal: {
      severity: "critical",
      code: "server-crash",
      title: "The server tick loop crashed",
      suggestion: "Inspect the first caused-by chain and the mod identifiers preceding the crash."
    }
  },
  {
    pattern: /failed to verify username|authentication servers are down/i,
    signal: {
      severity: "warning",
      code: "authentication",
      title: "Minecraft authentication failed",
      suggestion: "Check Mojang/Microsoft service status and online-mode configuration."
    }
  }
];

export function tailLog(content: string, lines: number): string {
  return stripAnsi(content).replace(/\r/g, "").split("\n").slice(-lines).join("\n");
}

export function diagnoseLog(content: string): DiagnosticSignal[] {
  const clean = stripAnsi(content).replace(/\r/g, "");
  const lines = clean.split("\n");
  const results: DiagnosticSignal[] = [];
  for (const { pattern, signal } of rules) {
    const index = lines.findIndex((line) => pattern.test(line));
    if (index === -1) continue;
    results.push({
      ...signal,
      evidence: lines[index]?.trim().slice(0, 500) || "Pattern detected in server log."
    });
  }
  return results;
}
