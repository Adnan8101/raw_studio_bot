


export enum ProtectionAction {
  BAN_MEMBERS = 'BAN_MEMBERS',
  KICK_MEMBERS = 'KICK_MEMBERS',
  DELETE_ROLES = 'DELETE_ROLES',
  CREATE_ROLES = 'CREATE_ROLES',
  DELETE_CHANNELS = 'DELETE_CHANNELS',
  CREATE_CHANNELS = 'CREATE_CHANNELS',
  ADD_BOTS = 'ADD_BOTS',
  DANGEROUS_PERMS = 'DANGEROUS_PERMS',
  GIVE_ADMIN_ROLE = 'GIVE_ADMIN_ROLE',
  PRUNE_MEMBERS = 'PRUNE_MEMBERS',
}


export enum WhitelistCategory {
  BAN_MEMBERS = 'BAN_MEMBERS',
  KICK_MEMBERS = 'KICK_MEMBERS',
  DELETE_ROLES = 'DELETE_ROLES',
  CREATE_ROLES = 'CREATE_ROLES',
  DELETE_CHANNELS = 'DELETE_CHANNELS',
  CREATE_CHANNELS = 'CREATE_CHANNELS',
  ADD_BOTS = 'ADD_BOTS',
  DANGEROUS_PERMS = 'DANGEROUS_PERMS',
  GIVE_ADMIN_ROLE = 'GIVE_ADMIN_ROLE',
  PRUNE_MEMBERS = 'PRUNE_MEMBERS',
  ALL = 'ALL',
}


export enum PunishmentType {
  BAN = 'ban',
  KICK = 'kick',
  TIMEOUT = 'timeout',
}


export enum JobState {
  CREATED = 'created',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRY = 'retry',
}


export enum JobType {
  RECOVERY = 'recovery',
  CASE_WRITE = 'case_write',
  SNAPSHOT = 'snapshot',
  CLEANUP = 'cleanup',
}


export interface SecurityEvent {
  guildId: string;
  userId: string;
  action: ProtectionAction;
  targetId?: string;
  auditLogId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}


export interface AntiNukeConfiguration {
  guildId: string;
  enabled: boolean;
  protections: ProtectionAction[];
}


export interface LimitConfiguration {
  action: ProtectionAction;
  limitCount: number;
  windowMs: number;
}


export interface PunishmentConfiguration {
  action: ProtectionAction;
  punishment: PunishmentType;
  durationSeconds?: number;
}


export interface WhitelistEntry {
  targetId: string;
  isRole: boolean;
  category: WhitelistCategory;
  createdBy: string;
  createdAt: Date;
}


export interface ModCase {
  caseNumber: number;
  guildId: string;
  targetId: string;
  moderatorId: string;
  action: string;
  reason?: string;
  metadata?: Record<string, any>;
  overturned: boolean;
  createdAt: Date;
}


export enum RecoveryMode {
  PARTIAL = 'partial',
  FULL = 'full',
}


export const EmbedColors = {
  SUCCESS: 0x00ff00,
  ERROR: 0xff0000,
  WARNING: 0xffa500,
  INFO: 0x3498db,
  SECURITY: 0xff0000,
  MODERATION: 0xffa500,
} as const;


export const DANGEROUS_PERMISSIONS = [
  'ADMINISTRATOR',
  'MANAGE_GUILD',
  'MANAGE_ROLES',
  'MANAGE_CHANNELS',
  'MANAGE_WEBHOOKS',
  'BAN_MEMBERS',
  'KICK_MEMBERS',
  'MENTION_EVERYONE',
] as const;


export const DEFAULT_LIMITS = {
  BAN_MEMBERS: { count: 3, windowMs: 10000 },
  KICK_MEMBERS: { count: 5, windowMs: 10000 },
  DELETE_ROLES: { count: 3, windowMs: 10000 },
  CREATE_ROLES: { count: 5, windowMs: 10000 },
  DELETE_CHANNELS: { count: 3, windowMs: 10000 },
  CREATE_CHANNELS: { count: 5, windowMs: 10000 },
  ADD_BOTS: { count: 2, windowMs: 30000 },
  DANGEROUS_PERMS: { count: 3, windowMs: 10000 },
  GIVE_ADMIN_ROLE: { count: 2, windowMs: 10000 },
  PRUNE_MEMBERS: { count: 1, windowMs: 60000 },
} as const;


export interface SlashCommand {
  data: any;
  execute: (interaction: any, ...args: any[]) => Promise<void>;
  category?: string;
  syntax?: string;
  permission?: string;
  example?: string;
}

export interface PrefixCommand {
  name: string;
  aliases?: string[];
  description: string;
  usage: string;
  permissions?: bigint[];
  category?: string;
  example?: string;
  execute: (message: any, args: string[], ...rest: any[]) => Promise<void>;
}
