export type HttpMethod = "GET" | "POST";
export type HttpRequestEncoding = "none" | "query" | "body";

export interface HttpSchema<TOutput = unknown> {
  parse(input: unknown): TOutput;
  safeParse(input: unknown):
    | { success: true; data: TOutput }
    | { success: false; error: { message: string } };
}

export interface HttpEndpointContract<
  TRequestSchema extends HttpSchema | undefined,
  TResponseSchema extends HttpSchema,
> {
  method: HttpMethod;
  path: string;
  requestEncoding: HttpRequestEncoding;
  pathParams?: readonly string[];
  requestSchema?: TRequestSchema;
  responseSchema: TResponseSchema;
}

export function defineHttpEndpointContract<
  TRequestSchema extends HttpSchema | undefined,
  TResponseSchema extends HttpSchema,
>(
  contract: HttpEndpointContract<TRequestSchema, TResponseSchema>,
): HttpEndpointContract<TRequestSchema, TResponseSchema> {
  return contract;
}

type InferHttpSchema<TSchema> = TSchema extends HttpSchema<infer TOutput>
  ? TOutput
  : never;

export type HttpEndpointRequest<
  TContract extends HttpEndpointContract<HttpSchema | undefined, HttpSchema>,
> =
  NonNullable<TContract["requestSchema"]> extends HttpSchema
    ? InferHttpSchema<NonNullable<TContract["requestSchema"]>>
    : undefined;

export type HttpEndpointResponse<
  TContract extends HttpEndpointContract<HttpSchema | undefined, HttpSchema>,
> = InferHttpSchema<TContract["responseSchema"]>;
