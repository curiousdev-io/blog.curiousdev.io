import React, { useState, useMemo, useRef, useCallback } from 'react';

// AWS Regional Pricing Data
// Source: AWS Pricing Bulk API (Lambda: 2025-12-18, Fargate/ECS: 2026-02-16)
// Lambda pricing is uniform across all regions per the API.
// Fargate pricing varies by region.
const AWS_REGION_PRICING = {
    'us-east-1': {
        name: 'US East (N. Virginia)',
        lambda: { requestPer1M: 0.20, gbSecondX86: 0.0000166667, gbSecondArm: 0.0000133334, freeRequests: 1000000, freeGbSeconds: 400000 },
        fargate: { vcpuPerHour: 0.04048, gbPerHour: 0.004445, vcpuPerHourArm: 0.03238, gbPerHourArm: 0.00356 },
    },
    'us-east-2': {
        name: 'US East (Ohio)',
        lambda: { requestPer1M: 0.20, gbSecondX86: 0.0000166667, gbSecondArm: 0.0000133334, freeRequests: 1000000, freeGbSeconds: 400000 },
        fargate: { vcpuPerHour: 0.04048, gbPerHour: 0.004445, vcpuPerHourArm: 0.03238, gbPerHourArm: 0.00356 },
    },
    'us-west-1': {
        name: 'US West (N. California)',
        lambda: { requestPer1M: 0.20, gbSecondX86: 0.0000166667, gbSecondArm: 0.0000133334, freeRequests: 1000000, freeGbSeconds: 400000 },
        fargate: { vcpuPerHour: 0.04656, gbPerHour: 0.00511, vcpuPerHourArm: 0.03725, gbPerHourArm: 0.00409 },
    },
    'us-west-2': {
        name: 'US West (Oregon)',
        lambda: { requestPer1M: 0.20, gbSecondX86: 0.0000166667, gbSecondArm: 0.0000133334, freeRequests: 1000000, freeGbSeconds: 400000 },
        fargate: { vcpuPerHour: 0.04048, gbPerHour: 0.004445, vcpuPerHourArm: 0.03238, gbPerHourArm: 0.00356 },
    },
    'eu-west-1': {
        name: 'EU (Ireland)',
        lambda: { requestPer1M: 0.20, gbSecondX86: 0.0000166667, gbSecondArm: 0.0000133334, freeRequests: 1000000, freeGbSeconds: 400000 },
        fargate: { vcpuPerHour: 0.04048, gbPerHour: 0.004445, vcpuPerHourArm: 0.03238, gbPerHourArm: 0.00356 },
    },
    'eu-west-2': {
        name: 'EU (London)',
        lambda: { requestPer1M: 0.20, gbSecondX86: 0.0000166667, gbSecondArm: 0.0000133334, freeRequests: 1000000, freeGbSeconds: 400000 },
        fargate: { vcpuPerHour: 0.04656, gbPerHour: 0.00511, vcpuPerHourArm: 0.03725, gbPerHourArm: 0.00409 },
    },
    'eu-central-1': {
        name: 'EU (Frankfurt)',
        lambda: { requestPer1M: 0.20, gbSecondX86: 0.0000166667, gbSecondArm: 0.0000133334, freeRequests: 1000000, freeGbSeconds: 400000 },
        fargate: { vcpuPerHour: 0.04656, gbPerHour: 0.00511, vcpuPerHourArm: 0.03725, gbPerHourArm: 0.00409 },
    },
    'ca-central-1': {
        name: 'Canada (Central)',
        lambda: { requestPer1M: 0.20, gbSecondX86: 0.0000166667, gbSecondArm: 0.0000133334, freeRequests: 1000000, freeGbSeconds: 400000 },
        fargate: { vcpuPerHour: 0.04456, gbPerHour: 0.004865, vcpuPerHourArm: 0.03565, gbPerHourArm: 0.00389 },
    },
    'ap-northeast-1': {
        name: 'Asia Pacific (Tokyo)',
        lambda: { requestPer1M: 0.20, gbSecondX86: 0.0000166667, gbSecondArm: 0.0000133334, freeRequests: 1000000, freeGbSeconds: 400000 },
        fargate: { vcpuPerHour: 0.05056, gbPerHour: 0.00553, vcpuPerHourArm: 0.04045, gbPerHourArm: 0.00442 },
    },
    'ap-southeast-1': {
        name: 'Asia Pacific (Singapore)',
        lambda: { requestPer1M: 0.20, gbSecondX86: 0.0000166667, gbSecondArm: 0.0000133334, freeRequests: 1000000, freeGbSeconds: 400000 },
        fargate: { vcpuPerHour: 0.05056, gbPerHour: 0.00553, vcpuPerHourArm: 0.04045, gbPerHourArm: 0.00442 },
    },
    'ap-south-1': {
        name: 'Asia Pacific (Mumbai)',
        lambda: { requestPer1M: 0.20, gbSecondX86: 0.0000166667, gbSecondArm: 0.0000133334, freeRequests: 1000000, freeGbSeconds: 400000 },
        fargate: { vcpuPerHour: 0.04256, gbPerHour: 0.004655, vcpuPerHourArm: 0.02383, gbPerHourArm: 0.00261 },
    },
    'sa-east-1': {
        name: 'South America (Sao Paulo)',
        lambda: { requestPer1M: 0.20, gbSecondX86: 0.0000166667, gbSecondArm: 0.0000133334, freeRequests: 1000000, freeGbSeconds: 400000 },
        fargate: { vcpuPerHour: 0.0696, gbPerHour: 0.0076, vcpuPerHourArm: 0.0557, gbPerHourArm: 0.00612 },
    },
};

// TCO multipliers based on Deloitte/AWS research
const TCO_FACTORS = {
    lambda: {
        developmentMultiplier: 0.7,  // 30% less development time
        maintenanceMultiplier: 0.125, // 8x less maintenance (Deloitte)
        operationsHoursPerMonth: 2,   // Hours spent on ops
    },
    fargate: {
        developmentMultiplier: 1.0,   // Baseline
        maintenanceMultiplier: 0.5,   // Less than EC2, more than Lambda
        operationsHoursPerMonth: 8,   // Hours spent on ops
    },
};

// Memory options in MB
const MEMORY_OPTIONS = [128, 256, 512, 768, 1024, 1536, 2048, 3008, 4096, 5120, 6144, 7168, 8192, 10240];

// Duration options in ms
const DURATION_OPTIONS = [50, 100, 150, 200, 300, 500, 750, 1000, 1500, 2000, 3000, 5000, 10000, 15000];

