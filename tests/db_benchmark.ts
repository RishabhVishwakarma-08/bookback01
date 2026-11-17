import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { BookListing } from '../server/models/BookListing.js';
import { Campus } from '../server/models/Campus.js';
import { User } from '../server/models/User.js';
import { hashPassword } from '../server/utils/security.js';

async function runBenchmark() {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri('bookback_benchmark'));

  const campus = await Campus.create({
    name: 'MITS Gwalior',
    domain: 'mitsgwalior.in',
    location: 'Gwalior, MP',
  });

  const owner = await User.create({
    name: 'Benchmark Owner',
    email: 'bench@mitsgwalior.in',
    collegeId: '0901CS231888',
    branch: 'CSE',
    year: '3rd Year',
    semester: 6,
    campusId: campus._id,
    passwordHash: await hashPassword('BenchPass@2026'),
    role: 'student',
    verified: true,
  });

  const branches = ['CSE', 'ECE', 'ME', 'IT', 'CE', 'AI & DS'];
  const offerTypes = ['sell', 'lend', 'donate', 'exchange'] as const;
  const conditions = ['New', 'Like New', 'Good', 'Fair'] as const;

  const bulkDocs = Array.from({ length: 1000 }, (_, i) => {
    const offerType = offerTypes[(i + Math.floor(i / 8)) % offerTypes.length];
    return {
      ownerId: owner._id,
      campusId: campus._id,
      title: `Engineering Textbook Volume ${i + 1}`,
      author: `Author ${i % 50}`,
      subject: `Subject ${(i % 20) + 1}`,
      branch: branches[i % branches.length],
      semester: (i % 8) + 1,
      condition: conditions[i % conditions.length],
      offerType,
      price: offerType === 'sell' ? 200 + (i % 500) : 0,
      description: 'Academic benchmark textbook record for MongoDB query optimization testing.',
      status: i % 10 === 0 ? 'reserved' : 'available',
    };
  });

  await BookListing.insertMany(bulkDocs);
  await BookListing.syncIndexes();

  const col = BookListing.collection;

  // 1. Force natural collection scan (simulating pre-index query)
  const unindexedExplain: any = await col
    .find({ status: 'available', semester: 4, offerType: 'sell' })
    .sort({ createdAt: -1 })
    .hint({ $natural: 1 })
    .explain('executionStats');

  // 2. Use compound index { status: 1, semester: 1, offerType: 1, createdAt: -1 }
  const indexedExplain: any = await col
    .find({ status: 'available', semester: 4, offerType: 'sell' })
    .sort({ createdAt: -1 })
    .explain('executionStats');

  // 3. Text index search
  const textExplain: any = await col
    .find({ $text: { $search: 'Engineering Volume' } })
    .explain('executionStats');

  console.log(
    JSON.stringify(
      {
        totalDocuments: await BookListing.countDocuments(),
        indexes: await col.indexes(),
        unindexedNaturalScan: {
          stage: unindexedExplain.executionStats.executionStages?.stage,
          nReturned: unindexedExplain.executionStats.nReturned,
          totalDocsExamined: unindexedExplain.executionStats.totalDocsExamined,
          totalKeysExamined: unindexedExplain.executionStats.totalKeysExamined,
          executionTimeMillis: unindexedExplain.executionStats.executionTimeMillis,
        },
        compoundIndexedScan: {
          stage:
            indexedExplain.executionStats.executionStages?.inputStage?.stage ||
            indexedExplain.executionStats.executionStages?.stage,
          indexName:
            indexedExplain.executionStats.executionStages?.inputStage?.indexName ||
            indexedExplain.executionStats.executionStages?.indexName,
          nReturned: indexedExplain.executionStats.nReturned,
          totalDocsExamined: indexedExplain.executionStats.totalDocsExamined,
          totalKeysExamined: indexedExplain.executionStats.totalKeysExamined,
          executionTimeMillis: indexedExplain.executionStats.executionTimeMillis,
        },
        textIndexScan: {
          nReturned: textExplain.executionStats.nReturned,
          totalDocsExamined: textExplain.executionStats.totalDocsExamined,
          totalKeysExamined: textExplain.executionStats.totalKeysExamined,
          executionTimeMillis: textExplain.executionStats.executionTimeMillis,
        },
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
  await mongod.stop();
}

runBenchmark().catch((e) => {
  console.error(e);
  process.exit(1);
});
