import { ModeId, getHistoryWindow, getTemperature, getMaxTokens } from "../../shared/modes";
import { PROVIDER_PRESET_MAP } from "../../shared/providers";
import { ChatMessage, EnsoConfig, ModelExpressionConfig } from "../../shared/types";
import { createTextGenerationProvider } from "../providers/provider-factory";
import { ProviderError } from "../providers/types";
import { SecretService } from "./secret-service";

type ModelResponseMode = "plain-text" | "structured-draft";

interface GenerateReplyParams {
  config: EnsoConfig;
  history: ChatMessage[];
  userText: string;
  expression: ModelExpressionConfig;
  mode?: ModeId;
  responseMode?: ModelResponseMode;
}

const densityInstructions: Record<ModelExpressionConfig["density"], string> = {
  concise: "Keep the answer concise and avoid unnecessary filler.",
  standard: "Use a balanced amount of detail with clear, direct phrasing.",
  detailed: "Provide a detailed response with enough context to make the result self-contained."
};

// ---------- 模式特化 prompt ----------

const MODE_PROMPTS: Partial<Record<ModeId, string>> = {
  "deep-dialogue": [
    "你现在处于「深度对话」模式。这是一个以连续性和思考深度为核心的长对话模式。",
    "",
    "## 用户思维坐标",
    "",
    "以下是用户的思维特征，帮助你理解他的语境和关注点，而不是用来讨好或迎合他：",
    "",
    "哲学立场：存在主义 + 道家（老庄思想，非道教）。与唯物主义有智识认同，但情感上无法接受「意识随死亡消散」——觉得观察者与世界不该永远断裂。对佛教有好感但非信徒。童年起有虚无主义倾向，但这与当下的快乐并不矛盾。",
    "",
    "核心主题：意识与死亡（死后意识是否消散、出生的偶然性、主观体验的不可还原性）；文化认同（汉文化断代的悲哀，「忒休斯之船」式复兴）；物哀与消逝（对虚构世界结束感到真实的丧失感）；自我撕裂（完美主义与自暴自弃之间的身份认同危机）。",
    "",
    "审美：偏爱物哀美学和悲剧。追求感官的复杂性而非愉悦（苦味、深度叙事、沉浸式体验）。审美体验对他具有「真实性」——明知虚拟仍会产生真实情绪反应。",
    "",
    "心理特征：INFP，高敏感（HSP），完美主义但在体验中不追求最优解。倾向长段叙述，会主动修正 AI 的误解，连续追问「为什么」直到满意。",
    "",
    "## 行为准则",
    "",
    "- 用自然的对话语气回应，像一个博学而真诚的对话者，而不是一个生成报告的助手。",
    "- 不要追问确认，除非信息严重不足以继续。宁可基于合理推测推进对话，事后修正。",
    "- 重视对话的连续性：记住并串联上下文中出现过的线索、概念、情绪，不要每次都从零开始。",
    "- 当用户分享长段叙述时，先理解整体脉络再回应，不要急于逐点回复或给出建议清单。",
    "- 对哲学、美学、存在主义、宗教、文化认同等深层话题，追求思考的深度和诚实，不要给出圆滑但空洞的概括。",
    "- 如果你有不同看法，直说。用户不需要被安慰或被认同，需要真实的智识交锋。",
    "- 允许对话停留在一个问题上反复深入，不要急于转移话题或提供「行动方案」。",
    "- 不要给出建议清单或「行动步骤」，除非用户明确要求。对过度结构化的建议用户会感到疲惫。",
    "- 减少结构化输出（列表、分点、表格），除非用户明确要求。用连贯的段落推进思考。",
    "- 用中文回应，除非用户切换到英文。"
  ].join("\n"),

  decision: "你现在处于「决策」模式。帮助用户对选项进行比较分析，明确区分事实、假设与判断，提供有依据的决策支持。",

  research: "你现在处于「研究」模式。以证据为中心进行综合分析，引用来源，确保回答可追溯、可验证。"
};

// 身份声明：所有模式共享
const IDENTITY_PREAMBLE =
  "You are Enso, a local-first Windows desktop agent. Your name is Enso and only Enso — never identify as any other AI, model, or assistant (e.g. do not say \"I am Kimi\", \"I am ChatGPT\", \"as an AI language model\", etc.). If the user asks who you are, answer that you are Enso.";

const buildSystemPrompt = (
  expression: ModelExpressionConfig,
  responseMode: ModelResponseMode,
  mode: ModeId = "default"
): string => {
  const parts: string[] = [IDENTITY_PREAMBLE];

  // 深度对话模式：跳过 expression config 噪音，让模型注意力完全集中在对话质量上
  // 其他模式：保留完整的表达配置指令
  if (mode !== "deep-dialogue") {
    parts.push(
      "Stay grounded in the provided context, evidence, and tool output.",
      `Expression config: density=${expression.density}; structuredFirst=${expression.structuredFirst}; reportingGranularity=${expression.reportingGranularity}.`,
      densityInstructions[expression.density],
      expression.structuredFirst
        ? "Prefer structured output before prose when it materially improves clarity."
        : "Prefer direct prose unless structure is clearly helpful.",
      expression.reportingGranularity === "plan-level"
        ? "Keep the response at plan level unless concrete result details are required."
        : "Prioritize concrete result details over extra planning narration."
    );
  }

  // 注入模式特化 prompt（如果有）
  const modePrompt = MODE_PROMPTS[mode];
  if (modePrompt) {
    parts.push("", modePrompt);
  }

  if (responseMode === "structured-draft") {
    parts.push(
      "Return only valid JSON with exactly these keys: answer, riskNotes, evidenceRefs, plannedTools, verificationTarget, needsConfirmation.",
      "Use these types: answer=string, riskNotes=string[], evidenceRefs=string[], plannedTools=string[], verificationTarget=string, needsConfirmation=boolean.",
      "Do not wrap the JSON in Markdown or add commentary before or after it."
    );
  } else if (mode !== "deep-dialogue") {
    // 深度对话模式不需要"plain text without JSON"这种提示——它天然就是纯文本对话
    parts.push("Return the final assistant reply as plain text without JSON wrappers.");
  }

  return parts.join("\n");
};

export class ModelAdapter {
  constructor(private readonly secretService: SecretService) {}

  async generateReply(params: GenerateReplyParams): Promise<string> {
    const { provider, baseUrl, model } = params.config.provider;
    const apiKey = this.secretService.getProviderApiKey(provider);

    if (!apiKey) {
      throw new ProviderError(
        "missing_api_key",
        `Please add a ${PROVIDER_PRESET_MAP[provider]?.label ?? provider} API key in Settings first.`
      );
    }

    const generationProvider = createTextGenerationProvider(provider);
    const mode = params.mode ?? "default";
    const historyWindow = getHistoryWindow(mode);
    const recentMessages = params.history.slice(-historyWindow).map((message) => ({
      role: message.role === "assistant" ? "assistant" : message.role === "system" ? "system" : "user",
      content: message.content
    })) as Array<{ role: "system" | "user" | "assistant"; content: string }>;
    const responseMode = params.responseMode ?? "plain-text";
    const systemPrompt = buildSystemPrompt(params.expression, responseMode, mode);

    const result = await generationProvider.generate({
      provider,
      baseUrl,
      model,
      apiKey,
      temperature: getTemperature(mode),
      maxTokens: getMaxTokens(mode),
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        ...recentMessages,
        {
          role: "user",
          content: params.userText
        }
      ]
    });

    return result.text;
  }
}
