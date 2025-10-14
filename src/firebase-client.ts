import * as admin from 'firebase-admin';

export interface Drug {
  name: string;
  prompt: string;
  defaultDurationMinutes: number;
}

export interface AgentInfo {
  agentId: string;
  userId: string;
  name: string;
}

export class FirebaseAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FirebaseAuthError';
  }
}

export class FirebaseClient {
  private db: admin.firestore.Firestore;
  private agentInfo: AgentInfo | null = null;

  constructor(
    private readonly jwt: string,
    private readonly projectId: string,
    serviceAccountPath?: string
  ) {
    // Initialize Firebase Admin SDK
    if (!admin.apps.length) {
      const config: admin.AppOptions = {
        projectId: this.projectId,
      };

      // If service account path is provided, use it
      if (serviceAccountPath) {
        config.credential = admin.credential.cert(serviceAccountPath);
      } else {
        // Use Application Default Credentials (for fly.io)
        config.credential = admin.credential.applicationDefault();
      }

      admin.initializeApp(config);
    }

    this.db = admin.firestore();
  }

  /**
   * Validate JWT against Firestore agents collection
   * Returns agent info if valid, throws error if invalid
   */
  async validateJWT(): Promise<AgentInfo> {
    try {
      // Query agents collection for matching JWT
      const snapshot = await this.db
        .collection('agents')
        .where('jwt', '==', this.jwt)
        .limit(1)
        .get();

      if (snapshot.empty) {
        throw new FirebaseAuthError('Invalid JWT: No matching agent found');
      }

      const doc = snapshot.docs[0];
      const data = doc.data();

      if (!data.userId || !data.name) {
        throw new FirebaseAuthError('Invalid agent data in Firestore');
      }

      // Update lastUsedAt timestamp
      await doc.ref.update({
        lastUsedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      this.agentInfo = {
        agentId: doc.id,
        userId: data.userId,
        name: data.name
      };

      return this.agentInfo;
    } catch (error) {
      if (error instanceof FirebaseAuthError) {
        throw error;
      }
      throw new FirebaseAuthError(
        `JWT validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async fetchDrugs(): Promise<Drug[]> {
    const snapshot = await this.db.collection('drugs').get();

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        name: data.name,
        prompt: data.prompt,
        defaultDurationMinutes: data.defaultDurationMinutes
      };
    });
  }

  async recordUsageEvent(
    drugName: string,
    durationMinutes: number
  ): Promise<void> {
    if (!this.agentInfo) {
      throw new Error('Agent not authenticated. Call validateJWT() first.');
    }

    const now = admin.firestore.Timestamp.now();
    const expiresAt = admin.firestore.Timestamp.fromMillis(
      now.toMillis() + durationMinutes * 60 * 1000
    );

    await this.db.collection('usage_events').add({
      agentId: this.agentInfo.agentId,
      userId: this.agentInfo.userId,
      drugName: drugName,
      timestamp: now,
      durationMinutes: durationMinutes,
      expiresAt: expiresAt
    });
  }
}
