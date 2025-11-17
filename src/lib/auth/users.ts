export type AuthRole = 'admin' | 'user';

export interface AuthUser {
  username: string;
  password: string;
  role: AuthRole;
  displayName: string;
}

const DEFAULT_ADMIN_USER = 'tapaz_admin';
const DEFAULT_ADMIN_PASSWORD = 'Admin!2024';
const DEFAULT_NORMAL_USER = 'tapaz_user';
const DEFAULT_NORMAL_PASSWORD = 'User!2024';

const buildUsers = (): AuthUser[] => {
  const adminUsername = process.env.AUTH_ADMIN_USERNAME ?? DEFAULT_ADMIN_USER;
  const adminPassword = process.env.AUTH_ADMIN_PASSWORD ?? DEFAULT_ADMIN_PASSWORD;
  const normalUsername = process.env.AUTH_USER_USERNAME ?? DEFAULT_NORMAL_USER;
  const normalPassword = process.env.AUTH_USER_PASSWORD ?? DEFAULT_NORMAL_PASSWORD;

  return [
    {
      username: adminUsername,
      password: adminPassword,
      role: 'admin',
      displayName: 'Administrator'
    },
    {
      username: normalUsername,
      password: normalPassword,
      role: 'user',
      displayName: 'Analitika İstifadəçisi'
    }
  ];
};

const users = buildUsers();

export const authenticateUser = (username: string, password: string) =>
  users.find((user) => user.username === username && user.password === password);

export const listUsers = () => users;
