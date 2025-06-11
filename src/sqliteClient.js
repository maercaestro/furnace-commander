import initSqlJs from 'sql.js';

class SQLiteClient {
  constructor() {
    this.db = null;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;

    try {
      // Initialize SQL.js
      const SQL = await initSqlJs({
        locateFile: file => `https://sql.js.org/dist/${file}`
      });

      // Try to load existing database from localStorage
      const savedDb = localStorage.getItem('furnace_commander_db');
      
      if (savedDb) {
        // Load existing database
        const uint8Array = new Uint8Array(JSON.parse(savedDb));
        this.db = new SQL.Database(uint8Array);
      } else {
        // Create new database
        this.db = new SQL.Database();
        this.createTables();
      }

      this.initialized = true;
      console.log('SQLite database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize SQLite database:', error);
      throw error;
    }
  }

  createTables() {
    if (!this.db) throw new Error('Database not initialized');

    // Create leaderboard table with same structure as Supabase
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS leaderboard (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_name TEXT NOT NULL,
        score INTEGER NOT NULL,
        grade TEXT NOT NULL,
        final_temp REAL,
        target_temp REAL,
        cost_savings REAL,
        co_emissions REAL,
        time_used INTEGER,
        feedback TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    this.db.run(createTableSQL);
    this.saveDatabase();
  }

  saveDatabase() {
    if (!this.db) return;

    try {
      // Export database to Uint8Array and save to localStorage
      const data = this.db.export();
      const dataString = JSON.stringify(Array.from(data));
      localStorage.setItem('furnace_commander_db', dataString);
    } catch (error) {
      console.error('Failed to save database:', error);
    }
  }

  async insert(table, data) {
    if (!this.initialized) await this.init();

    try {
      const columns = Object.keys(data);
      const values = Object.values(data);
      const placeholders = columns.map(() => '?').join(', ');
      
      const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
      
      this.db.run(sql, values);
      this.saveDatabase();

      return { error: null };
    } catch (error) {
      console.error('Insert error:', error);
      return { error: error.message };
    }
  }

  async select(table, options = {}) {
    if (!this.initialized) await this.init();

    try {
      let sql = `SELECT * FROM ${table}`;
      const params = [];

      // Add ORDER BY clause
      if (options.order) {
        const { column, ascending = false } = options.order;
        sql += ` ORDER BY ${column} ${ascending ? 'ASC' : 'DESC'}`;
      }

      // Add LIMIT clause
      if (options.limit) {
        sql += ` LIMIT ?`;
        params.push(options.limit);
      }

      const stmt = this.db.prepare(sql);
      const result = [];
      
      stmt.bind(params);
      while (stmt.step()) {
        const row = stmt.getAsObject();
        result.push(row);
      }
      stmt.free();

      return { data: result, error: null };
    } catch (error) {
      console.error('Select error:', error);
      return { data: null, error: error.message };
    }
  }

  // Supabase-compatible API methods
  from(table) {
    return {
      select: (columns = '*') => ({
        order: (column, options = {}) => ({
          limit: (limit) => this.select(table, { 
            order: { column, ascending: options.ascending },
            limit 
          })
        }),
        // Direct query without order
        limit: (limit) => this.select(table, { limit })
      }),
      insert: (data) => this.insert(table, Array.isArray(data) ? data[0] : data)
    };
  }
}

// Create a singleton instance
export const sqliteClient = new SQLiteClient();

// Initialize the database when the module is imported
sqliteClient.init().catch(console.error);
