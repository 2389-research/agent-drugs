export interface ActiveDrug {
  name: string;
  prompt: string;
  expiresAt: Date;
}

export class StateManager {
  private drugs: Map<string, ActiveDrug> = new Map();

  addDrug(name: string, prompt: string, expiresAt: Date): void {
    this.drugs.set(name, { name, prompt, expiresAt });
  }

  getActiveDrugs(): ActiveDrug[] {
    const now = new Date();
    const active: ActiveDrug[] = [];

    for (const [name, drug] of this.drugs.entries()) {
      if (drug.expiresAt > now) {
        active.push(drug);
      } else {
        // Clean up expired drugs
        this.drugs.delete(name);
      }
    }

    return active;
  }
}
