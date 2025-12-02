import React, { useEffect, useRef } from 'react';
import { Box, Paper, Typography, Chip } from '@mui/material';
import { Header } from '../layout/Header';

// --- Shader Code (WGSL - WebGPU Shading Language) ---
// This code runs directly on the GPU.

const computeShaderCode = `
  struct Particle {
    pos: vec2<f32>,
    vel: vec2<f32>,
  };

  struct SimulationState {
    // 0: normal, 1: anomaly
    is_anomaly: u32,
  };

  @group(0) @binding(0) var<storage, read> particles_in: array<Particle>;
  @group(0) @binding(1) var<storage, read_write> particles_out: array<Particle>;
  @group(0) @binding(2) var<storage, read_write> state_out: array<SimulationState>;

  // A simple function to detect an "anomaly"
  fn is_out_of_bounds(pos: vec2<f32>) -> bool {
    // Anomaly if particle is in the center-left quadrant
    return pos.x < 0.0 && pos.x > -0.5 && pos.y < 0.5 && pos.y > -0.5;
  }

  @compute @workgroup_size(64)
  fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    var particle_in = particles_in[index];

    // Update position
    var new_pos = particle_in.pos + particle_in.vel;

    // Boundary checks
    if (new_pos.x > 1.0 || new_pos.x < -1.0) { new_pos.x = -new_pos.x; }
    if (new_pos.y > 1.0 || new_pos.y < -1.0) { new_pos.y = -new_pos.y; }

    particles_out[index].pos = new_pos;
    particles_out[index].vel = particle_in.vel;
    
    // Anomaly detection logic on the GPU
    if (is_out_of_bounds(new_pos)) {
      state_out[index].is_anomaly = 1u;
    } else {
      state_out[index].is_anomaly = 0u;
    }
  }
`;

const renderShaderCode = `
  struct Particle {
    pos: vec2<f32>,
  };
  struct SimulationState {
    is_anomaly: u32,
  };

  @group(0) @binding(0) var<storage, read> particles: array<Particle>;
  @group(0) @binding(1) var<storage, read> states: array<SimulationState>;

  let NORMAL_COLOR = vec4<f32>(0.2, 0.5, 1.0, 0.7);
  let ANOMALY_COLOR = vec4<f32>(1.0, 0.1, 0.3, 1.0);

  @vertex
  fn vs_main(@builtin(vertex_index) vertex_index: u32) -> @builtin(position) vec4<f32> {
    let particle_index = vertex_index / 6u;
    let particle_pos = particles[particle_index].pos;
    
    // Render particles as simple squares
    let corners = array<vec2<f32>, 6>(
      vec2<f32>(-0.005, -0.005), vec2<f32>(0.005, -0.005), vec2<f32>(0.005, 0.005),
      vec2<f32>(-0.005, -0.005), vec2<f32>(0.005, 0.005), vec2<f32>(-0.005, 0.005)
    );

    return vec4<f32>(particle_pos + corners[vertex_index % 6u], 0.0, 1.0);
  }

  @fragment
  fn fs_main(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
    // This is a simplified example; a real implementation would pass the particle index
    // from the vertex shader to the fragment shader. For this PoC, we determine color
    // based on position to match the compute shader's logic.
    if (pos.x < 0.0 && pos.x > -0.5 && pos.y < 0.5 && pos.y > -0.5) {
        return ANOMALY_COLOR;
    }
    return NORMAL_COLOR;
  }
`;

