import { z } from 'zod';
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import * as express from 'express';
import { Request, Response, NextFunction, Router } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { ParsedQs } from 'qs';

/**
 * Helper schema for query boolean parameters
 * Handles the string representation of booleans in query parameters
 * This explicitly maintains the string type for Express compatibility
 */
export const queryBoolean = z.string()
  .optional()
  .transform(val => val === 'true' || val === '1');

/**
 * Helper schema for query number parameters
 * Handles the string representation of numbers in query parameters
 * This explicitly maintains the string type for Express compatibility
 */
export const queryNumber = z.string()
  .optional()
  .transform(val => val ? Number(val) : undefined);

/**
 * Helper schema for query integer parameters
 * Transforms string to integer and validates it's a valid integer
 */
export const queryInteger = z.string()
  .optional()
  .transform(val => val ? parseInt(val, 10) : undefined);

/**
 * Helper schema for positive number parameters
 * Transforms string to number and validates it's positive
 */
export const queryPositiveNumber = z.string()
  .optional()
  .transform(val => val ? Number(val) : undefined)
  .pipe(z.number().positive().optional());

// Standard error schema
export const ErrorSchema = z.object({
  error: z.string(),
  details: z.record(z.any())
});

// Type definitions for authenticated user
export interface AuthenticatedUser {
  id: string;
  roles: string[];
  scopes: string[];
  [key: string]: any; // For custom claims
}

// Add user property to Request interface
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}


// Configuration options
export interface ApiConfig {
  // Authentication settings
  auth: {
    jwtSecret?: string;
    tokenExpiration?: number;
    defaultErrorMessages: {
      unauthorized: string;
      invalidToken: string;
      insufficientRoles: string;
      insufficientScopes: string;
      insufficientClaims: string;
    };
  };
  // OpenAPI settings
  openapi: {
    bearerFormat: string;
    authDescription: string;
  };
}

// Default configuration
export const defaultApiConfig: ApiConfig = {
  auth: {
    defaultErrorMessages: {
      unauthorized: 'Authentication required',
      invalidToken: 'Invalid or expired token',
      insufficientRoles: 'Insufficient role permissions',
      insufficientScopes: 'Insufficient scope permissions',
      insufficientClaims: 'Access denied: insufficient claim'
    }
  },
  openapi: {
    bearerFormat: 'JWT',
    authDescription: 'Enter JWT token'
  }
};

// Current configuration (can be overridden)
export let apiConfig: ApiConfig = { ...defaultApiConfig };

// Function to set configuration
export function configureApi(config: Partial<ApiConfig>): void {
  apiConfig = {
    ...defaultApiConfig,
    ...config,
    auth: {
      ...defaultApiConfig.auth,
      ...(config.auth || {}),
      defaultErrorMessages: {
        ...defaultApiConfig.auth.defaultErrorMessages,
        ...(config.auth?.defaultErrorMessages || {})
      }
    },
    openapi: {
      ...defaultApiConfig.openapi,
      ...(config.openapi || {})
    }
  };
}

// Registry singleton
export const apiRegistry = new OpenAPIRegistry();

// Register Bearer authentication scheme in OpenAPI
apiRegistry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: apiConfig.openapi.bearerFormat,
  description: apiConfig.openapi.authDescription
});

/**
 * Standardized API response utilities
 */
export namespace ApiResponse {
  export function success<T>(res: Response, data: T, status: number = 200): Response {
    return res.status(status).json(data);
  }
  
  export function created<T>(res: Response, data: T): Response {
    return res.status(201).json(data);
  }

  export function badRequest(
    res: Response,
    message: string = 'Bad Request',
    details?: any
  ): Response {
    return error(res, message, details, 400);
  }

  export function conflict(
    res: Response,
    message: string,
    details?: any
  ): Response {
    return error(res, 'Conflict', { message, ...details }, 409);
  }

  export function error(
    res: Response,
    message: string,
    details?: any,
    status: number = 400
  ): Response {
    return res.status(status).json({
      error: message,
      details: details || {}
    });
  }

