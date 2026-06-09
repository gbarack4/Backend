import type { Request } from 'express';

export interface AuthPayload {
  clerkId: string;
}

export interface UserEntity {
  id: string;
  email: string;
}

export interface RequestWithAuth extends Request {
  authPayload?: AuthPayload;
  currentUser?: UserEntity;
}
