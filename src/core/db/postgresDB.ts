import { Pool, PoolClient } from 'pg';
import { ErrorHandler } from '../errorHandler';

export interface DataRow {
  id: string;
  type: 'panel' | 'ticket' | 'autosave' | 'config' | 'template';
  data: string;
  updatedAt: string;
}

export interface CustomQuestion {
  text: string;
  type: 'primary' | 'optional';
}

export interface PanelData {
  id: string;
  type: 'panel';
  guildId?: string; 
  name?: string;
  channel?: string;
  openCategory?: string;
  closeCategory?: string;
  staffRole?: string;
  logsChannel?: string;
  transcriptChannel?: string;
  label: string;
  emoji: string;
  color: string;
  embedColor?: string;
  description: string;
  openMessage: string;
  questions: string[]; 
  customQuestions?: CustomQuestion[];
  pendingQuestion?: string; 
  claimable: boolean;
  allowOwnerClose?: boolean;
  enabled: boolean;
  messageId?: string;
  ticketsCreated?: number;
  userPermissions?: string[];
  staffPermissions?: string[];
  editChanges?: string[]; 
}

export interface TicketData {
  id: string;
  type: 'ticket';
  owner: string;
  panelId: string;
  channelId: string;
  state: 'open' | 'closed';
  claimedBy?: string;
  createdAt: string;
  closedAt?: string;
  welcomeMessageId?: string;
  closeMessageId?: string;
}

export interface AutosaveData {
  id: string;
  type: 'autosave';
  userId: string;
  panelId?: string;
  data: Partial<PanelData>;
  tempPanel?: PanelData;
  pendingQuestion?: string; 
  startedAt: string;
  embedColor?: string;
  editChanges?: string[]; 
}

export interface GuildConfig {
  id: string;
  type: 'config';
  guildId: string;
  prefix: string;
  updatedAt: string;
}

export interface RoleAlias {
  id: string; 
  type: 'role_alias';
  guildId: string;
  alias: string;
  updatedAt: string;
}

export type StoredData = PanelData | TicketData | AutosaveData | GuildConfig | RoleAlias;

class PostgresDB {
  private pool: Pool;
  private isConnected: boolean = false;

  
  private prefixCache: Map<string, { prefix: string; cachedAt: number }> = new Map();
  private panelCache: Map<string, { panel: PanelData; cachedAt: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; 

  constructor(connectionString?: string) {
    const dbUrl = connectionString || process.env.DATABASE_URL;

    if (!dbUrl) {
      throw new Error('DATABASE_URL environment variable is required for PostgreSQL connection');
    }

    
    const cleanUrl = dbUrl.replace(/[?&]sslmode=[^&]*/g, '');

    const isLocal = cleanUrl.includes('localhost') || cleanUrl.includes('127.0.0.1');

    this.pool = new Pool({
      connectionString: cleanUrl,
      ssl: isLocal ? false : {
        rejectUnauthorized: false
      },
      max: 20, 
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 30000, 
      
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });

    
    this.pool.on('error', (err) => {
      
    });

    
    this.initializeDatabase().catch(err => {
      console.error('Database initialization error:', err.message);
    });

    
    this.warmupPool();
  }

  
  private async warmupPool(): Promise<void> {
    try {
      
      const warmupPromises = [];
      for (let i = 0; i < 3; i++) {
        warmupPromises.push(
          this.pool.connect().then(client => {
            client.release();
          })
        );
      }
      await Promise.all(warmupPromises);
      console.log('✅ Connection pool warmed up');
    } catch (error) {
      console.warn('⚠️ Pool warmup failed:', error);
    }
  }

  private async initializeDatabase(retries = 3): Promise<void> {
    let client: PoolClient | null = null;
    let lastError: any = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        client = await this.pool.connect();

        const createTable = `
          CREATE TABLE IF NOT EXISTS data (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            data JSONB NOT NULL,
            "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `;

        const createIndexes = `
          CREATE INDEX IF NOT EXISTS idx_type ON data(type);
          CREATE INDEX IF NOT EXISTS idx_updated ON data("updatedAt");
          CREATE INDEX IF NOT EXISTS idx_data_gin ON data USING gin(data);
          
          CREATE TABLE IF NOT EXISTS role_aliases (
            id SERIAL PRIMARY KEY,
            guild_id TEXT NOT NULL,
            role_id TEXT NOT NULL,
            alias TEXT NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(guild_id, alias)
          );
          
          CREATE INDEX IF NOT EXISTS idx_role_aliases_guild ON role_aliases(guild_id);
          CREATE INDEX IF NOT EXISTS idx_role_aliases_alias ON role_aliases(alias);
        `;

        await client.query(createTable);
        await client.query(createIndexes);

        this.isConnected = true;
        console.log('✅ Database tables initialized');

        return; 

      } catch (error: any) {
        lastError = error;

        if (attempt < retries) {
          const waitTime = attempt * 2000; 
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      } finally {
        if (client) {
          client.release();
          client = null;
        }
      }
    }

    
    throw lastError;
  }

  
  isConnectionReady(): boolean {
    return this.isConnected;
  }

  
  async waitForConnection(timeoutMs: number = 30000): Promise<boolean> {
    const startTime = Date.now();
    while (!this.isConnected && Date.now() - startTime < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    return this.isConnected;
  }

  
  async save<T extends StoredData>(data: T): Promise<void> {
    if (!this.isConnected) {
      const connected = await this.waitForConnection(5000);
      if (!connected) {
        throw new Error('Database connection not available');
      }
    }

    const client = await this.pool.connect();
    try {
      const now = new Date().toISOString();
      await client.query(
        `INSERT INTO data (id, type, data, "updatedAt")
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE 
         SET data = $3, "updatedAt" = $4`,
        [data.id, data.type, JSON.stringify(data), now]
      );
    } catch (error: any) {
      throw error;
    } finally {
      client.release();
    }
  }

  
  async get<T extends StoredData>(id: string): Promise<T | null> {
    if (!this.isConnected) {
      const connected = await this.waitForConnection(5000);
      if (!connected) {
        throw new Error('Database connection not available');
      }
    }

    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM data WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      
      return typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    } catch (error: any) {
      throw error;
    } finally {
      client.release();
    }
  }

  
  async getByType<T extends StoredData>(type: DataRow['type']): Promise<T[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM data WHERE type = $1 ORDER BY "updatedAt" DESC',
        [type]
      );

