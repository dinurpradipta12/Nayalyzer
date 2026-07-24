import { useState, useEffect } from 'react';
import { supabase, SUPABASE_ENABLED } from '../lib/supabase';
import { accountData, followerGrowthTrend, engagementTrend, reachTrend, kpiData } from '../data/mockData';
import { withTimeout } from '../lib/async';

/**
 * Returns account metrics for the active workspace.
 * Falls back to mockData when Supabase is not configured or workspace is in demo mode.
 */
export function useAccountMetrics(workspaceId) {
  const [metrics, setMetrics] = useState(null);   // { instagram, tiktok, threads }
  const [trends, setTrends]   = useState(null);   // { follower, engagement, reach }
  const [kpi, setKpi]         = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!workspaceId || workspaceId === 'demo-ws' || !SUPABASE_ENABLED) {
      setMetrics(accountData);
      setTrends({ follower: followerGrowthTrend, engagement: engagementTrend, reach: reachTrend });
      setKpi(kpiData);
      setLoading(false);
      return;
    }

    const fetchMetrics = async () => {
      setLoading(true);
      try {
        // Fetch social accounts
        const { data: accounts, error: accErr } = await withTimeout(supabase
          .from('social_accounts')
          .select('*')
          .eq('workspace_id', workspaceId), 6000, 'Accounts request timeout');
        if (accErr) throw accErr;

        // Fetch latest metrics per account
        const { data: metrics, error: metErr } = await withTimeout(supabase
          .from('account_metrics')
          .select('*, social_accounts(platform, username, account_name)')
          .eq('workspace_id', workspaceId)
          .order('metric_date', { ascending: false }), 7000, 'Metrics request timeout');
        if (metErr) throw metErr;

        if (!metrics?.length && !accounts?.length) {
          // No real data yet — use mock as fallback
          setMetrics(accountData);
          setTrends({ follower: followerGrowthTrend, engagement: engagementTrend, reach: reachTrend });
          setKpi(kpiData);
        } else {
          // Build account lookup map from social_accounts
          const accountMap = {};
          (accounts ?? []).forEach(a => {
            accountMap[a.id] = a;
          });

          // Transform Supabase rows → component-friendly shape
          const byPlatform = {};
          (metrics ?? []).forEach(m => {
            // Try join first, fallback to accountMap lookup
            const acc = m.social_accounts ?? accountMap[m.social_account_id] ?? {};
            const platform = (acc.platform ?? '').toLowerCase();
            if (!platform) return;
            if (!byPlatform[platform] || m.metric_date > byPlatform[platform].metric_date) {
              byPlatform[platform] = { ...m, ...acc };
            }
          });

          // If no metrics but accounts exist, build from social_accounts directly
          if (!Object.keys(byPlatform).length && accounts?.length) {
            accounts.forEach(a => {
              const p = (a.platform ?? '').toLowerCase();
              if (p) byPlatform[p] = { ...a, followers: a.followers_count ?? 0, engagement_rate: 0, reach: 0 };
            });
          }

          setMetrics(Object.keys(byPlatform).length ? byPlatform : accountData);

          // Build trend arrays from historical metrics
          const trendMap = {};
          [...(metrics ?? [])].reverse().forEach(m => {
            const month = new Date(m.metric_date).toLocaleString('id-ID', { month: 'short' });
            if (!trendMap[month]) trendMap[month] = { month };
            const acc = m.social_accounts ?? accountMap[m.social_account_id] ?? {};
            const p = (acc.platform ?? '').toLowerCase();
            if (p) {
              trendMap[month][p] = m.followers;
              trendMap[month][p + '_er'] = m.engagement_rate;
              trendMap[month][p + '_reach'] = m.reach;
            }
          });
          const trendArr = Object.values(trendMap).slice(-6);
          if (trendArr.length > 1) {
            setTrends({
              follower: trendArr.map(t => ({ month: t.month, instagram: t.instagram, tiktok: t.tiktok, threads: t.threads })),
              engagement: trendArr.map(t => ({ month: t.month, instagram: t.instagram_er, tiktok: t.tiktok_er, threads: t.threads_er })),
              reach: trendArr.map(t => ({ month: t.month, instagram: t.instagram_reach, tiktok: t.tiktok_reach, threads: t.threads_reach })),
            });
          } else {
            setTrends({ follower: followerGrowthTrend, engagement: engagementTrend, reach: reachTrend });
          }
          setKpi(kpiData); // computed KPI — use mock for now
        }
      } catch (e) {
        setError(e.message);
        // Always fallback to mock on error
        setMetrics(accountData);
        setTrends({ follower: followerGrowthTrend, engagement: engagementTrend, reach: reachTrend });
        setKpi(kpiData);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [workspaceId]);

  return { metrics, trends, kpi, loading, error };
}
