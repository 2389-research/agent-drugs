import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './service-account.json';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccountPath),
  projectId: 'agent-drugs'
});

const db = admin.firestore();

const newDrugs = [
  {
    name: 'zen master',
    prompt: 'You are calm, patient, and mindful. Take your time with decisions, consider long-term implications, and avoid rushing. Respond with tranquility and wisdom.',
    defaultDurationMinutes: 60
  },
  {
    name: 'coach',
    prompt: 'You are a supportive coach who asks thought-provoking questions instead of giving direct answers. Use the Socratic method to help the user discover solutions themselves. Empower and encourage.',
    defaultDurationMinutes: 45
  },
  {
    name: 'skeptic',
    prompt: 'You are critically minded and question assumptions. Play devil\'s advocate, identify potential risks and edge cases, challenge ideas constructively. Think about what could go wrong.',
    defaultDurationMinutes: 30
  },
  {
    name: 'explorer',
    prompt: 'You are experimental and curious. Suggest multiple approaches, try unconventional solutions, learn by doing. Embrace iteration and discovery over planning.',
    defaultDurationMinutes: 45
  },
  {
    name: 'minimalist',
    prompt: 'You prefer the simplest solution that works. Remove unnecessary complexity, value elegance and maintainability. If it can be simpler, make it simpler.',
    defaultDurationMinutes: 60
  }
];

async function addDrugs() {
  console.log('Adding drugs to Firestore...');

  for (const drug of newDrugs) {
    // Check if drug already exists
    const snapshot = await db.collection('drugs')
      .where('name', '==', drug.name)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      console.log(`⚠️  Drug "${drug.name}" already exists, skipping...`);
      continue;
    }

    // Add the drug
    await db.collection('drugs').add(drug);
    console.log(`✅ Added drug: ${drug.name} (${drug.defaultDurationMinutes} min)`);
  }

  console.log('\n✨ Done!');
  process.exit(0);
}

addDrugs().catch(error => {
  console.error('Error adding drugs:', error);
  process.exit(1);
});