  export function unauthorized(
    res: Response,
    message: string = apiConfig.auth.defaultErrorMessages.unauthorized,
    details?: any
  ): Response {
    return error(res, 'Unauthorized', { message, ...details }, 401);
  }

  export function forbidden(
    res: Response,
    message: string = 'Forbidden',
    details?: any
  ): Response {
    return error(res, 'Forbidden', { message, ...details }, 403);
  }

  export function notFound(
    res: Response,
    message: string = 'Not Found',
    details?: any
  ): Response {
    return error(res, 'Not Found', { message, ...details }, 404);
  }

  export function serverError(
    res: Response,
    message: string = 'Internal Server Error',
    details?: any
  ): Response {
    return error(res, 'Server Error', { message, ...details }, 500);
  }
}

/**
 * API Middleware namespace for authentication and authorization
 */
export namespace ApiMiddleware {

  const EMPTY_USER = { id: '', roles: [], scopes: [] };

  export let tokenValidator = (token: string): Promise<AuthenticatedUser> | AuthenticatedUser => {
    return EMPTY_USER;
  }

  /**
   * Authentication middleware
   */
  export function authentication() {
    return async function authMiddleware(req: Request, res: Response, next: NextFunction) {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return ApiResponse.unauthorized(res, apiConfig.auth.defaultErrorMessages.unauthorized, {
          message: 'Missing or invalid authorization token'
        });
      }

      const token = authHeader.split(' ')[1];

      try {
        try {
          const user = await Promise.resolve(tokenValidator(token));
          req.user = user;
          next();
        } catch (error) {
          return ApiResponse.unauthorized(
            res,
            apiConfig.auth.defaultErrorMessages.invalidToken,
            { error: error instanceof Error ? error.message : 'Token validation failed' }
          );
        }
      } catch (error) {
        return ApiResponse.unauthorized(res, apiConfig.auth.defaultErrorMessages.invalidToken);
      }
    };
  }

  /**
   * Role-based authorization middleware
   */
  export function roleAuthorization(roles: string[] | string) {
    return function roleMiddleware(req: Request, res: Response, next: NextFunction) {
      const user = req.user;

      if (!user) {
        return ApiResponse.unauthorized(res);
      }

      const requiredRoles = Array.isArray(roles) ? roles : [roles];
      const hasRole = requiredRoles.some(role => user.roles.includes(role));

      if (!hasRole) {
        return ApiResponse.forbidden(res, apiConfig.auth.defaultErrorMessages.insufficientRoles);
      }

      next();
    };
  }

  /**
   * Scope-based authorization middleware
   */
  export function scopeAuthorization(scopes: string[] | string) {
    return function scopeMiddleware(req: Request, res: Response, next: NextFunction) {
      const user = req.user;

      if (!user) {
        return ApiResponse.unauthorized(res);
      }

      const requiredScopes = Array.isArray(scopes) ? scopes : [scopes];
      const hasScope = requiredScopes.every(scope => user.scopes.includes(scope));

      if (!hasScope) {
        return ApiResponse.forbidden(res, apiConfig.auth.defaultErrorMessages.insufficientScopes);
      }

      next();
    };
  }

  // Add this instead:
  export function useAuth(router: AnyRouter, middleware: express.Handler): AnyRouter {
    // Mark the router as having auth middleware
    (router as any)._hasAuthMiddleware = true;

    // Apply the middleware
    router.use(middleware);

    return router;
  }
}

/**
 * Create authentication middleware with optional role and scope checks
 * @deprecated Use ApiMiddleware namespace instead
 */
