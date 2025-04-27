# TypedAPI Conditional Route Exposure

## Context
- Type: Security
- Target: TypedAPI OpenAPI Generator
- Environment: Development
- Feature: Role-based API documentation exposure

## Scenario: Hide admin routes for unauthenticated users

### Steps
1. **Given** I have TypedAPI routes with different authorization requirements:
   ```typescript
   import { z } from 'zod';
   import { Get } from '../src';
   import { Router } from 'express';

   const UserSchema = z.object({
     id: z.string(),
     name: z.string(),
     email: z.string().email()
   });

   const ProfileSchema = z.object({
     name: z.string(),
     email: z.string().email()
   });

   // Admin route with role authorization
   const getUsersRoute = Get('/admin/users', {
     response: {
       '200': z.array(UserSchema)
     },
     auth: {
       requiresAuthentication: true,
       authorization: {
         roles: 'admin'
       }
     }
   }, async (req, res) => {
     // Implementation
     return res.status(200).json([]);
   });

   // Regular route without auth requirements
   const getPublicProfileRoute = Get('/profile/public', {
     response: {
       '200': ProfileSchema
     }
   }, async (req, res) => {
     // Implementation
     return res.status(200).json({
       name: 'Public User',
       email: 'public@example.com'
     });
   });
   
   // Regular authenticated route
   const getUserProfileRoute = Get('/profile', {
     response: {
       '200': ProfileSchema
     },
     auth: {
       requiresAuthentication: true
     }
   }, async (req, res) => {
     // Implementation
     return res.status(200).json({
       name: 'Authenticated User',
       email: 'user@example.com'
     });
   });
   ```
2. **When** I generate an OpenAPI document with a configuration for unauthenticated access
3. **Then** the document should not contain the '/admin/users' path
4. **And** the document should not contain the '/profile' path
5. **And** the document should contain the '/profile/public' path

## Scenario: Hide admin routes for regular authenticated users

### Steps
1. **Given** I have TypedAPI routes with different authorization requirements as above
2. **When** I generate an OpenAPI document for a user with role 'user'
3. **Then** the document should not contain the '/admin/users' path
4. **And** the document should contain the '/profile' path
5. **And** the document should contain the '/profile/public' path

## Scenario: Show admin routes for admin users

### Steps
1. **Given** I have TypedAPI routes with different authorization requirements as above
2. **When** I generate an OpenAPI document for a user with role 'admin'
3. **Then** the document should contain the '/admin/users' path
4. **And** the document should contain the '/profile' path
5. **And** the document should contain the '/profile/public' path

## Scenario: Support for custom authorization function in OpenAPI generation

### Steps
1. **Given** I have a custom authorizeRoute function for generating OpenAPI documentation:
   ```typescript
   import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
   import { apiRegistry } from '../src';
   
   interface User {
     id: string;
     roles: string[];
     permissions: string[];
   }
   
   // Function to generate OpenAPI document based on user
   function generateOpenApiDocument(user?: User) {
     // Create OpenAPI generator
     const generator = new OpenAPIGenerator(apiRegistry.definitions);
     
     // Filter routes based on user permissions
     const filteredDefinitions = {
       ...apiRegistry.definitions,
       paths: Object.entries(apiRegistry.definitions.paths || {}).reduce((acc, [path, methods]) => {
         // Check each path and method
         const filteredMethods = Object.entries(methods).reduce((methodAcc, [method, operation]) => {
           // Check if route has auth requirements
           const security = operation.security;
           const requiresAuth = security && security.length > 0;
           
           // Check if route has role requirements
           const roles = operation.tags?.filter(tag => tag.startsWith('role:'))
                          .map(tag => tag.replace('role:', ''));
           const requiresAdminRole = roles?.includes('admin');
           
           // Authorization logic
           let authorized = true;
           
           // If route requires auth, check if user is authenticated
           if (requiresAuth && !user) {
             authorized = false;
           }
           
           // If route requires admin role, check if user has it
           if (requiresAdminRole && (!user || !user.roles.includes('admin'))) {
             authorized = false;
           }
           
           // If authorized, include the method
           if (authorized) {
             methodAcc[method] = operation;
           }
           
           return methodAcc;
         }, {});
         
         // If there are any methods left, include the path
         if (Object.keys(filteredMethods).length > 0) {
           acc[path] = filteredMethods;
         }
         
         return acc;
       }, {})
     };
     
     // Generate OpenAPI document from filtered definitions
     return generator.generateDocument(filteredDefinitions);
   }
   ```
2. **When** I generate an OpenAPI document for a user with specific permissions using this function
3. **Then** only routes matching the authorization logic should be included
4. **And** routes requiring admin role that the user doesn't have should be excluded