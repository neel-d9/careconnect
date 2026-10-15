
import os
import random
from datetime import datetime, timedelta, timezone

from faker import Faker
from pymongo import MongoClient
import psycopg2
from dotenv import load_dotenv


# ---------------------------------------------------------
# Configuration
# ---------------------------------------------------------

random.seed(42)
Faker.seed(42)
fake = Faker()

MONGO_URI = "mongodb://localhost:27017/medical_db"
DB_NAME = "medical_db"

# Reuse the PostgreSQL connection string from data_generation/.env
load_dotenv()
POSTGRES_URI = os.getenv("DB_URI")

if not POSTGRES_URI:
    raise RuntimeError(
        "DB_URI is missing from the .env file."
    )

# psycopg2 expects postgresql://, not the SQLAlchemy-specific
# postgresql+psycopg2:// scheme.
if POSTGRES_URI.startswith("postgresql+psycopg2://"):
    POSTGRES_URI = POSTGRES_URI.replace(
        "postgresql+psycopg2://",
        "postgresql://",
        1,
    )

NURSE_COUNT = 500
TARGET_PINGS = 500_000
PINGS_PER_NURSE = TARGET_PINGS // NURSE_COUNT

REVIEW_COUNT = 20_000
BATCH_SIZE = 5_000

CENTER_LAT = 17.3850
CENTER_LNG = 78.4867
JITTER_DEGREES = 0.03

PING_MAX_AGE_MINUTES = 100

REVIEW_TAGS = [
    "friendly", "professional", "long_wait", "clean_facility",
    "rushed", "attentive", "great_bedside_manner", "on_time",
    "helpful_staff", "would_recommend", "poor_communication",
    "compassionate", "efficient", "outdated_equipment",
]

CATALOG_CATEGORIES = [
    "General Healthcare",
    "Primary Care",
    "Outpatient Care",
    "Community Healthcare",
]


# ---------------------------------------------------------
# Helpers
# ---------------------------------------------------------

def random_point(center_lat, center_lng, jitter):
    """Generate GeoJSON coordinates in [longitude, latitude] order."""

    lat = center_lat + random.uniform(-jitter, jitter)
    lng = center_lng + random.uniform(-jitter, jitter)

    return {
        "type": "Point",
        "coordinates": [round(lng, 6), round(lat, 6)],
    }


# ---------------------------------------------------------
# PostgreSQL -> MongoDB MedicalCatalogs
# ---------------------------------------------------------

def seed_medical_catalogs(postgres_connection, mongo_db):
    """
    Copy actual PostgreSQL clinic records into MongoDB.

    The PostgreSQL clinic UUID is preserved as clinic_id.
    Descriptions and categories are generated metadata;
    they are not claimed to be official clinic information.
    """

    print("Reading clinics from PostgreSQL...")

    with postgres_connection.cursor() as cursor:
        cursor.execute("""
            SELECT
                id,
                name,
                latitude,
                longitude,
                is_accepting_patients
            FROM clinics
            ORDER BY id
        """)

        clinics = cursor.fetchall()

    if not clinics:
        raise RuntimeError(
            "No clinics found in PostgreSQL. "
            "MedicalCatalogs was not populated."
        )

    print(f"Found {len(clinics):,} PostgreSQL clinics.")

    # Clear existing catalog documents on every seeder run.
    # This does not drop the collection or its indexes.
    print("Clearing existing MedicalCatalogs...")
    mongo_db.MedicalCatalogs.delete_many({})

    synced_at = datetime.now(timezone.utc)
    documents = []
    postgres_clinic_ids = []

    for index, clinic in enumerate(clinics):
        (
            clinic_id,
            name,
            latitude,
            longitude,
            is_accepting_patients,
        ) = clinic

        # Preserve the original PostgreSQL UUID.
        clinic_id_string = str(clinic_id)
        postgres_clinic_ids.append(clinic_id_string)

        category = CATALOG_CATEGORIES[
            index % len(CATALOG_CATEGORIES)
        ]

        documents.append({
            "clinic_id": clinic_id_string,
            "name": name,

            "description": (
                f"{name} is a healthcare facility listed "
                "in the CareConnect clinic directory."
            ),

            "category": category,

            "location": {
                "type": "Point",
                "coordinates": [
                    float(longitude),
                    float(latitude),
                ],
            },

            "latitude": float(latitude),
            "longitude": float(longitude),
            "is_accepting_patients": bool(
                is_accepting_patients
            ),

            "source": "postgresql.clinics",
            "synced_at": synced_at,
        })

    # Insert in batches, keeping the seeder scalable.
    inserted_catalogs = 0

    for start in range(0, len(documents), BATCH_SIZE):
        batch = documents[start:start + BATCH_SIZE]

        result = mongo_db.MedicalCatalogs.insert_many(
            batch,
            ordered=True,
        )

        inserted_catalogs += len(result.inserted_ids)

    print(
        f"MedicalCatalogs inserted: "
        f"{inserted_catalogs:,}"
    )

    return postgres_clinic_ids


