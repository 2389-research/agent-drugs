import * as admin from 'firebase-admin';

export interface ActiveDrug {
  name: string;
  prompt: string;
  expiresAt: Date;
}

export interface ActiveDrugFirestore {
  name: string;
  prompt: string;
  expiresAt: admin.firestore.Timestamp;
}

/**
 * StateManager using Firestore for persistence across instances
 * Each agent has their own active drugs stored in Firestore
 */
export class StateManager {
  private db: admin.firestore.Firestore;
  private agentId: string;
  private userId: string;

  constructor(agentId: string, userId: string) {
    this.db = admin.firestore();
    this.agentId = agentId;
    this.userId = userId;
  }

  /**
   * Add a drug to the agent's active drugs
   * Stored in Firestore so it persists across MCP server instances
   * Uses transactions to prevent race conditions
   */
  async addDrug(name: string, prompt: string, expiresAt: Date): Promise<void> {
    const docRef = this.db
      .collection('active_drugs')
      .doc(`${this.userId}_${this.agentId}`);

    // Use transaction to prevent race condition when multiple calls happen simultaneously
    await this.db.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      const currentDrugs: ActiveDrugFirestore[] = doc.exists ? (doc.data()?.drugs || []) : [];

      // Add new drug (or replace if already exists)
      const newDrug: ActiveDrugFirestore = {
        name,
        prompt,
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt)
      };

      // Remove old version of same drug if exists
      const filteredDrugs = currentDrugs.filter(d => d.name !== name);
      filteredDrugs.push(newDrug);

      // Store back to Firestore atomically
      transaction.set(docRef, {
        userId: this.userId,
        agentId: this.agentId,
        drugs: filteredDrugs,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });
  }

  /**
   * Get all active drugs for this agent
   * Filters out expired drugs and cleans them up
   */
  async getActiveDrugs(): Promise<ActiveDrug[]> {
    const docRef = this.db
      .collection('active_drugs')
      .doc(`${this.userId}_${this.agentId}`);

    const doc = await docRef.get();
    if (!doc.exists) {
      return [];
    }

    const data = doc.data();
    if (!data || !data.drugs) {
      return [];
    }

    const now = admin.firestore.Timestamp.now();
    const activeDrugs: ActiveDrug[] = [];
    const stillActiveDrugs: ActiveDrugFirestore[] = [];

    for (const drug of data.drugs as ActiveDrugFirestore[]) {
      if (drug.expiresAt.toMillis() > now.toMillis()) {
        // Still active
        activeDrugs.push({
          name: drug.name,
          prompt: drug.prompt,
          expiresAt: drug.expiresAt.toDate()
        });
        stillActiveDrugs.push(drug);
      }
      // Expired drugs are filtered out
    }

    // Clean up expired drugs in Firestore
    if (stillActiveDrugs.length !== data.drugs.length) {
      await docRef.update({
        drugs: stillActiveDrugs,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    return activeDrugs;
  }

  /**
   * Clear all active drugs for this agent
   * Used by the "detox" command to remove all behavioral modifications
   * Uses a transaction to prevent race conditions with concurrent take/detox operations
   */
  async clearAllDrugs(): Promise<void> {
    const docRef = this.db
      .collection('active_drugs')
      .doc(`${this.userId}_${this.agentId}`);

    // Use transaction for optimistic concurrency control
    await this.db.runTransaction(async (transaction) => {
      // Read the current document (ensures we have the latest state)
      await transaction.get(docRef);

      // Set the drugs array to empty
      transaction.set(docRef, {
        userId: this.userId,
        agentId: this.agentId,
        drugs: [],
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });
  }
}
