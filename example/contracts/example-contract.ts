import { z } from 'zod';

// Define the request schemas
export const ParamsSchema = z.object({
  userId: z.string().uuid().describe('User unique identifier')
});

export const QuerySchema = z.object({
  include: z.string().optional().describe('Fields to include in the response'),
  // Express query params are always strings, so we parse them appropriately
  page: z.string()
    .optional()
    .default('1')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive())
    .describe('Page number for pagination'),
  limit: z.string()
    .optional()
    .default('10')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive())
    .describe('Number of items per page')
});

// Define the response schemas for different status codes
const UserSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  email: z.string().email(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

const ErrorSchema = z.object({
  error: z.string(),
  code: z.number().int(),
  message: z.string()
});

// Define the response union type
export type Response = 
  | { status: 200; body: { user: z.infer<typeof UserSchema> } }
  | { status: 400; body: z.infer<typeof ErrorSchema> }
  | { status: 404; body: z.infer<typeof ErrorSchema> };

// Define the contract
export const Contract = {
  path: '/users/:userId',
  method: 'get',
  summary: 'Get user by ID',
  description: 'Retrieve a user by their unique identifier',
  tags: ['users'],
  auth: {
    requiresAuthentication: true,
    authorization: {
      roles: ['user', 'admin']
    }
  },
  params: ParamsSchema,
  query: QuerySchema,
  response: {
    200: {
      description: 'User found successfully',
      schema: z.object({
        user: UserSchema
      })
    },
    400: {
      description: 'Bad request, invalid parameters',
      schema: ErrorSchema
    },
    404: {
      description: 'User not found',
      schema: ErrorSchema
    }
  }
};