export function createAuthMiddleware(options: {
  roles?: string[] | string;
  scopes?: string[] | string;
}) {
  return function authMiddleware(req: Request, res: Response, next: NextFunction) {
    // Chain the middleware
    const authMiddleware = ApiMiddleware.authentication();

    authMiddleware(req, res, (err) => {
      if (err) return next(err);

      // If roles are specified, check them
      if (options.roles) {
        const roleMiddleware = ApiMiddleware.roleAuthorization(options.roles);
        return roleMiddleware(req, res, (err) => {
          if (err) return next(err);

          // If scopes are specified, check them
          if (options.scopes) {
            const scopeMiddleware = ApiMiddleware.scopeAuthorization(options.scopes);
            return scopeMiddleware(req, res, next);
          }

          next();
        });
      } else if (options.scopes) {
        // If only scopes are specified, check them
        const scopeMiddleware = ApiMiddleware.scopeAuthorization(options.scopes);
        return scopeMiddleware(req, res, next);
      }

      next();
    });
  };
}

/**
 * Claim validation options
 */
export interface ClaimValidationOptions {
  userClaimPath: string;       // Path to the claim in the user object (e.g., 'companies', 'subscriptions.active')
  routeParamName: string;      // Route parameter to validate against (e.g., 'companyId')
  validator?: (claimValue: any, paramValue: string) => boolean | Promise<boolean>; // Optional custom validation function
  description?: string;        // Description for OpenAPI documentation
}

/**
 * Claim validation middleware in the ApiMiddleware namespace
 */
export namespace ApiMiddleware {
  /**
   * Claim-based authorization middleware
   */
  export function claimValidation(options: ClaimValidationOptions) {
    return async function claimValidationMiddleware(req: Request, res: Response, next: NextFunction) {
      const user = req.user;

      if (!user) {
        return ApiResponse.unauthorized(res, 'Authentication required for claim validation');
      }

      const paramValue = req.params[options.routeParamName];

      if (!paramValue) {
        return ApiResponse.error(
          res,
          'Bad Request',
          { message: `Parameter '${options.routeParamName}' is required for claim validation` },
          400
        );
      }

      // Get the claim value using the path
      const claimPath = options.userClaimPath.split('.');
      let claimValue = user;

      for (const part of claimPath) {
        if (claimValue === undefined || claimValue === null) {
          break;
        }
        claimValue = claimValue[part];
      }

      // Validate the claim
      let isValid = false;

      if (options.validator) {
        // Use custom validation function if provided
        isValid = await options.validator(claimValue, paramValue);
      } else {
        // Default validation: check if array includes the parameter value
        if (Array.isArray(claimValue)) {
          isValid = claimValue.includes(paramValue);
        } else if (typeof claimValue === 'object' && claimValue !== null) {
          // If it's an object, check if the parameter exists as a key
          isValid = paramValue in claimValue;
        } else {
          // Direct comparison for primitive values
          isValid = claimValue === paramValue;
        }
      }

      if (!isValid) {
        return ApiResponse.forbidden(
          res,
          apiConfig.auth.defaultErrorMessages.insufficientClaims,
          { message: `Access denied: insufficient claim for '${options.routeParamName}'` }
        );
      }

      next();
    };
  }
}

/**
 * Generic claim validation middleware factory
 * @deprecated Use ApiMiddleware.claimValidation instead
 */
export function requireClaim(options: {
  claimPath: string;       // Path to the claim in the user object (e.g., 'companies', 'subscriptions.active')
  paramName: string;       // Route parameter to validate against (e.g., 'companyId')
  validationFn?: (claimValue: any, paramValue: string) => boolean | Promise<boolean>; // Optional custom validation function
}) {
  return ApiMiddleware.claimValidation({
    userClaimPath: options.claimPath,
    routeParamName: options.paramName,
    validator: options.validationFn
  });
}

// Convenience middleware instances
export const authorize = ApiMiddleware.authentication();
export const requireAdmin = ApiMiddleware.roleAuthorization('admin');
export const requireRole = (role: string | string[]) => ApiMiddleware.roleAuthorization(role);
export const requireScope = (scope: string | string[]) => ApiMiddleware.scopeAuthorization(scope);

/**
 * Middleware composition utility
 */
