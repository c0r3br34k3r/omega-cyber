// src/test_index.ts
import 'reflect-metadata'; // Required for TypeORM decorators
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { DataSource } from 'typeorm';
import { PythonShell } from 'python-shell';
import request from 'supertest';
import path from 'path';
import config from 'config';
import { Channel } from 'amqplib';

// --- Mock external dependencies before app import ---
jest.mock('amqplib', () => ({
  connect: jest.fn(() => ({
    createChannel: jest.fn(() => ({
      assertQueue: jest.fn(),
      consume: jest.fn(),
      ack: jest.fn(),
      close: jest.fn(),
    })),
    close: jest.fn(),
  })),
}));

jest.mock('python-shell', () => ({
  PythonShell: jest.fn().mockImplementation(() => ({
    on: jest.fn((event, callback) => {
      if (event === 'message') {
        callback('Mock Python Output'); // Simulate some output
      }
    }),
    end: jest.fn((callback) => callback(null, 0, null)), // Simulate successful exit
  })),
}));

// Import the application after mocks are set up
// We need to dynamically import here to avoid hoisting issues with jest.mock
const startApplication = async () => {
  // Mock the winston logger to suppress console output during tests
  jest.mock('winston', () => ({
    createLogger: jest.fn().mockReturnValue({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }),
    format: {
      combine: jest.fn(),
      timestamp: jest.fn(),
      errors: jest.fn(),
      splat: jest.fn(),
      json: jest.fn(),
      colorize: jest.fn(),
      simple: jest.fn(),
    },
    transports: {
      Console: jest.fn(),
      File: jest.fn(),
    },
  }));
  const appModule = await import('./index');
  return appModule;
};

// --- Test Setup ---
const PROTO_PATH = path.join(__dirname, '..', '..', 'proto', 'alert.proto');
let AppDataSource: DataSource;
let grpcClient: any;
let appInstance: any; // To hold the application's express instance for supertest

beforeAll(async () => {
  // Use test-specific config
  process.env.NODE_ENV = 'test';
  config.util.loadFileConfigs(path.resolve(__dirname, '..', 'config'));

  appInstance = await startApplication();

  // Initialize TypeORM Data Source for testing
  AppDataSource = new DataSource({
    type: 'sqlite', // Use SQLite for fast in-memory testing
    database: ':memory:',
    entities: [path.join(__dirname, 'entity', '**', '*.{js,ts}')],
    synchronize: true, // Auto-create schema for tests
    logging: false,
  });
  await AppDataSource.initialize();

  // Setup gRPC client
  const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  const deceptionProto: any = grpc.loadPackageDefinition(packageDefinition).deception;
  const grpcPort = config.get<number>('grpc.port');
  grpcClient = new deceptionProto.DeceptionService(
    `localhost:${grpcPort}`,
    grpc.credentials.createInsecure() // Insecure for local testing
  );
}, 30000); // Increased timeout for setup

afterAll(async () => {
  await AppDataSource.destroy();
  if (grpcClient) {
    grpcClient.close();
  }
  // No explicit app teardown needed if `index.ts` doesn't expose a close method for Express or gRPC,
  // but in a real app, it should be gracefully shut down. For now, rely on `jest --forceExit`.
});

describe('Deception Engine Microservice', () => {
  it('should respond to health check', async () => {
    const httpPort = config.get<number>('http.port');
    const res = await request(`http://localhost:${httpPort}`).get('/health');
    expect(res.statusCode).toEqual(200);
    expect(res.text).toEqual('Deception Engine is healthy.');
  });

  describe('gRPC DeceptionService', () => {
    it('should deploy a honeypot', (done) => {
      const honeypotId = `test-honeypot-${Date.now()}`;
      const request = { honeypot_id: honeypotId, honeypot_type: 'SSH', config: '{"port":22}' };
      grpcClient.deployHoneypot(request, (err: any, response: any) => {
        expect(err).toBeNull();
        expect(response.success).toBe(true);
        expect(response.message).toContain(honeypotId);
        // In a real test, you would query the DB to ensure honeypot was created
        done();
      });
    });

    it('should update a deception strategy', (done) => {
      const strategyName = 'adaptive-defense-v2';
      const request = { strategy_name: strategyName, config: '{"detection_threshold":0.8}' };
      grpcClient.updateDeceptionStrategy(request, (err: any, response: any) => {
        expect(err).toBeNull();
        expect(response.success).toBe(true);
        expect(response.message).toContain(strategyName);
        done();
      });
    });

    it('should stream deception events', (done) => {
      const call = grpcClient.getDeceptionEventsStream({});
      let receivedEvents = 0;
      const expectedEventCount = 2; // Expecting at least two events from the mocked stream

      call.on('data', (event: any) => {
        expect(event).toHaveProperty('id');
        expect(event).toHaveProperty('type');
        expect(event).toHaveProperty('timestamp');
        receivedEvents++;
        if (receivedEvents >= expectedEventCount) {
          call.cancel(); // Stop the stream after receiving enough data
        }
      });

      call.on('end', () => {
        expect(receivedEvents).toBeGreaterThanOrEqual(expectedEventCount);
        done();
      });

      call.on('error', (err: any) => {
        // gRPC streams can throw an ABORTED error when cancelled, which is expected
        if (err.code === grpc.status.CANCELLED) {
          return;
        }
        done(err);
      });
    });
  });

  describe('Python Script Integration', () => {
    it('should invoke the Python simulation processor', async () => {
      const mockChannel = (await jest.mocked(require('amqplib').connect)()).createChannel();
      const consumeCallback = jest.mocked(mockChannel.consume).mock.calls[0][1];
      
      // Simulate receiving a message from RabbitMQ that triggers Python script
      const mockMessage = {
        content: Buffer.from(JSON.stringify({ type: 'RUN_SIMULATION_SCENARIO', scenarioId: 'test-scenario' })),
      };
      await consumeCallback(mockMessage);

      // Verify PythonShell was called with correct arguments
      expect(PythonShell).toHaveBeenCalledWith(
        expect.stringContaining('simulation.py'),
        expect.objectContaining({
          args: ['--scenario', 'test-scenario'],
        })
      );
      expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
    });
  });
});
