import { EventEmitter } from 'node:events';

export type StageKey = 'fetch' | 'extract' | 'check' | 'store' | 'report';

/** Weights must sum to 100. Extract is heaviest (link status checks, sub-extractors). */
export const STAGE_WEIGHTS: Record<StageKey, number> = {
  fetch: 15,
  extract: 40,
  check: 15,
  store: 10,
  report: 20,
};

export interface ProgressEvent {
  stage: StageKey | 'done';
  message: string;
  percent: number;
}

/**
 * Shared across pipeline stages via explicit parameter (not a global), so stages
 * stay plain functions that are trivially runnable/testable without a reporter
 * (see NoopProgressReporter below).
 */
export class ProgressReporter extends EventEmitter {
  private completedWeight = 0;

  startStage(stage: StageKey, message: string): void {
    this.emit('progress', { stage, message, percent: Math.round(this.completedWeight) } satisfies ProgressEvent);
  }

  /** fraction is 0..1 progress within the current stage, e.g. 12/47 links checked. */
  update(stage: StageKey, fraction: number, message: string): void {
    const clamped = Math.min(Math.max(fraction, 0), 1);
    const percent = this.completedWeight + STAGE_WEIGHTS[stage] * clamped;
    this.emit('progress', { stage, message, percent: Math.round(percent) } satisfies ProgressEvent);
  }

  finishStage(stage: StageKey): void {
    this.completedWeight += STAGE_WEIGHTS[stage];
    this.emit('progress', {
      stage,
      message: `Finished ${stage}`,
      percent: Math.round(this.completedWeight),
    } satisfies ProgressEvent);
  }

  done(message = 'Done'): void {
    this.emit('progress', { stage: 'done', message, percent: 100 } satisfies ProgressEvent);
  }
}

/** No-op reporter for tests and direct programmatic pipeline use. */
export class NoopProgressReporter extends ProgressReporter {
  override startStage(): void {}
  override update(): void {}
  override finishStage(): void {}
  override done(): void {}
}
