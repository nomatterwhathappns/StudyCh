import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");

function readProjectFile(relativePath: string) {
  return readFileSync(resolve(projectRoot, relativePath), "utf8");
}

describe("Vercel deployment adapter", () => {
  it("keeps a server entrypoint and Vercel build contract", () => {
    const packageJson = JSON.parse(readProjectFile("package.json")) as {
      scripts?: Record<string, string>;
    };
    const vercelConfig = JSON.parse(readProjectFile("vercel.json")) as {
      buildCommand?: string;
      functions?: Record<string, { runtime?: string; maxDuration?: number }>;
      rewrites?: Array<{ source: string; destination: string }>;
    };

    expect(readProjectFile("server.ts")).toContain("createApp");
    expect(packageJson.scripts?.["build:vercel"]).toContain("VITE_DEPLOY_TARGET=vercel");
    expect(packageJson.scripts?.["build:vercel"]).toContain("cp -R dist/public public");
    expect(vercelConfig.buildCommand).toBe("pnpm build:vercel");
    expect(vercelConfig.functions?.["server.ts"]?.runtime).toBe("nodejs22.x");
    expect(vercelConfig.functions?.["server.ts"]?.maxDuration).toBe(90);
    expect(vercelConfig.rewrites).toEqual(expect.arrayContaining([
      { source: "/api/:path*", destination: "/server.ts" },
      { source: "/manus-storage/:path*", destination: "/server.ts" },
    ]));
  });

  it("does not put the beta token or upstream API key in deployment config", () => {
    const trackedDeploymentFiles = ["server.ts", "vercel.json", "package.json", "server/_core/index.ts"]
      .map(readProjectFile)
      .join("\n");

    expect(trackedDeploymentFiles).not.toMatch(/STUDYOS_PUBLIC_TOKEN|NINE_ROUTER_API_KEY|sk-[A-Za-z0-9_-]{12,}/);
  });
});
