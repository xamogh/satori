export type JsonPrimitive = string | number | boolean | null
export type Json = JsonPrimitive | JsonObject | JsonArray
export type JsonObject = { readonly [key: string]: Json }
export type JsonArray = ReadonlyArray<Json>

