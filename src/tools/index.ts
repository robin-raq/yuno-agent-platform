import { makeToolRegistry, type ToolDef } from './registry';
import { remittanceTools } from './remittance';

export type { ToolDef, ToolContext, ToolRegistry } from './registry';
export { makeToolRegistry } from './registry';

/** Every built-in tool the platform ships with. Extend here as new tool families are added. */
export function defaultTools(): ToolDef[] {
  return [...remittanceTools];
}

/** Convenience: a registry populated with the built-in tools. */
export const makeDefaultRegistry = () => makeToolRegistry(defaultTools());
