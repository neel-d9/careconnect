import csv
import io
import os
import random
import time
import uuid
from datetime import datetime, timedelta
from decimal import Decimal

from faker import Faker
from sqlalchemy import create_engine
from dotenv import load_dotenv


# ---------------------------------------------------------
# Configuration
# ---------------------------------------------------------

fake = Faker()
load_dotenv()

DB_URI = os.getenv("DB_URI")

if not DB_URI:
    raise RuntimeError("DB_URI is missing from the .env file")

NUM_PATIENTS = 10_000
NUM_CLINICS = 100
NUM_AUDIT_LOGS = 100_000
NUM_APPOINTMENTS = 100_000

# Reproducible random data
random.seed(42)
Faker.seed(42)


# ---------------------------------------------------------
# PostgreSQL COPY helper
# ---------------------------------------------------------

def copy_rows(connection, table, columns, rows):
    """
    Bulk-insert rows into PostgreSQL using COPY.

    This is intentionally used instead of individual INSERT
    statements because the seeder generates a large dataset.
    """

    buffer = io.StringIO()

    writer = csv.writer(
        buffer,
        delimiter="\t",
        lineterminator="\n",
        quoting=csv.QUOTE_MINIMAL,
    )

    for row in rows:
        processed_row = [
            str(item).lower() if isinstance(item, bool) else item
            for item in row
        ]

        writer.writerow(processed_row)

    buffer.seek(0)

    column_list = ",".join(f'"{column}"' for column in columns)

    copy_sql = f"""
        COPY "{table}" ({column_list})
        FROM STDIN
        WITH (
            FORMAT CSV,
            DELIMITER E'\\t'
        )
    """

    with connection.cursor() as cursor:
        cursor.copy_expert(copy_sql, buffer)


# ---------------------------------------------------------
# Patient generation
# ---------------------------------------------------------

def generate_patients():
    """
    Generate the initial patient population.

    Every patient starts with a positive HSA balance.
    """

    patients = []

    for _ in range(NUM_PATIENTS):
        patients.append(
            {
                "id": uuid.uuid4(),
                "name": fake.name(),
                "balance": Decimal(random.randint(1_000, 10_000)),
            }
        )

    return patients


# ---------------------------------------------------------
# Clinic generation
# ---------------------------------------------------------

def generate_clinics():
    """
    Generate clinic records.

    Coordinates remain within the original project's
    geographic range and satisfy the latitude/longitude
    constraints in the schema.
    """

    clinics = []

    for _ in range(NUM_CLINICS):
        clinics.append(
            {
                "id": uuid.uuid4(),
                "name": f"{fake.city()} Care Clinic",
                "latitude": round(random.uniform(43.5, 45.5), 6),
                "longitude": round(random.uniform(-79.8, -78.5), 6),
                "is_accepting_patients": random.choices(
                    [True, False],
                    weights=[90, 10],
                    k=1,
                )[0],
            }
        )

    return clinics


# ---------------------------------------------------------
# Historical wallet audit generation
# ---------------------------------------------------------

def generate_audit_logs(patients):
    """
    Generate historical wallet audit records.

    IMPORTANT:
    amount_changed is always positive.

    The direction of the balance change is represented by
    action_type:
        DEBIT
        CREDIT

    This matches the database constraint:
        amount_changed > 0
    """

    balances = {
        patient["id"]: patient["balance"]
        for patient in patients
    }

    patient_ids = list(balances.keys())

    audit_logs = []

    start_date = datetime.now() - timedelta(days=730)

    for index in range(NUM_AUDIT_LOGS):

        patient_id = random.choice(patient_ids)

        current_balance = balances[patient_id]

        amount = (
            Decimal(random.randint(100, 50_000))
            / Decimal("100")
        ).quantize(Decimal("0.01"))

        # Decide whether this transaction is a debit or credit.
        #
        # A debit is only possible when sufficient HSA funds exist.
        if current_balance >= amount and random.choice([True, False]):
            amount_changed = amount
            action_type = "DEBIT"

            new_balance = (
                current_balance - amount
            ).quantize(Decimal("0.01"))

        else:
            amount_changed = amount
            action_type = "CREDIT"

            new_balance = (
                current_balance + amount
            ).quantize(Decimal("0.01"))

        # Keep our simulated historical balance up to date.
        balances[patient_id] = new_balance

        audit_logs.append(
            (
                patient_id,
                amount_changed,
                action_type,
                new_balance,
                start_date + timedelta(seconds=index * 630),
            )
        )

    # The final simulated balance becomes the patient's
    # starting HSA balance in the seeded database.
    for patient in patients:
        patient["balance"] = balances[patient["id"]]

    return audit_logs


# ---------------------------------------------------------
# Appointment generation
# ---------------------------------------------------------

def generate_appointments(patients, clinics):
    """
    Generate historical discharged appointments.

    These are historical seed records, so they are inserted
    directly using COPY rather than calling
    sp_book_appointment() 100,000 times.

    New appointments created by the application should use
    sp_book_appointment().
    """

    start_date = datetime.now() - timedelta(days=730)

    patient_ids = [patient["id"] for patient in patients]
    clinic_ids = [clinic["id"] for clinic in clinics]

    appointments = []

    for _ in range(NUM_APPOINTMENTS):

        patient_id = random.choice(patient_ids)
        clinic_id = random.choice(clinic_ids)

        copay_amount = (
            Decimal(random.randint(0, 20_000))
            / Decimal("100")
        ).quantize(Decimal("0.01"))

        created_at = (
            start_date
            + timedelta(
                seconds=random.randint(
                    0,
                    63_072_000,
                )
            )
        )

        appointments.append(
            (
                patient_id,
                clinic_id,
                copay_amount,
                "DISCHARGED",
                created_at,
            )
        )

    return appointments


