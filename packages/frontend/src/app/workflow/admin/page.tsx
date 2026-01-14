'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

// Dynamically import ECharts to avoid SSR issues
const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface DashboardData {
  overview: {
    totalWorkflows: number;
    completedWorkflows: number;
    inProgressWorkflows: number;
    publishedWorkflows: number;
    avgCompletionTime: number;
    thisWeekWorkflows: number;
    growthPercentage: number;
  };
  statusBreakdown: Record<string, number>;
  workflowsPerDay: Array<{ date: string; count: number }>;
  stepDistribution: Array<{ step: number; count: number }>;
  recentWorkflows: Array<{
    id: string;
    name: string;
    status: string;
    currentStep: number;
    createdAt: string;
    updatedAt: string;
  }>;
  costs: {
    totalApiCost: string;
    totalTokens: number;
    avgPerWorkflow: string;
    model: string;
    costPer1kTokens: number;
  };
}

const STEP_NAMES: Record<number, string> = {
  1: 'Program Foundation',
  2: 'KSC Framework',
  3: 'PLOs',
  4: 'Course Framework',
  5: 'Sources',
  6: 'Reading Lists',
  7: 'Assessments',
  8: 'Case Studies',
  9: 'Glossary',
  10: 'Lesson Plans & PPT',
};

