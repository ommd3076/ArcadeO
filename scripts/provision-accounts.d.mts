export interface ProvisionOptions {
  playerAPassword?: string;
  playerBPassword?: string;
  playerAUser?: string;
  playerBUser?: string;
  playerAName?: string;
  playerBName?: string;
}

export interface ProvisionAccountInfo {
  id: "A" | "B";
  username: string;
  displayName: string;
  passwordHash: string;
  salt: string;
  kdfAlgorithm: string;
  accentFamily: string;
  paletteFamily: string;
  preferenceVersion: number;
}

export function hashPassword(
  password: string,
  saltBytes?: Uint8Array,
  iterations?: number
): Promise<{ passwordHash: string; salt: string; kdfAlgorithm: string }>;

export function generateProvisioningSql(options?: ProvisionOptions): Promise<{
  sql: string;
  accountA: ProvisionAccountInfo;
  accountB: ProvisionAccountInfo;
}>;