# ---------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------

def validate_generated_data(
    patients,
    clinics,
    audit_logs,
    appointments,
):
    """
    Validate important invariants before writing data
    to PostgreSQL.
    """

    # -----------------------------------------------------
    # Patient validation
    # -----------------------------------------------------

    for patient in patients:
        if patient["balance"] < Decimal("0.00"):
            raise ValueError(
                f"Negative HSA balance generated for patient "
                f"{patient['id']}"
            )

    # -----------------------------------------------------
    # Clinic validation
    # -----------------------------------------------------

    for clinic in clinics:

        if not -90 <= clinic["latitude"] <= 90:
            raise ValueError(
                f"Invalid latitude generated: "
                f"{clinic['latitude']}"
            )

        if not -180 <= clinic["longitude"] <= 180:
            raise ValueError(
                f"Invalid longitude generated: "
                f"{clinic['longitude']}"
            )

    # -----------------------------------------------------
    # Audit validation
    # -----------------------------------------------------

    for (
        patient_id,
        amount_changed,
        action_type,
        balance_after,
        timestamp,
    ) in audit_logs:

        if amount_changed <= Decimal("0.00"):
            raise ValueError(
                "Audit amount_changed must be positive"
            )

        if action_type not in {"DEBIT", "CREDIT"}:
            raise ValueError(
                f"Invalid audit action_type: {action_type}"
            )

        if balance_after < Decimal("0.00"):
            raise ValueError(
                "Audit balance_after cannot be negative"
            )

    # -----------------------------------------------------
    # Appointment validation
    # -----------------------------------------------------

    valid_statuses = {
        "WAITING",
        "IN_CONSULTATION",
        "DISCHARGED",
    }

    for (
        patient_id,
        clinic_id,
        copay_amount,
        status,
        created_at,
    ) in appointments:

        if copay_amount < Decimal("0.00"):
            raise ValueError(
                "Appointment copay cannot be negative"
            )

        if status not in valid_statuses:
            raise ValueError(
                f"Invalid appointment status: {status}"
            )


# ---------------------------------------------------------
# Database seeding
# ---------------------------------------------------------

def seed_database():

    start_time = time.time()

    engine = create_engine(DB_URI)

    connection = engine.raw_connection()

    try:

        print("Generating patients...")
        patients = generate_patients()

        print("Generating clinics...")
        clinics = generate_clinics()

        print("Generating historical wallet audit logs...")
        audit_logs = generate_audit_logs(patients)

        print("Generating historical appointments...")
        appointments = generate_appointments(
            patients,
            clinics,
        )

        print("Validating generated data...")

        validate_generated_data(
            patients,
            clinics,
            audit_logs,
            appointments,
        )

        print("Generated data passed validation.")
        print()

        # -------------------------------------------------
        # Patients
        # -------------------------------------------------

        print("Seeding patients...")

        copy_rows(
            connection,
            "patients",
            [
                "id",
                "name",
                "hsa_balance",
            ],
            [
                (
                    patient["id"],
                    patient["name"],
                    patient["balance"],
                )
                for patient in patients
            ],
        )

        # -------------------------------------------------
        # Clinics
        # -------------------------------------------------

        print("Seeding clinics...")

        copy_rows(
            connection,
            "clinics",
            [
                "id",
                "name",
                "latitude",
                "longitude",
                "is_accepting_patients",
            ],
            [
                (
                    clinic["id"],
                    clinic["name"],
                    clinic["latitude"],
                    clinic["longitude"],
                    clinic["is_accepting_patients"],
                )
                for clinic in clinics
            ],
        )

        # -------------------------------------------------
        # Historical wallet audit logs
        # -------------------------------------------------

        print("Seeding wallet audit logs...")

        copy_rows(
            connection,
            "wallet_audit_logs",
            [
                "patient_id",
                "amount_changed",
                "action_type",
                "balance_after",
                "timestamp",
            ],
            audit_logs,
        )

        # -------------------------------------------------
        # Historical appointments
        # -------------------------------------------------

        print("Seeding appointments...")

        copy_rows(
            connection,
            "appointments",
            [
                "patient_id",
                "clinic_id",
                "copay_amount",
                "status",
                "created_at",
            ],
            appointments,
        )

        # -------------------------------------------------
        # Commit everything together
        # -------------------------------------------------

        connection.commit()

        elapsed = time.time() - start_time

        print()
        print("==========================================")
        print("Seeding completed successfully.")
        print("==========================================")
        print(f"Patients:      {len(patients):,}")
        print(f"Clinics:       {len(clinics):,}")
        print(f"Audit logs:    {len(audit_logs):,}")
        print(f"Appointments:  {len(appointments):,}")
        print(f"Elapsed time:  {elapsed:.2f} seconds")
        print("==========================================")

    except Exception:

        connection.rollback()

        print()
        print("Seeding failed.")
        print("Transaction rolled back.")

        raise

    finally:

        connection.close()
        engine.dispose()


# ---------------------------------------------------------
# Main
# ---------------------------------------------------------

if __name__ == "__main__":
    seed_database()