import { registerAs } from '@nestjs/config';

export default registerAs('clerk', () => {
  const secretKey = process.env.CLERK_SECRET_KEY;
  const issuer = process.env.CLERK_ISSUER;

  if (!secretKey || !issuer) {
    throw new Error(
      'CRITICAL: CLERK_SECRET_KEY or CLERK_ISSUER is not set in .env',
    );
  }

  return {
    secretKey,
    issuer,
  };
});
