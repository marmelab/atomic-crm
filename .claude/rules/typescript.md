---
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
---

# TypeScript / JavaScript

## Types and interfaces

Use interface for object shapes that may be extended or implemented.
Use type for unions, intersections, tuples, and utility types.
Prefer string literal unions over enum unless interoperability requires it.

    interface User {
      id: string
      email: string
    }

    type UserRole = 'admin' | 'member'
    type UserWithRole = User & { role: UserRole }

Add explicit parameter and return types to exported functions and public
class methods. Let TypeScript infer obvious local variable types.

## Avoid any

Never use any in application code.
Use unknown for external or untrusted input, then narrow safely.
Use generics when a value's type depends on the caller.

    // Wrong
    function getErrorMessage(error: any) {
      return error.message
    }

    // Correct
    function getErrorMessage(error: unknown): string {
      if (error instanceof Error) return error.message
      return 'Unexpected error'
    }

## React props

Define component props with a named interface or type.
Type callback props explicitly.
Do not use React.FC unless there is a specific reason.

    interface UserCardProps {
      user: User
      onSelect: (id: string) => void
    }

    function UserCard({ user, onSelect }: UserCardProps) {
      return <button onClick={() => onSelect(user.id)}>{user.email}</button>
    }

## Input validation with Zod

Use Zod for schema-based validation and infer types from the schema.
Do not duplicate type definitions — infer from the schema.

    import { z } from 'zod'

    const userSchema = z.object({
      email: z.string().email(),
      age: z.number().int().min(0).max(150)
    })

    type UserInput = z.infer<typeof userSchema>
    const validated: UserInput = userSchema.parse(input)

## Error handling

Use async/await with try-catch. Always narrow unknown errors before
accessing properties.

    async function loadUser(userId: string): Promise<User> {
      try {
        return await riskyOperation(userId)
      } catch (error: unknown) {
        logger.error('Operation failed', error)
        throw new Error(getErrorMessage(error))
      }
    }

## console.log

No console.log in production code. Use a proper logging library.