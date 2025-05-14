import { Client } from "pg";
import { config } from "dotenv";

// Load environment variables
config();

// Database configuration
const DB_CONFIG = {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || "5432"),
    ssl: {
        rejectUnauthorized: false,
    },
};

/**
 * Singleton database service that manages the PostgreSQL client connection
 */
class DatabaseService {
    private static instance: DatabaseService;
    private client: Client | null = null;
    private isConnected = false;

    private constructor() {}

    public static getInstance(): DatabaseService {
        if (!DatabaseService.instance) {
            DatabaseService.instance = new DatabaseService();
        }
        return DatabaseService.instance;
    }

    /**
     * Get the database client, creating a connection if necessary
     */
    public async getClient(): Promise<Client> {
        if (!this.client) {
            this.client = new Client(DB_CONFIG);
        }

        if (!this.isConnected) {
            try {
                console.log("Connecting to the database...");
                await this.client.connect();
                this.isConnected = true;
                console.log("Successfully connected to the database.");
            } catch (error) {
                console.error(`Failed to connect to database: ${error}`);
                throw error;
            }
        }

        return this.client;
    }

    /**
     * Execute a query and return the result
     */
    public async query(text: string, params: any[] = []): Promise<any> {
        const client = await this.getClient();
        return client.query(text, params);
    }

    /**
     * Close the database connection
     */
    public async disconnect(): Promise<void> {
        if (this.client && this.isConnected) {
            console.log("Closing database connection...");
            await this.client.end();
            this.isConnected = false;
            this.client = null;
            console.log("Database connection closed.");
        }
    }
}

export const dbService = DatabaseService.getInstance();