# ---------------------------------------------------------
# Nurse ping generation
# ---------------------------------------------------------

def generate_nurse_pings():
    """
    Generate exactly TARGET_PINGS before TTL expiration.

    Every nurse gets one recent ACTIVE ping so the geospatial
    workflow has recent active data for every nurse.
    """

    now = datetime.now(timezone.utc)
    nurse_ids = [fake.uuid4() for _ in range(NURSE_COUNT)]

    # One recent ACTIVE ping per nurse.
    initial_batch = []

    for nurse_id in nurse_ids:
        initial_batch.append({
            "nurse_id": nurse_id,
            "location": random_point(
                CENTER_LAT,
                CENTER_LNG,
                JITTER_DEGREES,
            ),
            "status": "ACTIVE",
            "created_at": now - timedelta(
                seconds=random.randint(0, 30)
            ),
        })

    yield initial_batch

    # Generate the remaining pings.
    remaining_per_nurse = PINGS_PER_NURSE - 1

    for nurse_id in nurse_ids:
        batch = []

        for _ in range(remaining_per_nurse):
            age_minutes = random.uniform(
                0,
                PING_MAX_AGE_MINUTES,
            )

            batch.append({
                "nurse_id": nurse_id,
                "location": random_point(
                    CENTER_LAT,
                    CENTER_LNG,
                    JITTER_DEGREES,
                ),
                "status": random.choices(
                    ["ACTIVE", "OFFLINE"],
                    weights=[0.7, 0.3],
                    k=1,
                )[0],
                "created_at": now - timedelta(
                    minutes=age_minutes
                ),
            })

            if len(batch) >= BATCH_SIZE:
                yield batch
                batch = []

        if batch:
            yield batch


# ---------------------------------------------------------
# Patient review generation
# ---------------------------------------------------------

def generate_patient_reviews(postgres_clinic_ids):
    """
    Generate synthetic reviews.

    Review clinic_id values refer to actual PostgreSQL clinics,
    rather than unrelated randomly generated clinic UUIDs.
    """

    patient_ids = [
        fake.uuid4()
        for _ in range(2_000)
    ]

    if not postgres_clinic_ids:
        raise ValueError(
            "Cannot generate reviews without clinic IDs."
        )

    batch = []

    for _ in range(REVIEW_COUNT):
        batch.append({
            "patient_id": random.choice(patient_ids),
            "clinic_id": random.choice(postgres_clinic_ids),

            "rating": random.choices(
                [1, 2, 3, 4, 5],
                weights=[0.05, 0.08, 0.15, 0.32, 0.40],
                k=1,
            )[0],

            "tags": random.sample(
                REVIEW_TAGS,
                k=random.randint(1, 3),
            ),

            "created_at": fake.date_time_between(
                start_date="-90d",
                end_date="now",
                tzinfo=timezone.utc,
            ),
        })

        if len(batch) >= BATCH_SIZE:
            yield batch
            batch = []

    if batch:
        yield batch


# ---------------------------------------------------------
# Main seeding process
# ---------------------------------------------------------

