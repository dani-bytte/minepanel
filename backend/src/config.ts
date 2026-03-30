import * as path from 'node:path';

export default () => {
  const baseDir = process.env.BASE_DIR || '/app';
  const isWindowsPath = /^[a-zA-Z]:[\\/]/.test(baseDir);
  const runtimeBaseDir = process.platform === 'win32' ? path.resolve(baseDir) : isWindowsPath ? '/app' : path.resolve(baseDir);

  return {
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '2d',
    jwtIssuer: process.env.JWT_ISSUER || 'minepanel',
    jwtAudience: process.env.JWT_AUDIENCE || 'minepanel-users',
    clientUsername: process.env.CLIENT_USERNAME,
    clientPassword: process.env.CLIENT_PASSWORD,
    frontendUrl: process.env.FRONTEND_URL,
    composeProject: process.env.COMPOSE_PROJECT,
    defaultLanguage: process.env.DEFAULT_LANGUAGE ?? 'en',
    serversDir: `${runtimeBaseDir}/servers`,
    baseDir: baseDir,
    database: {
      path: `${runtimeBaseDir}/data/minepanel.db`,
    },
  };
};