// Fargate vCPU/Memory combinations - curated for Lambda comparison
// Only including configs up to 4 vCPU since Lambda maxes at ~6 vCPU (10,240 MB)
const FARGATE_CONFIGS = [
    { vcpu: 0.25, memory: 0.5, label: '0.25 vCPU, 0.5 GB' },
    { vcpu: 0.25, memory: 1, label: '0.25 vCPU, 1 GB' },
    { vcpu: 0.25, memory: 2, label: '0.25 vCPU, 2 GB' },
    { vcpu: 0.5, memory: 1, label: '0.5 vCPU, 1 GB' },
    { vcpu: 0.5, memory: 2, label: '0.5 vCPU, 2 GB' },
    { vcpu: 0.5, memory: 3, label: '0.5 vCPU, 3 GB' },
    { vcpu: 0.5, memory: 4, label: '0.5 vCPU, 4 GB' },
    { vcpu: 1, memory: 2, label: '1 vCPU, 2 GB' },
    { vcpu: 1, memory: 3, label: '1 vCPU, 3 GB' },
    { vcpu: 1, memory: 4, label: '1 vCPU, 4 GB' },
    { vcpu: 1, memory: 5, label: '1 vCPU, 5 GB' },
    { vcpu: 1, memory: 6, label: '1 vCPU, 6 GB' },
    { vcpu: 1, memory: 7, label: '1 vCPU, 7 GB' },
    { vcpu: 1, memory: 8, label: '1 vCPU, 8 GB' },
    { vcpu: 2, memory: 4, label: '2 vCPU, 4 GB' },
    { vcpu: 2, memory: 5, label: '2 vCPU, 5 GB' },
    { vcpu: 2, memory: 6, label: '2 vCPU, 6 GB' },
    { vcpu: 2, memory: 8, label: '2 vCPU, 8 GB' },
    { vcpu: 2, memory: 10, label: '2 vCPU, 10 GB' },
    { vcpu: 2, memory: 16, label: '2 vCPU, 16 GB' },
    { vcpu: 4, memory: 8, label: '4 vCPU, 8 GB' },
    { vcpu: 4, memory: 12, label: '4 vCPU, 12 GB' },
    { vcpu: 4, memory: 16, label: '4 vCPU, 16 GB' },
    { vcpu: 4, memory: 20, label: '4 vCPU, 20 GB' },
    { vcpu: 4, memory: 30, label: '4 vCPU, 30 GB' },
    { vcpu: 8, memory: 16, label: '8 vCPU, 16 GB' },
    { vcpu: 8, memory: 20, label: '8 vCPU, 20 GB' },
    { vcpu: 8, memory: 32, label: '8 vCPU, 32 GB' },
    { vcpu: 8, memory: 60, label: '8 vCPU, 60 GB' },
];

// Lambda memory to Fargate config mapping (memory-based parity)
// Maps each Lambda size to the smallest Fargate config whose memory meets or
// exceeds the Lambda allocation, using the smallest vCPU tier that supports it.
const LAMBDA_TO_FARGATE_MAP = {
    128: { vcpu: 0.25, memory: 0.5 },   // 0.125 GB → 0.25 vCPU / 0.5 GB (tier min)
    256: { vcpu: 0.25, memory: 0.5 },   // 0.25 GB  → 0.25 vCPU / 0.5 GB (tier min)
    512: { vcpu: 0.25, memory: 0.5 },   // 0.5 GB   → 0.25 vCPU / 0.5 GB
    768: { vcpu: 0.25, memory: 1 },     // 0.75 GB  → 0.25 vCPU / 1 GB
    1024: { vcpu: 0.25, memory: 1 },    // 1 GB     → 0.25 vCPU / 1 GB
    1536: { vcpu: 0.25, memory: 2 },    // 1.5 GB   → 0.25 vCPU / 2 GB
    2048: { vcpu: 0.5, memory: 2 },     // 2 GB     → 0.5 vCPU / 2 GB
    3008: { vcpu: 0.5, memory: 3 },     // ~3 GB    → 0.5 vCPU / 3 GB
    4096: { vcpu: 0.5, memory: 4 },     // 4 GB     → 0.5 vCPU / 4 GB
    5120: { vcpu: 1, memory: 5 },       // 5 GB     → 1 vCPU / 5 GB
    6144: { vcpu: 1, memory: 6 },       // 6 GB     → 1 vCPU / 6 GB
    7168: { vcpu: 1, memory: 7 },       // 7 GB     → 1 vCPU / 7 GB
    8192: { vcpu: 1, memory: 8 },       // 8 GB     → 1 vCPU / 8 GB
    10240: { vcpu: 2, memory: 10 },     // 10 GB    → 2 vCPU / 10 GB
};

// Reverse mapping: Fargate config to closest Lambda memory (by memory parity)
const getFargateToLambdaMemory = (vcpu, memory) => {
    const entries = Object.entries(LAMBDA_TO_FARGATE_MAP);
    for (let i = entries.length - 1; i >= 0; i--) {
        const [mem, config] = entries[i];
        if (config.memory <= memory) {
            return Number(mem);
        }
    }
    return 128;
};

// Invocation presets for quick selection
const INVOCATION_PRESETS = [
    { value: 10000, label: '10K' },
    { value: 100000, label: '100K' },
    { value: 1000000, label: '1M' },
    { value: 5000000, label: '5M' },
    { value: 10000000, label: '10M' },
    { value: 50000000, label: '50M' },
    { value: 100000000, label: '100M' },
    { value: 500000000, label: '500M' },
    { value: 1000000000, label: '1B' },
];