export function composeMiddleware(middlewares: Array<(req: Request, res: Response, next: NextFunction) => void>) {
  return function (req: Request, res: Response, next: NextFunction) {
    function executeMiddleware(index: number) {
      if (index === middlewares.length) {
        return next();
      }

      middlewares[index](req, res, (err) => {
        if (err) return next(err);
        executeMiddleware(index + 1);
      });
    }

    executeMiddleware(0);
  };
}

// Enhanced request/response types
export interface ValidatedRequest<
  TParams extends ParamsDictionary = ParamsDictionary,
  TQuery extends ParsedQs = ParsedQs,
  TBody = any,
  TResponse = any
> extends Request<TParams, TResponse, TBody, TQuery> {
  params: TParams;
  query: TQuery;
  body: TBody;
}

export interface ApiResponse<TResponse = any> extends Response {
  json: <T extends keyof TResponse>(body: TResponse[T]) => this;
  send: <T extends keyof TResponse>(body: TResponse[T]) => this;
}

// Route options interface with improved naming and structure
export interface ApiRouteDefinition<
  TParams extends ParamsDictionary = ParamsDictionary,
  TQuery extends ParsedQs = ParsedQs,
  TBody = any
> {
  method: 'get' | 'post' | 'put' | 'delete' | 'patch';
  path: string;
  // Store the original path for Swagger documentation
  swaggerPath?: string;
  params?: z.ZodType<TParams>;
  query?: z.ZodType<TQuery>;
  body?: z.ZodType<TBody>;
  response: Record<string, z.ZodType<any>>;
  summary?: string;
  description?: string;
  tags?: string[];
  // Enhanced auth options with better structure
  auth?: {
    // Authentication
    requiresAuthentication?: boolean;

    // Authorization
    authorization?: {
      // Role-based access control
      roles?: string[] | string;

      // Scope-based access control
      scopes?: string[] | string;

      // Claim-based access control
      claims?: Array<{
        userClaimPath: string;
        routeParamName: string;
        description?: string;
        validator?: (claimValue: any, paramValue: string) => boolean | Promise<boolean>;
      }>;
    }
  };
  // Support for custom middleware
  middleware?: Array<(req: Request, res: Response, next: NextFunction) => void>;
}

// Route decorator factory with improved naming
export function defineApiRoute<
  TParams extends ParamsDictionary = ParamsDictionary,
  TQuery extends ParsedQs = ParsedQs,
  TBody = any,
  TResponses extends Record<string, any> = Record<string, any>