const STATUS_COLORS: Record<string, string> = {
  'step1_pending': '#80A3A2',
  'step1_complete': '#6B8F8E',
  'review_pending': '#8b7fa3',
  'step9_complete': '#5ab0b2',
  'step10_complete': '#80A3A2',
  'published': '#459698',
  'default': '#ABCECF',
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/v3/workflow/analytics/dashboard`, {
        credentials: 'include',
      });
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Chart Options - Updated with teal palette
  const workflowsChartOption = useMemo(() => {
    if (!data?.workflowsPerDay) return {};
    
    const dates = data.workflowsPerDay.slice(-30).map(d => {
      const date = new Date(d.date);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    });
    const counts = data.workflowsPerDay.slice(-30).map(d => d.count);
    
    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: 'rgba(128, 163, 162, 0.3)',
        textStyle: { color: '#4A6667' },
        axisPointer: {
          type: 'cross',
          lineStyle: { color: 'rgba(128, 163, 162, 0.3)' }
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '10%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: dates,
        axisLine: { lineStyle: { color: 'rgba(128, 163, 162, 0.5)' } },
        axisLabel: { color: '#6B8F8E', fontSize: 10 },
        splitLine: { show: false }
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisLabel: { color: '#6B8F8E' },
        splitLine: { lineStyle: { color: 'rgba(128, 163, 162, 0.2)' } }
      },
      series: [{
        name: 'Workflows',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: {
          width: 3,
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: '#80A3A2' },
              { offset: 1, color: '#5ab0b2' }
            ]
          }
        },
        itemStyle: {
          color: '#80A3A2',
          borderColor: '#fff',
          borderWidth: 2
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(128, 163, 162, 0.4)' },
              { offset: 0.5, color: 'rgba(171, 206, 207, 0.2)' },
              { offset: 1, color: 'rgba(218, 244, 245, 0)' }
            ]
          }
        },
        data: counts
      }]
    };
  }, [data]);

  const stepDistributionOption = useMemo(() => {
    if (!data?.stepDistribution) return {};
    
    const steps = Array.from({ length: 10 }, (_, i) => i + 1);
    const stepData = steps.map(step => {
      const found = data.stepDistribution.find(s => s.step === step);
      return found?.count || 0;
    });
    
    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: 'rgba(128, 163, 162, 0.3)',
        textStyle: { color: '#4A6667' },
        formatter: (params: any) => {
          const step = params[0].dataIndex + 1;
          return `<strong>Step ${step}</strong><br/>${STEP_NAMES[step]}<br/>Count: ${params[0].value}`;
        }
      },
      grid: {
        left: '3%',
        right: '8%',
        bottom: '3%',
        top: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'value',
        axisLine: { show: false },
        axisLabel: { color: '#6B8F8E' },
        splitLine: { lineStyle: { color: 'rgba(128, 163, 162, 0.2)' } }
      },
      yAxis: {
        type: 'category',
        data: steps.map(s => `S${s}`).reverse(),
        axisLine: { lineStyle: { color: 'rgba(128, 163, 162, 0.5)' } },
        axisLabel: { color: '#6B8F8E' },
        splitLine: { show: false }
      },
      series: [{
        type: 'bar',
        data: [...stepData].reverse(),
        barWidth: '60%',
        itemStyle: {
          borderRadius: [0, 4, 4, 0],
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: '#80A3A2' },
              { offset: 1, color: '#5ab0b2' }
            ]
          }
        },
        emphasis: {
          itemStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 1, y2: 0,
              colorStops: [
                { offset: 0, color: '#6B8F8E' },
                { offset: 1, color: '#80c8ca' }
              ]
            }
          }
        }
      }]
    };
  }, [data]);

  const statusPieOption = useMemo(() => {
    if (!data?.statusBreakdown) return {};
    
    const pieData = Object.entries(data.statusBreakdown).map(([name, value]) => ({
      name: name.replace(/_/g, ' '),
      value,
      itemStyle: { color: STATUS_COLORS[name] || STATUS_COLORS.default }
    }));
    
    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: 'rgba(128, 163, 162, 0.3)',
        textStyle: { color: '#4A6667' },
        formatter: '{b}: {c} ({d}%)'
      },
      legend: {
        orient: 'vertical',
        right: '5%',
        top: 'center',
        textStyle: { color: '#6B8F8E', fontSize: 11 },
        icon: 'circle',
        itemWidth: 10,
        itemHeight: 10
      },
      series: [{
        name: 'Status',
        type: 'pie',
        radius: ['50%', '75%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 6,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: false
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold',
            color: '#4A6667'
          },
          itemStyle: {
            shadowBlur: 20,
            shadowOffsetX: 0,
            shadowColor: 'rgba(128, 163, 162, 0.3)'
          }
        },
        data: pieData
      }]
    };
  }, [data]);

  const completionGaugeOption = useMemo(() => {
    const completionRate = data?.overview.totalWorkflows && data?.overview.completedWorkflows
      ? Math.round((data.overview.completedWorkflows / data.overview.totalWorkflows) * 100)
      : 0;
    
    return {
      series: [{
        type: 'gauge',
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max: 100,
        splitNumber: 10,
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 1, x2: 1, y2: 1,
            colorStops: [
              { offset: 0, color: '#5ab0b2' },
              { offset: 0.5, color: '#80A3A2' },
              { offset: 1, color: '#ABCECF' }
            ]
          }
        },
        progress: {
          show: true,
          width: 20,
          roundCap: true
        },
        pointer: {
          show: false
        },
        axisLine: {
          lineStyle: {
            width: 20,
            color: [[1, 'rgba(128, 163, 162, 0.2)']]
          },
          roundCap: true
        },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        anchor: { show: false },
        title: {
          show: true,
          offsetCenter: [0, '20%'],
          fontSize: 14,
          color: '#6B8F8E'
        },
        detail: {
          valueAnimation: true,
          width: '60%',
          lineHeight: 40,
          borderRadius: 8,
          offsetCenter: [0, '-10%'],
          fontSize: 36,
          fontWeight: 'bold',
          formatter: '{value}%',
          color: '#4A6667'
        },
        data: [{ value: completionRate, name: 'Completion Rate' }]
      }]
    };
  }, [data]);

  const costRadarOption = useMemo(() => {
    if (!data?.costs) return {};
    
    const totalCost = parseFloat(data.costs.totalApiCost || '0');
    const avgCost = parseFloat(data.costs.avgPerWorkflow || '0');
    const tokensK = (data.costs.totalTokens || 0) / 1000;
    
    return {
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: 'rgba(128, 163, 162, 0.3)',
        textStyle: { color: '#4A6667' }
      },
      radar: {
        indicator: [
          { name: 'Total Cost', max: Math.max(totalCost * 1.5, 100) },
          { name: 'Avg/Workflow', max: Math.max(avgCost * 2, 50) },
          { name: 'Tokens (K)', max: Math.max(tokensK * 1.2, 1000) },
          { name: 'Efficiency', max: 100 },
          { name: 'Completion', max: 100 }
        ],
        axisName: { color: '#6B8F8E', fontSize: 11 },
        splitArea: { areaStyle: { color: ['rgba(128, 163, 162, 0.05)', 'rgba(128, 163, 162, 0.1)'] } },
        axisLine: { lineStyle: { color: 'rgba(128, 163, 162, 0.3)' } },
        splitLine: { lineStyle: { color: 'rgba(128, 163, 162, 0.2)' } }
      },
      series: [{
        type: 'radar',
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: {
          width: 2,
          color: '#80A3A2'
        },
        itemStyle: {
          color: '#80A3A2',
          borderColor: '#fff',
          borderWidth: 2
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(128, 163, 162, 0.5)' },
              { offset: 1, color: 'rgba(128, 163, 162, 0.1)' }
            ]
          }
        },
        data: [{
          value: [
            totalCost,
            avgCost,
            tokensK,
            data.overview.totalWorkflows ? Math.min((data.overview.completedWorkflows / data.overview.totalWorkflows) * 100, 100) : 0,
            data.overview.totalWorkflows && data.overview.completedWorkflows
              ? Math.round((data.overview.completedWorkflows / data.overview.totalWorkflows) * 100)
              : 0
          ],
          name: 'Performance'
        }]
      }]
    };
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-sage-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-teal-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-sage-50 flex items-center justify-center">
        <div className="text-center text-rose-500">
          <p>{error}</p>
          <button
            onClick={() => router.push('/workflow')}
            className="mt-4 px-4 py-2 bg-white rounded-lg text-teal-700 border border-teal-200"
          >
            Back to Workflows
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-sage-50">
      {/* Header */}
      <header className="border-b border-teal-200/50 backdrop-blur-sm bg-white/80 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/workflow')}
              className="p-2 hover:bg-teal-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-teal-500 to-sage-500 bg-clip-text text-transparent flex items-center gap-2">
                <span className="text-2xl">📊</span> Admin Dashboard
              </h1>
              <p className="text-teal-600 text-sm mt-1">Workflow Analytics & Metrics</p>
            </div>
          </div>
          <button
            onClick={fetchDashboardData}
            className="px-4 py-2 bg-gradient-to-r from-teal-400 to-sage-400 hover:from-teal-300 hover:to-sage-300 text-white rounded-lg transition-all flex items-center gap-2 shadow-teal-lg"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <MetricCard title="Total Workflows" value={data?.overview.totalWorkflows || 0} icon="📁" color="teal" />
          <MetricCard title="Completed" value={data?.overview.completedWorkflows || 0} icon="✅" color="sage" />
          <MetricCard title="In Progress" value={data?.overview.inProgressWorkflows || 0} icon="⏳" color="amber" />
          <MetricCard title="This Week" value={data?.overview.thisWeekWorkflows || 0} icon="📈" color="mint" change={data?.overview.growthPercentage} />
        </div>

        {/* Second Row - Cost Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <MetricCard title="Avg. Completion Time" value={`${data?.overview.avgCompletionTime || 0}m`} icon="⏱️" color="teal" subtitle="minutes per workflow" />
          <MetricCard title="Total API Cost" value={`$${parseFloat(data?.costs.totalApiCost || '0').toFixed(2)}`} icon="💰" color="sage" subtitle={`via ${data?.costs.model || 'gpt-4o'}`} />
          <MetricCard title="Total Tokens" value={data?.costs.totalTokens?.toLocaleString() || '0'} icon="🔢" color="mint" subtitle="last 30 days" />
          <MetricCard title="Cost per Workflow" value={`$${parseFloat(data?.costs.avgPerWorkflow || '0').toFixed(2)}`} icon="📊" color="teal" subtitle="average per curriculum" />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Workflows Per Day Chart */}
          <div className="bg-white rounded-xl border border-teal-200/50 p-6 shadow-teal-sm">
            <h3 className="text-lg font-semibold text-teal-800 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-teal-400"></span>
              Workflows Created (Last 30 Days)
            </h3>
            <div className="h-64">
              <ReactECharts option={workflowsChartOption} style={{ height: '100%', width: '100%' }} />
            </div>
          </div>

          {/* Step Distribution */}
          <div className="bg-white rounded-xl border border-teal-200/50 p-6 shadow-teal-sm">
            <h3 className="text-lg font-semibold text-teal-800 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-sage-400"></span>
              Current Step Distribution
            </h3>
            <div className="h-64">
              <ReactECharts option={stepDistributionOption} style={{ height: '100%', width: '100%' }} />
            </div>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Status Pie Chart */}
          <div className="bg-white rounded-xl border border-teal-200/50 p-6 shadow-teal-sm">
            <h3 className="text-lg font-semibold text-teal-800 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-mint-500"></span>
              Status Breakdown
            </h3>
            <div className="h-64">
              <ReactECharts option={statusPieOption} style={{ height: '100%', width: '100%' }} />
            </div>
          </div>

          {/* Completion Gauge */}
          <div className="bg-white rounded-xl border border-teal-200/50 p-6 shadow-teal-sm">
            <h3 className="text-lg font-semibold text-teal-800 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-sage-400"></span>
              Completion Rate
            </h3>
            <div className="h-64">
              <ReactECharts option={completionGaugeOption} style={{ height: '100%', width: '100%' }} />
            </div>
          </div>

          {/* Performance Radar */}
          <div className="bg-white rounded-xl border border-teal-200/50 p-6 shadow-teal-sm">
            <h3 className="text-lg font-semibold text-teal-800 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-teal-400"></span>
              Performance Overview
            </h3>
            <div className="h-64">
              <ReactECharts option={costRadarOption} style={{ height: '100%', width: '100%' }} />
            </div>
          </div>
        </div>

        {/* Recent Workflows */}
        <div className="bg-white rounded-xl border border-teal-200/50 p-6 mb-8 shadow-teal-sm">
          <h3 className="text-lg font-semibold text-teal-800 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            Recent Workflows
          </h3>
          <div className="space-y-3 max-h-80 overflow-y-auto scrollbar-thin scrollbar-track-slate-800 scrollbar-thumb-slate-600">
            {data?.recentWorkflows?.map((workflow) => (
              <div
                key={workflow.id}
                onClick={() => router.push(`/workflow/${workflow.id}`)}
                className="flex items-center justify-between p-4 bg-teal-50/50 rounded-xl hover:bg-teal-100/50 cursor-pointer transition-all border border-transparent hover:border-teal-200 group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-200 to-sage-200 flex items-center justify-center text-teal-700 font-bold text-lg border border-teal-300/50 group-hover:from-teal-300 group-hover:to-sage-300 transition-colors">
                    {workflow.currentStep}
                  </div>
                  <div>
                    <p className="font-medium text-teal-800 group-hover:text-teal-600 transition-colors">{workflow.name}</p>
                    <p className="text-xs text-teal-600">Step {workflow.currentStep}: {STEP_NAMES[workflow.currentStep] || 'Unknown'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${
                    workflow.status.includes('complete') || workflow.status === 'published'
                      ? 'bg-sage-100 text-sage-700 border border-sage-200'
                      : 'bg-amber-100 text-amber-700 border border-amber-200'
                  }`}>
                    {workflow.status.replace(/_/g, ' ')}
                  </span>
                  <p className="text-xs text-teal-500 mt-2">{new Date(workflow.updatedAt).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
            {(!data?.recentWorkflows || data.recentWorkflows.length === 0) && (
              <p className="text-center text-teal-500 py-8">No workflows yet</p>
            )}
          </div>
        </div>

        {/* Quick Stats Footer */}
        <div className="bg-gradient-to-r from-teal-100 to-sage-100 rounded-xl border border-teal-200/50 p-8 shadow-teal-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div className="group">
              <p className="text-5xl font-bold bg-gradient-to-r from-teal-500 to-sage-500 bg-clip-text text-transparent group-hover:scale-110 transition-transform">
                {data?.overview.publishedWorkflows || 0}
              </p>
              <p className="text-sm text-teal-600 mt-2">Published Curricula</p>
            </div>
            <div className="group">
              <p className="text-5xl font-bold bg-gradient-to-r from-sage-500 to-mint-500 bg-clip-text text-transparent group-hover:scale-110 transition-transform">
                {data?.overview.totalWorkflows && data?.overview.completedWorkflows
                  ? Math.round((data.overview.completedWorkflows / data.overview.totalWorkflows) * 100)
                  : 0}%
              </p>
              <p className="text-sm text-teal-600 mt-2">Completion Rate</p>
            </div>
            <div className="group">
              <p className="text-5xl font-bold bg-gradient-to-r from-teal-400 to-teal-500 bg-clip-text text-transparent group-hover:scale-110 transition-transform">
                10
              </p>
              <p className="text-sm text-teal-600 mt-2">Workflow Steps</p>
            </div>
            <div className="group">
              <p className="text-5xl font-bold bg-gradient-to-r from-sage-400 to-teal-400 bg-clip-text text-transparent group-hover:scale-110 transition-transform">
                ~2h
              </p>
              <p className="text-sm text-teal-600 mt-2">Avg. Total Time</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: string;
  color: 'teal' | 'sage' | 'mint' | 'amber';
  change?: number;
  subtitle?: string;
}

