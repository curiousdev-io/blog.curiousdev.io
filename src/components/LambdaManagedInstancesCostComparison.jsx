import React, { useState, useMemo } from 'react';

// ============================================
// PRICING CONSTANTS
// ============================================
const LAMBDA_REQUEST_COST = 0.20 / 1_000_000;
const MANAGEMENT_FEE = 0.15;

// Lambda GB-second pricing varies by region (x86)
const LAMBDA_GB_SECOND_PRICING = {
  'us-east-1': 0.0000166667,
  'us-east-2': 0.0000166667,
  'us-west-2': 0.0000166667,
  'eu-west-1': 0.0000166667,
  'eu-central-1': 0.0000177800,
  'ap-northeast-1': 0.0000166667,
  'ap-southeast-1': 0.0000166667,
  'ap-southeast-2': 0.0000166667,
};

// Comprehensive EC2 instance pricing by region
// Data sources: AWS Pricing pages, instances.vantage.sh
// Savings Plan prices assume 72% discount (3-year Compute Savings Plan)
const REGIONS = {
  'us-east-1': { name: 'US East (N. Virginia)', multiplier: 1.0 },
  'us-east-2': { name: 'US East (Ohio)', multiplier: 1.0 },
  'us-west-2': { name: 'US West (Oregon)', multiplier: 1.0 },
  'eu-west-1': { name: 'EU (Ireland)', multiplier: 1.08 },
  'eu-central-1': { name: 'EU (Frankfurt)', multiplier: 1.12 },
  'ap-northeast-1': { name: 'Asia Pacific (Tokyo)', multiplier: 1.15 },
  'ap-southeast-1': { name: 'Asia Pacific (Singapore)', multiplier: 1.10 },
  'ap-southeast-2': { name: 'Asia Pacific (Sydney)', multiplier: 1.12 },
};