>(options: ApiRouteDefinition<TParams, TQuery, TBody>) {

  // Register automatic validation error response if not already defined
  if (!options.response['400']) {
    options.response['400'] = ErrorSchema;
  } else {
    // Use swaggerPath if available, otherwise use the regular path for the warning message
    const pathForWarning = options.swaggerPath || options.path;
    console.warn(`Custom 400 error response defined for route ${options.method.toUpperCase()} ${pathForWarning}. This may override automatic validation error responses.`);
  }

  // Normalize auth options for backward compatibility
  normalizeAuthOptions(options);

  // Register with OpenAPI
  registerWithOpenAPI(options);

  // Return a decorator function that takes the handler directly
  return function (
    handler: (req: ValidatedRequest<TParams, TQuery, TBody>, res: ApiResponse<TResponses>, next: NextFunction) => Promise<void> | void
  ) {
    return function (router: AnyRouter) {
      // Create middleware array
      const middlewares: any[] = [];

      // Add auth middleware if specified
      if (options.auth) {
        if (options.auth.requiresAuthentication) {
          // Check if router already has auth middleware
          const hasAuthMiddleware = (router as any)._hasAuthMiddleware;

          if (!hasAuthMiddleware) {
            // Add basic auth middleware
            middlewares.push(ApiMiddleware.authentication());
          }

          // Add authorization middleware if specified
          if (options.auth.authorization) {
            // Add role-based middleware if specified
            if (options.auth.authorization.roles) {
              middlewares.push(ApiMiddleware.roleAuthorization(options.auth.authorization.roles));
            }

            // Add scope-based middleware if specified
            if (options.auth.authorization.scopes) {
              middlewares.push(ApiMiddleware.scopeAuthorization(options.auth.authorization.scopes));
            }

            // Add claim validation middleware if specified
            if (options.auth.authorization.claims && options.auth.authorization.claims.length > 0) {
              for (const claim of options.auth.authorization.claims) {
                middlewares.push(ApiMiddleware.claimValidation({
                  userClaimPath: claim.userClaimPath,
                  routeParamName: claim.routeParamName,
                  validator: claim.validator,
                  description: claim.description
                }));
              }
            }
          }
        }
      }

      // Add custom middleware if specified
      if (options.middleware && options.middleware.length > 0) {
        middlewares.push(...options.middleware);
      }

      // Add the main route handler with validation
      middlewares.push(async (req: Request, res: Response, next: NextFunction) => {
        try {
          // Validate request parameters
          if (options.params) {
            const paramsResult = options.params.safeParse(req.params);
            if (!paramsResult.success) {
              if (process.env.NODE_ENV === 'development') {
                console.error('Parameter validation error:', paramsResult.error.format());
              }
              return ApiResponse.error(
                res,
                'Invalid request parameters',
                paramsResult.error.format(),
                400
              );
            }
            req.params = paramsResult.data as ParamsDictionary;
          }

          // Validate query parameters
          if (options.query) {
            const queryResult = options.query.safeParse(req.query);
            if (!queryResult.success) {
              if (process.env.NODE_ENV === 'development') {
                console.error('Query validation error:', queryResult.error.format());
              }
              return ApiResponse.error(
                res,
                'Invalid query parameters',
                queryResult.error.format(),
                400
              );
            }
            req.query = queryResult.data as ParsedQs;
          }

          // Validate request body
          if (options.body) {
            const bodyResult = options.body.safeParse(req.body);
            if (!bodyResult.success) {
              if (process.env.NODE_ENV === 'development') {
                console.error('Body validation error:', bodyResult.error.format());
              }
              return ApiResponse.error(
                res,
                'Invalid request body',
                bodyResult.error.format(),
                400
              );
            }
            req.body = bodyResult.data;
          }

          // Call the handler with validated request
          await handler(req as ValidatedRequest<TParams, TQuery, TBody>, res as ApiResponse<TResponses>, next);

          // Note: We don't validate responses here as they can be multiple types
        } catch (error) {
          next(error);
        }
      });

      // Apply all middlewares to the route
      router[options.method](options.path, ...middlewares);

      return router;
    };
  };
}

/**
 * Helper function to normalize auth options for backward compatibility
 */
function normalizeAuthOptions<
  TParams extends ParamsDictionary = ParamsDictionary,
  TQuery extends ParsedQs = ParsedQs,
  TBody = any
>(options: ApiRouteDefinition<TParams, TQuery, TBody>) {
  if (!options.auth) return;

  // If any authorization options are specified, ensure requiresAuthentication is true
  if (!options.auth.requiresAuthentication &&
    options.auth.authorization && (Object.keys(options.auth.authorization).length > 0)) {
    options.auth.requiresAuthentication = true;
  }
}

/**
 * Helper function to register with OpenAPI
 */
function registerWithOpenAPI<
  TParams extends ParamsDictionary = ParamsDictionary,
  TQuery extends ParsedQs = ParsedQs,
  TBody = any
