const requiredEnvVariables = [
  'API_PORT',
  'ADMINS',
  'MONGO_HOST',
  'MONGO_PORT',
  'MONGO_USERNAME',
  'MONGO_PASSWORD',
  'JWT_SECRET',
  'JWT_ACCESS_EXP',
  'JWT_REFRESH_EXP',
  'NODE_ENV',
  'API_URL',
  'DISCORD_TOKEN',
  'DISCORD_GUILD_ID',
];

/**
 * Check that all required ENV variables are set
 */
export function envCheck(): void {
  const unsetEnv = requiredEnvVariables.filter(
    (env) =>
      !(typeof process.env[env] !== 'undefined') || process.env[env] === '',
  );

  if (unsetEnv.length > 0) {
    throw new Error(
      `Required ENV variables are not set: [${unsetEnv.join(', ')}]`,
    );
  }
}
