/**
 * Known AI providers. The provider is chosen with the AI_PROVIDER secret; base URL,
 * API style and model can each be overridden, so any service that speaks one of the
 * two formats works without a code change.
 */
import type { AnalyzeEnv } from './analyzeWord.ts'

type Preset = Pick<AnalyzeEnv, 'aiBaseUrl' | 'aiApiStyle' | 'aiModel'>

export const AI_PRESETS: Record<string, Preset> = {
  openai: { aiBaseUrl: 'https://api.openai.com/v1', aiApiStyle: 'responses', aiModel: 'gpt-6-luna' },
  mistral: { aiBaseUrl: 'https://api.mistral.ai/v1', aiApiStyle: 'chat', aiModel: 'mistral-large-latest' },
}

export function resolveAiSettings(get: (name: string) => string | undefined): Preset & { aiApiKey: string } {
  const provider = (get('AI_PROVIDER') ?? 'openai').trim().toLowerCase()
  const preset = AI_PRESETS[provider] ?? { aiBaseUrl: '', aiApiStyle: 'chat' as const, aiModel: '' }
  const style = get('AI_API_STYLE')
  return {
    aiApiKey: get('AI_API_KEY') ?? get('OPENAI_API_KEY') ?? '',
    aiBaseUrl: get('AI_BASE_URL') ?? preset.aiBaseUrl,
    aiApiStyle: style === 'responses' || style === 'chat' ? style : preset.aiApiStyle,
    aiModel: get('AI_MODEL') ?? preset.aiModel,
  }
}