>(options: ApiRouteDefinition<TParams, TQuery, TBody>) {
  // Use swaggerPath if available, otherwise use the regular path
  const pathToUse = options.swaggerPath || options.path;
  const openApiPath = pathToUse.replace(/:([^/]+)/g, '{$1}');

  const pathItem: any = {
    summary: options.summary,
    description: options.description,
    tags: options.tags,
    responses: {}
  };

  // Add security requirements based on auth options
  if (options.auth) {
    if (options.auth.requiresAuthentication) {
      // Basic bearer auth
      const securityRequirement: Record<string, string[]> = {
        bearerAuth: []
      };

      // Add scopes if specified (for OAuth2)
      if (options.auth.authorization?.scopes) {
        const scopes = Array.isArray(options.auth.authorization.scopes)
          ? options.auth.authorization.scopes
          : [options.auth.authorization.scopes];

        // If using OAuth2, you would add scopes here
        // securityRequirement['oauth2'] = scopes;
      }

      pathItem.security = [securityRequirement];

      // Add 401 and 403 responses if not already defined
      if (!options.response['401']) {
        pathItem.responses['401'] = {
          description: 'Unauthorized',
          content: {
            'application/json': {
              schema: z.object({
                error: z.string(),
                details: z.record(z.any())
              })
            }
          }
        };
      }

      if (!options.response['403'] && options.auth.authorization && (
        options.auth.authorization.roles ||
        options.auth.authorization.scopes ||
        (options.auth.authorization.claims && options.auth.authorization.claims.length > 0)
      )) {
        pathItem.responses['403'] = {
          description: 'Forbidden',
          content: {
            'application/json': {
              schema: z.object({
                error: z.string(),
                details: z.record(z.any())
              })
            }
          }
        };
      }

      // Add claim validation information to the description
      if (options.auth.authorization?.claims && options.auth.authorization.claims.length > 0) {
        const claimDescriptions = options.auth.authorization.claims.map(claim =>
          claim.description || `Requires claim '${claim.userClaimPath}' to match parameter '${claim.routeParamName}'`
        );

        if (pathItem.description) {
          pathItem.description += '\n\n**Required Claims:**\n' + claimDescriptions.map(desc => `- ${desc}`).join('\n');
        } else {
          pathItem.description = '**Required Claims:**\n' + claimDescriptions.map(desc => `- ${desc}`).join('\n');
        }
      }
    }
  }

  // Add all response types
  Object.entries(options.response).forEach(([statusCode, schema]) => {
    pathItem.responses[statusCode] = {
      description: `Status ${statusCode} response`,
      content: {
        'application/json': {
          schema: schema
        }
      }
    };
  });

  // Add parameters
  const parameters: any[] = [];

  if (options.params) {
    const shape = (options.params as any)._def.shape();
    Object.keys(shape).forEach(paramName => {
      parameters.push({
        name: paramName,
        in: 'path',
        required: true,
        schema: shape[paramName],
      });
    });
  }

  if (options.query) {
    const shape = (options.query as any)._def.shape();
    Object.keys(shape).forEach(paramName => {
      parameters.push({
        name: paramName,
        in: 'query',
        required: false,
        schema: shape[paramName],
      });
    });
  }

  if (parameters.length > 0) {
    pathItem.parameters = parameters;
  }

  // Add request body
  if (options.body) {
    pathItem.requestBody = {
      content: {
        'application/json': {
          schema: options.body,
        },
      },
    };
  }

  // Register with OpenAPI
  apiRegistry.registerPath({
    method: options.method,
    path: openApiPath,
    ...pathItem,
  });
}

// Instead of using the Router type directly, create a more generic type  
export type AnyRouter = {
  get: Function;
  post: Function;
  put: Function;
  delete: Function;
  patch: Function;
  use: Function;
  [key: string]: any;
};

// Type for the handler function
export type ApiHandler<
  TParams extends ParamsDictionary = ParamsDictionary,
  TBody = any,
  TResponse = any,
  TQuery extends ParsedQs = ParsedQs
> = (req: ValidatedRequest<TParams, TQuery, TBody, TResponse>, res: ApiResponse<TResponse>, next: NextFunction) => Promise<void> | void;

// Simplified route creation functions
export function Get<
  TParams extends ParamsDictionary = ParamsDictionary,
  TQuery extends ParsedQs = ParsedQs,
  TResponses extends Record<string, z.ZodType<any>> = Record<string, z.ZodType<any>>
