export const TIME_OF_DAY_ACTIVITY_CONFIG_PATCH_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://zdesagochi.local/schemas/time-of-day-activity-config-patch.schema.json',
  title: 'TimeOfDayActivityConfigPatch',
  type: 'object',
  additionalProperties: false,
  properties: {
    periods: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'startHour', 'endHour', 'fallbackMessage'],
        additionalProperties: false,
        properties: {
          id: { enum: ['early_morning', 'morning', 'day', 'evening', 'night'] },
          startHour: { type: 'number', minimum: 0, maximum: 23 },
          endHour: { type: 'number', minimum: 0, maximum: 23 },
          fallbackMessage: { type: 'string', minLength: 1 },
        },
      },
    },
    fallbackOverrides: {
      type: 'object',
      additionalProperties: { type: 'string', minLength: 1 },
    },
    scoring: {
      type: 'object',
      additionalProperties: { type: 'number' },
    },
    defaultQuietHours: {
      type: 'object',
      additionalProperties: false,
      properties: {
        enabled: { type: 'boolean' },
        startHour: { type: 'number', minimum: 0, maximum: 23 },
        endHour: { type: 'number', minimum: 0, maximum: 23 },
      },
    },
    defaultTuningConfig: { $ref: '#/$defs/tuningConfig' },
    disabledActivityIds: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
    },
    activityRuleOverrides: {
      type: 'object',
      additionalProperties: { $ref: '#/$defs/activityRulePatch' },
    },
    activityRules: {
      type: 'array',
      items: { $ref: '#/$defs/activityRule' },
    },
  },
  $defs: {
    tuningConfig: {
      type: 'object',
      additionalProperties: false,
      properties: {
        disabledActivityIds: { type: 'array', items: { type: 'string', minLength: 1 } },
        activityScoreMultipliers: { type: 'object', additionalProperties: { type: 'number' } },
        cohortScoreMultipliers: {
          type: 'object',
          additionalProperties: {
            type: 'object',
            additionalProperties: { type: 'number' },
          },
        },
        globalScoreMultiplier: { type: 'number' },
      },
    },
    activityRulePatch: {
      type: 'object',
      additionalProperties: true,
      properties: {
        activityId: { type: 'string', minLength: 1 },
        baseScore: { type: 'number' },
        message: { type: 'string', minLength: 1 },
        reason: { type: 'string', minLength: 1 },
      },
    },
    activityRule: {
      type: 'object',
      required: ['id', 'activityId', 'baseScore', 'periodWeights', 'message', 'reason'],
      additionalProperties: true,
      properties: {
        id: { type: 'string', minLength: 1 },
        activityId: { type: 'string', minLength: 1 },
        baseScore: { type: 'number' },
        periodWeights: {
          type: 'object',
          minProperties: 1,
          additionalProperties: { type: 'number' },
        },
        message: { type: 'string', minLength: 1 },
        messageVariants: { type: 'array', items: { type: 'string', minLength: 1 } },
        reason: { type: 'string', minLength: 1 },
        ctaLabel: { type: 'string' },
      },
    },
  },
} as const;
