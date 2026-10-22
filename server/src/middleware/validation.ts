import { Request, Response, NextFunction } from 'express';

export const validateInput = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Basic wrapper, actual implementation can use Zod or Joi
    // For now, assume it's just passing through
    next();
  };
};
