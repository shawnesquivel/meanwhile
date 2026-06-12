/**
 * Minimal `vscode` module stub so the service layer (auth/portfolio/metrics/
 * loopback) can run headless in plain Node for integration tests. Only the
 * APIs those modules actually touch are implemented.
 */

export const openedUrls: string[] = [];

export const env = {
  appName: "harness",
  openExternal: async (uri: { toString(): string }) => {
    openedUrls.push(uri.toString());
    return true;
  },
};

export const Uri = {
  parse: (s: string) => ({ toString: () => s }),
};

export const extensions = {
  getExtension: (_id: string) => ({ packageJSON: { version: "0.0.0-test" } }),
};

/** In-memory SecretStorage lookalike. */
export class MemorySecrets {
  private m = new Map<string, string>();
  async get(k: string): Promise<string | undefined> {
    return this.m.get(k);
  }
  async store(k: string, v: string): Promise<void> {
    this.m.set(k, v);
  }
  async delete(k: string): Promise<void> {
    this.m.delete(k);
  }
}

export const workspace = {
  getConfiguration: () => ({ get: (_k: string) => undefined }),
};

export const window = {
  showInformationMessage: (..._a: unknown[]) => undefined,
  showWarningMessage: (..._a: unknown[]) => undefined,
};
