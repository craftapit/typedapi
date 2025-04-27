# TypedAPI: Type-Safe API Development Framework

## Overview

TypedAPI is a comprehensive framework for building type-safe, validated, and well-documented APIs in Node.js with Express. It combines the power of TypeScript, Zod validation, and OpenAPI documentation to create a robust development experience.

## Key Features

- **Type Safety**: End-to-end type safety from route definition to request/response handling
- **Request Validation**: Automatic validation of request parameters, query strings, and bodies
- **Response Validation**: Ensure your API responses match their documented structure
- **OpenAPI Documentation**: Automatically generate OpenAPI documentation from your route definitions
- **Authentication & Authorization**: Flexible, declarative auth system with multiple strategies
- **Claim-Based Access Control**: Fine-grained access control based on user claims
- **Middleware Support**: Seamless integration with Express middleware

## Why TypedAPI?

### Problem: The Express Gap

Express is lightweight and flexible, but this comes with tradeoffs:

1. **No Type Safety**: Express doesn't provide type safety between route definitions and handlers
2. **Manual Validation**: You need to manually validate request data
3. **Documentation Drift**: API documentation often becomes outdated as code changes
4. **Repetitive Auth Logic**: Authentication and authorization code is frequently duplicated
5. **Error-Prone**: Easy to make mistakes in parameter handling or response formatting

### Solution: TypedAPI

TypedAPI addresses these challenges by:

1. **Enforcing Type Contracts**: Route parameters, query strings, request bodies, and responses are all typed
2. **Automating Validation**: Uses Zod to validate all incoming data against your schemas
3. **Self-Documenting Code**: OpenAPI documentation is generated directly from your code
4. **Declarative Auth**: Define authentication and authorization requirements directly in route definitions
5. **Reducing Boilerplate**: Standardized patterns for common API tasks

## Use Cases

### Basic Route Definition

```typescript
// Define a route with typed parameters, body, and response
const createUserRoute = Post('/users', {
  requestBody: z.object({
    name: z.string(),
    email: z.string().email(),
    role: z.enum(['user', 'admin']).optional()
  }),
  response: {
    '201': z.object({ id: z.string(), name: z.string(), email: z.string() }),
    // Note: 400 error responses are automatically added for validation errors
  },
  summary: 'Create a new user',
  tags: ['Users']
}, async (req, res) => {
  // Fully typed request body
  const { name, email, role } = req.body;
  
  // Create user logic...
  const user = { id: 'new-id', name, email };
  
  // Typed response
  return res.status(201).json(user);
});
```

> **Note:** TypedAPI automatically adds a 400 error response for validation failures, even if not explicitly defined in the `response` object.

// Apply to router
createUserRoute(router);
```

### Authentication and Authorization

```typescript
// Route requiring authentication
const getUserProfileRoute = Get('/users/:userId/profile', {
  params: z.object({ userId: z.string() }),
  response: {
    '200': z.object({ id: z.string(), name: z.string(), email: z.string() })
  },
  auth: {
    // Requires authentication
    requiresAuthentication: true
  }
}, async (req, res) => {
  // User is guaranteed to be authenticated
  const { userId } = req.params;
  
  // Get user profile logic...
  
  return res.status(200).json(userProfile);
});

