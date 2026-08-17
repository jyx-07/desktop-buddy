import type { BehaviorRule, PetConfig, RuleAction, RuleTrigger } from "../types/pet";
import type { BehaviorController } from "./BehaviorController";
import type { MovementEngine } from "./MovementEngine";

interface TickContext {
  cursor: { x: number; y: number };
  idleSeconds: number;
  timeOfDay: { hour: number; minute: number };
}

/**
 * Minimal WHEN/DO automation runner. The UI for authoring rules can grow
 * later (Phase 14) - this just needs to stay a stable, extensible target.
 */
export class RuleEngine {
  private config: PetConfig;
  private behavior: BehaviorController;
  private movement: MovementEngine;
  private firedThisMinute = new Set<string>();

  constructor(config: PetConfig, behavior: BehaviorController, movement: MovementEngine) {
    this.config = config;
    this.behavior = behavior;
    this.movement = movement;
  }

  updateConfig(config: PetConfig) {
    this.config = config;
  }

  evaluate(ctx: TickContext) {
    for (const rule of this.config.rules) {
      if (!rule.enabled) continue;
      if (!this.matches(rule.trigger, ctx)) continue;

      if (rule.trigger.type === "timeOfDay") {
        const fireKey = `${rule.id}:${ctx.timeOfDay.hour}:${ctx.timeOfDay.minute}`;
        if (this.firedThisMinute.has(fireKey)) continue;
        this.firedThisMinute.add(fireKey);
      }

      this.apply(rule.action, ctx);
    }
  }

  private matches(trigger: RuleTrigger, ctx: TickContext): boolean {
    switch (trigger.type) {
      case "idleForMinutes":
        return ctx.idleSeconds >= trigger.minutes * 60;
      case "mouseIdleSeconds":
        return ctx.idleSeconds >= trigger.seconds;
      case "timeOfDay":
        return ctx.timeOfDay.hour === trigger.hour && ctx.timeOfDay.minute === trigger.minute;
    }
  }

  private apply(action: RuleAction, ctx: TickContext) {
    switch (action.type) {
      case "moveNear":
        this.movement.seekScreenPoint(ctx.cursor.x, ctx.cursor.y, 55);
        break;
      case "sleep":
        this.behavior.forceState("sleep", 60000);
        break;
      case "lookAtCursor":
        this.behavior.forceState("lookAtCursor", 3000);
        break;
      case "playAnimation":
        this.behavior.forceState(action.state, 3000);
        break;
    }
  }
}

export type { BehaviorRule };
