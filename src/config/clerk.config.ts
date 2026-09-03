import { registerAs } from '@nestjs/config';

export default registerAs('clerk', () => {
  const secretKey = process.env.CLERK_SECRET_KEY;

  if (!secretKey) {
    throw new Error('CRITICAL: CLERK_SECRET_KEY is not set in .env');
  }

  return {
    secretKey,
  };
});