// Base pricing for us-east-1 (On-Demand Linux)
// Only "large" and above sizes are supported for Lambda Managed Instances
const EC2_BASE_PRICING = {
  // General Purpose - M Family (Graviton)
  'm7g.large':    { vcpu: 2,  memory: 8,   price: 0.0816, family: 'General Purpose', arch: 'arm64' },
  'm7g.xlarge':   { vcpu: 4,  memory: 16,  price: 0.1632, family: 'General Purpose', arch: 'arm64' },
  'm7g.2xlarge':  { vcpu: 8,  memory: 32,  price: 0.3264, family: 'General Purpose', arch: 'arm64' },
  'm7g.4xlarge':  { vcpu: 16, memory: 64,  price: 0.6528, family: 'General Purpose', arch: 'arm64' },
  'm7g.8xlarge':  { vcpu: 32, memory: 128, price: 1.3056, family: 'General Purpose', arch: 'arm64' },
  'm7g.12xlarge': { vcpu: 48, memory: 192, price: 1.9584, family: 'General Purpose', arch: 'arm64' },
  'm7g.16xlarge': { vcpu: 64, memory: 256, price: 2.6112, family: 'General Purpose', arch: 'arm64' },
  
  // General Purpose - M Family (Intel)
  'm7i.large':    { vcpu: 2,  memory: 8,   price: 0.1008, family: 'General Purpose', arch: 'x86_64' },
  'm7i.xlarge':   { vcpu: 4,  memory: 16,  price: 0.2016, family: 'General Purpose', arch: 'x86_64' },
  'm7i.2xlarge':  { vcpu: 8,  memory: 32,  price: 0.4032, family: 'General Purpose', arch: 'x86_64' },
  'm7i.4xlarge':  { vcpu: 16, memory: 64,  price: 0.8064, family: 'General Purpose', arch: 'x86_64' },
  'm7i.8xlarge':  { vcpu: 32, memory: 128, price: 1.6128, family: 'General Purpose', arch: 'x86_64' },
  'm7i.12xlarge': { vcpu: 48, memory: 192, price: 2.4192, family: 'General Purpose', arch: 'x86_64' },
  'm7i.16xlarge': { vcpu: 64, memory: 256, price: 3.2256, family: 'General Purpose', arch: 'x86_64' },

  // General Purpose - M Family (AMD)
  'm7a.large':    { vcpu: 2,  memory: 8,   price: 0.1157, family: 'General Purpose', arch: 'x86_64' },
  'm7a.xlarge':   { vcpu: 4,  memory: 16,  price: 0.2314, family: 'General Purpose', arch: 'x86_64' },
  'm7a.2xlarge':  { vcpu: 8,  memory: 32,  price: 0.4627, family: 'General Purpose', arch: 'x86_64' },
  'm7a.4xlarge':  { vcpu: 16, memory: 64,  price: 0.9254, family: 'General Purpose', arch: 'x86_64' },
  'm7a.8xlarge':  { vcpu: 32, memory: 128, price: 1.8509, family: 'General Purpose', arch: 'x86_64' },
  'm7a.12xlarge': { vcpu: 48, memory: 192, price: 2.7763, family: 'General Purpose', arch: 'x86_64' },
  'm7a.16xlarge': { vcpu: 64, memory: 256, price: 3.7018, family: 'General Purpose', arch: 'x86_64' },

  // Compute Optimized - C Family (Graviton)
  'c7g.large':    { vcpu: 2,  memory: 4,   price: 0.0725, family: 'Compute Optimized', arch: 'arm64' },
  'c7g.xlarge':   { vcpu: 4,  memory: 8,   price: 0.1450, family: 'Compute Optimized', arch: 'arm64' },
  'c7g.2xlarge':  { vcpu: 8,  memory: 16,  price: 0.2900, family: 'Compute Optimized', arch: 'arm64' },
  'c7g.4xlarge':  { vcpu: 16, memory: 32,  price: 0.5800, family: 'Compute Optimized', arch: 'arm64' },
  'c7g.8xlarge':  { vcpu: 32, memory: 64,  price: 1.1600, family: 'Compute Optimized', arch: 'arm64' },
  'c7g.12xlarge': { vcpu: 48, memory: 96,  price: 1.7400, family: 'Compute Optimized', arch: 'arm64' },
  'c7g.16xlarge': { vcpu: 64, memory: 128, price: 2.3200, family: 'Compute Optimized', arch: 'arm64' },

  // Compute Optimized - C Family (Intel)
  'c7i.large':    { vcpu: 2,  memory: 4,   price: 0.0893, family: 'Compute Optimized', arch: 'x86_64' },
  'c7i.xlarge':   { vcpu: 4,  memory: 8,   price: 0.1785, family: 'Compute Optimized', arch: 'x86_64' },
  'c7i.2xlarge':  { vcpu: 8,  memory: 16,  price: 0.3570, family: 'Compute Optimized', arch: 'x86_64' },
  'c7i.4xlarge':  { vcpu: 16, memory: 32,  price: 0.7140, family: 'Compute Optimized', arch: 'x86_64' },
  'c7i.8xlarge':  { vcpu: 32, memory: 64,  price: 1.4280, family: 'Compute Optimized', arch: 'x86_64' },
  'c7i.12xlarge': { vcpu: 48, memory: 96,  price: 2.1420, family: 'Compute Optimized', arch: 'x86_64' },
  'c7i.16xlarge': { vcpu: 64, memory: 128, price: 2.8560, family: 'Compute Optimized', arch: 'x86_64' },

  // Compute Optimized - C Family (AMD)
  'c7a.large':    { vcpu: 2,  memory: 4,   price: 0.1025, family: 'Compute Optimized', arch: 'x86_64' },
  'c7a.xlarge':   { vcpu: 4,  memory: 8,   price: 0.2051, family: 'Compute Optimized', arch: 'x86_64' },
  'c7a.2xlarge':  { vcpu: 8,  memory: 16,  price: 0.4102, family: 'Compute Optimized', arch: 'x86_64' },
  'c7a.4xlarge':  { vcpu: 16, memory: 32,  price: 0.8203, family: 'Compute Optimized', arch: 'x86_64' },
  'c7a.8xlarge':  { vcpu: 32, memory: 64,  price: 1.6406, family: 'Compute Optimized', arch: 'x86_64' },
  'c7a.12xlarge': { vcpu: 48, memory: 96,  price: 2.4610, family: 'Compute Optimized', arch: 'x86_64' },
  'c7a.16xlarge': { vcpu: 64, memory: 128, price: 3.2813, family: 'Compute Optimized', arch: 'x86_64' },

  // Memory Optimized - R Family (Graviton)
  'r7g.large':    { vcpu: 2,  memory: 16,  price: 0.1071, family: 'Memory Optimized', arch: 'arm64' },
  'r7g.xlarge':   { vcpu: 4,  memory: 32,  price: 0.2142, family: 'Memory Optimized', arch: 'arm64' },
  'r7g.2xlarge':  { vcpu: 8,  memory: 64,  price: 0.4284, family: 'Memory Optimized', arch: 'arm64' },
  'r7g.4xlarge':  { vcpu: 16, memory: 128, price: 0.8568, family: 'Memory Optimized', arch: 'arm64' },
  'r7g.8xlarge':  { vcpu: 32, memory: 256, price: 1.7136, family: 'Memory Optimized', arch: 'arm64' },
  'r7g.12xlarge': { vcpu: 48, memory: 384, price: 2.5704, family: 'Memory Optimized', arch: 'arm64' },
  'r7g.16xlarge': { vcpu: 64, memory: 512, price: 3.4272, family: 'Memory Optimized', arch: 'arm64' },

  // Memory Optimized - R Family (Intel)
  'r7i.large':    { vcpu: 2,  memory: 16,  price: 0.1323, family: 'Memory Optimized', arch: 'x86_64' },
  'r7i.xlarge':   { vcpu: 4,  memory: 32,  price: 0.2646, family: 'Memory Optimized', arch: 'x86_64' },
  'r7i.2xlarge':  { vcpu: 8,  memory: 64,  price: 0.5292, family: 'Memory Optimized', arch: 'x86_64' },
  'r7i.4xlarge':  { vcpu: 16, memory: 128, price: 1.0584, family: 'Memory Optimized', arch: 'x86_64' },
  'r7i.8xlarge':  { vcpu: 32, memory: 256, price: 2.1168, family: 'Memory Optimized', arch: 'x86_64' },
  'r7i.12xlarge': { vcpu: 48, memory: 384, price: 3.1752, family: 'Memory Optimized', arch: 'x86_64' },
  'r7i.16xlarge': { vcpu: 64, memory: 512, price: 4.2336, family: 'Memory Optimized', arch: 'x86_64' },

  // Memory Optimized - R Family (AMD)
  'r7a.large':    { vcpu: 2,  memory: 16,  price: 0.1516, family: 'Memory Optimized', arch: 'x86_64' },
  'r7a.xlarge':   { vcpu: 4,  memory: 32,  price: 0.3032, family: 'Memory Optimized', arch: 'x86_64' },
  'r7a.2xlarge':  { vcpu: 8,  memory: 64,  price: 0.6063, family: 'Memory Optimized', arch: 'x86_64' },
  'r7a.4xlarge':  { vcpu: 16, memory: 128, price: 1.2126, family: 'Memory Optimized', arch: 'x86_64' },
  'r7a.8xlarge':  { vcpu: 32, memory: 256, price: 2.4253, family: 'Memory Optimized', arch: 'x86_64' },
  'r7a.12xlarge': { vcpu: 48, memory: 384, price: 3.6379, family: 'Memory Optimized', arch: 'x86_64' },
  'r7a.16xlarge': { vcpu: 64, memory: 512, price: 4.8506, family: 'Memory Optimized', arch: 'x86_64' },
};

// IMPORTANT: Lambda Managed Instances minimum function size is 2GB memory, 1 vCPU
const MIN_MANAGED_MEMORY_MB = 2048;
const MEMORY_CONFIGS = [128, 256, 512, 768, 1024, 1536, 2048, 3008, 4096, 5120, 6144, 7168, 8192, 10240];
const MANAGED_MEMORY_CONFIGS = MEMORY_CONFIGS.filter(m => m >= MIN_MANAGED_MEMORY_MB);
const DURATION_OPTIONS = [50, 100, 150, 200, 300, 500, 750, 1000, 1500, 2000, 3000, 5000];

const COLORS = {
  lambda: '#FF6B35',
  managedOnDemand: '#2EC4B6',
  managedSavings: '#6366f1',
  breakeven: '#E71D36',
  grid: '#334155',
  text: '#94a3b8',
  background: '#1e293b',
};

