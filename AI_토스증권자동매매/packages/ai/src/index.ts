import OpenAI from 'openai';
import { z } from 'zod';

export const CatalystAnalysisSchema = z.object({
  symbol: z.string().min(1),
  strategy: z.enum(['core', 'momentum', 'dopamine']),
  catalystType: z.enum(['earnings','guidance','contract','fda','merger','reverse_merger','spinoff','ai_pivot','listing','short_squeeze','other']),
  catalystScore: z.number().min(0).max(10),
  confidence: z.number().min(0).max(1),
  action: z.enum(['ENTER', 'WATCH', 'REJECT']),
  thesis: z.array(z.string()),
  risks: z.array(z.string()),
  invalidationConditions: z.array(z.string()),
  expiresAt: z.string().datetime(),
});
export type CatalystAnalysis = z.infer<typeof CatalystAnalysisSchema>;

export interface CatalystAnalyzer { analyze(symbol: string, news: string): Promise<CatalystAnalysis> }

export class MockCatalystAnalyzer implements CatalystAnalyzer {
  constructor(private readonly result: CatalystAnalysis) {}
  async analyze(): Promise<CatalystAnalysis> { return CatalystAnalysisSchema.parse(this.result); }
}

export class OpenAICatalystAnalyzer implements CatalystAnalyzer {
  private readonly client: OpenAI;
  constructor(apiKey: string, private readonly model = 'gpt-4.1-mini', enabled = process.env.OPENAI_ENABLED === 'true') { if (!enabled) throw new Error('OpenAI API is disabled by OPENAI_ENABLED'); this.client = new OpenAI({ apiKey }); }
  async analyze(symbol: string, news: string): Promise<CatalystAnalysis> {
    const response = await this.client.responses.create({
      model: this.model,
      input: `Analyze this US equity catalyst. Symbol: ${symbol}\nNews: ${news}`,
      text: { format: { type: 'json_schema', name: 'catalyst_analysis', strict: true, schema: {
        type: 'object', additionalProperties: false,
        required: ['symbol','strategy','catalystType','catalystScore','confidence','action','thesis','risks','invalidationConditions','expiresAt'],
        properties: {
          symbol: { type: 'string' }, strategy: { type: 'string', enum: ['core','momentum','dopamine'] },
          catalystType: { type: 'string', enum: ['earnings','guidance','contract','fda','merger','reverse_merger','spinoff','ai_pivot','listing','short_squeeze','other'] },
          catalystScore: { type: 'number', minimum: 0, maximum: 10 }, confidence: { type: 'number', minimum: 0, maximum: 1 },
          action: { type: 'string', enum: ['ENTER','WATCH','REJECT'] }, thesis: { type: 'array', items: { type: 'string' } },
          risks: { type: 'array', items: { type: 'string' } }, invalidationConditions: { type: 'array', items: { type: 'string' } },
          expiresAt: { type: 'string', format: 'date-time' }
        }
      } } }
    });
    return CatalystAnalysisSchema.parse(JSON.parse(response.output_text));
  }
}