// Route requiring specific role
const deleteUserRoute = Delete('/users/:userId', {
  params: z.object({ userId: z.string() }),
  response: {
    '200': z.object({ success: z.boolean() })
  },
  auth: {
    authorization: {
      // Requires admin role
      roles: 'admin'
    }
  }
}, async (req, res) => {
  // User is guaranteed to be authenticated and have admin role
  const { userId } = req.params;
  
  // Delete user logic...
  
  return res.status(200).json({ success: true });
});
```

### Claim-Based Authorization

```typescript
// Route requiring ownership of a resource
const updateCompanyRoute = Put('/companies/:companyId', {
  params: z.object({ companyId: z.string() }),
  requestBody: z.object({ name: z.string(), address: z.string() }),
  response: {
    '200': z.object({ id: z.string(), name: z.string(), address: z.string() })
  },
  auth: {
    authorization: {
      // User must own this company
      claims: [
        {
          userClaimPath: 'companies',
          routeParamName: 'companyId',
          description: 'User must have access to the specified company'
        }
      ]
    }
  }
}, async (req, res) => {
  // User is guaranteed to have access to this company
  const { companyId } = req.params;
  const { name, address } = req.body;
  
  // Update company logic...
  
  return res.status(200).json({ id: companyId, name, address });
});
```

### Custom Validation Logic

```typescript
// Route with custom claim validation
const approveDocumentRoute = Post('/projects/:projectId/documents/:documentId/approve', {
  params: z.object({ projectId: z.string(), documentId: z.string() }),
  response: {
    '200': z.object({ success: z.boolean() })
  },
  auth: {
    authorization: {
      claims: [
        {
          userClaimPath: 'projectRoles',
          routeParamName: 'projectId',
          description: 'User must be a project manager or admin',
          validator: (projectRoles, projectId) => {
            if (!projectRoles || typeof projectRoles !== 'object') return false;
            const role = projectRoles[projectId];
            return role === 'manager' || role === 'admin';
          }
        }
      ]
    }
  }
}, async (req, res) => {
  // User is guaranteed to be a manager or admin for this project
  const { projectId, documentId } = req.params;
  
  // Approve document logic...
  
  return res.status(200).json({ success: true });
});
```

### Router-Level Authentication

```typescript
// Create a router with global authentication
const apiRouter = Router();
ApiMiddleware.useAuth(apiRouter, ApiMiddleware.authentication());

// All routes added to this router will require authentication
// but won't need to specify auth: { requiresAuthentication: true } individually
const listProjectsRoute = Get('/projects', {
  response: {
    '200': z.array(z.object({ id: z.string(), name: z.string() }))
  }
}, async (req, res) => {
  // User is guaranteed to be authenticated
  const user = req.user;
  
  // List projects logic...
  
  return res.status(200).json(projects);
});

listProjectsRoute(apiRouter);
```

### Composition with Express Middleware

```typescript
// Using custom middleware with a route
const rateLimitedRoute = Post('/high-traffic-endpoint', {
  requestBody: z.object({ /* ... */ }),
  response: {
    '200': z.object({ /* ... */ })
  },
  middleware: [
    rateLimiter({ windowMs: 15 * 60 * 1000, max: 100 }),
    cacheMiddleware({ ttl: 60 })
  ]
}, async (req, res) => {
  // Implementation...
});
```

## Best Practices

### 1. Define Schemas Separately

For reusable schemas, define them separately:

```typescript
// schemas.ts
export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email()
});

// You can also use the built-in error schema
import { ErrorSchema } from 'typedapi';

// routes.ts
import { UserSchema } from './schemas';
import { ErrorSchema } from 'typedapi';

const getUserRoute = Get('/users/:userId', {
  params: z.object({ userId: z.string() }),
  response: {
    '200': UserSchema,
    '404': ErrorSchema
  }
}, async (req, res) => {
  // Implementation...
});
```

### 2. Group Related Routes

Organize routes by feature or resource:

```typescript
// users/routes.ts
export const userRoutes = (router: Router) => {
  createUserRoute(router);
  getUserRoute(router);
  updateUserRoute(router);
  deleteUserRoute(router);
  return router;
};

