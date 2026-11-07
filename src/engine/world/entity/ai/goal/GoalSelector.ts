/**
 * Translation of: world/entity/ai/goal/GoalSelector.h + Goal.h
 *
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/entity/ai/goal/GoalSelector.h
 *
 * GoalSelector manages a priority-ordered list of AI Goals.
 */

export interface Goal {
  canUse(): boolean;
  canContinueToUse(): boolean;
  start(): void;
  stop(): void;
  tick(): void;
  canInterrupt(): boolean;
  getRequiredControlFlags(): number;
}

class InternalGoal {
  constructor(public prio: number, public goal: Goal, public isUsing = false) {}
}

export class GoalSelector {
  private goals: InternalGoal[] = [];

  addGoal(prio: number, goal: Goal): void {
    this.goals.push(new InternalGoal(prio, goal));
  }

  tick(): void {
    const toStart: InternalGoal[] = [];
    for (const ig of this.goals) {
      if (ig.isUsing) {
        if (!this.canUseInSystem(ig) || !ig.goal.canContinueToUse()) {
          ig.goal.stop();
          ig.isUsing = false;
        } else continue;
      }
      if (!this.canUseInSystem(ig) || !ig.goal.canUse()) continue;
      toStart.push(ig);
      ig.isUsing = true;
    }
    for (const ig of toStart) ig.goal.start();
    for (const ig of this.goals) {
      if (ig.isUsing) ig.goal.tick();
    }
  }

  private canUseInSystem(goal: InternalGoal): boolean {
    for (const ig of this.goals) {
      if (ig.goal === goal.goal && ig.prio === goal.prio) continue;
      if (goal.prio >= ig.prio) {
        if (ig.isUsing && !this.canCoExist(goal, ig)) return false;
      } else if (ig.isUsing && !ig.goal.canInterrupt()) {
        return false;
      }
    }
    return true;
  }

  private canCoExist(goalA: InternalGoal, goalB: InternalGoal): boolean {
    return (goalA.goal.getRequiredControlFlags() & goalB.goal.getRequiredControlFlags()) === 0;
  }
}
