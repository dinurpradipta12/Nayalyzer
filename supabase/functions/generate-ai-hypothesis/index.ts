// ============================================================
// Supabase Edge Function: generate-ai-hypothesis
// Fetches analytics data, sends to OpenAI, saves hypotheses.
// Deploy: supabase functions deploy generate-ai-hypothesis
// Secrets: supabase secrets set OPENAI_API_KEY=sk-...
// ============================================================

import { serve }        from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI_API_KEY  = Deno.env.get('OPENAI_API_KEY') ?? '';
const SUPABASE_URL    = Deno.env.get('SUPABASE_URL')   ?? '';
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── JSON schema for OpenAI structured output ─────────────────
const HYPOTHESIS_SCHEMA = {
  type: 'object',
  properties: {
    hypotheses: {
      type: 'array',
      items: {
        type: 'object',
        required: [
          'title','hypothesis_type','summary','pattern_detected','data_evidence',
          'confidence_score','strategic_meaning','suggested_experiment',
          'experiment_duration','success_metrics','predicted_impact',
          'expected_impact','risk_level','impact_score','urgency_score',
          'difficulty_score','action_plan','content_recommendations','platforms',
        ],
        properties: {
          title:                   { type: 'string' },
          hypothesis_type:         { type: 'string', enum: ['growth','content','engagement','competitor','experiment'] },
          summary:                 { type: 'string' },
          pattern_detected:        { type: 'string' },
          data_evidence:           { type: 'array', items: { type: 'string' } },
          confidence_score:        { type: 'number', minimum: 0, maximum: 100 },
          strategic_meaning:       { type: 'string' },
          suggested_experiment:    { type: 'string' },
          experiment_duration:     { type: 'integer', enum: [7,14,30] },
          success_metrics:         { type: 'array', items: { type: 'string' } },
          predicted_impact:        { type: 'string' },
          expected_impact:         { type: 'string' },
          risk_level:              { type: 'string', enum: ['Low','Medium','High'] },
          impact_score:            { type: 'number', minimum: 0, maximum: 100 },
          urgency_score:           { type: 'number', minimum: 0, maximum: 100 },
          difficulty_score:        { type: 'number', minimum: 0, maximum: 100 },
          action_plan:             { type: 'array', items: { type: 'string' } },
          content_recommendations: { type: 'array', items: { type: 'string' } },
          platforms:               { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
  required: ['hypotheses'],
};

// ── Compact data summarizer ───────────────────────────────────
function buildContext(data: Record<string, unknown>, platform: string, dateRange: string): string {
  const { accounts, metrics, contents, competitors } = data as {
    accounts: unknown[]; metrics: unknown[]; contents: unknown[]; competitors: unknown[];
  };

  const lines: string[] = [
    `## Analytics Context`,
    `Platform filter: ${platform} | Date range: ${dateRange}`,
    ``,
    `### Social Accounts (${accounts?.length ?? 0})`,
  ];

  (accounts as Record<string,unknown>[])?.slice(0, 5).forEach((a) => {
    lines.push(`- ${a.platform} @${a.username}: ${a.followers_count ?? 0} followers`);
  });

  lines.push(`\n### Account Metrics (last 30 days, ${metrics?.length ?? 0} rows)`);
  const metricSample = (metrics as Record<string,unknown>[])?.slice(0, 20) ?? [];
  if (metricSample.length) {
    const avgER   = avg(metricSample, 'engagement_rate');
    const avgReach = avg(metricSample, 'reach');
    const avgGrowth = avg(metricSample, 'follower_growth');
    lines.push(`- Avg engagement rate: ${avgER.toFixed(2)}%`);
    lines.push(`- Avg reach: ${Math.round(avgReach).toLocaleString()}`);
    lines.push(`- Avg follower growth/period: ${Math.round(avgGrowth)}`);
  }

  lines.push(`\n### Content Performance (${contents?.length ?? 0} posts)`);
  const contentSample = (contents as Record<string,unknown>[])?.slice(0, 30) ?? [];
  if (contentSample.length) {
    // Group by content_type
    const byType: Record<string, number[]> = {};
    contentSample.forEach((c) => {
      const t = (c.content_type as string) || 'Unknown';
      if (!byType[t]) byType[t] = [];
      byType[t].push((c.engagement_rate as number) ?? 0);
    });
    Object.entries(byType).forEach(([t, ers]) => {
      const mean = ers.reduce((s, v) => s + v, 0) / ers.length;
      lines.push(`- ${t}: ${ers.length} posts, avg ER ${mean.toFixed(2)}%`);
    });

    // Best performing posts
    const sorted = [...contentSample].sort((a,b) => ((b.engagement_rate as number)??0) - ((a.engagement_rate as number)??0));
    lines.push(`\nTop 5 posts by ER:`);
    sorted.slice(0,5).forEach((c) => {
      lines.push(`  * "${c.title || c.content_url}" (${c.content_type}) ER:${(c.engagement_rate as number ?? 0).toFixed(1)}% saves:${c.saves ?? 0} shares:${c.shares ?? 0}`);
    });

    // Watch rate / completion rate if available
    const withWatch = contentSample.filter((c) => (c.watch_rate as number) > 0);
    if (withWatch.length) {
      lines.push(`Avg watch rate: ${avg(withWatch, 'watch_rate').toFixed(1)}%`);
      lines.push(`Avg completion rate: ${avg(withWatch, 'completion_rate').toFixed(1)}%`);
    }
  }

  lines.push(`\n### Competitors (${competitors?.length ?? 0})`);
  (competitors as Record<string,unknown>[])?.slice(0,4).forEach((comp) => {
    lines.push(`- ${comp.name} @${comp.username} (${comp.platform}): ${(comp.followers as number ?? 0).toLocaleString()} followers, ER ${comp.average_engagement_rate ?? 'N/A'}%`);
  });

  return lines.join('\n');
}

function avg(arr: Record<string,unknown>[], key: string): number {
  const vals = arr.map(r => (r[key] as number) ?? 0).filter(v => v > 0);
  return vals.length ? vals.reduce((s,v) => s+v, 0) / vals.length : 0;
}

// ── System prompt ─────────────────────────────────────────────
function buildSystemPrompt(): string {
  return `Kamu adalah senior social media strategist dan data analyst dengan pengalaman 10+ tahun.

Tugasmu: Analisa data social media yang diberikan dan hasilkan hipotesa yang SPESIFIK, TERUKUR, dan BISA DIUJI.

ATURAN KERAS:
1. Jangan beri saran generik seperti "buat konten lebih baik" atau "posting lebih sering"
2. Setiap hipotesa WAJIB punya evidence dari data yang nyata
3. Confidence score harus realistis — jangan semua 90+
4. Success metric harus kuantitatif (%, angka absolut)
5. Experiment harus spesifik (berapa konten, berapa hari, format apa)
6. Buat tepat 5 hipotesa: 1 growth, 1 content, 1 engagement, 1 competitor, 1 experiment
7. Output HANYA JSON sesuai schema, tidak ada teks lain
8. Gunakan Bahasa Indonesia

PANDUAN SCORING:
- confidence_score: seberapa kuat evidence mendukung hipotesa (0-100)
- impact_score: seberapa besar dampak jika terbukti (0-100)
- urgency_score: seberapa mendesak untuk diuji sekarang (0-100)
- difficulty_score: seberapa sulit eksperimennya (0-100, lebih tinggi = lebih sulit)
- priority = impact + urgency + confidence - difficulty (dihitung otomatis)

Hasilkan analisis mendalam berdasarkan data yang ada. Temukan pola tersembunyi yang tidak obvious.`;
}

// ── Fetch analytics data from Supabase ───────────────────────
async function fetchAnalyticsData(supabase: ReturnType<typeof createClient>, workspaceId: string, platform: string) {
  const platformFilter = platform !== 'Semua' && platform !== 'All' ? platform : null;

  // Social accounts
  let accQ = supabase.from('social_accounts').select('*').eq('workspace_id', workspaceId);
  if (platformFilter) accQ = accQ.eq('platform', platformFilter);
  const { data: accounts } = await accQ;

  // Account metrics (last 90 days)
  const since = new Date(); since.setDate(since.getDate() - 90);
  const sinceStr = since.toISOString().split('T')[0];
  const accountIds = (accounts ?? []).map((a: Record<string,unknown>) => a.id);

  let metricsData: unknown[] = [];
  if (accountIds.length) {
    const { data } = await supabase
      .from('account_metrics')
      .select('*')
      .in('social_account_id', accountIds)
      .gte('metric_date', sinceStr)
      .order('metric_date', { ascending: false })
      .limit(200);
    metricsData = data ?? [];
  }

  // Content + metrics (joined view or separate query)
  let contentsData: unknown[] = [];
  if (accountIds.length) {
    const { data: contents } = await supabase
      .from('contents')
      .select(`*, content_metrics(*)`)
      .in('social_account_id', accountIds)
      .order('published_at', { ascending: false })
      .limit(100);
    // Flatten
    contentsData = (contents ?? []).map((c: Record<string,unknown>) => {
      const latest = Array.isArray(c.content_metrics) ? c.content_metrics[c.content_metrics.length - 1] : {};
      return { ...c, ...latest, content_metrics: undefined };
    });
  }

  // Competitors
  const { data: competitors } = await supabase
    .from('competitors')
    .select(`*, competitor_metrics(*)`)
    .eq('workspace_id', workspaceId)
    .limit(10);

  const flatCompetitors = (competitors ?? []).map((c: Record<string,unknown>) => {
    const latest = Array.isArray(c.competitor_metrics) ? c.competitor_metrics[c.competitor_metrics.length - 1] : {};
    return { ...c, ...latest, competitor_metrics: undefined };
  });

  return { accounts: accounts ?? [], metrics: metricsData, contents: contentsData, competitors: flatCompetitors };
}

// ── Call OpenAI ───────────────────────────────────────────────
async function callOpenAI(context: string): Promise<unknown[]> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'hypothesis_output',
          strict: true,
          schema: HYPOTHESIS_SCHEMA,
        },
      },
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user',   content: `Analisa data berikut dan hasilkan 5 hipotesa:\n\n${context}` },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${err.slice(0, 200)}`);
  }

  const json = await response.json();
  const content = json.choices?.[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(content);
  return parsed.hypotheses ?? [];
}

// ── Save hypotheses to Supabase ───────────────────────────────
async function saveHypotheses(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  hypotheses: Record<string,unknown>[],
) {
  const rows = hypotheses.map((h) => ({
    workspace_id:             workspaceId,
    title:                    h.title,
    hypothesis_type:          h.hypothesis_type,
    summary:                  h.summary,
    pattern_detected:         h.pattern_detected,
    data_evidence:            h.data_evidence,
    confidence_score:         h.confidence_score,
    strategic_meaning:        h.strategic_meaning,
    suggested_experiment:     h.suggested_experiment,
    experiment_duration:      h.experiment_duration,
    success_metrics:          h.success_metrics,
    predicted_impact:         h.predicted_impact,
    expected_impact:          h.expected_impact,
    risk_level:               h.risk_level,
    impact_score:             h.impact_score,
    urgency_score:            h.urgency_score,
    difficulty_score:         h.difficulty_score,
    action_plan:              h.action_plan,
    content_recommendations:  h.content_recommendations,
    platforms:                h.platforms,
    status:                   'New',
  }));

  const { data, error } = await supabase.from('ai_hypotheses').insert(rows).select();
  if (error) throw new Error(`DB insert error: ${error.message}`);
  return data;
}

// ── Main handler ──────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json() as { workspace_id: string; platform?: string; date_range?: string };
    const { workspace_id, platform = 'Semua', date_range = '30 hari terakhir' } = body;

    if (!workspace_id) {
      return new Response(JSON.stringify({ error: 'workspace_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE);

    // 1. Fetch data
    const data = await fetchAnalyticsData(supabaseClient, workspace_id, platform);
    const totalRows = (data.accounts?.length ?? 0) + (data.metrics?.length ?? 0) + (data.contents?.length ?? 0);

    if (totalRows < 3) {
      return new Response(JSON.stringify({
        error: 'Insufficient data',
        message: 'Kamu perlu import setidaknya beberapa data analytics terlebih dahulu sebelum AI bisa membuat hipotesa.',
      }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2. Build context
    const context = buildContext(data as Record<string,unknown>, platform, date_range);

    // 3. Call OpenAI
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured. Set it via: supabase secrets set OPENAI_API_KEY=sk-...');
    }
    const hypotheses = await callOpenAI(context);

    // 4. Save to DB
    const saved = await saveHypotheses(supabaseClient, workspace_id, hypotheses as Record<string,unknown>[]);

    return new Response(JSON.stringify({ success: true, count: saved?.length ?? 0, hypotheses: saved }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
