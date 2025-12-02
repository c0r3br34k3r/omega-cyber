// src/index.ts
import 'reflect-metadata'; // Required for TypeORM decorators
import express from 'express';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { DataSource } from 'typeorm';
import { Channel, connect } from 'amqplib';
import config from 'config';
import { createLogger, format, transports } from 'winston';
import { PythonShell } from 'python-shell';
import { fileURLToPath } from 'url';
import path from 'path';

// --- Global Constants & Environment ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROTO_PATH = path.join(__dirname, '..', '..', 'proto', 'alert.proto'); // Adjust path as needed

// --- Logger Configuration ---
const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: 'deception-engine' },
  transports: [
    new transports.Console({
      format: format.combine(format.colorize(), format.simple()),
    }),
    new transports.File({ filename: 'logs/error.log', level: 'error' }),
    new transports.File({ filename: 'logs/combined.log' }),
  ],
});

// --- TypeORM Data Source (PostgreSQL example) ---
const AppDataSource = new DataSource({
  type: 'postgres',
  host: config.get<string>('db.host'),
  port: config.get<number>('db.port'),
  username: config.get<string>('db.user'),
  password: config.get<string>('db.pass'),
  database: config.get<string>('db.name'),
  synchronize: false, // Set to true for dev, false for prod and use migrations
  logging: ['error'],
  entities: [path.join(__dirname, 'entity', '**', '*.{js,ts}')],
  migrations: [path.join(__dirname, 'migration', '**', '*.{js,ts}')],
  subscribers: [path.join(__dirname, 'subscriber', '**', '*.{js,ts}')],
});

// --- gRPC Server Implementation (Placeholder) ---
// This would connect to the Omega Orchestration and Intelligence Core
interface IDeceptionService {
  deployHoneypot: (call: any, callback: grpc.sendUnaryData<any>) => void;
  updateDeceptionStrategy: (call: any, callback: grpc.sendUnaryData<any>) => void;
  getDeceptionEventsStream: (call: any) => void; // Server-side streaming
}

const deceptionService: IDeceptionService = {
  deployHoneypot: (call, callback) => {
    logger.info(`Received DeployHoneypot request for type: ${call.request.honeypot_type}`);
    // Implement actual honeypot deployment logic (e.g., via Docker/K8s API)
    callback(null, { success: true, message: `Honeypot ${call.request.honeypot_id} deployed.` });
  },
  updateDeceptionStrategy: (call, callback) => {
    logger.info(`Updating deception strategy: ${call.request.strategy_name}`);
    // Logic to update strategy in DB or propagate to running honeypots
    callback(null, { success: true, message: `Strategy ${call.request.strategy_name} updated.` });
  },
  getDeceptionEventsStream: (call) => {
    logger.info('Client subscribed to Deception Events Stream');
    // Implement logic to push real-time deception events to clients
    // For example, periodically send simulated events or actual detected interactions
    const interval = setInterval(() => {
      call.write({
        id: `evt-${Date.now()}`,
        type: 'HONEYPOT_INTERACTION',
        timestamp: Date.now(),
        description: `Simulated interaction on honeypot: ${Math.random().toFixed(4)}`,
        severity: Math.random() > 0.7 ? 1 : 0, // 0 for low, 1 for high
      });
    }, 5000); // Send an event every 5 seconds

    call.on('cancelled', () => {
      logger.info('Client unsubscribed from Deception Events Stream');
      clearInterval(interval);
    });
  },
};

// --- Python Simulation Runner ---
class PythonDeceptionProcessor {
  private scriptPath: string;

  constructor(scriptName: string) {
    this.scriptPath = path.join(__dirname, scriptName);
  }

  async runSimulation(args: string[]): Promise<string> {
    logger.info(`Invoking Python simulation: ${this.scriptPath} with args: ${args.join(' ')}`);
    return new Promise((resolve, reject) => {
      const pyshell = new PythonShell(this.scriptPath, {
        mode: 'text',
        pythonOptions: ['-u'], // get real-time output
        args: args,
      });

      let output = '';
      pyshell.on('message', (message) => {
        logger.debug(`Python output: ${message}`);
        output += message + '\n';
      });

      pyshell.end((err, code, signal) => {
        if (err) {
          logger.error(`Python script error: ${err.message}`);
          return reject(err);
        }
        logger.info(`Python script finished with code ${code}, signal ${signal}`);
        resolve(output);
      });
    });
  }
}
const pythonDeception = new PythonDeceptionProcessor('simulation.py');


// --- Main Application Start ---
async function startApplication() {
  try {
    // 1. Initialize Database
    await AppDataSource.initialize();
    logger.info('Database connection established successfully.');

    // 2. Setup gRPC Server
    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    const deceptionProto: any = grpc.loadPackageDefinition(packageDefinition).deception;
    const grpcServer = new grpc.Server();
    grpcServer.addService(deceptionProto.DeceptionService.service, deceptionService);
    const grpcPort = config.get<number>('grpc.port');
    grpcServer.bindAsync(
      `0.0.0.0:${grpcPort}`,
      grpc.ServerCredentials.createInsecure(), // Use secure credentials in production
      (err, port) => {
        if (err) {
          logger.error(`Failed to bind gRPC server: ${err.message}`);
          throw err;
        }
        grpcServer.start();
        logger.info(`gRPC server listening on port ${port}`);
      }
    );

    // 3. Setup Express for health checks and meta-management
    const app = express();
    app.use(express.json());
    app.get('/health', (req, res) => res.status(200).send('Deception Engine is healthy.'));
    const httpPort = config.get<number>('http.port');
    app.listen(httpPort, () => {
      logger.info(`Express HTTP server listening on port ${httpPort}`);
    });

    // 4. Connect to RabbitMQ (AMQP) for message bus integration
    let rabbitMQChannel: Channel | null = null;
    try {
      const connection = await connect(config.get<string>('rabbitmq.url'));
      rabbitMQChannel = await connection.createChannel();
      await rabbitMQChannel.assertQueue('deception_tasks', { durable: true });
      rabbitMQChannel.consume('deception_tasks', async (msg) => {
        if (msg) {
          const task = JSON.parse(msg.content.toString());
          logger.info(`Received deception task: ${task.type}`);
          // Example: run a Python script based on the task
          if (task.type === 'RUN_SIMULATION_SCENARIO') {
            try {
              const pythonOutput = await pythonDeception.runSimulation(['--scenario', task.scenarioId]);
              logger.info(`Python simulation output: ${pythonOutput}`);
            } catch (pyErr) {
              logger.error(`Python simulation failed: ${pyErr}`);
            }
          }
          rabbitMQChannel?.ack(msg);
        }
      });
      logger.info('Connected to RabbitMQ and consuming deception_tasks queue.');
    } catch (amqpErr: any) {
      logger.error(`Failed to connect to RabbitMQ: ${amqpErr.message}`);
    }


    // --- Graceful Shutdown ---
    const gracefulShutdown = async () => {
      logger.info('Initiating graceful shutdown...');
      grpcServer.forceShutdown();
      await AppDataSource.destroy();
      await rabbitMQChannel?.close();
      logger.info('Deception Engine gracefully shut down.');
      process.exit(0);
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

  } catch (error: any) {
    logger.error(`Application failed to start: ${error.message}`, error);
    process.exit(1);
  }
}

startApplication();