def main():
    mongo_client = MongoClient(
        MONGO_URI,
        serverSelectionTimeoutMS=5000,
    )

    postgres_connection = None

    try:
        # Verify MongoDB before modifying any data.
        mongo_client.admin.command("ping")
        mongo_db = mongo_client[DB_NAME]

        print(f"Connected to MongoDB: {DB_NAME}")

        # Connect to PostgreSQL and verify that clinic data
        # is available before clearing MongoDB collections.
        print("Connecting to PostgreSQL...")
        postgres_connection = psycopg2.connect(
            POSTGRES_URI,
            connect_timeout=5,
        )

        print("Connected to PostgreSQL.")

        # Read clinics, clear MedicalCatalogs, and populate it.
        postgres_clinic_ids = seed_medical_catalogs(
            postgres_connection,
            mongo_db,
        )

        # Intentionally clear these collections on every run.
        # Existing indexes remain in place.
        print(
            "Clearing existing NursePings "
            "and PatientReviews..."
        )

        mongo_db.NursePings.delete_many({})
        mongo_db.PatientReviews.delete_many({})

        # -------------------------------------------------
        # Seed nurse pings
        # -------------------------------------------------

        print(
            f"Seeding {TARGET_PINGS:,} NursePings "
            f"across {NURSE_COUNT} nurses..."
        )

        inserted_pings = 0

        for batch in generate_nurse_pings():
            mongo_db.NursePings.insert_many(
                batch,
                ordered=False,
            )

            inserted_pings += len(batch)

            print(
                f"  {inserted_pings:,} pings inserted",
                end="\r",
                flush=True,
            )

        print(
            f"\nDone: {inserted_pings:,} "
            "NursePings inserted."
        )

        # -------------------------------------------------
        # Seed patient reviews
        # -------------------------------------------------

        print(f"Seeding {REVIEW_COUNT:,} PatientReviews...")

        inserted_reviews = 0

        for batch in generate_patient_reviews(
            postgres_clinic_ids
        ):
            mongo_db.PatientReviews.insert_many(
                batch,
                ordered=False,
            )

            inserted_reviews += len(batch)

            print(
                f"  {inserted_reviews:,} reviews inserted",
                end="\r",
                flush=True,
            )

        print(
            f"\nDone: {inserted_reviews:,} "
            "PatientReviews inserted."
        )

        # -------------------------------------------------
        # Verification
        # -------------------------------------------------

        catalog_count = (
            mongo_db.MedicalCatalogs.count_documents({})
        )

        nurse_count = (
            mongo_db.NursePings.count_documents({})
        )

        review_count = (
            mongo_db.PatientReviews.count_documents({})
        )

        active_count = mongo_db.NursePings.count_documents({
            "status": "ACTIVE"
        })

        nurses_with_recent_active_ping = len(
            mongo_db.NursePings.distinct(
                "nurse_id",
                {
                    "status": "ACTIVE",
                    "created_at": {
                        "$gte": datetime.now(timezone.utc)
                        - timedelta(minutes=5)
                    },
                },
            )
        )

        print("\n========== Verification ==========")
        print(f"MedicalCatalogs: {catalog_count:,}")
        print(f"PostgreSQL clinics read: {len(postgres_clinic_ids):,}")
        print(f"NursePings: {nurse_count:,}")
        print(f"PatientReviews: {review_count:,}")
        print(f"Currently active pings: {active_count:,}")
        print(
            "Nurses with a recent ACTIVE ping: "
            f"{nurses_with_recent_active_ping:,}"
        )
        print("==================================")

        if catalog_count != len(postgres_clinic_ids):
            print(
                "WARNING: MedicalCatalogs count does not match "
                "the number of PostgreSQL clinics."
            )

        if nurse_count != TARGET_PINGS:
            print(
                "WARNING: NursePings count differs from target. "
                "The TTL monitor may have expired older documents."
            )

        if review_count != REVIEW_COUNT:
            print(
                "WARNING: PatientReviews count differs from target."
            )

        if nurses_with_recent_active_ping != NURSE_COUNT:
            print(
                "WARNING: Not every nurse has a recent ACTIVE ping."
            )

    finally:
        if postgres_connection is not None:
            postgres_connection.close()

        mongo_client.close()
        print("\nDatabase connections closed.")


if __name__ == "__main__":
    main()
