import { Router } from 'express';
import { z } from 'zod';
import {
    Post,
    Get,
    Put,
    ApiMiddleware,
    authorize,
    ApiResponse
} from '../src';

/**                                                                                                                                                       
 * Example usage of the API framework
 */

ApiMiddleware.tokenValidator = (token) => {
    //eg: return jwt.verify(token, process.env.JWT_SECRET) as AuthenticatedUser
    return {
        id: 'the-user-id',
        roles: ['user'],
        scopes: ['user:read']
    }
};

// Create a router with global auth
const securedRouter = Router();
ApiMiddleware.useAuth(securedRouter, ApiMiddleware.authentication()); // All routes will require authentication

// Example with specific scopes
const createUserRoute = Post('/users', {
    description: 'Create a new user',
    requestBody: z.object({
        email: z.string().email(),
        name: z.string()
    }),
    response: {
        '201': z.object({ id: z.string(), email: z.string() })
    },
    tags: ['Users'],
    auth: {
        requiresAuthentication: true,
        authorization: {
            scopes: ['write:users']
        }
    }
},
    async (req, res, next) => {
        // Implementation...
        const { email, name } = req.body;
        return ApiResponse.success(res, { id: 'new-user-id', email }, 201);
    });

// Apply to the secured router
createUserRoute(securedRouter);

// Example of a route with admin role requirement
const updateUserRoute = Post('/users/:userId', {
    description: 'Update a user',
    params: z.object({ userId: z.string() }),
    requestBody: z.object({ email: z.string().email() }),
    response: {
        '200': z.object({ success_message: z.string() }),
        '201': z.object({ myProperty: z.string() })
    },
    tags: ['Users'],
    auth: {
        authorization: {
            roles: 'admin'
        }
    }
},
    async (req, res, next) => {
        try {
            // Access typed parameters and body
            const userId = req.params.userId;
            const email = req.body.email;

            // Access the authenticated user (added by auth middleware)
            const currentUser = req.user!;
            console.log(`User ${currentUser.id} is updating user ${userId} with email ${email}`);

            // Return success response
            return ApiResponse.success(res, { success_message: 'yeah' }, 200);
        } catch (error) {
            // Return error response
            return ApiResponse.error(res, 'Operation failed', error);
        }
    });

// Apply to the secured router
updateUserRoute(securedRouter);

// Business router example
const myBusinessRouter = Router();
ApiMiddleware.useAuth(myBusinessRouter, authorize);

const addUpdateCompanyRoute = Post('/company/:companyId', {
    requestBody: z.object({ 'price': z.number().positive() }),
    response: {
        '200': z.object({ 'updated_price': z.number() }),
        '403': z.object({ error: z.string(), details: z.record(z.any()) })
    },
    auth: {
        authorization: {
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
    // Access the company ID and price
    const companyId = req.params.companyId;
    const price = req.body.price;

    // Access the authenticated user
    const user = req.user!;

    // At this point, we know the user has access to this company
    console.log(`User ${user.id} is updating price for company ${companyId} to ${price}`);

    // Return the updated price
    return ApiResponse.success(res, { updated_price: price });
});

addUpdateCompanyRoute(myBusinessRouter);

// Example for subscription validation
const getSubscriptionDetails = Get('/subscriptions/:subscriptionId', {
    response: {
        '200': z.object({
            id: z.string(),
            name: z.string(),
            status: z.string(),
            expiresAt: z.string().datetime()
        })
    },
    auth: {
        authorization: {
            claims: [
                {
                    userClaimPath: 'subscriptions',
                    routeParamName: 'subscriptionId',
                    description: 'User must own the specified subscription'
                }
            ]
        }
    }
}, async (req, res) => {
    const subscriptionId = req.params.subscriptionId;

    // At this point, we know the user owns this subscription
    return ApiResponse.success(res, {
        id: subscriptionId,
        name: 'Premium Plan',
        status: 'active',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    });
});

// Example with a custom validation function for more complex scenarios
const updateProjectTask = Put('/projects/:projectId/tasks/:taskId', {
    requestBody: z.object({
        status: z.enum(['todo', 'in-progress', 'done']),
        assignee: z.string().optional()
    }),
    response: {
        '200': z.object({ success: z.boolean() })
    },
    auth: {
        authorization: {
            claims: [
                {
                    userClaimPath: 'projectRoles',
                    routeParamName: 'projectId',
                    description: 'User must have admin or editor role in the project',
                    validator: (projectRoles, projectId) => {
                        // Check if user has admin or editor role for this project
                        if (!projectRoles || typeof projectRoles !== 'object') {
                            return false;
                        }

                        const role = projectRoles[projectId];
                        return role === 'admin' || role === 'editor';
                    }
                }
            ]
        }
    }
}, async (req, res) => {
    // Implementation...
    return ApiResponse.success(res, { success: true });
});

// Use in your Express app
// app.use('/api', securedRouter);

// Example of using queryBoolean and queryNumber for query parameters
const getFilteredItemsRoute = Get('/items', {
  query: z.object({
    category: z.string().optional(),
    active: queryBoolean,  // Will transform 'true' or '1' to boolean true
    limit: queryPositiveNumber,  // Will transform string to positive number
    page: queryInteger     // Will transform string to integer
  }),
  response: {
    '200': z.array(z.object({
      id: z.string(),
      name: z.string(),
      active: z.boolean()
    }))
  }
}, async (req, res) => {
  // Access the transformed query parameters
  const { category, active, limit, page } = req.query;
  
  console.log(`Fetching ${limit} items on page ${page}, active: ${active}, category: ${category}`);
  
  // Return sample data
  return ApiResponse.success(res, [
    { id: '1', name: 'Item 1', active: true },
    { id: '2', name: 'Item 2', active: false }
  ]);
});

// Apply to router
getFilteredItemsRoute(securedRouter);