// app.ts
app.use('/api', userRoutes(Router()));
```

### 3. Standardize Error Responses

Use the ApiResponse helpers for consistent error handling:

```typescript
try {
  // Business logic...
  if (!user) {
    return ApiResponse.notFound(res, 'User not found');
  }
  
  return ApiResponse.success(res, user);
} catch (error) {
  return ApiResponse.error(res, 'Failed to process request', error);
}
```

### 4. Document Your APIs

Add meaningful descriptions and examples:

```typescript
const createUserRoute = Post('/users', {
  summary: 'Create a new user',
  description: 'Creates a new user account with the provided information.',
  requestBody: UserCreateSchema,
  response: {
    '201': UserSchema,
    '400': ErrorSchema
  },
  tags: ['Users']
}, async (req, res) => {
  // Implementation...
});
```

### 5. Handling Query Parameters

When working with query parameters, remember that Express parses them as strings. TypedAPI provides helpers for common transformations:

```typescript
// Using the queryBoolean helper for boolean query parameters
const getActiveUsersRoute = Get('/users', {
  query: z.object({
    active: queryBoolean,  // Will transform 'true' or '1' to boolean true
    role: z.enum(['admin', 'user']).optional()
  }),
  response: {
    '200': z.array(UserSchema)
  }
}, async (req, res) => {
  // req.query.active is now a boolean
  const { active, role } = req.query;
  
  // Implementation...
});
```

## Error Handling and Status Codes

TypedAPI provides standardized error handling with consistent status codes:

### Default Error Codes

| Status Code | Error Type | Description |
|-------------|------------|-------------|
| 400 | Bad Request | Used for validation errors (invalid parameters, query strings, or request bodies) |
| 401 | Unauthorized | Authentication failures (missing or invalid token) |
| 403 | Forbidden | Authorization failures (insufficient roles, scopes, or claims) |
| 404 | Not Found | Resource not found |
| 500 | Internal Server Error | Unexpected server errors |

### Automatic Validation Errors

TypedAPI automatically validates all incoming requests against your Zod schemas:

- **Path Parameters**: Validated against the `params` schema
- **Query Parameters**: Validated against the `query` schema
- **Request Body**: Validated against the `body` schema

When validation fails, TypedAPI automatically returns a `400 Bad Request` response with detailed validation errors:

```json
{
  "error": "Invalid request body",
  "details": {
    "name": ["Required"],
    "email": ["Invalid email format"]
  }
}
```

### Error Response Schema

TypedAPI exports a standard error schema that you can use in your route definitions:

```typescript
import { ErrorSchema } from 'typedapi';

const createUserRoute = Post('/users', {
  requestBody: UserSchema,
  response: {
    '201': CreatedUserSchema,
    '400': ErrorSchema,  // Use the standard error schema
    '409': z.object({
      error: z.string(),
      message: z.string()
    })
  }
}, async (req, res) => {
  // Implementation...
});
```

The standard error schema has the following structure:

```typescript
{
  error: string;    // Error message
  details: Record<string, any>;  // Additional error details
}
```

### Custom Error Responses

You can define custom error responses in your route definitions:

```typescript
const createUserRoute = Post('/users', {
  requestBody: UserSchema,
  response: {
    '201': CreatedUserSchema,
    '400': z.object({
      error: z.string(),
      details: z.record(z.any())
    }),
    '409': z.object({
      error: z.string(),
      message: z.string()
    })
  }
}, async (req, res) => {
  // Implementation...
});
```

### Error Response Helpers

TypedAPI provides helper functions for consistent error responses:

```typescript
// Basic error response (400 Bad Request by default)
ApiResponse.error(res, 'Invalid data', details);

// Authentication error (401 Unauthorized)
ApiResponse.unauthorized(res, 'Authentication required');

// Authorization error (403 Forbidden)
ApiResponse.forbidden(res, 'Insufficient permissions');

// Not found error (404 Not Found)
ApiResponse.notFound(res, 'User not found');

// Server error (500 Internal Server Error)
ApiResponse.serverError(res, 'Database connection failed');
```

## Conclusion

TypedAPI bridges the gap between Express's flexibility and the type safety, validation, and documentation needs of modern API development. By providing a declarative, type-safe way to define routes with built-in validation and authorization, it helps you build more robust APIs with less code and fewer bugs.

Whether you're building a small service or a large API, TypedAPI helps ensure your endpoints are correctly implemented, properly validated, and well-documented.
