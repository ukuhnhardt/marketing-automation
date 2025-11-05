declare module 'dotenv-flow' {
  interface ConfigOptions {
    node_env?: string;
    path?: string;
    silent?: boolean;
  }

  function config(opts?: ConfigOptions): void;

  export = { config };
}