// Styles
const styles = {
    container: {
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '20px',
    },
    header: {
        textAlign: 'center',
        marginBottom: '32px',
    },
    title: {
        fontSize: '28px',
        fontWeight: '700',
        color: '#1a1a2e',
        marginBottom: '8px',
    },
    subtitle: {
        fontSize: '16px',
        color: '#6b7280',
        marginTop: '0',
    },
    card: {
        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    },
    cardTitle: {
        fontSize: '18px',
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '20px',
    },
    inputGroup: {
        marginBottom: '16px',
    },
    label: {
        display: 'block',
        fontSize: '13px',
        fontWeight: '500',
        color: '#475569',
        marginBottom: '6px',
    },
    select: {
        width: '100%',
        padding: '10px 12px',
        fontSize: '14px',
        border: '1px solid #cbd5e1',
        borderRadius: '8px',
        backgroundColor: '#fff',
        color: '#1e293b',
        cursor: 'pointer',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        outline: 'none',
    },
    input: {
        width: '100%',
        padding: '10px 12px',
        fontSize: '14px',
        border: '1px solid #cbd5e1',
        borderRadius: '8px',
        backgroundColor: '#fff',
        color: '#1e293b',
        boxSizing: 'border-box',
        outline: 'none',
    },
    presetButtons: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px',
        marginTop: '8px',
    },
    presetButton: {
        padding: '4px 10px',
        fontSize: '12px',
        border: '1px solid #e2e8f0',
        borderRadius: '4px',
        backgroundColor: '#fff',
        color: '#64748b',
        cursor: 'pointer',
        transition: 'all 0.2s',
    },
    presetButtonActive: {
        backgroundColor: '#3b82f6',
        color: '#fff',
        borderColor: '#3b82f6',
    },
    tabContainer: {
        display: 'flex',
        gap: '8px',
        marginBottom: '24px',
        borderBottom: '2px solid #e2e8f0',
        paddingBottom: '0',
    },
    tab: {
        padding: '12px 24px',
        fontSize: '14px',
        fontWeight: '500',
        color: '#64748b',
        backgroundColor: 'transparent',
        border: 'none',
        borderBottom: '2px solid transparent',
        marginBottom: '-2px',
        cursor: 'pointer',
        transition: 'all 0.2s',
    },
    tabActive: {
        color: '#3b82f6',
        borderBottomColor: '#3b82f6',
    },
    resultsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '20px',
        marginBottom: '24px',
    },
    resultCard: {
        borderRadius: '12px',
        padding: '24px',
        textAlign: 'center',
    },
    lambdaCard: {
        background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
        border: '2px solid #f59e0b',
    },
    fargateCard: {
        background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
        border: '2px solid #3b82f6',
    },
    winnerCard: {
        boxShadow: '0 0 0 3px rgba(34, 197, 94, 0.3)',
    },
    resultLabel: {
        fontSize: '14px',
        fontWeight: '500',
        color: '#475569',
        marginBottom: '4px',
    },
    resultValue: {
        fontSize: '32px',
        fontWeight: '700',
        marginBottom: '8px',
    },
    lambdaValue: {
        color: '#b45309',
    },
    fargateValue: {
        color: '#1d4ed8',
    },
    resultSubtext: {
        fontSize: '12px',
        color: '#64748b',
    },
    breakEvenCard: {
        background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
        border: '2px solid #10b981',
        borderRadius: '12px',
        padding: '24px',
        textAlign: 'center',
        marginBottom: '24px',
    },
    breakEvenValue: {
        fontSize: '28px',
        fontWeight: '700',
        color: '#059669',
        marginBottom: '8px',
    },
    breakEvenLabel: {
        fontSize: '14px',
        color: '#047857',
    },
    chartContainer: {
        background: '#fff',
        borderRadius: '12px',
        padding: '24px',
        border: '1px solid #e2e8f0',
        marginBottom: '24px',
    },
    chartTitle: {
        fontSize: '16px',
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: '16px',
    },
    chart: {
        width: '100%',
        height: '300px',
        position: 'relative',
    },
    legend: {
        display: 'flex',
        justifyContent: 'center',
        gap: '24px',
        marginTop: '16px',
    },
    legendItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '13px',
        color: '#475569',
    },
    legendDot: {
        width: '12px',
        height: '12px',
        borderRadius: '50%',
    },
    tcoBreakdown: {
        marginTop: '24px',
    },
    breakdownTable: {
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '14px',
    },
    breakdownHeader: {
        backgroundColor: '#f8fafc',
        borderBottom: '2px solid #e2e8f0',
    },
    breakdownTh: {
        padding: '12px 16px',
        textAlign: 'left',
        fontWeight: '600',
        color: '#1e293b',
    },
    breakdownTd: {
        padding: '12px 16px',
        borderBottom: '1px solid #e2e8f0',
        color: '#475569',
    },
    breakdownTdRight: {
        textAlign: 'right',
        fontFamily: 'monospace',
        fontWeight: '500',
    },
    totalRow: {
        backgroundColor: '#f8fafc',
        fontWeight: '600',
    },
    winnerBadge: {
        display: 'inline-block',
        padding: '4px 12px',
        borderRadius: '9999px',
        fontSize: '12px',
        fontWeight: '600',
        backgroundColor: '#22c55e',
        color: '#fff',
        marginTop: '8px',
    },
    infoBox: {
        backgroundColor: '#eff6ff',
        border: '1px solid #bfdbfe',
        borderRadius: '8px',
        padding: '16px',
        marginTop: '24px',
    },
    infoTitle: {
        fontSize: '14px',
        fontWeight: '600',
        color: '#1e40af',
        marginBottom: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    infoText: {
        fontSize: '13px',
        color: '#1e40af',
        lineHeight: '1.6',
        margin: 0,
    },
    toggleContainer: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '16px',
    },
    toggle: {
        position: 'relative',
        width: '48px',
        height: '24px',
        backgroundColor: '#cbd5e1',
        borderRadius: '12px',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
    },
    toggleActive: {
        backgroundColor: '#3b82f6',
    },
    toggleKnob: {
        position: 'absolute',
        top: '2px',
        left: '2px',
        width: '20px',
        height: '20px',
        backgroundColor: '#fff',
        borderRadius: '50%',
        transition: 'transform 0.2s',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
    },
    toggleKnobActive: {
        transform: 'translateX(24px)',
    },
    toggleLabel: {
        fontSize: '14px',
        color: '#475569',
    },
    savingsCard: {
        background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
        border: '2px solid #a855f7',
        borderRadius: '12px',
        padding: '20px',
        textAlign: 'center',
    },
    savingsValue: {
        fontSize: '24px',
        fontWeight: '700',
        color: '#7c3aed',
    },
    savingsLabel: {
        fontSize: '13px',
        color: '#6b21a8',
        marginTop: '4px',
    },
    tooltipContainer: {
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
    },
    tooltipTrigger: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '16px',
        height: '16px',
        borderRadius: '50%',
        backgroundColor: '#e2e8f0',
        color: '#64748b',
        fontSize: '11px',
        fontWeight: '600',
        cursor: 'help',
        border: 'none',
        padding: 0,
        transition: 'all 0.2s',
    },
    tooltipTriggerHover: {
        backgroundColor: '#3b82f6',
        color: '#fff',
    },
    tooltipContent: {
        width: 'max-content',
        maxWidth: '420px',
        padding: '14px 16px',
        backgroundColor: '#1e293b',
        color: '#f1f5f9',
        fontSize: '12px',
        lineHeight: '1.5',
        borderRadius: '8px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)',
        zIndex: 1000,
        pointerEvents: 'none',
    },
    tooltipArrow: {
        position: 'absolute',
        top: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 0,
        height: 0,
        borderLeft: '6px solid transparent',
        borderRight: '6px solid transparent',
        borderTop: '6px solid #1e293b',
    },
    tooltipTitle: {
        fontWeight: '600',
        marginBottom: '6px',
        color: '#fff',
    },
    tooltipExample: {
        marginTop: '8px',
        padding: '8px',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: '4px',
        fontFamily: 'monospace',
        fontSize: '11px',
    },
};

// Utility functions
const formatCurrency = (value) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
};