function MetricCard({ title, value, icon, color, change, subtitle }: MetricCardProps) {
  const colorClasses = {
    teal: 'from-teal-400/20 to-teal-300/10 text-teal-600 border-teal-200/50',
    sage: 'from-sage-400/20 to-sage-300/10 text-sage-600 border-sage-200/50',
    mint: 'from-mint-400/20 to-mint-300/10 text-mint-600 border-mint-200/50',
    amber: 'from-amber-400/20 to-amber-300/10 text-amber-600 border-amber-200/50',
  };

  const iconBgClasses = {
    teal: 'bg-teal-100 border-teal-200',
    sage: 'bg-sage-100 border-sage-200',
    mint: 'bg-mint-100 border-mint-200',
    amber: 'bg-amber-100 border-amber-200',
  };

  const textColors = {
    teal: 'text-teal-700',
    sage: 'text-sage-700',
    mint: 'text-mint-700',
    amber: 'text-amber-700',
  };

  return (
    <div className={`bg-white rounded-xl border border-teal-200/50 p-5 hover:shadow-teal-md transition-all group shadow-teal-sm`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg ${iconBgClasses[color]} border flex items-center justify-center text-xl group-hover:scale-110 transition-transform`}>
          {icon}
        </div>
        {typeof change === 'number' && (
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
            change >= 0 ? 'bg-sage-100 text-sage-600 border border-sage-200' : 'bg-rose-100 text-rose-600 border border-rose-200'
          }`}>
            {change >= 0 ? '+' : ''}{change}%
          </span>
        )}
      </div>
      <p className={`text-3xl font-bold ${textColors[color]}`}>
        {value}
      </p>
      <p className="text-sm text-teal-600 mt-1">{title}</p>
      {subtitle && <p className="text-xs text-teal-500">{subtitle}</p>}
    </div>
  );
}