// ============================================
// STYLES
// ============================================
const styles = {
  container: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    backgroundColor: '#0f172a',
    color: '#f1f5f9',
    padding: '24px',
    borderRadius: '12px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    marginBottom: '8px',
    color: '#f1f5f9',
  },
  subtitle: {
    fontSize: '14px',
    color: '#94a3b8',
    marginBottom: '24px',
  },
  controlsContainer: {
    backgroundColor: '#1e293b',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '24px',
  },
  controlsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '16px',
  },
  controlGroup: {
    display: 'flex',
    flexDirection: 'column',
  },
  label: {
    fontSize: '12px',
    color: '#94a3b8',
    marginBottom: '4px',
  },
  select: {
    backgroundColor: '#334155',
    color: '#f1f5f9',
    border: 'none',
    borderRadius: '4px',
    padding: '8px 12px',
    fontSize: '14px',
    cursor: 'pointer',
  },
  chartContainer: {
    backgroundColor: '#1e293b',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '24px',
  },
  chartTitle: {
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '16px',
    color: '#f1f5f9',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '12px',
    marginBottom: '16px',
    padding: '12px',
    backgroundColor: '#0f172a',
    borderRadius: '6px',
  },
  statItem: {
    fontSize: '13px',
  },
  statLabel: {
    color: '#94a3b8',
  },
  statValue: {
    fontWeight: 'bold',
    marginLeft: '8px',
  },
  legend: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px',
    marginTop: '12px',
    justifyContent: 'center',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
  },
  legendColor: {
    width: '16px',
    height: '3px',
    borderRadius: '2px',
  },
  heatmapContainer: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '12px',
  },
  th: {
    padding: '8px',
    textAlign: 'center',
    color: '#94a3b8',
    fontWeight: '500',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '8px',
    textAlign: 'center',
    fontFamily: 'monospace',
    color: '#f1f5f9',
    fontWeight: '500',
  },
  tdLabel: {
    textAlign: 'left',
    fontWeight: '500',
    color: '#f1f5f9',
    whiteSpace: 'nowrap',
  },
  insights: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '16px',
  },
  insightCard: {
    backgroundColor: '#334155',
    borderRadius: '8px',
    padding: '16px',
  },
  insightTitle: {
    fontWeight: '600',
    marginBottom: '10px',
    fontSize: '14px',
  },
  insightList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    fontSize: '13px',
    color: '#cbd5e1',
    lineHeight: '1.8',
  },
  footer: {
    fontSize: '11px',
    color: '#64748b',
    textAlign: 'center',
    marginTop: '16px',
  },
  warning: {
    backgroundColor: '#422006',
    border: '1px solid #f97316',
    borderRadius: '6px',
    padding: '12px',
    marginBottom: '16px',
    fontSize: '13px',
    color: '#fed7aa',
  },
  instanceInfo: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '8px',
    backgroundColor: '#0f172a',
    borderRadius: '6px',
    padding: '12px',
    marginBottom: '16px',
    fontSize: '12px',
  },
  instanceInfoItem: {
    display: 'flex',
    flexDirection: 'column',
  },
  instanceInfoLabel: {
    color: '#64748b',
    fontSize: '11px',
  },
  instanceInfoValue: {
    color: '#f1f5f9',
    fontWeight: '500',
  },
  tabContainer: {
    display: 'flex',
    gap: '4px',
    marginBottom: '16px',
    flexWrap: 'wrap',
  },
  tab: {
    padding: '8px 16px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    border: 'none',
    transition: 'all 0.2s',
  },
  tabActive: {
    backgroundColor: '#6366f1',
    color: '#fff',
  },
  tabInactive: {
    backgroundColor: '#334155',
    color: '#94a3b8',
  },
};

// ============================================
// UTILITY FUNCTIONS
// ============================================
const formatCurrency = (value) => {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  return `$${value.toFixed(3)}`;
};

const formatInvocations = (value) => {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toString();
};

const getInstancePrice = (instanceType, region) => {
  const baseInstance = EC2_BASE_PRICING[instanceType];
  const regionData = REGIONS[region];
  return baseInstance.price * regionData.multiplier;
};

const getLambdaGbSecondPrice = (region) => {
  return LAMBDA_GB_SECOND_PRICING[region] || LAMBDA_GB_SECOND_PRICING['us-east-1'];
};

const calcLambdaCost = (invocations, memoryMB, durationMs, region) => {
  const memoryGB = memoryMB / 1024;
  const durationSeconds = durationMs / 1000;
  const gbSeconds = invocations * memoryGB * durationSeconds;
  const gbSecondPrice = getLambdaGbSecondPrice(region);
  return (invocations * LAMBDA_REQUEST_COST) + (gbSeconds * gbSecondPrice);
};

const calcManagedInstancesCost = (invocations, instanceType, instanceCount, region, useSavingsPlans = false) => {
  const onDemandPrice = getInstancePrice(instanceType, region);
  const hoursPerMonth = 730;
  const savingsDiscount = 0.72; // 72% savings with 3-year Compute Savings Plan
  const hourlyRate = useSavingsPlans ? onDemandPrice * (1 - savingsDiscount) : onDemandPrice;
  const managementFee = onDemandPrice * MANAGEMENT_FEE; // Always based on on-demand price
  const ec2Cost = instanceCount * (hourlyRate + managementFee) * hoursPerMonth;
  const requestCost = invocations * LAMBDA_REQUEST_COST;
  return ec2Cost + requestCost;
};

const estimateRequiredInstances = (invocationsPerMonth, instanceType, memoryMB, durationMs, multiConcurrency = 10) => {
  const instance = EC2_BASE_PRICING[instanceType];
  const invocationsPerSecond = invocationsPerMonth / (730 * 3600);
  const durationSeconds = durationMs / 1000;
  
  // CPU-based capacity
  const requestsPerVcpuPerSecond = (multiConcurrency / durationSeconds) * 0.7;
  const totalCapacityPerInstance = instance.vcpu * requestsPerVcpuPerSecond;
  
  // Memory-based capacity (85% usable memory)
  const memoryGB = memoryMB / 1024;
  const environmentsPerInstance = Math.floor((instance.memory * 0.85) / memoryGB);
  const memoryBasedCapacity = environmentsPerInstance * multiConcurrency / durationSeconds;
  
  const effectiveCapacity = Math.min(totalCapacityPerInstance, memoryBasedCapacity);
  return Math.max(1, Math.ceil(invocationsPerSecond / effectiveCapacity));
};

