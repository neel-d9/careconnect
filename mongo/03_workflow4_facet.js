// CareConnect - Workflow 4: Review Analytics using $facet




const careConnectDb = db.getSiblingDB("medical_db");

const clinicId = "d01c5dbb-6b60-4308-9c8f-6c1152a61ae5";

const pipeline = [
     {
        $match: {
            clinic_id: clinicId
        }
    },
    {
        $facet: {
            // 1. Count reviews for each rating.
            ratingDistribution: [
                {
                    $match: {
                        rating: { $gte: 1, $lte: 5 }
                    }
                },
                {
                    $group: {
                        _id: "$rating",
                        count: { $sum: 1 }
                    }
                },
                {
                    $sort: { _id: 1 }
                },
                {
                    $project: {
                        _id: 0,
                        rating: "$_id",
                        count: 1
                    }
                }
            ],

            // 2. Find the 10 most frequently occurring tags.
            topTags: [
                {
                    $unwind: "$tags"
                },
                {
                    $match: {
                        tags: { $type: "string", $ne: "" }
                    }
                },
                {
                    $group: {
                        _id: "$tags",
                        count: { $sum: 1 }
                    }
                },
                {
                    $sort: {
                        count: -1,
                        _id: 1
                    }
                },
                {
                    $limit: 10
                },
                {
                    $project: {
                        _id: 0,
                        tag: "$_id",
                        count: 1
                    }
                }
            ],

            // 3. Calculate the global average and review count.
            overallAverage: [
                {
                    $match: {
                        rating: { $gte: 1, $lte: 5 }
                    }
                },
                {
                    $group: {
                        _id: null,
                        averageRating: { $avg: "$rating" },
                        totalReviews: { $sum: 1 }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        averageRating: {
                            $round: ["$averageRating", 2]
                        },
                        totalReviews: 1
                    }
                }
            ]
        }
    }
];

const result = careConnectDb.PatientReviews
    .aggregate(pipeline)
    .toArray();

print("CareConnect review analytics:");
printjson(result);