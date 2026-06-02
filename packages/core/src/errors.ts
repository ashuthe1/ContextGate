export class ContextGateError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "ContextGateError";
  }
}

export class ConfigError extends ContextGateError {
  constructor(message: string) {
    super(message, "CONFIG_ERROR");
    this.name = "ConfigError";
  }
}

export class PolicyError extends ContextGateError {
  constructor(message: string) {
    super(message, "POLICY_ERROR");
    this.name = "PolicyError";
  }
}

export class CatalogError extends ContextGateError {
  constructor(message: string) {
    super(message, "CATALOG_ERROR");
    this.name = "CatalogError";
  }
}