>(
  path: string,
  options: {
    response: TResponses;
    params?: z.ZodType<TParams>;
    query?: z.ZodType<TQuery>;
    summary?: string;
    description?: string;
    tags?: string[];
    auth?: {
      requiresAuthentication?: boolean;
      authorization?: {
        roles?: string[] | string;
        scopes?: string[] | string;
        claims?: Array<{
          userClaimPath: string;
          routeParamName: string;
          description?: string;
          validator?: (claimValue: any, paramValue: string) => boolean | Promise<boolean>;
        }>;
      };
    };
    middleware?: Array<(req: Request, res: Response, next: NextFunction) => void>;
  },
  handler: (req: ValidatedRequest<TParams, TQuery, never>, res: ApiResponse<{
    [K in keyof TResponses]: z.infer<TResponses[K]>
  }>, next: NextFunction) => Promise<any> | Promise<void> | void
) {
  return defineApiRoute<TParams, TQuery, never, {
    [K in keyof TResponses]: z.infer<TResponses[K]>
  }>({
    method: 'get',
    path,
    response: options.response,
    params: options.params,
    query: options.query,
    summary: options.summary,
    description: options.description,
    tags: options.tags,
    auth: options.auth,
    middleware: options.middleware
  })(handler);
}

export function Post<
  TParams extends ParamsDictionary = ParamsDictionary,
  TBody = any,
  TResponses extends Record<string, z.ZodType<any>> = Record<string, z.ZodType<any>>
>(
  path: string,
  options: {
    requestBody?: z.ZodType<TBody>;
    response: TResponses;
    params?: z.ZodType<TParams>;
    query?: z.ZodType<ParsedQs>;
    summary?: string;
    description?: string;
    tags?: string[];
    auth?: {
      requiresAuthentication?: boolean;
      authorization?: {
        roles?: string[] | string;
        scopes?: string[] | string;
        claims?: Array<{
          userClaimPath: string;
          routeParamName: string;
          description?: string;
          validator?: (claimValue: any, paramValue: string) => boolean | Promise<boolean>;
        }>;
      };
    };
    middleware?: Array<(req: Request, res: Response, next: NextFunction) => void>;
  },
  handler: (req: ValidatedRequest<TParams, ParsedQs, TBody>, res: ApiResponse<{
    [K in keyof TResponses]: z.infer<TResponses[K]>
  }>, next: NextFunction) => Promise<any> | Promise<void> | void
) {
  return defineApiRoute<TParams, ParsedQs, TBody, {
    [K in keyof TResponses]: z.infer<TResponses[K]>
  }>({
    method: 'post',
    path,
    params: options.params,
    body: options.requestBody,
    response: options.response,
    summary: options.summary,
    description: options.description,
    tags: options.tags,
    auth: options.auth,
    middleware: options.middleware
  })(handler);
}

export function Put<
  TParams extends ParamsDictionary = ParamsDictionary,
  TBody = any,
  TResponses extends Record<string, z.ZodType<any>> = Record<string, z.ZodType<any>>
>(
  path: string,
  options: {
    requestBody?: z.ZodType<TBody>;
    response: TResponses;
    params?: z.ZodType<TParams>;
    query?: z.ZodType<ParsedQs>;
    summary?: string;
    description?: string;
    tags?: string[];
    auth?: {
      requiresAuthentication?: boolean;
      authorization?: {
        roles?: string[] | string;
        scopes?: string[] | string;
        claims?: Array<{
          userClaimPath: string;
          routeParamName: string;
          description?: string;
          validator?: (claimValue: any, paramValue: string) => boolean | Promise<boolean>;
        }>;
      };
    };
    middleware?: Array<(req: Request, res: Response, next: NextFunction) => void>;
  },
  handler: (req: ValidatedRequest<TParams, ParsedQs, TBody>, res: ApiResponse<{
    [K in keyof TResponses]: z.infer<TResponses[K]>
  }>, next: NextFunction) => Promise<any> | Promise<void> | void
) {
  return defineApiRoute<TParams, ParsedQs, TBody, {
    [K in keyof TResponses]: z.infer<TResponses[K]>
  }>({
    method: 'put',
    path,
    params: options.params,
    body: options.requestBody,
    response: options.response,
    summary: options.summary,
    description: options.description,
    tags: options.tags,
    auth: options.auth,
    middleware: options.middleware
  })(handler);
}

