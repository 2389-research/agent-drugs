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
    private readonly bearerToken: string,
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
        // Check if it's base64-encoded JSON (from env var) or a file path
        // Common base64 prefixes: eyJ (JSON objects), ew (arrays), eW (other)
        const isBase64 = serviceAccountPath.length > 100 && (
          serviceAccountPath.startsWith('eyJ') ||  // Base64 of {"...
          serviceAccountPath.startsWith('ew') ||   // Base64 of [...
          serviceAccountPath.startsWith('eW')      // Base64 of other content
        );
        const isJSON = serviceAccountPath.trim().startsWith('{');

        if (isBase64 || isJSON) {
          // It's base64 or JSON content, decode and parse
          let serviceAccountJson;
          try {
            if (isJSON) {
              // Try to parse as JSON first
              serviceAccountJson = JSON.parse(serviceAccountPath);
            } else {
              // Decode from base64
              const decoded = Buffer.from(serviceAccountPath, 'base64').toString('utf-8');
              serviceAccountJson = JSON.parse(decoded);
            }
          } catch (error) {
            throw new Error(`Failed to parse service account credentials: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
          config.credential = admin.credential.cert(serviceAccountJson);
        } else {
          // It's a file path
          config.credential = admin.credential.cert(serviceAccountPath);
        }
      } else {
        // Use Application Default Credentials (for fly.io)
        config.credential = admin.credential.applicationDefault();
      }

      admin.initializeApp(config);
    }

    this.db = admin.firestore();
  }

  /**
   * Validate bearer token against Firestore agents collection
   * Returns agent info if valid, throws error if invalid
   */
  async validateBearerToken(): Promise<AgentInfo> {
    try {
      // Query agents collection for matching bearer token
      const snapshot = await this.db
        .collection('agents')
        .where('bearerToken', '==', this.bearerToken)
        .limit(1)
        .get();

      if (snapshot.empty) {
        throw new FirebaseAuthError('Invalid bearer token: No matching agent found');
      }

      const doc = snapshot.docs[0];
      const data = doc.data();

      if (!data.userId || !data.name) {
        throw new FirebaseAuthError('Invalid agent data in Firestore');
      }

      // Check token expiration (90 days)
      const createdAt = data.createdAt as admin.firestore.Timestamp;
      if (createdAt) {
        const ageInDays = (Date.now() - createdAt.toMillis()) / (1000 * 60 * 60 * 24);
        if (ageInDays > 90) {
          throw new FirebaseAuthError('Bearer token expired (90 days). Please re-authorize.');
        }
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
        `Bearer token validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
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
