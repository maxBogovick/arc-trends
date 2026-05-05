import type {
  EmergentStateType,
  InfluenceCategory,
  PersonalityDefinition,
  TraitKey,
} from './types';

type WindowWithTinyAI = Window & {
  ai?: {
    generate(prompt: string, options?: { maxTokens?: number }): Promise<string> | string;
  };
};

export interface MemoryGenerationContext {
  personality: PersonalityDefinition;
  ageHours: number;
  traitKey: TraitKey;
  direction: 'up' | 'down' | 'origin';
  category: InfluenceCategory;
  emergentState: EmergentStateType | null;
  dominantInfluences: string[];
}

export interface MemoryTextGenerator {
  generate(ctx: MemoryGenerationContext): Promise<string>;
}

export const MEMORY_TEMPLATES: Record<TraitKey, Record<'up' | 'down', string[]>> = {
  vitality: {
    up: ['Бурная игровая сессия', 'Не хотел останавливаться'],
    down: ['Тихий спокойный день', 'Долгий отдых'],
  },
  sociality: {
    up: ['Долгое время вместе', 'Особенно близкий момент'],
    down: ['Снова один...', 'Привык обходиться без тебя'],
  },
  order: {
    up: ['Всё по расписанию', 'День прошёл правильно'],
    down: ['Всё вверх дном', 'Хаос как стиль жизни'],
  },
  appetite: {
    up: ['Новый вкус', 'Гастрономическое открытие'],
    down: ['Ел что дали', 'Еда — просто топливо'],
  },
  caution: {
    up: ['Что-то напугало', 'Тревожный день'],
    down: ['Бесстрашный сегодня', 'Смелее обычного'],
  },
  curiosity: {
    up: ['Новое открытие', 'Мир стал интереснее'],
    down: ['Привычный маршрут', 'Зачем что-то менять'],
  },
};

export class TemplateGenerator implements MemoryTextGenerator {
  constructor(private readonly random: () => number = Math.random) {}

  async generate(ctx: MemoryGenerationContext): Promise<string> {
    if (ctx.direction === 'origin') return 'Что-то важное началось';

    const templates = MEMORY_TEMPLATES[ctx.traitKey]?.[ctx.direction] ?? ['Что-то изменилось'];
    const index = Math.floor(this.random() * templates.length);
    return templates[index] || 'Что-то изменилось';
  }
}

export class TinyAIGenerator implements MemoryTextGenerator {
  constructor(private readonly fallback: MemoryTextGenerator = new TemplateGenerator()) {}

  async generate(ctx: MemoryGenerationContext): Promise<string> {
    const prompt = buildMemoryPrompt(ctx);

    try {
      const ai = getTinyAI();
      const raw = ai ? await ai.generate(prompt, { maxTokens: 30 }) : '';
      const cleaned = sanitizeMemoryText(raw);
      return cleaned || this.fallback.generate(ctx);
    } catch {
      return this.fallback.generate(ctx);
    }
  }
}

export const DeviceCapabilities = {
  hasOnDeviceAI(): boolean {
    return getTinyAI() !== null;
  },
};

export function createMemoryTextGenerator(): MemoryTextGenerator {
  return DeviceCapabilities.hasOnDeviceAI()
    ? new TinyAIGenerator()
    : new TemplateGenerator();
}

export function buildMemoryPrompt(ctx: MemoryGenerationContext): string {
  const directionText = ctx.direction === 'up'
    ? 'вверх'
    : ctx.direction === 'down'
      ? 'вниз'
      : 'к истоку';

  return [
    `Питомец: ${ctx.personality.name}, ${Math.floor(ctx.ageHours / 24)} дней.`,
    `Действия дня: ${ctx.dominantInfluences.join(', ') || 'обычный день'}.`,
    `Черта "${ctx.traitKey}" сдвинулась ${directionText}.`,
    'Одно предложение в дневник от третьего лица. Без имён характеров.',
  ].join(' ');
}

export function sanitizeMemoryText(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().replace(/\s+/g, ' ').slice(0, 120);
}

function getTinyAI(): WindowWithTinyAI['ai'] | null {
  if (typeof window === 'undefined') return null;
  const candidate = (window as WindowWithTinyAI).ai;
  return candidate && typeof candidate.generate === 'function' ? candidate : null;
}
