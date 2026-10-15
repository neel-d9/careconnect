// CareConnect - Workflow 3: Find the nearest active nurse

const patientLng = 78.4867;
const patientLat = 17.3850;
const maxDistanceMeters = 5000;

const careConnectDb = db.getSiblingDB("medical_db");

const pipeline = [
    // 1. Find active nurse pings within 5 km.
    {
        $geoNear: {
            near: {
                type: "Point",
                coordinates: [patientLng, patientLat]
            },
            key: "location",
            distanceField: "distance_meters",
            maxDistance: maxDistanceMeters,
            spherical: true,
            query: {
                status: "ACTIVE"
            }
        }
    },

    // 2. Sort each nurse's pings newest first.
    {
        $sort: {
            nurse_id: 1,
            created_at: -1
        }
    },

    // 3. Keep the most recent matching ping per nurse.
    {
        $group: {
            _id: "$nurse_id",
            nurse_id: { $first: "$nurse_id" },
            location: { $first: "$location" },
            distance_meters: { $first: "$distance_meters" },
            last_seen: { $first: "$created_at" },
            status: { $first: "$status" }
        }
    },

    // 4. Select the closest nurse.
    {
        $sort: {
            distance_meters: 1
        }
    },

    {
        $limit: 1
    },

    // 5. Format the result.
    {
        $project: {
            _id: 0,
            nurse_id: 1,
            distance_meters: {
                $round: ["$distance_meters", 1]
            },
            distance_km: {
                $round: [
                    { $divide: ["$distance_meters", 1000] },
                    2
                ]
            },
            last_seen: 1,
            location: 1
        }
    }
];

const result = careConnectDb.NursePings.aggregate(pipeline).toArray();

if (result.length === 0) {
    print("No active nurse found within 5 km.");
} else {
    print("Nearest active nurse:");
    printjson(result[0]);
}