import type { TestProject } from "vitest/node";
import { startDaemon, type DaemonInfo } from "../support/daemon";

declare module "vitest" {
  export interface ProvidedContext {
    daemon: DaemonInfo;
  }
}

// One daemon for the whole run. Tests create their own torrents and look them
// up by hash, so they never depend on each other's state.
export default async function setup(project: TestProject) {
  const daemon = await startDaemon();
  const { stop, ...info } = daemon;
  project.provide("daemon", info);
  return stop;
}
