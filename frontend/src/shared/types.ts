interface User {
  id: string;
  name: string;
  email: string;
  active: boolean;
  roleId: number;
  //optional timestamps
  createdAt?: string; // ISO date string
  updatedAt?: string; // ISO date string
}

export type { User };
