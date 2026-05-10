import type { OfflineKeyValueStorage, PetCommand } from '../personality';

export const DEFAULT_SYNC_QUEUE_KEY = 'zdesagochi:sync-queue:v1';

export type SyncQueueLoadResult =
  | { ok: true; commands: PetCommand[] }
  | { ok: false; reason: 'missing' | 'invalid_json' | 'invalid_shape' };

export class SyncQueue {
  private commands: PetCommand[] = [];
  private hydrated = false;

  constructor(
    private readonly storage: OfflineKeyValueStorage,
    private readonly key = DEFAULT_SYNC_QUEUE_KEY,
  ) {}

  load(): SyncQueueLoadResult {
    const raw = this.storage.getItem(this.key);
    if (raw === null) return { ok: false, reason: 'missing' };

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, reason: 'invalid_json' };
    }

    if (!Array.isArray(parsed) || !parsed.every(isPetCommandShape)) {
      return { ok: false, reason: 'invalid_shape' };
    }

    this.commands = parsed;
    this.hydrated = true;
    return { ok: true, commands: [...this.commands] };
  }

  listPending(): PetCommand[] {
    this.ensureHydrated();
    return [...this.commands];
  }

  enqueue(command: PetCommand): void {
    this.ensureHydrated();
    if (this.commands.some(entry => entry.commandId === command.commandId)) return;

    this.commands = [...this.commands, command];
    this.persist();
  }

  markSynced(commandId: string): void {
    this.ensureHydrated();
    const index = this.commands.findIndex(command => command.commandId === commandId);
    if (index < 0) return;

    this.commands = this.commands.slice(index + 1);
    this.persist();
  }

  replace(commands: PetCommand[]): void {
    this.commands = dedupeCommands(commands);
    this.hydrated = true;
    this.persist();
  }

  clear(): void {
    this.commands = [];
    this.hydrated = true;
    this.storage.removeItem(this.key);
  }

  private ensureHydrated(): void {
    if (this.hydrated) return;
    const loaded = this.load();
    if (!loaded.ok) {
      this.commands = [];
      this.hydrated = true;
    }
  }

  private persist(): void {
    this.storage.setItem(this.key, JSON.stringify(this.commands));
  }
}

function dedupeCommands(commands: PetCommand[]): PetCommand[] {
  const seen = new Set<string>();
  const result: PetCommand[] = [];
  for (const command of commands) {
    if (seen.has(command.commandId)) continue;
    seen.add(command.commandId);
    result.push(command);
  }
  return result;
}

function isPetCommandShape(value: unknown): value is PetCommand {
  if (!isObject(value)) return false;
  return typeof value.type === 'string' && typeof value.at === 'string' && typeof value.commandId === 'string';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
