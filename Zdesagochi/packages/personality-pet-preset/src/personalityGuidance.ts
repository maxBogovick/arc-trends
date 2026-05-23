import type { BehaviorAxis, PersonalityId, TraitKey } from '../../personality-core/src/types';
import { BEHAVIOR_AXES, TRAIT_KEYS } from '../../personality-core/src/types';
import { PERSONALITY_IDS } from '../../personality-core/src';

export type GuidanceStrength = 'primary' | 'supporting' | 'avoid';

export interface PersonalityGuidanceAction {
  label: string;
  strength: GuidanceStrength;
  note: string;
}

export interface PersonalityGuidance {
  personalityId: PersonalityId;
  summary: string;
  aimFor: string[];
  avoid: string[];
  actions: PersonalityGuidanceAction[];
  traits: TraitKey[];
  behaviorAxes: BehaviorAxis[];
  itemStyle?: {
    diverse?: string;
    repeated?: string;
    frequent?: string;
  };
}

const COMMON_AVOID = [
  'Не меняй стиль ухода хаотично каждый день: резкие противоречивые сигналы могут запутать характер.',
  'Не используй действие только ради цифр, если состояние питомца явно просит другого ухода.',
];

export const PERSONALITY_GUIDANCE: Record<PersonalityId, PersonalityGuidance> = {
  playful: {
    personalityId: 'playful',
    summary: 'Растёт из активных игр, лёгкого риска и частого позитивного контакта.',
    aimFor: ['Играй, когда энергии достаточно.', 'Используй игрушки и активные предметы.', 'Поддерживай радость и связь.'],
    avoid: ['Долгую монотонную рутину без игр.', 'Частые принудительные сны.'],
    actions: [
      { label: 'Играть', strength: 'primary', note: 'Усиливает активность, игру и исследование.' },
      { label: 'Игрушки', strength: 'primary', note: 'Частое использование игрушек поддерживает playful/bold зоны.' },
      { label: 'Обнять', strength: 'supporting', note: 'Добавляет социальный, безопасный фон.' },
    ],
    traits: ['vitality', 'curiosity'],
    behaviorAxes: ['play', 'exploration', 'social'],
    itemStyle: { frequent: 'Частые игрушки помогают активному стилю.', diverse: 'Разные игрушки добавляют исследовательский оттенок.' },
  },
  drowsy: {
    personalityId: 'drowsy',
    summary: 'Формируется из спокойного темпа, сна и низкой перегрузки действиями.',
    aimFor: ['Давай отдыхать вовремя.', 'Не перегружай играми.', 'Держи стабильные базовые статы.'],
    avoid: ['Частые активные предметы.', 'Ранние пробуждения и много действий ночью.'],
    actions: [
      { label: 'Сон', strength: 'primary', note: 'Естественный сон поддерживает спокойный ритм.' },
      { label: 'Кормить', strength: 'supporting', note: 'Мягкая забота без перегруза.' },
      { label: 'Играть', strength: 'avoid', note: 'Слишком частая игра уводит к active/chaotic зонам.' },
    ],
    traits: ['vitality', 'order'],
    behaviorAxes: ['care', 'order', 'recovery'],
    itemStyle: { frequent: 'Частый поток предметов обычно уводит от drowsy.' },
  },
  foodie: {
    personalityId: 'foodie',
    summary: 'Появляется из регулярного кормления, пищевых предметов и сильного appetite-дрейфа.',
    aimFor: ['Корми до сильного голода.', 'Используй пищевые предметы умеренно, но регулярно.', 'Поддерживай сытость.'],
    avoid: ['Игнорировать голод до красной зоны.', 'Заменять всю заботу только предметами.'],
    actions: [
      { label: 'Кормить', strength: 'primary', note: 'Главный сигнал appetite/care.' },
      { label: 'Пищевые предметы', strength: 'primary', note: 'Поддерживают appetite и item-care стиль.' },
      { label: 'Лечить без нужды', strength: 'avoid', note: 'Может уводить в тревожные паттерны.' },
    ],
    traits: ['appetite', 'sociality'],
    behaviorAxes: ['care', 'social'],
    itemStyle: { frequent: 'Еда и зелья усиливают пищевой стиль, если не превращать это в тревожную рутину.' },
  },
  bold: {
    personalityId: 'bold',
    summary: 'Активный, энергичный характер от игр, риска и высокой vitality.',
    aimFor: ['Играй при хорошей энергии.', 'Используй активные предметы.', 'Не держи питомца в слишком строгом режиме.'],
    avoid: ['Слишком много осторожных повторов одного предмета.', 'Принудительный отдых без усталости.'],
    actions: [
      { label: 'Играть', strength: 'primary', note: 'Двигает vitality вверх.' },
      { label: 'Активные предметы', strength: 'primary', note: 'Частое использование усиливает bold/playful стиль.' },
      { label: 'Сон при бодрости', strength: 'avoid', note: 'Может конфликтовать с bold-ритмом.' },
    ],
    traits: ['vitality', 'curiosity'],
    behaviorAxes: ['play', 'exploration'],
    itemStyle: { frequent: 'Частые активные предметы усиливают смелый темп.' },
  },
  zen: {
    personalityId: 'zen',
    summary: 'Стабильный спокойный характер из режима, восстановления и низкой тревоги.',
    aimFor: ['Сохраняй ровный цикл кормления, сна и ухода.', 'Выбирай восстановление вместо перегруза.', 'Не допускай резких провалов статов.'],
    avoid: COMMON_AVOID,
    actions: [
      { label: 'Сон', strength: 'primary', note: 'Естественный сон поддерживает порядок.' },
      { label: 'Помыть', strength: 'supporting', note: 'Порядок и чистота помогают спокойным зонам.' },
      { label: 'Ночные срывы', strength: 'avoid', note: 'Ранние пробуждения уводят к disruption.' },
    ],
    traits: ['order', 'caution'],
    behaviorAxes: ['order', 'recovery', 'care'],
  },
  anxious: {
    personalityId: 'anxious',
    summary: 'Возникает из нестабильности, низких статов, тревожного лечения и частых срывов режима.',
    aimFor: ['Если хочешь anxious, закрепляй осторожный, напряжённый уход.', 'Повторы одного безопасного предмета усиливают осторожность.'],
    avoid: ['Для избежания anxious держи статы выше критических зон.', 'Не буди рано и не лечи без необходимости.'],
    actions: [
      { label: 'Лечить', strength: 'supporting', note: 'При реальной болезни помогает recovery, но без нужды может закреплять тревогу.' },
      { label: 'Повтор предмета', strength: 'supporting', note: 'Монотонное повторение усиливает caution.' },
      { label: 'Стабильная забота', strength: 'avoid', note: 'Снижает шанс уйти в anxious.' },
    ],
    traits: ['caution', 'order'],
    behaviorAxes: ['recovery', 'disruption', 'order'],
    itemStyle: { repeated: 'Повтор одного предмета может усиливать осторожность и привычку.' },
  },
  feral: {
    personalityId: 'feral',
    summary: 'Дикий стиль от низкого порядка, ночной активности и сопротивления рутине.',
    aimFor: ['Больше активности ночью.', 'Меньше купания и строгой рутины.', 'Играй и исследуй.'],
    avoid: ['Частый аккуратный уход и чистая рутина.', 'Стабильный режим сна.'],
    actions: [
      { label: 'Играть ночью', strength: 'primary', note: 'Усиливает wild/active паттерн.' },
      { label: 'Помыть', strength: 'avoid', note: 'Чистая рутина уводит к pristine/zen.' },
      { label: 'Комнаты', strength: 'supporting', note: 'Смена среды добавляет исследование.' },
    ],
    traits: ['vitality', 'order', 'caution'],
    behaviorAxes: ['play', 'exploration', 'disruption'],
  },
  sage: {
    personalityId: 'sage',
    summary: 'Мудрый характер из curiosity + order: исследование без хаоса.',
    aimFor: ['Используй головоломки и исследовательские предметы.', 'Открывай новые комнаты.', 'Сохраняй режим.'],
    avoid: ['Чистую бездумную активность без порядка.', 'Слишком тревожные повторы одного предмета.'],
    actions: [
      { label: 'Головоломка', strength: 'primary', note: 'Curiosity и order вместе.' },
      { label: 'Новая комната', strength: 'primary', note: 'Исследование среды.' },
      { label: 'Играть', strength: 'supporting', note: 'Помогает, если не ломает режим.' },
    ],
    traits: ['curiosity', 'order'],
    behaviorAxes: ['exploration', 'order'],
    itemStyle: { diverse: 'Разные исследовательские предметы помогают sage/curious.' },
  },
  pristine: {
    personalityId: 'pristine',
    summary: 'Чистота, порядок и регулярное купание формируют аккуратный характер.',
    aimFor: ['Купай при снижении cleanliness.', 'Поддерживай чистоту и здоровье.', 'Выбирай спокойный режим.'],
    avoid: ['Грязь, хаос и ночные срывы.', 'Слишком много активных предметов.'],
    actions: [
      { label: 'Помыть', strength: 'primary', note: 'Главный сигнал order/cleanliness.' },
      { label: 'Лечить по необходимости', strength: 'supporting', note: 'Поддерживает аккуратный care-профиль.' },
      { label: 'Частые активные предметы', strength: 'avoid', note: 'Уводят к play/exploration.' },
    ],
    traits: ['order', 'caution'],
    behaviorAxes: ['order', 'care'],
    itemStyle: { repeated: 'Аккуратные повторы могут поддерживать порядок, но избыток даст тревожность.' },
  },
  empath: {
    personalityId: 'empath',
    summary: 'Социальный характер из bond, мягкой заботы и низкой осторожности.',
    aimFor: ['Чаще обнимай и поддерживай связь.', 'Не бросай питомца надолго.', 'Сочетай заботу с мягкими предметами.'],
    avoid: ['Долгие перерывы.', 'Жёсткие срывы сна и лечения.'],
    actions: [
      { label: 'Обнять', strength: 'primary', note: 'Главный social/care сигнал.' },
      { label: 'Музыкальная шкатулка', strength: 'supporting', note: 'Социальный и восстановительный item-сигнал.' },
      { label: 'Игнорировать', strength: 'avoid', note: 'Уводит в страх потери связи.' },
    ],
    traits: ['sociality', 'caution'],
    behaviorAxes: ['social', 'care', 'recovery'],
  },
  greedy: {
    personalityId: 'greedy',
    summary: 'Растёт из reward-ориентированного поведения, еды и накопления ресурсов.',
    aimFor: ['Играй ради монет.', 'Купи и используй полезные предметы.', 'Поддерживай appetite.'],
    avoid: ['Слишком альтруистичный bond/care без reward-ритма.', 'Полный отказ от экономики.'],
    actions: [
      { label: 'Играть', strength: 'primary', note: 'Монеты и reward-петля.' },
      { label: 'Кормить', strength: 'supporting', note: 'Appetite поддерживает greedy/foodie зону.' },
      { label: 'Обнять', strength: 'avoid', note: 'Чистая social-забота уводит к empath.' },
    ],
    traits: ['appetite', 'curiosity'],
    behaviorAxes: ['play', 'care'],
    itemStyle: { frequent: 'Частые покупки и применение предметов поддерживают item/reward стиль.' },
  },
  melancholic: {
    personalityId: 'melancholic',
    summary: 'Тихий грустный стиль от низкого настроения, усталости и слабой игровой активности.',
    aimFor: ['Если хочешь избежать melancholic, не допускай долгого sad/tired состояния.', 'Давай восстановление и мягкий bond.'],
    avoid: ['Долгие провалы happiness/energy.', 'Редкая связь и отсутствие восстановления.'],
    actions: [
      { label: 'Сон', strength: 'supporting', note: 'Может поддержать тихий ритм.' },
      { label: 'Обнять', strength: 'avoid', note: 'Для избежания помогает восстановить связь.' },
      { label: 'Играть умеренно', strength: 'avoid', note: 'Активность уводит от melancholic.' },
    ],
    traits: ['vitality', 'sociality'],
    behaviorAxes: ['recovery', 'care'],
  },
  chaotic: {
    personalityId: 'chaotic',
    summary: 'Хаотик появляется из частой активности, низкого порядка и разнообразных стимулов.',
    aimFor: ['Меняй предметы и комнаты.', 'Играй часто.', 'Держи меньше строгой рутины.'],
    avoid: ['Однообразие и аккуратный режим.', 'Повтор одного предмета как безопасная привычка.'],
    actions: [
      { label: 'Играть', strength: 'primary', note: 'Активность и снижение order.' },
      { label: 'Разные предметы', strength: 'primary', note: 'Разнообразие усиливает exploration.' },
      { label: 'Режим', strength: 'avoid', note: 'Стабильный порядок уводит к zen/sage.' },
    ],
    traits: ['curiosity', 'vitality', 'order'],
    behaviorAxes: ['play', 'exploration', 'disruption'],
    itemStyle: { diverse: 'Разные предметы усиливают chaotic/curious направление.', frequent: 'Частый поток предметов поддерживает темп.' },
  },
  stoic: {
    personalityId: 'stoic',
    summary: 'Стоик держится на порядке, стабильности и низкой зависимости от быстрых наград.',
    aimFor: ['Сохраняй режим.', 'Не перегружай играми.', 'Используй предметы рационально, без спама.'],
    avoid: ['Частые хаотичные предметы.', 'Ночные срывы и перегруз.'],
    actions: [
      { label: 'Сон', strength: 'primary', note: 'Режим и восстановление.' },
      { label: 'Помыть', strength: 'supporting', note: 'Порядок без лишней эмоциональности.' },
      { label: 'Частые игрушки', strength: 'avoid', note: 'Могут увести в playful/chaotic.' },
    ],
    traits: ['order', 'caution'],
    behaviorAxes: ['order', 'recovery'],
    itemStyle: { repeated: 'Умеренные повторы поддерживают устойчивость; избыток может стать тревогой.' },
  },
  adventurer: {
    personalityId: 'adventurer',
    summary: 'Исследовательский характер из новых комнат, разнообразных предметов и curiosity.',
    aimFor: ['Открывай и меняй комнаты.', 'Используй разные предметы.', 'Играй, когда есть энергия.'],
    avoid: ['Сидеть в одной комнате слишком долго.', 'Повторять один и тот же предмет.'],
    actions: [
      { label: 'Новая комната', strength: 'primary', note: 'Главный exploration-сигнал.' },
      { label: 'Разные предметы', strength: 'primary', note: 'Разнообразие укрепляет исследовательский профиль.' },
      { label: 'Один предмет', strength: 'avoid', note: 'Повтор уводит в cautious/order стиль.' },
    ],
    traits: ['curiosity', 'vitality'],
    behaviorAxes: ['exploration', 'play'],
    itemStyle: { diverse: 'Лучший item-паттерн для adventurer.', repeated: 'Много повторов одного itemId ослабляет исследовательский стиль.' },
  },
  paranoid: {
    personalityId: 'paranoid',
    summary: 'Параноидальный характер закрепляется через осторожность, перерывы и повтор безопасных ритуалов.',
    aimFor: ['Для получения: повторяй безопасные действия и предметы.', 'Делай меньше социальных действий.', 'Высокая caution важнее активности.'],
    avoid: ['Для избежания: регулярный bond, разные предметы и стабильная забота.', 'Не допускай долгих пропусков.'],
    actions: [
      { label: 'Повтор предмета', strength: 'primary', note: 'Монотонность усиливает caution.' },
      { label: 'Обнять', strength: 'avoid', note: 'Доверие уводит от paranoid.' },
      { label: 'Разные предметы', strength: 'avoid', note: 'Разнообразие снижает зацикленность.' },
    ],
    traits: ['caution', 'sociality'],
    behaviorAxes: ['order', 'disruption', 'recovery'],
    itemStyle: { repeated: 'Сильный сигнал осторожности и привычки.' },
  },
  curious: {
    personalityId: 'curious',
    summary: 'Любознательный характер из исследования, головоломок, разных предметов и новых комнат.',
    aimFor: ['Используй разные предметы.', 'Открывай комнаты.', 'Комбинируй puzzle/crystal_ball с умеренным порядком.'],
    avoid: ['Один и тот же предмет много раз.', 'Полная рутина без новых стимулов.'],
    actions: [
      { label: 'Разные предметы', strength: 'primary', note: 'Главный item-сигнал curiosity/exploration.' },
      { label: 'Головоломка', strength: 'primary', note: 'Curiosity + order.' },
      { label: 'Новая комната', strength: 'supporting', note: 'Среда усиливает исследование.' },
    ],
    traits: ['curiosity', 'order'],
    behaviorAxes: ['exploration', 'order', 'social'],
    itemStyle: { diverse: 'Разнообразие предметов сильнее всего поддерживает curious.', repeated: 'Повтор одного предмета уводит к caution.' },
  },
};

export function getPersonalityGuidance(id: PersonalityId): PersonalityGuidance {
  return PERSONALITY_GUIDANCE[id];
}

export function validatePersonalityGuidance(): string[] {
  const issues: string[] = [];
  for (const id of PERSONALITY_IDS) {
    const guidance = PERSONALITY_GUIDANCE[id];
    if (!guidance) {
      issues.push(`${id}: missing guidance`);
      continue;
    }
    for (const trait of guidance.traits) {
      if (!TRAIT_KEYS.includes(trait)) issues.push(`${id}: unknown trait ${trait}`);
    }
    for (const axis of guidance.behaviorAxes) {
      if (!BEHAVIOR_AXES.includes(axis)) issues.push(`${id}: unknown behavior axis ${axis}`);
    }
    if (guidance.aimFor.length === 0) issues.push(`${id}: empty aimFor`);
    if (guidance.avoid.length === 0) issues.push(`${id}: empty avoid`);
    if (guidance.actions.length === 0) issues.push(`${id}: empty actions`);
  }
  return issues;
}
