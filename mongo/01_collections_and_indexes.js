// CareConnect - MongoDB Collections and Indexes
// Safe to run multiple times.

const careConnectDb = db.getSiblingDB("medical_db");

// 1. Create collections only if they do not already exist.
const requiredCollections = [
    "MedicalCatalogs",
    "PatientReviews",
    "NursePings"
];

const existingCollections = careConnectDb.getCollectionNames();

for (const collectionName of requiredCollections) {
    if (!existingCollections.includes(collectionName)) {
        careConnectDb.createCollection(collectionName);
        print(`Created collection: ${collectionName}`);
    } else {
        print(`Collection already exists: ${collectionName}`);
    }
}

// 2. Create a geospatial index for nearby nurse searches.
// Required for queries using $geoNear.
careConnectDb.NursePings.createIndex(
    { location: "2dsphere" }
);

// 3. Create a TTL index to expire nurse pings after 2 hours.
// created_at must be stored as a MongoDB Date.
// TTL deletion is asynchronous.
careConnectDb.NursePings.createIndex(
    { created_at: 1 },
    { expireAfterSeconds: 7200 }
);

// 4. Print confirmation and verify the indexes.
print("CareConnect MongoDB collections and indexes are ready.");
print("Database: medical_db");

print("NursePings indexes:");
printjson(careConnectDb.NursePings.getIndexes());