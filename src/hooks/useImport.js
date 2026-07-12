import { useState, useCallback } from 'react';
import { supabase, SUPABASE_ENABLED } from '../lib/supabase';

/**
 * Hook for executing import upsert logic and managing import logs.
 * In demo mode (no Supabase), simulates the import and returns mock results.
 */
export function useImport(workspaceId) {
  const [importing, setImporting] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  // ── Find or create social_account ──────────────────────
  const findOrCreateAccount = async (platform, username) => {
    const { data: existing } = await supabase
      .from('social_accounts')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('platform', platform)
      .eq('username', username)
      .maybeSingle();
    if (existing) return existing.id;

    const { data: created, error } = await supabase
      .from('social_accounts')
      .insert({ workspace_id: workspaceId, platform, username, account_name: username, connection_status: 'disconnected' })
      .select('id')
      .single();
    if (error) throw new Error(`Gagal membuat akun ${platform}/${username}: ${error.message}`);
    return created.id;
  };

  // ── Find or create competitor ───────────────────────────
  const findOrCreateCompetitor = async (platform, username, name) => {
    const { data: existing } = await supabase
      .from('competitors')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('platform', platform)
      .eq('username', username)
      .maybeSingle();
    if (existing) return existing.id;

    const { data: created, error } = await supabase
      .from('competitors')
      .insert({ workspace_id: workspaceId, platform, username, name: name || username })
      .select('id')
      .single();
    if (error) throw new Error(`Gagal membuat kompetitor ${username}: ${error.message}`);
    return created.id;
  };

  // ── Find or create content ─────────────────────────────
  const findOrCreateContent = async (accountId, platform, row) => {
    let query = supabase.from('contents').select('id').eq('workspace_id', workspaceId).eq('social_account_id', accountId);
    if (row.content_url) {
      query = query.eq('content_url', row.content_url);
    } else {
      query = query.eq('title', row.title || '').eq('platform', platform);
    }
    const { data: existing } = await query.maybeSingle();
    if (existing) return existing.id;

    const { data: created, error } = await supabase
      .from('contents')
      .insert({
        workspace_id:      workspaceId,
        social_account_id: accountId,
        platform,
        content_url:    row.content_url || null,
        title:          row.title || null,
        caption:        row.caption || null,
        content_type:   row.content_type || null,
        content_pillar: row.content_pillar || null,
        campaign_name:  row.campaign_name || null,
        published_at:   row.published_at ? `${row.published_at}T00:00:00+07:00` : null,
      })
      .select('id')
      .single();
    if (error) throw new Error(`Gagal membuat konten "${row.title}": ${error.message}`);
    return created.id;
  };

  // ── IMPORT ACCOUNT METRICS ─────────────────────────────
  const importAccountMetrics = async (rows) => {
    const errors = [];
    let success = 0, updated = 0, failed = 0;

    for (const row of rows) {
      if (!row._valid) { failed++; errors.push({ row: row._rowIndex, errors: row._errors }); continue; }
      try {
        const accountId = await findOrCreateAccount(row.platform, row.username);
        const { error } = await supabase
          .from('account_metrics')
          .upsert({
            workspace_id:      workspaceId,
            social_account_id: accountId,
            metric_date:       row.metric_date,
            followers:         row.followers,
            follower_growth:   row.follower_growth,
            reach:             row.reach,
            impressions:       row.impressions,
            profile_visits:    row.profile_visits,
            website_clicks:    row.website_clicks,
            engagement_count:  row.engagement_count,
            engagement_rate:   row.engagement_rate,
          }, { onConflict: 'social_account_id,metric_date', ignoreDuplicates: false });
        if (error) throw new Error(error.message);
        // Also update follower count on social_accounts
        await supabase.from('social_accounts').update({ followers_count: row.followers })
          .eq('id', accountId);
        success++;
      } catch (e) {
        failed++;
        errors.push({ row: row._rowIndex, message: e.message });
      }
    }
    return { success, updated, failed, errors };
  };

  // ── IMPORT CONTENT PERFORMANCE ─────────────────────────
  const importContentPerformance = async (rows) => {
    const errors = [];
    let success = 0, updated = 0, failed = 0;

    for (const row of rows) {
      if (!row._valid) { failed++; errors.push({ row: row._rowIndex, errors: row._errors }); continue; }
      try {
        const accountId  = await findOrCreateAccount(row.platform, row.username);
        const contentId  = await findOrCreateContent(accountId, row.platform, row);
        const metricDate = row.published_at;

        const { error } = await supabase
          .from('content_metrics')
          .upsert({
            workspace_id:      workspaceId,
            content_id:        contentId,
            metric_date:       metricDate,
            views:             row.views,
            reach:             row.reach,
            impressions:       row.impressions,
            likes:             row.likes,
            comments:          row.comments,
            shares:            row.shares,
            saves:             row.saves,
            replies:           row.replies,
            reposts:           row.reposts,
            engagement_count:  row.likes + row.comments + row.shares + row.saves,
            engagement_rate:   row.engagement_rate,
            watch_rate:        row.watch_rate,
            completion_rate:   row.completion_rate,
            performance_score: calculateScore(row),
            performance_status: categorizeScore(calculateScore(row)),
          }, { onConflict: 'content_id,metric_date', ignoreDuplicates: false });
        if (error) throw new Error(error.message);
        success++;
      } catch (e) {
        failed++;
        errors.push({ row: row._rowIndex, message: e.message });
      }
    }
    return { success, updated, failed, errors };
  };

  // ── IMPORT COMPETITOR METRICS ──────────────────────────
  const importCompetitorMetrics = async (rows) => {
    const errors = [];
    let success = 0, updated = 0, failed = 0;

    for (const row of rows) {
      if (!row._valid) { failed++; errors.push({ row: row._rowIndex, errors: row._errors }); continue; }
      try {
        const competitorId = await findOrCreateCompetitor(row.platform, row.username, row.competitor_name);
        const { error } = await supabase
          .from('competitor_metrics')
          .upsert({
            workspace_id:            workspaceId,
            competitor_id:           competitorId,
            metric_date:             row.metric_date,
            followers:               row.followers,
            follower_growth:         row.follower_growth,
            posting_frequency:       row.posting_frequency,
            average_likes:           row.average_likes,
            average_comments:        row.average_comments,
            average_shares:          row.average_shares,
            average_engagement_rate: row.average_engagement_rate,
            top_content_url:         row.top_content_url,
          }, { onConflict: 'competitor_id,metric_date', ignoreDuplicates: false });
        if (error) throw new Error(error.message);
        success++;
      } catch (e) {
        failed++;
        errors.push({ row: row._rowIndex, message: e.message });
      }
    }
    return { success, updated, failed, errors };
  };

  // ── Main executeImport ─────────────────────────────────
  const executeImport = useCallback(async ({ importType, validatedRows, sourceLabel, dataSourceId }) => {
    setImporting(true);
    const started = Date.now();
    let result = { success: 0, updated: 0, failed: 0, errors: [] };

    try {
      if (!SUPABASE_ENABLED || workspaceId === 'demo-ws') {
        // Demo mode: simulate
        await new Promise(r => setTimeout(r, 1200));
        const validCount = validatedRows.filter(r => r._valid).length;
        const failCount  = validatedRows.length - validCount;
        result = { success: validCount, updated: Math.floor(validCount * 0.2), failed: failCount, errors: [] };
      } else {
        if (importType === 'account_metrics')     result = await importAccountMetrics(validatedRows);
        if (importType === 'content_performance') result = await importContentPerformance(validatedRows);
        if (importType === 'competitor_metrics')  result = await importCompetitorMetrics(validatedRows);

        // Log to import_logs
        await supabase.from('import_logs').insert({
          workspace_id:  workspaceId,
          data_source_id: dataSourceId || null,
          import_type:   importType,
          source_label:  sourceLabel || 'Manual Import',
          total_rows:    validatedRows.length,
          success_rows:  result.success,
          updated_rows:  result.updated,
          failed_rows:   result.failed,
          skipped_rows:  0,
          error_details: result.errors,
          duration_ms:   Date.now() - started,
        });
      }
    } catch (e) {
      result.errors.push({ message: e.message });
    } finally {
      setImporting(false);
      setLastResult(result);
    }
    return result;
  }, [workspaceId]);

  return { executeImport, importing, lastResult };
}

// ── Helpers ──────────────────────────────────────────────────
function calculateScore(row) {
  let score = 50;
  if (row.engagement_rate > 8)   score += 30;
  else if (row.engagement_rate > 5) score += 20;
  else if (row.engagement_rate > 3) score += 10;
  if (row.saves > 100)   score += 10;
  if (row.shares > 50)   score += 5;
  if (row.completion_rate > 50) score += 5;
  return Math.min(Math.round(score), 100);
}

function categorizeScore(score) {
  if (score >= 80) return 'High Performer';
  if (score >= 60) return 'Stable';
  if (score >= 40) return 'Needs Improvement';
  return 'Underperform';
}