export function Delete<
  TParams extends ParamsDictionary = ParamsDictionary,
  TBody = any,
  TResponses extends Record<string, z.ZodType<any>> = Record<string, z.ZodType<any>>
>(
  path: string,
  options: {
    requestBody?: z.ZodType<TBody>;
    response: TResponses;
    params?: z.ZodType<TParams>;
    query?: z.ZodType<ParsedQs>;
    summary?: string;
    description?: string;
    tags?: string[];
    auth?: {
      requiresAuthentication?: boolean;
      authorization?: {
        roles?: string[] | string;
        scopes?: string[] | string;
        claims?: Array<{
          userClaimPath: string;
          routeParamName: string;
          description?: string;
          validator?: (claimValue: any, paramValue: string) => boolean | Promise<boolean>;
        }>;
      };
    };
    middleware?: Array<(req: Request, res: Response, next: NextFunction) => void>;
  },
  handler: (req: ValidatedRequest<TParams, ParsedQs, TBody>, res: ApiResponse<{
    [K in keyof TResponses]: z.infer<TResponses[K]>
  }>, next: NextFunction) => Promise<any> | Promise<void> | void
) {
  return defineApiRoute<TParams, ParsedQs, TBody, {
    [K in keyof TResponses]: z.infer<TResponses[K]>
  }>({
    method: 'delete',
    path,
    params: options.params,
    body: options.requestBody,
    response: options.response,
    summary: options.summary,
    description: options.description,
    tags: options.tags,
    auth: options.auth,
    middleware: options.middleware
  })(handler);
}

export function Patch<
  TParams extends ParamsDictionary = ParamsDictionary,
  TBody = any,
  TResponses extends Record<string, z.ZodType<any>> = Record<string, z.ZodType<any>>
>(
  path: string,
  options: {
    requestBody?: z.ZodType<TBody>;
    response: TResponses;
    params?: z.ZodType<TParams>;
    query?: z.ZodType<ParsedQs>;
    summary?: string;
    description?: string;
    tags?: string[];
    auth?: {
      requiresAuthentication?: boolean;
      authorization?: {
        roles?: string[] | string;
        scopes?: string[] | string;
        claims?: Array<{
          userClaimPath: string;
          routeParamName: string;
          description?: string;
          validator?: (claimValue: any, paramValue: string) => boolean | Promise<boolean>;
        }>;
      };
    };
    middleware?: Array<(req: Request, res: Response, next: NextFunction) => void>;
  },
  handler: (req: ValidatedRequest<TParams, ParsedQs, TBody>, res: ApiResponse<{
    [K in keyof TResponses]: z.infer<TResponses[K]>
  }>, next: NextFunction) => Promise<any> | Promise<void> | void
) {
  return defineApiRoute<TParams, ParsedQs, TBody, {
    [K in keyof TResponses]: z.infer<TResponses[K]>
  }>({
    method: 'patch',
    path,
    params: options.params,
    body: options.requestBody,
    response: options.response,
    summary: options.summary,
    description: options.description,
    tags: options.tags,
    auth: options.auth,
    middleware: options.middleware
  })(handler);
}



// // Register OAuth2 security scheme
// apiRegistry.registerComponent('securitySchemes', 'oauth2', {
//   type: 'oauth2',
//   flows: {
//     implicit: {
//       authorizationUrl: 'https://example.com/oauth/authorize',
//       scopes: {
//         'read:users': 'Read user information',
//         'write:users': 'Create or modify users',
//         'admin': 'Full administrative access'
//       }
//     }
//   }
// });

