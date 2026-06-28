export type DiToken<T = unknown> = symbol & { readonly __type?: T };

export function createDiToken<T>(name: string): DiToken<T> {
  return Symbol.for(name);
}