const findBreakeven = (memoryMB, durationMs, instanceType, region, useSavingsPlans) => {
  // For memory below minimum, Managed Instances not applicable
  if (memoryMB < MIN_MANAGED_MEMORY_MB) {
    return Infinity;
  }
  
  let low = 100_000;
  let high = 2_000_000_000;
  
  while (high - low > 10000) {
    const mid = Math.floor((low + high) / 2);
    const lambdaCost = calcLambdaCost(mid, memoryMB, durationMs, region);
    const instanceCount = estimateRequiredInstances(mid, instanceType, memoryMB, durationMs);
    const managedCost = calcManagedInstancesCost(mid, instanceType, instanceCount, region, useSavingsPlans);
    
    if (managedCost < lambdaCost) {
      high = mid;
    } else {
      low = mid;
    }
  }
  
  return Math.round((low + high) / 2);
};

// ============================================
// TOOLTIP STYLES
// ============================================
const tooltipStyles = {
  container: {
    position: 'absolute',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    border: '1px solid #475569',
    borderRadius: '6px',
    padding: '10px 12px',
    fontSize: '12px',
    color: '#f1f5f9',
    pointerEvents: 'none',
    zIndex: 100,
    minWidth: '180px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  },
  title: {
    fontWeight: '600',
    marginBottom: '8px',
    color: '#e2e8f0',
    borderBottom: '1px solid #334155',
    paddingBottom: '6px',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
  },
  label: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  value: {
    fontWeight: '600',
    fontFamily: 'monospace',
  },
};

// ============================================
// LINE CHART COMPONENT (SVG) WITH TOOLTIPS
// ============================================
const LineChart = ({ data, height = 300 }) => {
  const [hoverData, setHoverData] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = React.useRef(null);
  
  const width = 700;
  const margin = { top: 20, right: 30, bottom: 40, left: 70 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const xMin = Math.min(...data.map(d => d.invocations));
  const xMax = Math.max(...data.map(d => d.invocations));
  const yValues = data.flatMap(d => [d.lambdaCost, d.managedOnDemand, d.managedSavings]);
  const yMin = Math.max(0.1, Math.min(...yValues.filter(v => v > 0)));
  const yMax = Math.max(...yValues);

  const logScale = (value, min, max, range) => {
    if (value <= 0) return 0;
    const logMin = Math.log10(min);
    const logMax = Math.log10(max);
    const logValue = Math.log10(value);
    return ((logValue - logMin) / (logMax - logMin)) * range;
  };

  const inverseLogScale = (pixel, min, max, range) => {
    const logMin = Math.log10(min);
    const logMax = Math.log10(max);
    const logValue = (pixel / range) * (logMax - logMin) + logMin;
    return Math.pow(10, logValue);
  };

  const xScale = (value) => logScale(value, xMin, xMax, innerWidth);
  const yScale = (value) => innerHeight - logScale(value, yMin, yMax, innerHeight);

  const createPath = (key) => {
    const validData = data.filter(d => d[key] > 0);
    if (validData.length === 0) return '';
    return validData.map((d, i) => {
      const x = margin.left + xScale(d.invocations);
      const y = margin.top + yScale(d[key]);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  };

  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * width;
    const svgY = ((e.clientY - rect.top) / rect.height) * height;
    
    // Check if within chart area
    if (svgX < margin.left || svgX > width - margin.right) {
      setHoverData(null);
      return;
    }
    
    const chartX = svgX - margin.left;
    const invocations = inverseLogScale(chartX, xMin, xMax, innerWidth);
    
    // Find nearest data point
    let nearest = data[0];
    let minDist = Math.abs(Math.log10(data[0].invocations) - Math.log10(invocations));
    for (const d of data) {
      const dist = Math.abs(Math.log10(d.invocations) - Math.log10(invocations));
      if (dist < minDist) {
        minDist = dist;
        nearest = d;
      }
    }
    
    setHoverData(nearest);
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleMouseLeave = () => {
    setHoverData(null);
  };

  const xTicks = [100_000, 1_000_000, 10_000_000, 100_000_000, 1_000_000_000];
  const yTicks = [1, 10, 100, 1000, 10000];

  const hoverX = hoverData ? margin.left + xScale(hoverData.invocations) : 0;

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <svg 
        viewBox={`0 0 ${width} ${height}`} 
        style={{ width: '100%', maxWidth: '700px', cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Grid lines */}
        {yTicks.filter(t => t >= yMin && t <= yMax).map(tick => (
          <line
            key={`y-${tick}`}
            x1={margin.left}
            x2={width - margin.right}
            y1={margin.top + yScale(tick)}
            y2={margin.top + yScale(tick)}
            stroke={COLORS.grid}
            strokeOpacity={0.3}
            strokeDasharray="4,4"
          />
        ))}
        
        {xTicks.filter(t => t >= xMin && t <= xMax).map(tick => (
          <line
            key={`x-${tick}`}
            x1={margin.left + xScale(tick)}
            x2={margin.left + xScale(tick)}
            y1={margin.top}
            y2={height - margin.bottom}
            stroke={COLORS.grid}
            strokeOpacity={0.3}
            strokeDasharray="4,4"
          />
        ))}

        {/* Lines */}
        <path d={createPath('lambdaCost')} fill="none" stroke={COLORS.lambda} strokeWidth={2.5} />
        <path d={createPath('managedOnDemand')} fill="none" stroke={COLORS.managedOnDemand} strokeWidth={2.5} />
        <path d={createPath('managedSavings')} fill="none" stroke={COLORS.managedSavings} strokeWidth={2.5} />

        {/* Hover line and points */}
        {hoverData && (
          <>
            <line
              x1={hoverX}
              x2={hoverX}
              y1={margin.top}
              y2={height - margin.bottom}
              stroke="#94a3b8"
              strokeWidth={1}
              strokeDasharray="4,4"
            />
            {hoverData.lambdaCost > 0 && (
              <circle
                cx={hoverX}
                cy={margin.top + yScale(hoverData.lambdaCost)}
                r={5}
                fill={COLORS.lambda}
                stroke="#fff"
                strokeWidth={2}
              />
            )}
            {hoverData.managedOnDemand > 0 && (
              <circle
                cx={hoverX}
                cy={margin.top + yScale(hoverData.managedOnDemand)}
                r={5}
                fill={COLORS.managedOnDemand}
                stroke="#fff"
                strokeWidth={2}
              />
            )}
            {hoverData.managedSavings > 0 && (
              <circle
                cx={hoverX}
                cy={margin.top + yScale(hoverData.managedSavings)}
                r={5}
                fill={COLORS.managedSavings}
                stroke="#fff"
                strokeWidth={2}
              />
            )}
          </>
        )}

        {/* Axes */}
        <line x1={margin.left} x2={width - margin.right} y1={height - margin.bottom} y2={height - margin.bottom} stroke={COLORS.grid} />
        <line x1={margin.left} x2={margin.left} y1={margin.top} y2={height - margin.bottom} stroke={COLORS.grid} />

        {/* X-axis labels */}
        {xTicks.filter(t => t >= xMin && t <= xMax).map(tick => (
          <text
            key={`xl-${tick}`}
            x={margin.left + xScale(tick)}
            y={height - 10}
            fill={COLORS.text}
            fontSize="11"
            textAnchor="middle"
          >
            {formatInvocations(tick)}
          </text>
        ))}

        {/* Y-axis labels */}
        {yTicks.filter(t => t >= yMin && t <= yMax).map(tick => (
          <text
            key={`yl-${tick}`}
            x={margin.left - 10}
            y={margin.top + yScale(tick) + 4}
            fill={COLORS.text}
            fontSize="11"
            textAnchor="end"
          >
            {formatCurrency(tick)}
          </text>
        ))}

        {/* Axis titles */}
        <text x={width / 2} y={height - 2} fill={COLORS.text} fontSize="12" textAnchor="middle">
          Monthly Invocations
        </text>
        <text x={15} y={height / 2} fill={COLORS.text} fontSize="12" textAnchor="middle" transform={`rotate(-90, 15, ${height / 2})`}>
          Monthly Cost ($)
        </text>
      </svg>

      {/* Tooltip */}
      {hoverData && (
        <div
          style={{
            ...tooltipStyles.container,
            left: mousePos.x > 400 ? mousePos.x - 220 : mousePos.x + 15,
            top: mousePos.y - 10,
            minWidth: '220px',
          }}
        >
          <div style={tooltipStyles.title}>
            {formatInvocations(hoverData.invocations)} invocations/mo
          </div>
          <div style={tooltipStyles.row}>
            <span style={tooltipStyles.label}>
              <span style={{ ...tooltipStyles.dot, backgroundColor: COLORS.lambda }} />
              On-Demand Lambda
            </span>
            <span style={tooltipStyles.value}>{formatCurrency(hoverData.lambdaCost)}</span>
          </div>
          {hoverData.managedOnDemand > 0 && (
            <div style={tooltipStyles.row}>
              <span style={tooltipStyles.label}>
                <span style={{ ...tooltipStyles.dot, backgroundColor: COLORS.managedOnDemand }} />
                Managed (Standard)
              </span>
              <span style={tooltipStyles.value}>{formatCurrency(hoverData.managedOnDemand)}</span>
            </div>
          )}
          {hoverData.managedSavings > 0 && (
            <div style={tooltipStyles.row}>
              <span style={tooltipStyles.label}>
                <span style={{ ...tooltipStyles.dot, backgroundColor: COLORS.managedSavings }} />
                Managed (Savings Plan)
              </span>
              <span style={tooltipStyles.value}>{formatCurrency(hoverData.managedSavings)}</span>
            </div>
          )}
          {hoverData.managedOnDemand > 0 && hoverData.lambdaCost > 0 && (
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #334155' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>vs On-Demand Lambda:</div>
              <div style={tooltipStyles.row}>
                <span style={{ color: '#94a3b8', fontSize: '11px' }}>Managed (Standard)</span>
                <span style={{ 
                  ...tooltipStyles.value, 
                  color: hoverData.lambdaCost > hoverData.managedOnDemand ? '#10b981' : '#f97316',
                  fontSize: '12px',
                }}>
                  {hoverData.lambdaCost > hoverData.managedOnDemand ? '+' : ''}
                  {(((hoverData.lambdaCost - hoverData.managedOnDemand) / hoverData.lambdaCost) * 100).toFixed(1)}%
                </span>
              </div>
              {hoverData.managedSavings > 0 && (
                <div style={tooltipStyles.row}>
                  <span style={{ color: '#94a3b8', fontSize: '11px' }}>Managed (Savings Plan)</span>
                  <span style={{ 
                    ...tooltipStyles.value, 
                    color: hoverData.lambdaCost > hoverData.managedSavings ? '#10b981' : '#f97316',
                    fontSize: '12px',
                  }}>
                    {hoverData.lambdaCost > hoverData.managedSavings ? '+' : ''}
                    {(((hoverData.lambdaCost - hoverData.managedSavings) / hoverData.lambdaCost) * 100).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================
// SAVINGS CHART COMPONENT (SVG) WITH TOOLTIPS
// ============================================
const SavingsChart = ({ data, height = 200 }) => {
  const [hoverData, setHoverData] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = React.useRef(null);

  const width = 700;
  const margin = { top: 20, right: 30, bottom: 40, left: 70 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const xMin = Math.min(...data.map(d => d.invocations));
  const xMax = Math.max(...data.map(d => d.invocations));

  const logScale = (value, min, max, range) => {
    const logMin = Math.log10(min);
    const logMax = Math.log10(max);
    const logValue = Math.log10(value);
    return ((logValue - logMin) / (logMax - logMin)) * range;
  };

  const inverseLogScale = (pixel, min, max, range) => {
    const logMin = Math.log10(min);
    const logMax = Math.log10(max);
    const logValue = (pixel / range) * (logMax - logMin) + logMin;
    return Math.pow(10, logValue);
  };

  const xScale = (value) => logScale(value, xMin, xMax, innerWidth);
  const yScale = (value) => innerHeight - ((value + 50) / 145) * innerHeight;

  const handleMouseMove = (e) => {
    if (!containerRef.current || data.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * width;
    
    if (svgX < margin.left || svgX > width - margin.right) {
      setHoverData(null);
      return;
    }
    
    const chartX = svgX - margin.left;
    const invocations = inverseLogScale(chartX, xMin, xMax, innerWidth);
    
    let nearest = data[0];
    let minDist = Math.abs(Math.log10(data[0].invocations) - Math.log10(invocations));
    for (const d of data) {
      const dist = Math.abs(Math.log10(d.invocations) - Math.log10(invocations));
      if (dist < minDist) {
        minDist = dist;
        nearest = d;
      }
    }
    
    setHoverData(nearest);
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleMouseLeave = () => {
    setHoverData(null);
  };

  const areaPath = data.map((d, i) => {
    const x = margin.left + xScale(d.invocations);
    const y = margin.top + yScale(d.savings);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ') + ` L ${margin.left + innerWidth} ${margin.top + innerHeight} L ${margin.left} ${margin.top + innerHeight} Z`;

  const linePath = data.map((d, i) => {
    const x = margin.left + xScale(d.invocations);
    const y = margin.top + yScale(d.savings);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  const zeroY = margin.top + yScale(0);
  const hoverX = hoverData ? margin.left + xScale(hoverData.invocations) : 0;
  const hoverY = hoverData ? margin.top + yScale(hoverData.savings) : 0;

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <svg 
        viewBox={`0 0 ${width} ${height}`} 
        style={{ width: '100%', maxWidth: '700px', cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Zero line */}
        <line
          x1={margin.left}
          x2={width - margin.right}
          y1={zeroY}
          y2={zeroY}
          stroke={COLORS.breakeven}
          strokeWidth={2}
          strokeDasharray="6,4"
        />

        {/* Area fill */}
        <path d={areaPath} fill={COLORS.managedSavings} fillOpacity={0.2} />
        
        {/* Line */}
        <path d={linePath} fill="none" stroke={COLORS.managedSavings} strokeWidth={2.5} />

        {/* Hover elements */}
        {hoverData && (
          <>
            <line
              x1={hoverX}
              x2={hoverX}
              y1={margin.top}
              y2={height - margin.bottom}
              stroke="#94a3b8"
              strokeWidth={1}
              strokeDasharray="4,4"
            />
            <circle
              cx={hoverX}
              cy={hoverY}
              r={6}
              fill={hoverData.savings >= 0 ? '#10b981' : '#f97316'}
              stroke="#fff"
              strokeWidth={2}
            />
          </>
        )}

        {/* Axes */}
        <line x1={margin.left} x2={width - margin.right} y1={height - margin.bottom} y2={height - margin.bottom} stroke={COLORS.grid} />
        <line x1={margin.left} x2={margin.left} y1={margin.top} y2={height - margin.bottom} stroke={COLORS.grid} />

        {/* X-axis labels */}
        {[1_000_000, 10_000_000, 100_000_000, 1_000_000_000].filter(t => t >= xMin && t <= xMax).map(tick => (
          <text key={tick} x={margin.left + xScale(tick)} y={height - 10} fill={COLORS.text} fontSize="11" textAnchor="middle">
            {formatInvocations(tick)}
          </text>
        ))}

        {/* Y-axis labels */}
        {[-40, -20, 0, 20, 40, 60, 80].map(tick => (
          <text key={tick} x={margin.left - 10} y={margin.top + yScale(tick) + 4} fill={COLORS.text} fontSize="11" textAnchor="end">
            {tick}%
          </text>
        ))}

        {/* Labels */}
        <text x={margin.left + 10} y={margin.top + yScale(70)} fill="#10b981" fontSize="11">
          Managed Instances cheaper
        </text>
        <text x={margin.left + 10} y={margin.top + yScale(-30)} fill="#f97316" fontSize="11">
          On-Demand Lambda cheaper
        </text>
      </svg>

      {/* Tooltip */}
      {hoverData && (
        <div
          style={{
            ...tooltipStyles.container,
            left: mousePos.x > 400 ? mousePos.x - 190 : mousePos.x + 15,
            top: mousePos.y - 10,
            minWidth: '160px',
          }}
        >
          <div style={tooltipStyles.title}>
            {formatInvocations(hoverData.invocations)} invocations/mo
          </div>
          <div style={tooltipStyles.row}>
            <span style={{ color: '#94a3b8' }}>Savings:</span>
            <span style={{ 
              ...tooltipStyles.value, 
              color: hoverData.savings >= 0 ? '#10b981' : '#f97316',
              fontSize: '14px',
            }}>
              {hoverData.savings >= 0 ? '+' : ''}{hoverData.savings.toFixed(1)}%
            </span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
            {hoverData.savings >= 0 
              ? 'Managed Instances is cheaper' 
              : 'On-Demand Lambda is cheaper'}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// INSTANCE SELECTOR COMPONENT
// ============================================
const InstanceSelector = ({ value, onChange, familyFilter }) => {
  const filteredInstances = Object.entries(EC2_BASE_PRICING)
    .filter(([_, data]) => !familyFilter || data.family === familyFilter)
    .sort((a, b) => a[1].price - b[1].price);

  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={styles.select}>
      {filteredInstances.map(([name, data]) => (
        <option key={name} value={name}>
          {name} ({data.vcpu} vCPU, {data.memory} GB)
        </option>
      ))}
    </select>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================
export default function LambdaCostComparison() {
  const [memoryMB, setMemoryMB] = useState(2048);
  const [durationMs, setDurationMs] = useState(200);
  const [instanceType, setInstanceType] = useState('m7g.large');
  const [region, setRegion] = useState('us-east-1');
  const [familyFilter, setFamilyFilter] = useState(null);

  const instanceData = EC2_BASE_PRICING[instanceType];
  const effectiveMemory = Math.max(memoryMB, MIN_MANAGED_MEMORY_MB);
  const isBelowMinimum = memoryMB < MIN_MANAGED_MEMORY_MB;

  // Generate chart data
  const chartData = useMemo(() => {
    const points = [];
    const logMin = 5; // 100K
    const logMax = 9.3; // ~2B
    
    for (let i = 0; i <= 50; i++) {
      const logValue = logMin + (logMax - logMin) * (i / 50);
      const invocations = Math.round(Math.pow(10, logValue));
      
      const lambdaCost = calcLambdaCost(invocations, memoryMB, durationMs, region);
      
      const instanceCount = estimateRequiredInstances(invocations, instanceType, effectiveMemory, durationMs);
      const managedOnDemand = isBelowMinimum ? null : calcManagedInstancesCost(invocations, instanceType, instanceCount, region, false);
      const managedSavings = isBelowMinimum ? null : calcManagedInstancesCost(invocations, instanceType, instanceCount, region, true);
      
      points.push({
        invocations,
        lambdaCost,
        managedOnDemand: managedOnDemand || 0,
        managedSavings: managedSavings || 0,
      });
    }
    return points;
  }, [memoryMB, durationMs, instanceType, region, effectiveMemory, isBelowMinimum]);

  // Generate savings data
  const savingsData = useMemo(() => {
    if (isBelowMinimum) return [];
    
    const points = [];
    const logMin = 5.5;
    const logMax = 9.3;
    
    for (let i = 0; i <= 50; i++) {
      const logValue = logMin + (logMax - logMin) * (i / 50);
      const invocations = Math.round(Math.pow(10, logValue));
      
      const lambdaCost = calcLambdaCost(invocations, effectiveMemory, durationMs, region);
      const instanceCount = estimateRequiredInstances(invocations, instanceType, effectiveMemory, durationMs);
      const managedCost = calcManagedInstancesCost(invocations, instanceType, instanceCount, region, true);
      
      const savings = lambdaCost > 0 ? ((lambdaCost - managedCost) / lambdaCost) * 100 : 0;
      
      points.push({
        invocations,
        savings: Math.max(-50, Math.min(95, savings)),
      });
    }
    return points;
  }, [effectiveMemory, durationMs, instanceType, region, isBelowMinimum]);

  // Calculate break-even points
  const breakevenSavings = useMemo(() => 
    findBreakeven(effectiveMemory, durationMs, instanceType, region, true), 
    [effectiveMemory, durationMs, instanceType, region]
  );
  
  const breakevenOnDemand = useMemo(() => 
    findBreakeven(effectiveMemory, durationMs, instanceType, region, false), 
    [effectiveMemory, durationMs, instanceType, region]
  );

  const families = ['All', 'General Purpose', 'Compute Optimized', 'Memory Optimized'];

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Lambda On-Demand vs Managed Instances</h1>
      <p style={styles.subtitle}>Interactive cost comparison with break-even analysis across regions and instance types</p>

      {/* Controls */}
      <div style={styles.controlsContainer}>
        <div style={styles.controlsGrid}>
          <div style={styles.controlGroup}>
            <label style={styles.label}>AWS Region</label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              style={styles.select}
            >
              {Object.entries(REGIONS).map(([id, { name }]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>
          
          <div style={styles.controlGroup}>
            <label style={styles.label}>Function Memory</label>
            <select
              value={memoryMB}
              onChange={(e) => setMemoryMB(Number(e.target.value))}
              style={styles.select}
            >
              {MEMORY_CONFIGS.map(m => (
                <option key={m} value={m}>
                  {m} MB {m < MIN_MANAGED_MEMORY_MB ? '(Lambda only)' : ''}
                </option>
              ))}
            </select>
          </div>
          
          <div style={styles.controlGroup}>
            <label style={styles.label}>Duration (ms)</label>
            <select
              value={durationMs}
              onChange={(e) => setDurationMs(Number(e.target.value))}
              style={styles.select}
            >
              {DURATION_OPTIONS.map(d => (
                <option key={d} value={d}>{d} ms</option>
              ))}
            </select>
          </div>
          
          <div style={styles.controlGroup}>
            <label style={styles.label}>Instance Type</label>
            <InstanceSelector 
              value={instanceType} 
              onChange={setInstanceType}
              familyFilter={familyFilter === 'All' ? null : familyFilter}
            />
          </div>
        </div>
        
        {/* Instance Family Filter */}
        <div style={{ marginTop: '16px' }}>
          <label style={styles.label}>Filter by Instance Family</label>
          <div style={styles.tabContainer}>
            {families.map(fam => (
              <button
                key={fam}
                onClick={() => setFamilyFilter(fam === 'All' ? null : fam)}
                style={{
                  ...styles.tab,
                  ...((!familyFilter && fam === 'All') || familyFilter === fam 
                    ? styles.tabActive 
                    : styles.tabInactive)
                }}
              >
                {fam}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Warning for minimum memory */}
      {isBelowMinimum && (
        <div style={styles.warning}>
          ⚠️ <strong>Note:</strong> Lambda Managed Instances requires minimum 2 GB function memory. 
          Functions with {memoryMB} MB are only available on traditional Lambda.
          Managed Instances comparison uses 2 GB for calculation.
        </div>
      )}

      {/* Instance Info */}
      <div style={styles.chartContainer}>
        <h2 style={styles.chartTitle}>Selected Instance: {instanceType}</h2>
        <div style={styles.instanceInfo}>
          <div style={styles.instanceInfoItem}>
            <span style={styles.instanceInfoLabel}>Family</span>
            <span style={styles.instanceInfoValue}>{instanceData.family}</span>
          </div>
          <div style={styles.instanceInfoItem}>
            <span style={styles.instanceInfoLabel}>Architecture</span>
            <span style={styles.instanceInfoValue}>{instanceData.arch}</span>
          </div>
          <div style={styles.instanceInfoItem}>
            <span style={styles.instanceInfoLabel}>vCPUs</span>
            <span style={styles.instanceInfoValue}>{instanceData.vcpu}</span>
          </div>
          <div style={styles.instanceInfoItem}>
            <span style={styles.instanceInfoLabel}>Memory</span>
            <span style={styles.instanceInfoValue}>{instanceData.memory} GB</span>
          </div>
          <div style={styles.instanceInfoItem}>
            <span style={styles.instanceInfoLabel}>On-Demand ({region})</span>
            <span style={styles.instanceInfoValue}>${getInstancePrice(instanceType, region).toFixed(4)}/hr</span>
          </div>
          <div style={styles.instanceInfoItem}>
            <span style={styles.instanceInfoLabel}>w/ 72% Savings Plan</span>
            <span style={styles.instanceInfoValue}>${(getInstancePrice(instanceType, region) * 0.28).toFixed(4)}/hr</span>
          </div>
          <div style={styles.instanceInfoItem}>
            <span style={styles.instanceInfoLabel}>+ 15% Mgmt Fee</span>
            <span style={styles.instanceInfoValue}>${(getInstancePrice(instanceType, region) * 0.15).toFixed(4)}/hr</span>
          </div>
        </div>
      </div>

      {/* Main Chart */}
      <div style={styles.chartContainer}>
        <h2 style={styles.chartTitle}>Cost Comparison</h2>
        
        <div style={styles.statsGrid}>
          <div style={styles.statItem}>
            <span style={styles.statLabel}>Break-even (w/ Savings Plans):</span>
            <span style={{ ...styles.statValue, color: '#10b981' }}>
              {breakevenSavings === Infinity ? 'N/A' : `${formatInvocations(breakevenSavings)}/mo`}
            </span>
          </div>
          <div style={styles.statItem}>
            <span style={styles.statLabel}>Break-even (On-Demand):</span>
            <span style={{ ...styles.statValue, color: '#2EC4B6' }}>
              {breakevenOnDemand === Infinity ? 'N/A' : `${formatInvocations(breakevenOnDemand)}/mo`}
            </span>
          </div>
          <div style={styles.statItem}>
            <span style={styles.statLabel}>Memory:</span>
            <span style={styles.statValue}>{memoryMB} MB</span>
          </div>
          <div style={styles.statItem}>
            <span style={styles.statLabel}>Duration:</span>
            <span style={styles.statValue}>{durationMs} ms</span>
          </div>
          <div style={styles.statItem}>
            <span style={styles.statLabel}>Region:</span>
            <span style={styles.statValue}>{REGIONS[region].name}</span>
          </div>
        </div>

        <LineChart data={chartData} />
        
        <div style={styles.legend}>
          <div style={styles.legendItem}>
            <div style={{ ...styles.legendColor, backgroundColor: COLORS.lambda }} />
            <span>On-Demand Lambda</span>
          </div>
          <div style={styles.legendItem}>
            <div style={{ ...styles.legendColor, backgroundColor: COLORS.managedOnDemand }} />
            <span>Managed Instances (Standard)</span>
          </div>
          <div style={styles.legendItem}>
            <div style={{ ...styles.legendColor, backgroundColor: COLORS.managedSavings }} />
            <span>Managed Instances (Savings Plan)</span>
          </div>
        </div>
      </div>

      {/* Savings Chart */}
      {!isBelowMinimum && (
        <div style={styles.chartContainer}>
          <h2 style={styles.chartTitle}>Potential Savings with Managed Instances</h2>
          <p style={{ ...styles.subtitle, marginBottom: '16px' }}>
            {effectiveMemory} MB memory, {durationMs}ms duration, {instanceType} with 72% Savings Plan in {REGIONS[region].name}
          </p>
          <SavingsChart data={savingsData} />
          <p style={{ fontSize: '11px', color: '#64748b', marginTop: '8px', textAlign: 'center' }}>
            Positive = Managed Instances cheaper | Negative = On-Demand Lambda cheaper
          </p>
        </div>
      )}

      {/* Instance Comparison Table */}
      <div style={styles.chartContainer}>
        <h2 style={styles.chartTitle}>Supported Instance Types & Pricing ({REGIONS[region].name})</h2>
        <p style={{ ...styles.subtitle, marginBottom: '16px' }}>
          All C, M, R family instances (large and above) are supported. Prices shown are On-Demand + 15% management fee.
        </p>
        
        <div style={styles.heatmapContainer}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, textAlign: 'left' }}>Instance</th>
                <th style={styles.th}>Family</th>
                <th style={styles.th}>Arch</th>
                <th style={styles.th}>vCPU</th>
                <th style={styles.th}>Memory</th>
                <th style={styles.th}>On-Demand/hr</th>
                <th style={styles.th}>Savings Plan/hr</th>
                <th style={styles.th}>Total w/ Mgmt Fee</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(EC2_BASE_PRICING)
                .filter(([_, data]) => !familyFilter || familyFilter === 'All' || data.family === familyFilter)
                .slice(0, 15) // Show first 15 matching
                .map(([name, data]) => {
                  const price = getInstancePrice(name, region);
                  const savingsPrice = price * 0.28;
                  const mgmtFee = price * 0.15;
                  return (
                    <tr key={name} style={{ backgroundColor: name === instanceType ? '#334155' : 'transparent' }}>
                      <td style={{ ...styles.tdLabel, color: name === instanceType ? '#6366f1' : '#f1f5f9' }}>
                        {name}
                      </td>
                      <td style={styles.td}>{data.family.split(' ')[0]}</td>
                      <td style={styles.td}>{data.arch}</td>
                      <td style={styles.td}>{data.vcpu}</td>
                      <td style={styles.td}>{data.memory} GB</td>
                      <td style={styles.td}>${price.toFixed(4)}</td>
                      <td style={styles.td}>${savingsPrice.toFixed(4)}</td>
                      <td style={styles.td}>${(savingsPrice + mgmtFee).toFixed(4)}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: '11px', color: '#64748b', marginTop: '8px' }}>
          Showing {familyFilter && familyFilter !== 'All' ? familyFilter : 'all families'}. 
          72% Savings Plan discount shown. Management fee is always based on On-Demand price.
        </p>
      </div>

      {/* Insights */}
      <div style={styles.chartContainer}>
        <h2 style={styles.chartTitle}>Key Takeaways</h2>
        <div style={styles.insights}>
          <div style={styles.insightCard}>
            <h3 style={{ ...styles.insightTitle, color: '#10b981' }}>When Managed Instances Win</h3>
            <ul style={styles.insightList}>
              <li>• High invocation volume (&gt;10M/month with Savings Plans)</li>
              <li>• Long function durations (&gt;500ms)</li>
              <li>• Steady, predictable traffic patterns</li>
              <li>• Existing EC2 Savings Plans commitments</li>
              <li>• Latency-critical workloads (no cold starts)</li>
              <li>• Function memory ≥ 2 GB requirement met</li>
            </ul>
          </div>
          <div style={styles.insightCard}>
            <h3 style={{ ...styles.insightTitle, color: '#f97316' }}>When On-Demand Lambda Wins</h3>
            <ul style={styles.insightList}>
              <li>• Low to moderate volume (&lt;5M/month)</li>
              <li>• Short function durations (&lt;100ms)</li>
              <li>• Bursty, unpredictable traffic</li>
              <li>• Need for scale-to-zero</li>
              <li>• Function memory &lt; 2 GB</li>
              <li>• Simple operational model preferred</li>
            </ul>
          </div>
          <div style={styles.insightCard}>
            <h3 style={{ ...styles.insightTitle, color: '#6366f1' }}>Instance Selection Tips</h3>
            <ul style={styles.insightList}>
              <li>• <strong>Graviton (g suffix)</strong>: Best price/performance</li>
              <li>• <strong>C family</strong>: CPU-intensive workloads</li>
              <li>• <strong>M family</strong>: Balanced workloads</li>
              <li>• <strong>R family</strong>: Memory-intensive workloads</li>
              <li>• Let AWS choose for best availability</li>
              <li>• Minimum size: large (no medium/small)</li>
            </ul>
          </div>
        </div>
      </div>

      <p style={styles.footer}>
        Pricing data as of December 2025. Managed Instances include 15% management fee on EC2 On-Demand price.
        Savings Plan assumes 72% discount (3-year Compute Savings Plan). Regional pricing uses multipliers from us-east-1 base.
        Multi-concurrency factor: 10 concurrent requests per environment at 70% efficiency.
      </p>
    </div>
  );
}
