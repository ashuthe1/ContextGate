import type { JsonObject } from "../../core/src/index.js";

export interface ArgumentValidationResult {
  valid: boolean;
  errors: string[];
  arguments?: JsonObject;
}

export function validateArguments(schema: JsonObject, args: unknown): ArgumentValidationResult {
  if (!isRecord(args)) {
    return {
      valid: false,
      errors: ["arguments must be an object"],
    };
  }

  const errors: string[] = [];
  const required = Array.isArray(schema.required)
    ? schema.required.filter((item): item is string => typeof item === "string")
    : [];
  const properties = isRecord(schema.properties) ? schema.properties : {};

  for (const key of required) {
    if (!(key in args)) {
      errors.push(`missing required argument: ${key}`);
    }
  }

  for (const [key, property] of Object.entries(properties)) {
    if (!(key in args) || !isRecord(property)) {
      continue;
    }

    const expectedType = typeof property.type === "string" ? property.type : undefined;
    if (!expectedType) {
      continue;
    }

    if (!matchesJsonSchemaType(args[key], expectedType)) {
      errors.push(`argument ${key} must be ${expectedType}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    arguments: args as JsonObject,
  };
}

function matchesJsonSchemaType(value: unknown, expectedType: string): boolean {
  switch (expectedType) {
    case "string":
      return typeof value === "string";
    case "number":
    case "integer":
      return typeof value === "number" && Number.isFinite(value);
    case "boolean":
      return typeof value === "boolean";
    case "object":
      return isRecord(value);
    case "array":
      return Array.isArray(value);
    case "null":
      return value === null;
    default:
      return true;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
