import { TsepEngine } from './tsep';
import { TsepPlugin } from './types';

export default class Plugins {
  private registered = new Map<string, TsepPlugin>();

  constructor(private tsep: TsepEngine) {}

  /**
   * Adds the given plugin(s) to the registry
   */
  register(...plugins: TsepPlugin[]) {
    plugins.forEach((plugin) => {
      if (typeof plugin !== 'object' || !plugin.name || !plugin.init) {
        throw new Error('Invalid Tsep plugin format');
      }
      if (this.registered.has(plugin.name)) {
        // already registered. Ignore.
        return;
      }
      plugin.init(this.tsep);
      this.registered.set(plugin.name, plugin);
    });
  }
}