      return result.rows.map(row => {
        
        return typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      });
    } catch (error: any) {
      throw error;
    } finally {
      client.release();
    }
  }

  
  async delete(id: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('DELETE FROM data WHERE id = $1', [id]);
    } catch (error: any) {
      throw error;
    } finally {
      client.release();
    }
  }

  
  async getAllPanels(guildId?: string): Promise<PanelData[]> {
    if (!guildId) {
      return this.getByType<PanelData>('panel');
    }

    const client = await this.pool.connect();
    try {
      
      const result = await client.query(
        `SELECT * FROM data WHERE type = 'panel' AND data->>'guildId' = $1 ORDER BY "updatedAt" DESC`,
        [guildId]
      );

      return result.rows.map(row => {
        return typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      });
    } catch (error: any) {
      
      return [];
    } finally {
      client.release();
    }
  }

  
  async getAllTickets(): Promise<TicketData[]> {
    return this.getByType<TicketData>('ticket');
  }

  
  async getTicketsByPanel(panelId: string): Promise<TicketData[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM data WHERE type = 'ticket' AND data->>'panelId' = $1 ORDER BY "updatedAt" DESC`,
        [panelId]
      );

      return result.rows.map(row => {
        return typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      });
    } catch (error: any) {
      ErrorHandler.handle(error, 'Get tickets by panel');
      throw error;
    } finally {
      client.release();
    }
  }

  
  async getOpenTicketsForUser(userId: string, panelId: string): Promise<TicketData[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM data 
         WHERE type = 'ticket' 
         AND data->>'owner' = $1 
         AND data->>'panelId' = $2 
         AND data->>'state' = 'open'
         ORDER BY "updatedAt" DESC`,
        [userId, panelId]
      );

      return result.rows.map(row => {
        return typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      });
    } catch (error: any) {
      ErrorHandler.handle(error, 'Get open tickets for user');
      return [];
    } finally {
      client.release();
    }
  }

  
  async getAutosave(userId: string): Promise<AutosaveData | null> {
    return this.get<AutosaveData>(`autosave:${userId}`);
  }

  
  async deleteAutosave(userId: string): Promise<void> {
    await this.delete(`autosave:${userId}`);
  }

  
  async generatePanelId(): Promise<string> {
    const panels = await this.getAllPanels();
    const ids = panels.map(p => parseInt(p.id.split(':')[1]));
    const maxId = ids.length > 0 ? Math.max(...ids) : 1000;
    return `panel:${maxId + 1}`;
  }

  
  async generateTicketId(): Promise<string> {
    const tickets = await this.getAllTickets();
    const ids = tickets.map(t => parseInt(t.id.split(':')[1]));
    const maxId = ids.length > 0 ? Math.max(...ids) : 1000;
    return `ticket:${maxId + 1}`;
  }

  
  async close(): Promise<void> {
    await this.pool.end();
  }

  
  getPool(): Pool {
    return this.pool;
  }

  
  isConnectionActive(): boolean {
    return this.isConnected;
  }

  
  async getGuildConfig(guildId: string): Promise<GuildConfig | null> {
    return this.get<GuildConfig>(`config:${guildId}`);
  }

  
  async saveGuildConfig(guildId: string, prefix: string): Promise<void> {
    const config: GuildConfig = {
      id: `config:${guildId}`,
      type: 'config',
      guildId,
      prefix,
      updatedAt: new Date().toISOString()
    };
    await this.save(config);

    
    this.clearPrefixCache(guildId);
  }

  
  async getPrefix(guildId: string): Promise<string> {
    
    const cached = this.prefixCache.get(guildId);
    if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL) {
      return cached.prefix;
    }

    
    const config = await this.getGuildConfig(guildId);
    const prefix = config?.prefix || '$';

    
    this.prefixCache.set(guildId, { prefix, cachedAt: Date.now() });

    return prefix;
  }

  
  clearPrefixCache(guildId: string): void {
    this.prefixCache.delete(guildId);
  }

  
  async savePanelTemplate(templateId: string, template: any): Promise<void> {
    
    const { id: _originalId, ...templateWithoutId } = template;

    const templateData = {
      id: `template:${templateId}`,
      type: 'template' as const,
      ...templateWithoutId
    };
    await this.save(templateData as any);
  }

  
  async getPanelTemplate(templateId: string): Promise<any | null> {
    return await this.get(`template:${templateId}`);
  }

  
  async getAllTemplates(): Promise<any[]> {
    return this.getByType('template');
  }

  
  async migratePanelsWithGuildId(client: any): Promise<number> {
    try {
      const allPanels = await this.getByType<PanelData>('panel');
      let migratedCount = 0;

      for (const panel of allPanels) {
        
        if (panel.guildId) continue;

        
        if (panel.channel) {
          try {
            const channel = await client.channels.fetch(panel.channel);
            if (channel && 'guild' in channel && channel.guild) {
              panel.guildId = channel.guild.id;
              await this.save(panel);
              migratedCount++;
              console.log(`✅ Migrated panel ${panel.id} to guild ${channel.guild.id}`);
            }
          } catch (error) {
            console.warn(`⚠️ Could not migrate panel ${panel.id}: channel not found`);
          }
        }
      }

      console.log(`📦 Migration complete: ${migratedCount} panels updated`);
      return migratedCount;
    } catch (error: any) {
      console.error('❌ Migration failed:', error.message);
      return 0;
    }
  }

  
  async addRoleAlias(guildId: string, roleId: string, alias: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        `INSERT INTO role_aliases (guild_id, role_id, alias)
         VALUES ($1, $2, $3)
         ON CONFLICT (guild_id, alias) 
         DO UPDATE SET role_id = $2`,
        [guildId, roleId, alias.toLowerCase()]
      );
    } catch (error: any) {
      throw error;
    } finally {
      client.release();
    }
  }

  
  async removeRoleAlias(guildId: string, alias: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `DELETE FROM role_aliases WHERE guild_id = $1 AND alias = $2`,
        [guildId, alias.toLowerCase()]
      );
      return (result.rowCount ?? 0) > 0;
    } catch (error: any) {
      throw error;
    } finally {
      client.release();
    }
  }

  
  async getRoleAliases(guildId: string): Promise<{ alias: string; roleId: string }[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT alias, role_id as "roleId" FROM role_aliases WHERE guild_id = $1`,
        [guildId]
      );
      return result.rows;
    } catch (error: any) {
      throw error;
    } finally {
      client.release();
    }
  }

  
  async getRoleByAlias(guildId: string, alias: string): Promise<string | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT role_id FROM role_aliases WHERE guild_id = $1 AND alias = $2`,
        [guildId, alias.toLowerCase()]
      );
      return result.rows[0]?.role_id || null;
    } catch (error: any) {
      throw error;
    } finally {
      client.release();
    }
  }
}

export default PostgresDB;