const formatNumber = (value) => {
    if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)}B`;
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toString();
};

// Simple SVG Chart Component
const CostChart = ({ lambdaCosts, fargateCosts, invocationPoints, breakEvenPoint }) => {
    const width = 800;
    const height = 280;
    const padding = { top: 20, right: 80, bottom: 50, left: 70 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const maxCost = Math.max(...lambdaCosts, ...fargateCosts) * 1.1;
    const minInv = Math.min(...invocationPoints);
    const maxInv = Math.max(...invocationPoints);

    const logScale = (value, min, max) => {
        const logMin = Math.log10(min);
        const logMax = Math.log10(max);
        const logValue = Math.log10(value);
        return (logValue - logMin) / (logMax - logMin);
    };

    const xScale = (inv) => padding.left + logScale(inv, minInv, maxInv) * chartWidth;
    const yScale = (cost) => padding.top + chartHeight - (cost / maxCost) * chartHeight;

    const lambdaPath = invocationPoints.map((inv, i) => {
        const x = xScale(inv);
        const y = yScale(lambdaCosts[i]);
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    const fargatePath = invocationPoints.map((inv, i) => {
        const x = xScale(inv);
        const y = yScale(fargateCosts[i]);
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    const xTicks = [10000, 100000, 1000000, 10000000, 100000000, 1000000000].filter(v => v >= minInv && v <= maxInv);
    const yTicks = Array.from({ length: 5 }, (_, i) => (maxCost / 4) * i);

    return (
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
            {/* Grid lines */}
            {yTicks.map((tick, i) => (
                <line
                    key={`y-${i}`}
                    x1={padding.left}
                    x2={width - padding.right}
                    y1={yScale(tick)}
                    y2={yScale(tick)}
                    stroke="#e2e8f0"
                    strokeDasharray="4,4"
                />
            ))}

            {/* Y-axis labels */}
            {yTicks.map((tick, i) => (
                <text
                    key={`y-label-${i}`}
                    x={padding.left - 10}
                    y={yScale(tick)}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fontSize="11"
                    fill="#64748b"
                >
                    {formatCurrency(tick)}
                </text>
            ))}

            {/* X-axis labels */}
            {xTicks.map((tick, i) => (
                <text
                    key={`x-label-${i}`}
                    x={xScale(tick)}
                    y={height - padding.bottom + 20}
                    textAnchor="middle"
                    fontSize="11"
                    fill="#64748b"
                >
                    {formatNumber(tick)}
                </text>
            ))}

            {/* Axis titles */}
            <text
                x={width / 2}
                y={height - 5}
                textAnchor="middle"
                fontSize="12"
                fill="#475569"
                fontWeight="500"
            >
                Monthly Invocations
            </text>
            <text
                x={15}
                y={height / 2}
                textAnchor="middle"
                fontSize="12"
                fill="#475569"
                fontWeight="500"
                transform={`rotate(-90, 15, ${height / 2})`}
            >
                Monthly Cost ($)
            </text>

            {/* Break-even vertical line */}
            {breakEvenPoint && breakEvenPoint >= minInv && breakEvenPoint <= maxInv && (
                <>
                    <line
                        x1={xScale(breakEvenPoint)}
                        x2={xScale(breakEvenPoint)}
                        y1={padding.top}
                        y2={height - padding.bottom}
                        stroke="#10b981"
                        strokeWidth="2"
                        strokeDasharray="6,4"
                    />
                    <text
                        x={xScale(breakEvenPoint)}
                        y={padding.top - 5}
                        textAnchor="middle"
                        fontSize="11"
                        fill="#10b981"
                        fontWeight="600"
                    >
                        Break-even: {formatNumber(breakEvenPoint)}
                    </text>
                </>
            )}

            {/* Cost lines */}
            <path
                d={lambdaPath}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d={fargatePath}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* Data points */}
            {invocationPoints.map((inv, i) => (
                <React.Fragment key={`points-${i}`}>
                    <circle cx={xScale(inv)} cy={yScale(lambdaCosts[i])} r="4" fill="#f59e0b" />
                    <circle cx={xScale(inv)} cy={yScale(fargateCosts[i])} r="4" fill="#3b82f6" />
                </React.Fragment>
            ))}
        </svg>
    );
};

// Tooltip Component — uses fixed positioning to avoid clipping by parent containers
const Tooltip = ({ children, content, title, example }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [pos, setPos] = useState({ top: 0, left: 0 });
    const triggerRef = useRef(null);

    const show = useCallback(() => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setPos({
                top: rect.top - 8,
                left: rect.left + rect.width / 2,
            });
        }
        setIsVisible(true);
    }, []);

    const hide = useCallback(() => setIsVisible(false), []);

    return (
        <span style={styles.tooltipContainer}>
            {children}
            <button
                ref={triggerRef}
                style={{
                    ...styles.tooltipTrigger,
                    ...(isVisible ? styles.tooltipTriggerHover : {}),
                }}
                onMouseEnter={show}
                onMouseLeave={hide}
                onFocus={show}
                onBlur={hide}
                aria-label="More information"
                type="button"
            >
                ?
            </button>
            {isVisible && (
                <div style={{
                    ...styles.tooltipContent,
                    position: 'fixed',
                    top: pos.top,
                    left: pos.left,
                    transform: 'translate(-50%, -100%)',
                }}>
                    {title && <div style={styles.tooltipTitle}>{title}</div>}
                    <div>{content}</div>
                    {example && <div style={styles.tooltipExample}>{example}</div>}
                    <div style={styles.tooltipArrow} />
                </div>
            )}
        </span>
    );
};

// Main Component
export default function LambdaFargateCostExercise() {
    // State
    const [activeTab, setActiveTab] = useState('cloud'); // 'cloud' or 'tco'
    const [region, setRegion] = useState('us-east-1');
    const [lambdaMemory, setLambdaMemory] = useState(1024);
    const [duration, setDuration] = useState(200);
    const [invocationsPerMonth, setInvocationsPerMonth] = useState(1000000);
    const [fargateConfig, setFargateConfig] = useState(FARGATE_CONFIGS[1]); // 0.25 vCPU, 1 GB (matches 1024 MB Lambda)
    const [useArm, setUseArm] = useState(true);
    const [engineerSalary, setEngineerSalary] = useState(120000);
    const [utilizationPercent, setUtilizationPercent] = useState(70);
    const [includeFreerier, setIncludeFreeTier] = useState(false);

    // Handler for Lambda memory change (always updates Fargate to equivalent)
    const handleLambdaMemoryChange = (newMemory) => {
        setLambdaMemory(newMemory);
        const mappedConfig = LAMBDA_TO_FARGATE_MAP[newMemory];
        if (mappedConfig) {
            const config = FARGATE_CONFIGS.find(
                c => c.vcpu === mappedConfig.vcpu && c.memory === mappedConfig.memory
            );
            if (config) setFargateConfig(config);
        }
    };

    // Handler for Fargate config change (always updates Lambda to equivalent)
    const handleFargateConfigChange = (vcpu, memory) => {
        const config = FARGATE_CONFIGS.find(c => c.vcpu === vcpu && c.memory === memory);
        if (config) {
            setFargateConfig(config);
            const lambdaMem = getFargateToLambdaMemory(vcpu, memory);
            setLambdaMemory(lambdaMem);
        }
    };

    // Region-specific pricing
    const regionPricing = AWS_REGION_PRICING[region];
    const LAMBDA_PRICING = regionPricing.lambda;
    const FARGATE_PRICING = regionPricing.fargate;

    // Calculate Lambda cost
    const lambdaCost = useMemo(() => {
        const memoryGB = lambdaMemory / 1024;
        const durationSec = duration / 1000;
        const gbSeconds = invocationsPerMonth * memoryGB * durationSec;

        const pricePerGbSecond = useArm ? LAMBDA_PRICING.gbSecondArm : LAMBDA_PRICING.gbSecondX86;

        let billableRequests = invocationsPerMonth;
        let billableGbSeconds = gbSeconds;

        if (includeFreerier) {
            billableRequests = Math.max(0, invocationsPerMonth - LAMBDA_PRICING.freeRequests);
            billableGbSeconds = Math.max(0, gbSeconds - LAMBDA_PRICING.freeGbSeconds);
        }

        const requestCost = (billableRequests / 1000000) * LAMBDA_PRICING.requestPer1M;
        const computeCost = billableGbSeconds * pricePerGbSecond;

        return {
            requests: requestCost,
            compute: computeCost,
            total: requestCost + computeCost,
            gbSeconds: gbSeconds,
        };
    }, [lambdaMemory, duration, invocationsPerMonth, useArm, includeFreerier, LAMBDA_PRICING]);

    // Calculate Fargate cost (always-on for comparison)
    const fargateCost = useMemo(() => {
        const hoursPerMonth = 730; // Average hours in a month
        const vcpuPrice = useArm ? FARGATE_PRICING.vcpuPerHourArm : FARGATE_PRICING.vcpuPerHour;
        const memoryPrice = useArm ? FARGATE_PRICING.gbPerHourArm : FARGATE_PRICING.gbPerHour;

        // Calculate required tasks based on utilization
        const avgDurationSec = duration / 1000;
        const requestsPerSecond = invocationsPerMonth / (hoursPerMonth * 3600);
        const concurrentRequests = requestsPerSecond * avgDurationSec;
        const tasksNeeded = Math.max(1, Math.ceil(concurrentRequests / (utilizationPercent / 100)));

        const vcpuCost = fargateConfig.vcpu * vcpuPrice * hoursPerMonth * tasksNeeded;
        const memoryCost = fargateConfig.memory * memoryPrice * hoursPerMonth * tasksNeeded;

        return {
            vcpu: vcpuCost,
            memory: memoryCost,
            total: vcpuCost + memoryCost,
            tasksNeeded: tasksNeeded,
        };
    }, [fargateConfig, useArm, duration, invocationsPerMonth, utilizationPercent, FARGATE_PRICING]);

    // Calculate TCO costs
    const tcoCosts = useMemo(() => {
        const hourlyRate = engineerSalary / 2080; // Standard work hours per year

        const lambdaOps = TCO_FACTORS.lambda.operationsHoursPerMonth * hourlyRate;
        const fargateOps = TCO_FACTORS.fargate.operationsHoursPerMonth * hourlyRate;

        // Development cost amortized monthly (assuming 3-month initial dev, amortized over 12 months)
        const baseDevelopmentHours = 160; // ~1 month of dev time
        const lambdaDev = (baseDevelopmentHours * TCO_FACTORS.lambda.developmentMultiplier * hourlyRate) / 12;
        const fargateDev = (baseDevelopmentHours * TCO_FACTORS.fargate.developmentMultiplier * hourlyRate) / 12;

        // Maintenance cost monthly
        const baseMaintenanceHours = 20; // Hours per month
        const lambdaMaint = baseMaintenanceHours * TCO_FACTORS.lambda.maintenanceMultiplier * hourlyRate;
        const fargateMaint = baseMaintenanceHours * TCO_FACTORS.fargate.maintenanceMultiplier * hourlyRate;

        return {
            lambda: {
                infrastructure: lambdaCost.total,
                operations: lambdaOps,
                development: lambdaDev,
                maintenance: lambdaMaint,
                total: lambdaCost.total + lambdaOps + lambdaDev + lambdaMaint,
            },
            fargate: {
                infrastructure: fargateCost.total,
                operations: fargateOps,
                development: fargateDev,
                maintenance: fargateMaint,
                total: fargateCost.total + fargateOps + fargateDev + fargateMaint,
            },
        };
    }, [lambdaCost, fargateCost, engineerSalary]);

    // Calculate break-even point
    const breakEvenPoint = useMemo(() => {
        // Binary search for break-even
        let low = 1000;
        let high = 10000000000;

        const calculateCosts = (invocations) => {
            const memoryGB = lambdaMemory / 1024;
            const durationSec = duration / 1000;
            const gbSeconds = invocations * memoryGB * durationSec;

            const pricePerGbSecond = useArm ? LAMBDA_PRICING.gbSecondArm : LAMBDA_PRICING.gbSecondX86;
            const requestCost = (invocations / 1000000) * LAMBDA_PRICING.requestPer1M;
            const computeCost = gbSeconds * pricePerGbSecond;
            const lambdaTotal = requestCost + computeCost;

            const hoursPerMonth = 730;
            const vcpuPrice = useArm ? FARGATE_PRICING.vcpuPerHourArm : FARGATE_PRICING.vcpuPerHour;
            const memoryPrice = useArm ? FARGATE_PRICING.gbPerHourArm : FARGATE_PRICING.gbPerHour;

            const requestsPerSecond = invocations / (hoursPerMonth * 3600);
            const concurrentRequests = requestsPerSecond * (duration / 1000);
            const tasksNeeded = Math.max(1, Math.ceil(concurrentRequests / (utilizationPercent / 100)));

            const vcpuCost = fargateConfig.vcpu * vcpuPrice * hoursPerMonth * tasksNeeded;
            const memoryCost = fargateConfig.memory * memoryPrice * hoursPerMonth * tasksNeeded;
            const fargateTotal = vcpuCost + memoryCost;

            return { lambda: lambdaTotal, fargate: fargateTotal };
        };

        // Find where Lambda becomes more expensive than Fargate
        while (high - low > 1000) {
            const mid = Math.floor((low + high) / 2);
            const costs = calculateCosts(mid);

            if (costs.lambda < costs.fargate) {
                low = mid;
            } else {
                high = mid;
            }
        }

        return Math.round(low);
    }, [lambdaMemory, duration, fargateConfig, useArm, utilizationPercent, LAMBDA_PRICING, FARGATE_PRICING]);

    // Generate chart data
    const chartData = useMemo(() => {
        const points = [10000, 50000, 100000, 500000, 1000000, 5000000, 10000000, 50000000, 100000000, 500000000, 1000000000];

        const calculateLambda = (inv) => {
            const memoryGB = lambdaMemory / 1024;
            const durationSec = duration / 1000;
            const gbSeconds = inv * memoryGB * durationSec;
            const pricePerGbSecond = useArm ? LAMBDA_PRICING.gbSecondArm : LAMBDA_PRICING.gbSecondX86;
            return (inv / 1000000) * LAMBDA_PRICING.requestPer1M + gbSeconds * pricePerGbSecond;
        };

        const calculateFargate = (inv) => {
            const hoursPerMonth = 730;
            const vcpuPrice = useArm ? FARGATE_PRICING.vcpuPerHourArm : FARGATE_PRICING.vcpuPerHour;
            const memoryPrice = useArm ? FARGATE_PRICING.gbPerHourArm : FARGATE_PRICING.gbPerHour;
            const requestsPerSecond = inv / (hoursPerMonth * 3600);
            const concurrentRequests = requestsPerSecond * (duration / 1000);
            const tasksNeeded = Math.max(1, Math.ceil(concurrentRequests / (utilizationPercent / 100)));
            return (fargateConfig.vcpu * vcpuPrice + fargateConfig.memory * memoryPrice) * hoursPerMonth * tasksNeeded;
        };

        return {
            invocationPoints: points,
            lambdaCosts: points.map(calculateLambda),
            fargateCosts: points.map(calculateFargate),
        };
    }, [lambdaMemory, duration, fargateConfig, useArm, utilizationPercent, LAMBDA_PRICING, FARGATE_PRICING]);

    const cloudWinner = lambdaCost.total <= fargateCost.total ? 'lambda' : 'fargate';
    const tcoWinner = tcoCosts.lambda.total <= tcoCosts.fargate.total ? 'lambda' : 'fargate';
    const savings = Math.abs(lambdaCost.total - fargateCost.total);
    const savingsPercent = Math.abs((lambdaCost.total - fargateCost.total) / Math.max(lambdaCost.total, fargateCost.total) * 100);

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h1 style={styles.title}>Lambda vs Fargate Cost Calculator</h1>
                <p style={styles.subtitle}>
                    Interactive comparison with break-even analysis and TCO insights
                </p>
            </div>

            {/* Tab Navigation */}
            <div style={styles.tabContainer}>
                <button
                    style={{ ...styles.tab, ...(activeTab === 'cloud' ? styles.tabActive : {}) }}
                    onClick={() => setActiveTab('cloud')}
                >
                    ☁️ Cloud Costs Only
                </button>
                <button
                    style={{ ...styles.tab, ...(activeTab === 'tco' ? styles.tabActive : {}) }}
                    onClick={() => setActiveTab('tco')}
                >
                    📊 Total Cost of Ownership
                </button>
            </div>

            {/* Configuration Panel */}
            <div style={styles.card}>
                <h3 style={styles.cardTitle}>
                    ⚙️ Configuration
                </h3>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
                    Lambda and Fargate sizes are linked by memory. The Fargate task is set to the smallest
                    configuration whose memory meets or exceeds the Lambda allocation.
                    {' '}<strong>{lambdaMemory >= 1024 ? `${(lambdaMemory / 1024).toFixed(1)} GB` : `${lambdaMemory} MB`} Lambda → {fargateConfig.vcpu} vCPU / {fargateConfig.memory} GB Fargate</strong>
                </div>
                <div style={styles.grid}>
                    {/* Lambda Config */}
                    <div>
                        <h4 style={{ marginTop: 0, marginBottom: '16px', color: '#b45309', fontSize: '15px' }}>
                            🟡 AWS Lambda
                        </h4>
                        <div style={styles.inputGroup}>
                            <label style={styles.label}>
                                <Tooltip
                                    title="Lambda Memory Allocation"
                                    content="Memory directly affects both cost and performance. More memory also allocates proportionally more CPU power. Finding the right balance can actually reduce costs—a function that runs 2x faster at 2x memory costs the same but finishes sooner."
                                    example="1,769 MB ≈ 1 vCPU equivalent"
                                >
                                    Memory Allocation
                                </Tooltip>
                            </label>
                            <select
                                style={styles.select}
                                value={lambdaMemory}
                                onChange={(e) => handleLambdaMemoryChange(Number(e.target.value))}
                            >
                                {MEMORY_OPTIONS.map((mem) => (
                                    <option key={mem} value={mem}>
                                        {mem >= 1024 ? `${(mem / 1024).toFixed(1)} GB` : `${mem} MB`}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div style={styles.inputGroup}>
                            <label style={styles.label}>Average Duration</label>
                            <select
                                style={styles.select}
                                value={duration}
                                onChange={(e) => setDuration(Number(e.target.value))}
                            >
                                {DURATION_OPTIONS.map((dur) => (
                                    <option key={dur} value={dur}>
                                        {dur >= 1000 ? `${(dur / 1000).toFixed(1)} s` : `${dur} ms`}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Fargate Config */}
                    <div>
                        <h4 style={{ marginTop: 0, marginBottom: '16px', color: '#1d4ed8', fontSize: '15px' }}>
                            🔵 AWS Fargate
                        </h4>
                        <div style={styles.inputGroup}>
                            <label style={styles.label}>
                                <Tooltip
                                    title="Fargate Task Size"
                                    content="The vCPU and memory allocated to each Fargate task. Unlike Lambda, you choose fixed configurations. Tasks run 24/7 and are billed per-second. Choose based on your workload's resource needs—oversizing wastes money, undersizing causes performance issues."
                                    example="1 vCPU + 2 GB ≈ $29.50/month per task"
                                >
                                    Task Size
                                </Tooltip>
                            </label>
                            <select
                                style={styles.select}
                                value={`${fargateConfig.vcpu}-${fargateConfig.memory}`}
                                onChange={(e) => {
                                    const [vcpu, memory] = e.target.value.split('-').map(Number);
                                    handleFargateConfigChange(vcpu, memory);
                                }}
                            >
                                {FARGATE_CONFIGS.map((config) => (
                                        <option key={config.label} value={`${config.vcpu}-${config.memory}`}>
                                            {config.label}
                                        </option>
                                    ))}
                            </select>
                        </div>
                        <div style={styles.inputGroup}>
                            <label style={styles.label}>
                                <Tooltip
                                    title="What is Fargate Target Utilization?"
                                    content="The percentage of time each Fargate task is actively processing requests. Lower utilization means more idle capacity (and higher costs) but better handling of traffic spikes. Higher utilization is more cost-efficient but risks performance degradation under load."
                                    example="70% utilization = task handles requests 70% of the time, idle 30%"
                                >
                                    Fargate Target Utilization
                                </Tooltip>
                            </label>
                            <select
                                style={styles.select}
                                value={utilizationPercent}
                                onChange={(e) => setUtilizationPercent(Number(e.target.value))}
                            >
                                <option value={50}>50% (Conservative)</option>
                                <option value={60}>60%</option>
                                <option value={70}>70% (Typical)</option>
                                <option value={80}>80% (Optimized)</option>
                                <option value={90}>90% (Aggressive)</option>
                            </select>
                        </div>
                    </div>

                    {/* Shared Config */}
                    <div>
                        <h4 style={{ marginTop: 0, marginBottom: '16px', color: '#475569', fontSize: '15px' }}>
                            📈 Workload
                        </h4>
                        <div style={styles.inputGroup}>
                            <label style={styles.label}>AWS Region</label>
                            <select
                                style={styles.select}
                                value={region}
                                onChange={(e) => setRegion(e.target.value)}
                            >
                                {Object.entries(AWS_REGION_PRICING).map(([id, r]) => (
                                    <option key={id} value={id}>
                                        {r.name} ({id})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div style={styles.inputGroup}>
                            <label style={styles.label}>Monthly Invocations</label>
                            <input
                                type="number"
                                style={styles.input}
                                value={invocationsPerMonth}
                                onChange={(e) => setInvocationsPerMonth(Number(e.target.value) || 0)}
                                min="0"
                            />
                            <div style={styles.presetButtons}>
                                {INVOCATION_PRESETS.map((preset) => (
                                    <button
                                        key={preset.value}
                                        style={{
                                            ...styles.presetButton,
                                            ...(invocationsPerMonth === preset.value ? styles.presetButtonActive : {}),
                                        }}
                                        onClick={() => setInvocationsPerMonth(preset.value)}
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div style={styles.toggleContainer}>
                            <div
                                style={{ ...styles.toggle, ...(useArm ? styles.toggleActive : {}) }}
                                onClick={() => setUseArm(!useArm)}
                            >
                                <div style={{ ...styles.toggleKnob, ...(useArm ? styles.toggleKnobActive : {}) }} />
                            </div>
                            <span style={styles.toggleLabel}>
                                {useArm ? 'ARM/Graviton (20% cheaper)' : 'x86 Architecture'}
                            </span>
                        </div>
                        <div style={styles.toggleContainer}>
                            <div
                                style={{ ...styles.toggle, ...(includeFreerier ? styles.toggleActive : {}) }}
                                onClick={() => setIncludeFreeTier(!includeFreerier)}
                            >
                                <div style={{ ...styles.toggleKnob, ...(includeFreerier ? styles.toggleKnobActive : {}) }} />
                            </div>
                            <span style={styles.toggleLabel}>Include Lambda Free Tier</span>
                        </div>
                    </div>

                    {/* TCO Config (only shown in TCO tab) */}
                    {activeTab === 'tco' && (
                        <div>
                            <h4 style={{ marginTop: 0, marginBottom: '16px', color: '#7c3aed', fontSize: '15px' }}>
                                👤 Human Costs
                            </h4>
                            <div style={styles.inputGroup}>
                                <label style={styles.label}>Engineer Annual Salary (USD)</label>
                                <input
                                    type="number"
                                    style={styles.input}
                                    value={engineerSalary}
                                    onChange={(e) => setEngineerSalary(Number(e.target.value) || 0)}
                                    min="0"
                                    step="10000"
                                />
                                <div style={styles.presetButtons}>
                                    {[80000, 100000, 120000, 150000, 180000, 200000].map((salary) => (
                                        <button
                                            key={salary}
                                            style={{
                                                ...styles.presetButton,
                                                ...(engineerSalary === salary ? styles.presetButtonActive : {}),
                                            }}
                                            onClick={() => setEngineerSalary(salary)}
                                        >
                                            ${(salary / 1000)}K
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Results Section */}
            {activeTab === 'cloud' ? (
                <>
                    {/* Cloud Cost Results */}
                    <div style={styles.resultsGrid}>
                        <div style={{
                            ...styles.resultCard,
                            ...styles.lambdaCard,
                            ...(cloudWinner === 'lambda' ? styles.winnerCard : {}),
                        }}>
                            <div style={styles.resultLabel}>AWS Lambda</div>
                            <div style={{ ...styles.resultValue, ...styles.lambdaValue }}>
                                {formatCurrency(lambdaCost.total)}
                            </div>
                            <div style={styles.resultSubtext}>
                                Requests: {formatCurrency(lambdaCost.requests)} | Compute: {formatCurrency(lambdaCost.compute)}
                            </div>
                            {cloudWinner === 'lambda' && (
                                <div style={styles.winnerBadge}>✓ Best Value</div>
                            )}
                        </div>

                        <div style={{
                            ...styles.resultCard,
                            ...styles.fargateCard,
                            ...(cloudWinner === 'fargate' ? styles.winnerCard : {}),
                        }}>
                            <div style={styles.resultLabel}>AWS Fargate</div>
                            <div style={{ ...styles.resultValue, ...styles.fargateValue }}>
                                {formatCurrency(fargateCost.total)}
                            </div>
                            <div style={styles.resultSubtext}>
                                {fargateCost.tasksNeeded} task{fargateCost.tasksNeeded > 1 ? 's' : ''} running 24/7
                            </div>
                            {cloudWinner === 'fargate' && (
                                <div style={styles.winnerBadge}>✓ Best Value</div>
                            )}
                        </div>

                        <div style={styles.savingsCard}>
                            <div style={styles.savingsValue}>
                                {formatCurrency(savings)} ({savingsPercent.toFixed(1)}%)
                            </div>
                            <div style={styles.savingsLabel}>
                                Monthly savings with {cloudWinner === 'lambda' ? 'Lambda' : 'Fargate'}
                            </div>
                        </div>
                    </div>

                    {/* Break-even Point */}
                    <div style={styles.breakEvenCard}>
                        <div style={styles.breakEvenValue}>
                            {formatNumber(breakEvenPoint)} invocations/month
                        </div>
                        <div style={styles.breakEvenLabel}>
                            Break-even point: Lambda is cheaper below this, Fargate is cheaper above
                        </div>
                    </div>

                    {/* Chart */}
                    <div style={styles.chartContainer}>
                        <h3 style={styles.chartTitle}>Cost Comparison Across Scale</h3>
                        <CostChart
                            lambdaCosts={chartData.lambdaCosts}
                            fargateCosts={chartData.fargateCosts}
                            invocationPoints={chartData.invocationPoints}
                            breakEvenPoint={breakEvenPoint}
                        />
                        <div style={styles.legend}>
                            <div style={styles.legendItem}>
                                <div style={{ ...styles.legendDot, backgroundColor: '#f59e0b' }} />
                                Lambda ({useArm ? 'ARM' : 'x86'})
                            </div>
                            <div style={styles.legendItem}>
                                <div style={{ ...styles.legendDot, backgroundColor: '#3b82f6' }} />
                                Fargate ({fargateConfig.label})
                            </div>
                            <div style={styles.legendItem}>
                                <div style={{ ...styles.legendDot, backgroundColor: '#10b981' }} />
                                Break-even Point
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <>
                    {/* TCO Results */}
                    <div style={styles.resultsGrid}>
                        <div style={{
                            ...styles.resultCard,
                            ...styles.lambdaCard,
                            ...(tcoWinner === 'lambda' ? styles.winnerCard : {}),
                        }}>
                            <div style={styles.resultLabel}>Lambda Total Cost of Ownership</div>
                            <div style={{ ...styles.resultValue, ...styles.lambdaValue }}>
                                {formatCurrency(tcoCosts.lambda.total)}
                            </div>
                            <div style={styles.resultSubtext}>per month (infrastructure + human costs)</div>
                            {tcoWinner === 'lambda' && (
                                <div style={styles.winnerBadge}>✓ Lower TCO</div>
                            )}
                        </div>

                        <div style={{
                            ...styles.resultCard,
                            ...styles.fargateCard,
                            ...(tcoWinner === 'fargate' ? styles.winnerCard : {}),
                        }}>
                            <div style={styles.resultLabel}>Fargate Total Cost of Ownership</div>
                            <div style={{ ...styles.resultValue, ...styles.fargateValue }}>
                                {formatCurrency(tcoCosts.fargate.total)}
                            </div>
                            <div style={styles.resultSubtext}>per month (infrastructure + human costs)</div>
                            {tcoWinner === 'fargate' && (
                                <div style={styles.winnerBadge}>✓ Lower TCO</div>
                            )}
                        </div>
                    </div>

                    {/* TCO Breakdown Table */}
                    <div style={styles.card}>
                        <h3 style={styles.cardTitle}>📋 TCO Breakdown (Monthly)</h3>
                        <table style={styles.breakdownTable}>
                            <thead style={styles.breakdownHeader}>
                                <tr>
                                    <th style={styles.breakdownTh}>Cost Category</th>
                                    <th style={{ ...styles.breakdownTh, textAlign: 'right' }}>Lambda</th>
                                    <th style={{ ...styles.breakdownTh, textAlign: 'right' }}>Fargate</th>
                                    <th style={{ ...styles.breakdownTh, textAlign: 'right' }}>Difference</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style={styles.breakdownTd}>☁️ Infrastructure (AWS)</td>
                                    <td style={{ ...styles.breakdownTd, ...styles.breakdownTdRight }}>
                                        {formatCurrency(tcoCosts.lambda.infrastructure)}
                                    </td>
                                    <td style={{ ...styles.breakdownTd, ...styles.breakdownTdRight }}>
                                        {formatCurrency(tcoCosts.fargate.infrastructure)}
                                    </td>
                                    <td style={{
                                        ...styles.breakdownTd,
                                        ...styles.breakdownTdRight,
                                        color: tcoCosts.lambda.infrastructure < tcoCosts.fargate.infrastructure ? '#16a34a' : '#dc2626',
                                    }}>
                                        {tcoCosts.lambda.infrastructure < tcoCosts.fargate.infrastructure ? '-' : '+'}
                                        {formatCurrency(Math.abs(tcoCosts.lambda.infrastructure - tcoCosts.fargate.infrastructure))}
                                    </td>
                                </tr>
                                <tr>
                                    <td style={styles.breakdownTd}>
                                        <Tooltip
                                            title="Operations & Monitoring"
                                            content="Time spent on day-to-day operational tasks: monitoring dashboards, reviewing logs and alerts, scaling adjustments, incident response, and on-call support. Lambda requires ~2 hrs/month (managed scaling, built-in monitoring). Fargate requires ~8 hrs/month (container health, task scaling policies, load balancer tuning, networking)."
                                        >
                                            🔧 Operations & Monitoring
                                        </Tooltip>
                                    </td>
                                    <td style={{ ...styles.breakdownTd, ...styles.breakdownTdRight }}>
                                        {formatCurrency(tcoCosts.lambda.operations)}
                                    </td>
                                    <td style={{ ...styles.breakdownTd, ...styles.breakdownTdRight }}>
                                        {formatCurrency(tcoCosts.fargate.operations)}
                                    </td>
                                    <td style={{
                                        ...styles.breakdownTd,
                                        ...styles.breakdownTdRight,
                                        color: tcoCosts.lambda.operations < tcoCosts.fargate.operations ? '#16a34a' : '#dc2626',
                                    }}>
                                        {tcoCosts.lambda.operations < tcoCosts.fargate.operations ? '-' : '+'}
                                        {formatCurrency(Math.abs(tcoCosts.lambda.operations - tcoCosts.fargate.operations))}
                                    </td>
                                </tr>
                                <tr>
                                    <td style={styles.breakdownTd}>💻 Development (Amortized)</td>
                                    <td style={{ ...styles.breakdownTd, ...styles.breakdownTdRight }}>
                                        {formatCurrency(tcoCosts.lambda.development)}
                                    </td>
                                    <td style={{ ...styles.breakdownTd, ...styles.breakdownTdRight }}>
                                        {formatCurrency(tcoCosts.fargate.development)}
                                    </td>
                                    <td style={{
                                        ...styles.breakdownTd,
                                        ...styles.breakdownTdRight,
                                        color: tcoCosts.lambda.development < tcoCosts.fargate.development ? '#16a34a' : '#dc2626',
                                    }}>
                                        {tcoCosts.lambda.development < tcoCosts.fargate.development ? '-' : '+'}
                                        {formatCurrency(Math.abs(tcoCosts.lambda.development - tcoCosts.fargate.development))}
                                    </td>
                                </tr>
                                <tr>
                                    <td style={styles.breakdownTd}>
                                        <Tooltip
                                            title="Maintenance & Patching"
                                            content="Ongoing effort to keep the runtime environment secure and up to date: OS and dependency patching, runtime version upgrades, container image rebuilds, security vulnerability remediation, and configuration drift management. Lambda handles most of this automatically (8x less maintenance per Deloitte research). Fargate requires managing base images, rebuilding containers, and coordinating rolling updates."
                                        >
                                            🛠️ Maintenance & Patching
                                        </Tooltip>
                                    </td>
                                    <td style={{ ...styles.breakdownTd, ...styles.breakdownTdRight }}>
                                        {formatCurrency(tcoCosts.lambda.maintenance)}
                                    </td>
                                    <td style={{ ...styles.breakdownTd, ...styles.breakdownTdRight }}>
                                        {formatCurrency(tcoCosts.fargate.maintenance)}
                                    </td>
                                    <td style={{
                                        ...styles.breakdownTd,
                                        ...styles.breakdownTdRight,
                                        color: tcoCosts.lambda.maintenance < tcoCosts.fargate.maintenance ? '#16a34a' : '#dc2626',
                                    }}>
                                        {tcoCosts.lambda.maintenance < tcoCosts.fargate.maintenance ? '-' : '+'}
                                        {formatCurrency(Math.abs(tcoCosts.lambda.maintenance - tcoCosts.fargate.maintenance))}
                                    </td>
                                </tr>
                                <tr style={styles.totalRow}>
                                    <td style={styles.breakdownTd}><strong>Total Monthly TCO</strong></td>
                                    <td style={{ ...styles.breakdownTd, ...styles.breakdownTdRight }}>
                                        <strong>{formatCurrency(tcoCosts.lambda.total)}</strong>
                                    </td>
                                    <td style={{ ...styles.breakdownTd, ...styles.breakdownTdRight }}>
                                        <strong>{formatCurrency(tcoCosts.fargate.total)}</strong>
                                    </td>
                                    <td style={{
                                        ...styles.breakdownTd,
                                        ...styles.breakdownTdRight,
                                        color: tcoCosts.lambda.total < tcoCosts.fargate.total ? '#16a34a' : '#dc2626',
                                    }}>
                                        <strong>
                                            {tcoCosts.lambda.total < tcoCosts.fargate.total ? '-' : '+'}
                                            {formatCurrency(Math.abs(tcoCosts.lambda.total - tcoCosts.fargate.total))}
                                        </strong>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* TCO Info Box */}
                    <div style={styles.infoBox}>
                        <div style={styles.infoTitle}>
                            💡 Understanding TCO
                        </div>
                        <p style={styles.infoText}>
                            Total Cost of Ownership goes beyond cloud bills. Based on AWS/Deloitte research, serverless
                            technologies like Lambda can reduce development time by 30% and maintenance costs by up to 8x
                            compared to traditional approaches. This calculator factors in: infrastructure costs,
                            operations/monitoring time, amortized development effort, and ongoing maintenance such as
                            patching and updates. While Fargate may show lower infrastructure costs at high scale,
                            Lambda often wins on TCO due to reduced human overhead.
                        </p>
                    </div>
                </>
            )}

            {/* Key Takeaways */}
            <div style={{ ...styles.card, marginTop: '24px' }}>
                <h3 style={styles.cardTitle}>🎯 Key Takeaways</h3>
                <div style={styles.grid}>
                    <div>
                        <h4 style={{ marginTop: 0, color: '#f59e0b', fontSize: '15px' }}>When Lambda Wins</h4>
                        <ul style={{ margin: 0, paddingLeft: '20px', color: '#475569', lineHeight: '1.8' }}>
                            <li>Low to moderate invocation volume (&lt;{formatNumber(breakEvenPoint)}/month)</li>
                            <li>Variable or spiky traffic patterns</li>
                            <li>Short function durations (&lt;1s)</li>
                            <li>Need for scale-to-zero</li>
                            <li>Minimizing operational overhead</li>
                            <li>Rapid development cycles</li>
                        </ul>
                    </div>
                    <div>
                        <h4 style={{ marginTop: 0, color: '#3b82f6', fontSize: '15px' }}>When Fargate Wins</h4>
                        <ul style={{ margin: 0, paddingLeft: '20px', color: '#475569', lineHeight: '1.8' }}>
                            <li>High, steady invocation volume (&gt;{formatNumber(breakEvenPoint)}/month)</li>
                            <li>Predictable, consistent traffic</li>
                            <li>Long-running processes (&gt;15 min)</li>
                            <li>Need for more compute control</li>
                            <li>Container ecosystem requirements</li>
                            <li>Existing container expertise</li>
                        </ul>
                    </div>
                    <div>
                        <h4 style={{ marginTop: 0, color: '#10b981', fontSize: '15px' }}>Cost Optimization Tips</h4>
                        <ul style={{ margin: 0, paddingLeft: '20px', color: '#475569', lineHeight: '1.8' }}>
                            <li>Use ARM/Graviton for 20% savings</li>
                            <li>Right-size memory allocation</li>
                            <li>Consider Compute Savings Plans (up to 52%)</li>
                            <li>Use Fargate Spot for fault-tolerant workloads</li>
                            <li>Monitor and optimize function duration</li>
                            <li>Batch requests where possible</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Disclaimer */}
            <div style={{
                textAlign: 'center',
                fontSize: '12px',
                color: '#94a3b8',
                marginTop: '24px',
                padding: '16px',
                borderTop: '1px solid #e2e8f0',
            }}>
                Pricing data as of February 2026 for {regionPricing.name}. TCO estimates based on AWS/Deloitte research.
                This calculator is directional—validate assumptions with your specific workload.
                Actual costs may vary based on data transfer, storage, and other AWS service usage.
            </div>
        </div>
    );
}