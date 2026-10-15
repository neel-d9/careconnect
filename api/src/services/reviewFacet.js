
export async function reviewAnalyticsFacet(mongoDb,clinicId) {
  if (!clinicId) {
    throw new Error('clinicId is required for review analytics');
  }

  const result = await mongoDb
    .collection('PatientReviews')
    .aggregate([
      // Filter reviews for the requested clinic first.
      {
        $match: {
          clinic_id: clinicId,
        },
      },
      {
        $facet: {
          // 1. Count reviews for each rating.
          ratingDistribution: [
            {
              $match: {
                rating: { $gte: 1, $lte: 5 },
              },
            },
            {
              $group: {
                _id: '$rating',
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
            {
              $project: {
                _id: 0,
                rating: '$_id',
                count: 1,
              },
            },
          ],

          // 2. Find the 10 most frequent tags.
          topTags: [
            { $unwind: '$tags' },
            {
              $match: {
                tags: { $type: 'string', $ne: '' },
              },
            },
            {
              $group: {
                _id: '$tags',
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1, _id: 1 } },
            { $limit: 10 },
            {
              $project: {
                _id: 0,
                tag: '$_id',
                count: 1,
              },
            },
          ],

          // 3. Calculate this clinic's average rating and review count.
          overallAverage: [
            {
              $match: {
                rating: { $gte: 1, $lte: 5 },
              },
            },
            {
              $group: {
                _id: null,
                averageRating: { $avg: '$rating' },
                totalReviews: { $sum: 1 },
              },
            },
            {
              $project: {
                _id: 0,
                averageRating: {
                  $round: ['$averageRating', 2],
                },
                totalReviews: 1,
              },
            },
          ],
          // 4. Get recent reviews for this clinic
          recentReviews: [
            { $sort: { created_at: -1 } },
            { $limit: 6 },
            {
              $project: {
                _id: 0,
                id: '$_id',
                rating: 1,
                tags: 1,
                created_at: 1,
              },
            },
          ],
        },
      },
    ])
    .toArray();

  const r = result[0] || {};

  return {
    ratingDistribution: r.ratingDistribution || [],
    topTags: r.topTags || [],
    overallAverage: r.overallAverage?.[0] || {
      averageRating: null,
      totalReviews: 0,
    },
    recentReviews: r.recentReviews || [],
  };
}
