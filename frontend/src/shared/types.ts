interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  isActive: boolean;
  roleId: string[]; // Array of role names
}

export type { User };
