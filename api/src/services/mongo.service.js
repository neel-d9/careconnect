import { getMongoDb } from '../config/mongo.js';
import {reviewAnalyticsFacet} from './reviewFacet.js';
export async function nearbyNurse({lat,lng,radiusKm=5}){
  const radius=Math.min(Number(radiusKm)||5,5)*1000;

  const docs=await getMongoDb().collection('NursePings').aggregate([
    {$geoNear:{near:{type:'Point',coordinates:[Number(lng),Number(lat)]},distanceField:'distance_meters',spherical:true,maxDistance:radius,query:{status:'ACTIVE'}}},
    {$sort:{nurse_id:1,created_at:-1}},
    {$group:{_id:'$nurse_id',nurse_id:{$first:'$nurse_id'},location:{$first:'$location'},distance_meters:{$first:'$distance_meters'},last_seen:{$first:'$created_at'},status:{$first:'$status'}}},
    {$sort:{distance_meters:1}},
    {$limit:6}
  ]).toArray();
  return { nurse: docs[0]||null, nurses: docs };
}


export async function reviewAnalytics(clinicId){
  const result = await reviewAnalyticsFacet(getMongoDb(), clinicId);
  return result;
}

export async function medicalCatalog()
{
  const collection=getMongoDb().collection('MedicalCatalogs');
  const exists=await getMongoDb().listCollections({name:'MedicalCatalogs'}).hasNext();
  if(!exists) return null;
  let formulary = await collection.findOne({ specialist: { $exists: true } });
  if (!formulary) {
    formulary = {
      specialist: "Dr. Anita Rao",
      specialty: "Cardiology",
      mode: ["in_person", "telehealth"],
      slots: ["Mon 09:00–13:00", "Wed 09:00–13:00", "Fri 14:00–18:00"],
      formulary: [
        { name: "Amlodipine", category: "Antihypertensive", dosage: "5 mg once daily", tier: 1 },
        { name: "Metformin", category: "Antidiabetic", dosage: "500 mg twice daily", tier: 1 },
        { name: "Atorvastatin", category: "Lipid lowering", dosage: "10 mg at night", tier: 2 }
      ]
    };
    try {
      await collection.insertOne({ type: 'clinical_formulary', ...formulary });
    } catch {
      // Ignored
    }
  }
  return formulary;
}
