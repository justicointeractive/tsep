import { assert } from './assert';
import { TsepHookCallback, TsepHookCallbackContext } from './types';

export default class Hooks {
  private hooks = new Map<string, TsepHookCallback[]>();

  /**
   * Adds the given callback to the list of callbacks for the given hook.
   *
   * The callback will be invoked when the hook it is registered for is run.
   *
   * One callback function can be registered to multiple hooks and the same hook multiple times.
   *
   */
  add(
    nameOrObject: string | Record<string, TsepHookCallback>,
    callback: TsepHookCallback | boolean,
    first?: boolean | null
  ) {
    if (typeof nameOrObject != 'string') {
      // Multiple hook callbacks, keyed by name
      for (const name in nameOrObject) {
        assert(typeof callback === 'boolean');
        this.add(name, nameOrObject[name], callback);
      }
    } else {
      assert(typeof callback !== 'boolean');

      const hookCallbacks = this.get(nameOrObject);

      this.hooks.set(nameOrObject, hookCallbacks);

      if (callback) {
        hookCallbacks[first ? 'unshift' : 'push'](callback);
      }
    }
  }

  /**
   * Runs a hook invoking all registered callbacks with the given environment variables.
   *
   * Callbacks will be invoked synchronously and in the order in which they were registered.
   *
   */
  run(name: string, env: TsepHookCallbackContext) {
    this.get(name).forEach(function (callback) {
      callback.call(env.context, env);
    });
  }

  get(name: string) {
    return this.hooks.get(name) ?? [];
  }
}