// --- Main Component ---
const WebGPUIntegrationConcept: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    if (!navigator.gpu) {
      setIsSupported(false);
      return;
    }

    const initWebGPU = async () => {
      const canvas = canvasRef.current!;
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) return;
      const device = await adapter.requestDevice();
      const context = canvas.getContext('webgpu')!;
      const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
      context.configure({ device, format: presentationFormat });

      // Create shaders
      const computeModule = device.createShaderModule({ code: computeShaderCode });
      const renderModule = device.createShaderModule({ code: renderShaderCode });

      const numParticles = 50000;
      const particleData = new Float32Array(numParticles * 4); // pos(2), vel(2)
      for (let i = 0; i < numParticles; i++) {
        particleData[i * 4 + 0] = (Math.random() - 0.5) * 2; // pos.x
        particleData[i * 4 + 1] = (Math.random() - 0.5) * 2; // pos.y
        particleData[i * 4 + 2] = (Math.random() - 0.5) * 0.01; // vel.x
        particleData[i * 4 + 3] = (Math.random() - 0.5) * 0.01; // vel.y
      }
      
      // Create buffers
      const particleBufferIn = device.createBuffer({ size: particleData.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
      device.queue.writeBuffer(particleBufferIn, 0, particleData);
      const particleBufferOut = device.createBuffer({ size: particleData.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX });
      const stateBuffer = device.createBuffer({ size: numParticles * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX });

      // Create pipelines
      const computePipeline = device.createComputePipeline({ layout: 'auto', compute: { module: computeModule, entryPoint: 'main' } });
      const renderPipeline = device.createRenderPipeline({ layout: 'auto', vertex: { module: renderModule, entryPoint: 'vs_main' }, fragment: { module: renderModule, entryPoint: 'fs_main', targets: [{ format: presentationFormat }] } });

      const computeBindGroupIn = device.createBindGroup({ layout: computePipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: particleBufferIn } }, { binding: 1, resource: { buffer: particleBufferOut } }, { binding: 2, resource: { buffer: stateBuffer } }] });
      const computeBindGroupOut = device.createBindGroup({ layout: computePipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: particleBufferOut } }, { binding: 1, resource: { buffer: particleBufferIn } }, { binding: 2, resource: { buffer: stateBuffer } }] });
      const renderBindGroup = device.createBindGroup({ layout: renderPipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: particleBufferOut } }, { binding: 1, resource: { buffer: stateBuffer } }] });

      let frame = 0;
      function animationFrame() {
        const commandEncoder = device.createCommandEncoder();
        
        // Compute Pass
        const computePass = commandEncoder.beginComputePass();
        computePass.setPipeline(computePipeline);
        computePass.setBindGroup(0, frame % 2 === 0 ? computeBindGroupIn : computeBindGroupOut);
        computePass.dispatchWorkgroups(Math.ceil(numParticles / 64));
        computePass.end();

        // Render Pass
        const renderPass = commandEncoder.beginRenderPass({ colorAttachments: [{ view: context.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0.02, g: 0.04, b: 0.1, a: 1.0 } }] });
        renderPass.setPipeline(renderPipeline);
        renderPass.setBindGroup(0, renderBindGroup);
        renderPass.draw(numParticles * 6, 1, 0, 0);
        renderPass.end();
        
        device.queue.submit([commandEncoder.finish()]);
        
        frame++;
        requestAnimationFrame(animationFrame);
      }
      requestAnimationFrame(animationFrame);
    };

    initWebGPU();
  }, []);

  return (
    <Box className="h-full flex flex-col p-4 space-y-4">
      <Header title="WebGPU Integration Concept" description="Proof-of-concept for client-side, GPU-accelerated data processing." />
      <Paper className="card flex-grow flex flex-col">
        <Typography variant="h6">GPU-Accelerated Anomaly Detection</Typography>
        <Typography variant="body2" color="text.secondary" className="mb-2">
          This demo uses a WebGPU <strong>Compute Shader</strong> to simulate {`50,000`} data points and detect anomalies in real-time, entirely on the GPU.
          Normal points are blue; anomalous points (in the center-left quadrant) are flagged red. This offloads heavy computation from the CPU, enabling analysis of massive datasets in the browser.
        </Typography>
        <Box className="flex-grow w-full h-full relative border border-border rounded-lg mt-2">
          {!isSupported && <Typography color="error">WebGPU is not supported on this browser.</Typography>}
          <canvas ref={canvasRef} className="w-full h-full" width={1000} height={600}></canvas>
        </Box>
      </Paper>
    </Box>
  );
};

export default WebGPUIntegrationConcept;
