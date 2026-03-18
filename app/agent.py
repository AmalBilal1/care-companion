import os
import json
import psycopg2
import google.generativeai as genai

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from typing import Optional, List, Dict
from dateutil import parser as date_parser
from pypdf import PdfReader

from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent

from google.oauth2 import service_account
from googleapiclient.discovery import build

load_dotenv()

# ── LLM ───────────────────────────────────────────────────────────────────────

llm = ChatGoogleGenerativeAI(
    model="gemini-2.0-flash",
    google_api_key=os.environ.get("GOOGLE_API_KEY"),
)

# Also configure genai for direct generation calls (discharge parser, visit summary)
genai.configure(api_key=os.environ.get("GOOGLE_API_KEY"))
_genai_model = genai.GenerativeModel("gemini-2.0-flash")

# ── Google Calendar ────────────────────────────────────────────────────────────

SERVICE_ACCOUNT_FILE = "service_account.json"
SCOPES = ["https://www.googleapis.com/auth/calendar"]
TIMEZONE = "America/New_York"
CALENDAR_ID = os.environ.get("GOOGLE_CALENDAR_ID", "")


def _authenticate_google_calendar():
    credentials = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE, scopes=SCOPES
    )
    return build("calendar", "v3", credentials=credentials)


def _sync_to_calendar(appointment_time, summary, description=None, duration_minutes=30):
    try:
        service = _authenticate_google_calendar()
        if appointment_time.tzinfo is None:
            appointment_time = appointment_time.replace(tzinfo=ZoneInfo("America/New_York"))
        event = {
            "summary": summary,
            "description": description or "",
            "start": {"dateTime": appointment_time.isoformat(), "timeZone": TIMEZONE},
            "end": {"dateTime": (appointment_time + timedelta(minutes=duration_minutes)).isoformat(), "timeZone": TIMEZONE},
        }
        created = service.events().insert(calendarId=CALENDAR_ID, body=event).execute()
        return created.get("htmlLink")
    except Exception as e:
        print(f"⚠️ Calendar sync failed: {e}")
        return None

# ── Database ───────────────────────────────────────────────────────────────────

def get_db_connection():
    return psycopg2.connect(
        host=os.environ["DB_HOST"],
        database=os.environ["DB_NAME"],
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        port=os.environ["DB_PORT"],
        sslmode="require",
        connect_timeout=10,
    )


def init_db():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            user_id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT,
            phone TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS appointments (
            id SERIAL PRIMARY KEY,
            patient_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
            appointment_time TIMESTAMP NOT NULL,
            reason TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS symptom_logs (
            symptom_id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
            symptom TEXT NOT NULL,
            severity INTEGER CHECK (severity >= 1 AND severity <= 10),
            logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS medication_logs (
            medication_id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
            medication_name TEXT NOT NULL,
            dosage TEXT,
            schedule TEXT,
            start_date DATE,
            end_date DATE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS discharge_instructions (
            instruction_id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
            instruction TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS notes (
            note_id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS reminders (
            reminder_id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
            reminder_type TEXT,
            message TEXT,
            remind_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    conn.commit()
    cur.close()
    conn.close()

# ── DB Helpers ─────────────────────────────────────────────────────────────────

def _create_appointment_db(patient_id: int, appointment_time, reason: str = None) -> int:
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO appointments (patient_id, appointment_time, reason) VALUES (%s, %s, %s) RETURNING id;",
        (patient_id, appointment_time, reason),
    )
    appt_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()
    return appt_id


def _get_appointments(user_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, appointment_time, reason, created_at FROM appointments WHERE patient_id=%s ORDER BY appointment_time;",
        (user_id,),
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows


def _add_discharge_instruction(user_id: int, instruction: str) -> int:
    conn = get_db_connection()
    cur = conn.cursor()
    # Skip if this exact instruction already exists for this user
    cur.execute(
        "SELECT instruction_id FROM discharge_instructions WHERE user_id=%s AND instruction=%s LIMIT 1;",
        (user_id, instruction),
    )
    existing = cur.fetchone()
    if existing:
        cur.close()
        conn.close()
        return existing[0]
    cur.execute(
        "INSERT INTO discharge_instructions (user_id, instruction) VALUES (%s, %s) RETURNING instruction_id;",
        (user_id, instruction),
    )
    iid = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()
    return iid


def _get_discharge_instructions(user_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT instruction_id, instruction, created_at FROM discharge_instructions WHERE user_id=%s ORDER BY created_at DESC;",
        (user_id,),
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows


def _log_symptom(user_id: int, symptom: str, severity: int) -> int:
    severity = max(1, min(10, severity))
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO symptom_logs (user_id, symptom, severity) VALUES (%s, %s, %s) RETURNING symptom_id;",
        (user_id, symptom, severity),
    )
    sid = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()
    return sid


def _get_symptom_logs(user_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT symptom, severity, logged_at FROM symptom_logs WHERE user_id=%s ORDER BY logged_at DESC;",
        (user_id,),
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows


def _add_medication(user_id: int, medication_name: str, dosage: str = None, schedule: str = None, start_date=None, end_date=None) -> int:
    conn = get_db_connection()
    cur = conn.cursor()
    # Skip if this medication+dosage already exists for this user
    cur.execute(
        "SELECT medication_id FROM medication_logs WHERE user_id=%s AND LOWER(medication_name)=LOWER(%s) AND dosage=%s LIMIT 1;",
        (user_id, medication_name, dosage),
    )
    existing = cur.fetchone()
    if existing:
        cur.close()
        conn.close()
        return existing[0]
    cur.execute(
        "INSERT INTO medication_logs (user_id, medication_name, dosage, schedule, start_date, end_date) VALUES (%s,%s,%s,%s,%s,%s) RETURNING medication_id;",
        (user_id, medication_name, dosage, schedule, start_date, end_date),
    )
    mid = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()
    return mid


def _get_medications(user_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT medication_name, dosage, schedule, start_date, end_date, created_at FROM medication_logs WHERE user_id=%s;",
        (user_id,),
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows


def _add_reminder(user_id: int, reminder_type: str, message: str, remind_at) -> int:
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO reminders (user_id, reminder_type, message, remind_at) VALUES (%s,%s,%s,%s) RETURNING reminder_id;",
        (user_id, reminder_type, message, remind_at),
    )
    rid = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()
    return rid

# ── Reference Data ─────────────────────────────────────────────────────────────

MEDICATIONS_DB = {
    "acetaminophen": {"purpose": "Relieves mild to moderate pain and reduces fever", "common_side_effects": "Generally well-tolerated; rare side effects include nausea", "warnings": "Do not exceed 3000mg per day. Do not take with alcohol.", "food_instructions": "Can be taken with or without food"},
    "ibuprofen": {"purpose": "Reduces pain, inflammation, and fever", "common_side_effects": "Stomach upset, nausea, dizziness", "warnings": "Take with food to prevent stomach upset. Do not use if you have kidney problems or stomach ulcers.", "food_instructions": "Take with food or milk"},
    "oxycodone": {"purpose": "Treats moderate to severe pain", "common_side_effects": "Drowsiness, constipation, nausea, dizziness", "warnings": "Do not drive or operate machinery. Do not drink alcohol. Can be habit-forming.", "food_instructions": "Can be taken with or without food"},
    "metoprolol": {"purpose": "Lowers blood pressure and heart rate, protects the heart", "common_side_effects": "Tiredness, dizziness, slow heartbeat", "warnings": "Do not stop taking suddenly. Call doctor if heart rate drops below 50.", "food_instructions": "Take with food"},
    "lisinopril": {"purpose": "Lowers blood pressure and protects kidneys and heart", "common_side_effects": "Dry cough, dizziness, headache", "warnings": "Call doctor if you develop swelling of face, lips, or tongue.", "food_instructions": "Can be taken with or without food"},
    "aspirin": {"purpose": "Prevents blood clots, reduces risk of heart attack and stroke", "common_side_effects": "Stomach upset, heartburn", "warnings": "Can cause bleeding. Call doctor if you see blood in stool or unusual bruising.", "food_instructions": "Take with food to reduce stomach upset"},
    "atorvastatin": {"purpose": "Lowers cholesterol to reduce risk of heart disease", "common_side_effects": "Muscle aches, headache, nausea", "warnings": "Call doctor if you have unexplained muscle pain or weakness.", "food_instructions": "Take in the evening, with or without food"},
    "warfarin": {"purpose": "Prevents blood clots", "common_side_effects": "Bleeding, bruising", "warnings": "Requires regular blood tests. Avoid alcohol. Maintain consistent vitamin K intake.", "food_instructions": "Take at the same time each day"},
    "amoxicillin": {"purpose": "Treats bacterial infections", "common_side_effects": "Diarrhea, nausea, rash", "warnings": "Complete the full course even if you feel better.", "food_instructions": "Can be taken with or without food"},
    "ciprofloxacin": {"purpose": "Treats bacterial infections", "common_side_effects": "Nausea, diarrhea, dizziness", "warnings": "Avoid dairy products and antacids within 2 hours. Call doctor if you have tendon pain.", "food_instructions": "Take 2 hours before or 6 hours after dairy"},
    "metformin": {"purpose": "Lowers blood sugar in type 2 diabetes", "common_side_effects": "Nausea, diarrhea, stomach upset", "warnings": "Call doctor if you have severe nausea, vomiting, or rapid breathing.", "food_instructions": "Take with meals to reduce stomach upset"},
    "omeprazole": {"purpose": "Reduces stomach acid, treats heartburn and ulcers", "common_side_effects": "Headache, nausea, diarrhea", "warnings": "Take 30-60 minutes before eating.", "food_instructions": "Take before breakfast"},
    "furosemide": {"purpose": "Removes excess fluid, treats swelling and high blood pressure", "common_side_effects": "Frequent urination, dizziness, muscle cramps", "warnings": "Take in the morning to avoid nighttime urination.", "food_instructions": "Can be taken with or without food"},
    "prednisone": {"purpose": "Reduces inflammation and suppresses immune system", "common_side_effects": "Increased appetite, mood changes, trouble sleeping", "warnings": "Do not stop suddenly if taking for more than a few days.", "food_instructions": "Take with food to prevent stomach upset"},
    "apixaban": {"purpose": "Prevents blood clots, reduces stroke risk", "common_side_effects": "Bleeding, bruising", "warnings": "Call doctor if you have unusual bleeding or blood in urine.", "food_instructions": "Can be taken with or without food"},
    "gabapentin": {"purpose": "Treats nerve pain and post-surgical pain", "common_side_effects": "Drowsiness, dizziness, swelling of feet", "warnings": "Do not stop suddenly. May cause drowsiness - avoid driving initially.", "food_instructions": "Take with food"},
}

WARNING_SIGNS_DB = {
    "cardiac_surgery": {
        "emergency_signs": ["chest pain that is severe or getting worse", "difficulty breathing or shortness of breath at rest", "sudden weakness on one side of body", "fainting or passing out", "coughing up blood", "heart racing or pounding that does not stop", "temperature above 101.5°F with chills"],
        "urgent_signs": ["incision is red, swollen, or draining pus", "fever above 100.4°F", "leg swelling that is new or getting worse", "weight gain of more than 3 pounds in one day", "nausea or vomiting that prevents taking medications", "dizziness that does not go away"],
        "expected_symptoms": ["mild soreness around incision", "tiredness and fatigue for several weeks", "trouble sleeping", "mild swelling in legs that improves with elevation", "decreased appetite", "mood changes or feeling emotional", "mild constipation from pain medications"],
    },
    "joint_replacement": {
        "emergency_signs": ["sudden severe pain in the surgical leg", "chest pain or difficulty breathing", "calf pain with swelling and warmth (possible blood clot)", "surgical leg turns pale, blue, or cold", "fainting or passing out"],
        "urgent_signs": ["fever above 100.4°F", "increased redness or warmth around incision", "drainage from incision that is yellow, green, or smells bad", "new numbness or tingling in foot", "unable to bear weight as instructed"],
        "expected_symptoms": ["pain and swelling around the joint for several weeks", "bruising that may spread down the leg", "clicking or popping sounds from new joint", "difficulty sleeping due to discomfort", "stiffness that improves with physical therapy"],
    },
    "abdominal_surgery": {
        "emergency_signs": ["severe abdominal pain that is getting worse", "vomiting blood or material that looks like coffee grounds", "blood in stool or black tarry stools", "fever above 101.5°F with chills", "unable to keep any fluids down for 12 hours", "no bowel movement or gas for 3 days"],
        "urgent_signs": ["incision is opening or separating", "redness spreading from incision site", "fever above 100.4°F", "increasing pain not relieved by prescribed medication", "persistent nausea or vomiting"],
        "expected_symptoms": ["gas pain and bloating for several days", "constipation from pain medications", "decreased appetite", "fatigue", "mild bruising around incision"],
    },
    "pneumonia": {
        "emergency_signs": ["severe difficulty breathing", "chest pain when breathing", "confusion or altered mental status", "lips or fingernails turning blue", "coughing up large amounts of blood"],
        "urgent_signs": ["fever that returns after improving", "shortness of breath with minimal activity", "cough that is getting worse instead of better", "unable to keep fluids down"],
        "expected_symptoms": ["cough that gradually improves over 2-3 weeks", "fatigue for several weeks", "mild shortness of breath with activity that improves daily"],
    },
    "heart_failure": {
        "emergency_signs": ["severe shortness of breath", "chest pain", "fainting", "coughing up pink or bloody mucus"],
        "urgent_signs": ["weight gain of more than 2-3 pounds in one day or 5 pounds in one week", "increased swelling in legs, ankles, or abdomen", "waking up at night short of breath", "needing more pillows to sleep comfortably", "new or worsening cough"],
        "expected_symptoms": ["some shortness of breath with activity", "mild fatigue", "need to urinate more often when taking diuretics"],
    },
    "stroke": {
        "emergency_signs": ["new weakness or numbness on one side", "new difficulty speaking or understanding speech", "new vision problems", "severe headache unlike any before", "new difficulty walking or loss of balance"],
        "urgent_signs": ["dizziness that does not go away", "confusion or memory problems getting worse", "difficulty swallowing"],
        "expected_symptoms": ["fatigue, especially in the first few weeks", "emotional changes", "gradual improvement in strength and coordination with therapy"],
    },
    "general_surgery": {
        "emergency_signs": ["severe pain not relieved by medication", "heavy bleeding from incision", "fever above 101.5°F", "difficulty breathing", "chest pain"],
        "urgent_signs": ["fever above 100.4°F", "redness, swelling, or pus from incision", "incision opening up", "persistent vomiting", "unable to urinate"],
        "expected_symptoms": ["mild to moderate pain around incision", "fatigue", "bruising near incision", "constipation"],
    },
}

# ── Helper: symptom severity assessment ───────────────────────────────────────

def _assess_symptom_severity(symptom: str, severity: int, condition_data: dict) -> dict:
    symptom_lower = symptom.lower()
    for sign in condition_data.get("emergency_signs", []):
        if any(word in symptom_lower for word in sign.lower().split()):
            if severity >= 7:
                return {"level": "emergency", "reason": f"This matches: {sign}"}
    for sign in condition_data.get("urgent_signs", []):
        if any(word in symptom_lower for word in sign.lower().split()):
            if severity >= 5:
                return {"level": "urgent", "reason": f"This could indicate: {sign}"}
            return {"level": "monitor", "reason": f"This may be related to: {sign}. Monitor closely."}
    if severity >= 8:
        return {"level": "urgent", "reason": f"Severe symptom (severity {severity}/10) requires medical attention."}
    if severity >= 5:
        return {"level": "monitor", "reason": f"Moderate symptom (severity {severity}/10). Monitor and rest."}
    return {"level": "normal", "reason": "Mild symptom within expected range."}

# ── Tools ──────────────────────────────────────────────────────────────────────

@tool
def parse_discharge_instructions(user_id: int, discharge_text: str) -> str:
    """Parse discharge instructions and extract medications, appointments, and care instructions,
    then save them to the database. Use this when a patient shares or uploads their discharge paperwork."""

    prompt = f"""
You are a medical discharge parser.

Extract structured information from the discharge instructions below.

Return ONLY valid JSON in this format (no markdown fences, no extra text):

{{
    "medications": [
        {{"name": "string", "dosage": "string", "schedule": "string"}}
    ],
    "appointments": [
        {{"datetime": "string or null", "reason": "string"}}
    ],
    "care_instructions": ["string"]
}}

Discharge Instructions:
{discharge_text}
"""
    try:
        response = _genai_model.generate_content(prompt)
        raw = response.text.strip()
        if raw.startswith("```"):
            raw = raw.replace("```json", "").replace("```", "").strip()
        parsed = json.loads(raw)
    except Exception as e:
        return f"⚠️ Parsing failed: {str(e)}"

    for med in parsed.get("medications", []):
        _add_medication(user_id, med.get("name"), med.get("dosage"), med.get("schedule"))

    calendar_errors = []
    for appt in parsed.get("appointments", []):
        dt_string = appt.get("datetime")
        reason = appt.get("reason")
        if dt_string:
            try:
                appointment_time = date_parser.parse(dt_string, default=datetime(datetime.now().year, 1, 1))
                _create_appointment_db(user_id, appointment_time, reason)
                link = _sync_to_calendar(
                    appointment_time,
                    summary=f"Medical Appointment: {reason or 'Follow-up'}",
                    description=f"CareCompanion appointment for patient {user_id}",
                )
                if not link:
                    calendar_errors.append(reason or "appointment")
            except Exception as e:
                calendar_errors.append(f"{reason}: {str(e)}")

    for instruction in parsed.get("care_instructions", []):
        _add_discharge_instruction(user_id, instruction)

    result = (
        "✅ Discharge instructions processed.\n"
        f"- Medications added: {len(parsed.get('medications', []))}\n"
        f"- Appointments scheduled: {len(parsed.get('appointments', []))}\n"
        f"- Care instructions saved: {len(parsed.get('care_instructions', []))}"
    )
    if calendar_errors:
        result += f"\n⚠️ Calendar sync failed for: {', '.join(calendar_errors)}"
    return result


@tool
def schedule_appointment(user_id: int, appointment_datetime: str, reason: str) -> str:
    """Schedule a follow-up appointment for a patient and sync it to Google Calendar.
    appointment_datetime should be a human-readable date/time string like 'March 20 at 2 PM'."""
    try:
        appointment_time = date_parser.parse(appointment_datetime)
    except Exception:
        return f"❌ Could not parse date: '{appointment_datetime}'. Please provide a clearer date and time."

    appt_id = _create_appointment_db(user_id, appointment_time, reason)
    calendar_link = _sync_to_calendar(
        appointment_time,
        summary=f"Medical Appointment: {reason}",
        description=f"CareCompanion appointment for patient {user_id}",
    )

    result = f"✅ Appointment scheduled for {appointment_time.strftime('%B %d, %Y at %I:%M %p')} — {reason} (ID: {appt_id})"
    if calendar_link:
        result += f"\n🔗 Calendar: {calendar_link}"
    return result


@tool
def get_appointments(user_id: int) -> str:
    """Get all upcoming appointments for a patient."""
    rows = _get_appointments(user_id)
    if not rows:
        return "No appointments scheduled."
    lines = ["📅 Upcoming Appointments:"]
    for row in rows:
        appt_time = row[1].strftime("%B %d, %Y at %I:%M %p") if hasattr(row[1], "strftime") else str(row[1])
        lines.append(f"  • {row[2] or 'Follow-up'} — {appt_time}")
    return "\n".join(lines)


@tool
def log_symptom_check(user_id: int, symptom: str, severity: int, condition_type: Optional[str] = None) -> str:
    """Log a symptom for a patient and assess if it requires medical attention.
    severity is 1-10 (1=mild, 10=severe).
    condition_type options: cardiac_surgery, joint_replacement, abdominal_surgery, pneumonia, heart_failure, stroke, general_surgery."""

    try:
        _log_symptom(user_id, symptom, severity)
    except Exception as e:
        return f"❌ Error logging symptom: {str(e)}"

    response = [f"✅ Symptom logged: '{symptom}' (Severity: {severity}/10)"]

    if condition_type and condition_type.lower() in WARNING_SIGNS_DB:
        condition_data = WARNING_SIGNS_DB[condition_type.lower()]
        assessment = _assess_symptom_severity(symptom.lower(), severity, condition_data)

        if assessment["level"] == "emergency":
            response += [
                "\n🚨 EMERGENCY WARNING 🚨",
                f"  {assessment['reason']}",
                "\nCall 911 or go to the nearest ER immediately.",
            ]
        elif assessment["level"] == "urgent":
            response += [
                "\n⚠️ URGENT — Contact your doctor TODAY.",
                f"  {assessment['reason']}",
            ]
        elif assessment["level"] == "monitor":
            response += [
                "\n📊 Monitor this symptom.",
                f"  {assessment['reason']}",
                "  Check again in 4-6 hours. Contact doctor if it worsens.",
            ]
        else:
            response.append("\n✅ This appears to be a normal recovery symptom. Continue following your discharge plan.")

    recent = _get_symptom_logs(user_id)
    if len(recent) > 1:
        response.append("\n📈 Recent Symptoms:")
        for s, sev, t in recent[:3]:
            t_str = t.strftime("%b %d, %I:%M %p") if hasattr(t, "strftime") else str(t)
            response.append(f"  • {s} (Severity: {sev}/10) — {t_str}")

    response += [
        "\n📞 Emergency: Call 911 for severe symptoms.",
        "📞 Non-emergency: Call your doctor's office during business hours.",
    ]
    return "\n".join(response)


@tool
def analyze_symptom_trends(user_id: int, days: int = 7) -> str:
    """Analyze symptom trends for a patient over the past N days to identify patterns."""
    all_symptoms = _get_symptom_logs(user_id)
    if not all_symptoms:
        return "No symptom data available yet."

    cutoff = datetime.now() - timedelta(days=days)
    recent = [(s, sev, t) for s, sev, t in all_symptoms if hasattr(t, "date") and t >= cutoff]
    if not recent:
        return f"No symptoms logged in the last {days} days."

    symptom_data: Dict[str, List[int]] = {}
    for s, sev, _ in recent:
        symptom_data.setdefault(s, []).append(sev)

    lines = [f"📊 Symptom Trend Analysis (Last {days} Days)", f"Total logged: {len(recent)}", ""]
    for s, severities in symptom_data.items():
        avg = sum(severities) / len(severities)
        trend = "worsening 📈" if len(severities) > 1 and severities[-1] > severities[0] else \
                "improving 📉" if len(severities) > 1 and severities[-1] < severities[0] else "stable ⚖️"
        lines.append(f"  • {s}: avg {avg:.1f}/10, peak {max(severities)}/10 — {trend}")

    severe = [s for s, sev in symptom_data.items() if max(sev) >= 7]
    if severe:
        lines += ["", f"🚨 High-severity symptoms: {', '.join(severe)}", "  Please contact your healthcare provider."]

    return "\n".join(lines)


@tool
def create_medication_schedule(user_id: int) -> str:
    """Create and display a daily medication reminder schedule for a patient based on their logged medications."""
    medications = _get_medications(user_id)
    if not medications:
        return "No medications found. Please add medications first (e.g., by parsing discharge instructions)."

    freq_to_times = {
        "once": ["08:00"], "daily": ["08:00"],
        "twice": ["08:00", "20:00"],
        "three": ["08:00", "14:00", "20:00"],
        "four": ["08:00", "12:00", "16:00", "20:00"],
        "bedtime": ["22:00"],
    }

    lines = ["📋 YOUR DAILY MEDICATION SCHEDULE", "=" * 40]
    reminder_count = 0

    for med in medications:
        med_name = med[0] or ""
        dosage = med[1] or ""
        frequency = (med[2] or "once daily").lower()

        if "as needed" in frequency or "prn" in frequency:
            times = []
        elif "bedtime" in frequency:
            times = ["22:00"]
        elif "twice" in frequency:
            times = ["08:00", "20:00"]
        elif "three" in frequency:
            times = ["08:00", "14:00", "20:00"]
        elif "four" in frequency:
            times = ["08:00", "12:00", "16:00", "20:00"]
        else:
            times = ["08:00"]

        def fmt(t):
            h, m = map(int, t.split(":"))
            if h == 0:
                return f"12:{m:02d} AM"
            elif h < 12:
                return f"{h}:{m:02d} AM"
            elif h == 12:
                return f"12:{m:02d} PM"
            else:
                return f"{h - 12}:{m:02d} PM"

        display_times = ", ".join(fmt(t) for t in times) if times else "As needed"
        lines += [f"\n💊 {med_name.upper()} {dosage}", f"   Frequency: {frequency}", f"   Times: {display_times}"]

        now = datetime.now()
        for time_str in times:
            h, m = map(int, time_str.split(":"))
            remind_at = now.replace(hour=h, minute=m, second=0, microsecond=0)
            if remind_at < now:
                remind_at += timedelta(days=1)
            try:
                _add_reminder(user_id, "medication", f"Take {dosage} of {med_name}", remind_at)
                reminder_count += 1
            except Exception:
                pass

    lines += ["", "=" * 40, f"✅ {reminder_count} reminders created.", "⚠️ Set phone alarms as backup!"]
    return "\n".join(lines)


@tool
def get_medication_info(medication_name: str) -> str:
    """Look up information about a specific medication including its purpose, side effects, warnings, and food instructions."""
    name = medication_name.lower().strip()
    info = MEDICATIONS_DB.get(name)
    if not info:
        return f"No information found for '{medication_name}'. Please check the spelling or consult your pharmacist."
    return (
        f"💊 {name.title()}\n"
        f"Purpose: {info['purpose']}\n"
        f"Side effects: {info['common_side_effects']}\n"
        f"⚠️ Warnings: {info['warnings']}\n"
        f"🍽️ Food: {info['food_instructions']}"
    )


@tool
def generate_visit_summary(user_id: int) -> str:
    """Generate a concise doctor-visit summary based on the patient's recent symptoms, medications, and upcoming appointments."""
    symptoms = _get_symptom_logs(user_id)
    medications = _get_medications(user_id)
    appointments = _get_appointments(user_id)

    symptom_str = "\n".join(
        f"- {s[0]} (Severity: {s[1]}/10) on {s[2].strftime('%b %d, %Y') if hasattr(s[2], 'strftime') else s[2]}"
        for s in symptoms[:10]
    ) or "No symptoms logged."

    med_str = "\n".join(
        f"- {m[0]} {m[1] or ''}: {m[2] or ''}" for m in medications
    ) or "No medications listed."

    appt_str = "\n".join(
        f"- {a[2] or 'Follow-up'} on {a[1].strftime('%b %d, %Y at %I:%M %p') if hasattr(a[1], 'strftime') else a[1]}"
        for a in appointments
    ) or "No upcoming appointments."

    prompt = f"""
You are a medical assistant helping a patient prepare for a doctor's visit.

SYMPTOMS (Recent):
{symptom_str}

CURRENT MEDICATIONS:
{med_str}

UPCOMING APPOINTMENTS:
{appt_str}

Please provide a concise visit summary with:
- Overall health trend (improving/worsening/stable)
- Key concerns to discuss (2-3 bullet points)
- Suggested questions for the doctor (2-3)
- What to bring to the appointment
"""
    try:
        response = _genai_model.generate_content(prompt)
        return f"📊 VISIT SUMMARY\n{'─'*40}\n{response.text}"
    except Exception as e:
        return f"❌ Error generating summary: {str(e)}"


@tool
def get_discharge_instructions(user_id: int) -> str:
    """Retrieve the saved discharge instructions for a patient from the database."""
    rows = _get_discharge_instructions(user_id)
    if not rows:
        return "No discharge instructions found. Try parsing discharge paperwork first."
    lines = ["📋 Discharge Instructions:"]
    for row in rows:
        lines.append(f"  • {row[1]}")
    return "\n".join(lines)


@tool
def consult_discharge_instructions_pdf(query: str, pdf_path: str = "discharge_summary.pdf") -> str:
    """Answer a specific question about a patient's discharge instructions from a PDF file.
    Use this when the patient asks questions about their recovery plan, diet restrictions, or wound care."""
    try:
        reader = PdfReader(pdf_path)
        text = "".join(page.extract_text() for page in reader.pages)
    except FileNotFoundError:
        return "No discharge PDF found. Please upload your discharge instructions file."
    except Exception as e:
        return f"Error reading PDF: {str(e)}"

    prompt = f"""
Based on the following discharge instructions, answer the patient's question.

DISCHARGE INSTRUCTIONS:
{text[:3000]}

PATIENT'S QUESTION:
{query}

Provide a clear, helpful answer based ONLY on the discharge instructions.
If the answer is not found, say so and suggest contacting their doctor.
"""
    try:
        response = _genai_model.generate_content(prompt)
        return response.text
    except Exception as e:
        return f"Error generating answer: {str(e)}"


@tool
def lookup_medical_reference(topic: str) -> str:
    """Look up medication information or warning signs for a medical condition from the internal reference database.
    Use this when a patient asks about a medication or what symptoms to watch for after their procedure."""
    topic_lower = topic.lower().strip()

    if topic_lower in MEDICATIONS_DB:
        info = MEDICATIONS_DB[topic_lower]
        return f"💊 {topic_lower.title()}:\n" + "\n".join(f"  • {k}: {v}" for k, v in info.items())

    for condition, data in WARNING_SIGNS_DB.items():
        if topic_lower in condition.replace("_", " "):
            lines = [f"⚠️ {condition.replace('_', ' ').title()} Warning Signs:", "🚨 EMERGENCY:"]
            lines += [f"  • {s}" for s in data.get("emergency_signs", [])[:3]]
            lines += ["⚠️ URGENT:"]
            lines += [f"  • {s}" for s in data.get("urgent_signs", [])[:3]]
            lines += ["✅ Expected (normal):"]
            lines += [f"  • {s}" for s in data.get("expected_symptoms", [])[:3]]
            return "\n".join(lines)

    partial = [f"💊 {k.title()}: {v.get('purpose', '')}" for k, v in MEDICATIONS_DB.items() if topic_lower in k]
    if partial:
        return "Related medications found:\n" + "\n".join(partial[:3])

    return "No specific reference found. Please consult your healthcare provider."

# ── System Prompt ──────────────────────────────────────────────────────────────

system_prompt = """You are CareCompanion, a supportive AI healthcare assistant for recently discharged patients and their caregivers.

Your goal is to help patients manage their post-discharge recovery by:
- Answering questions about their medications and care instructions
- Logging and monitoring their symptoms over time
- Scheduling and tracking follow-up appointments
- Generating visit summaries to prepare for doctor appointments
- Providing guidance based on their specific medical condition

CRITICAL RULES — you must follow these exactly:
- Always use user_id=1 for every tool call unless explicitly told otherwise
- NEVER summarize or acknowledge discharge information from memory. You MUST call parse_discharge_instructions first, then report what the tool returned.
- NEVER confirm that an appointment was scheduled unless schedule_appointment or parse_discharge_instructions tool actually returned a success message.
- NEVER confirm that a symptom was logged unless log_symptom_check tool actually returned a success message.
- If a patient shares any text that looks like discharge paperwork (medications, appointments, instructions), you MUST call parse_discharge_instructions immediately before responding.
- For any emergency symptoms (chest pain, difficulty breathing, fainting), immediately tell the patient to call 911.
- Never provide a medical diagnosis — you support care, you don't replace doctors.

Tool usage rules:
- parse_discharge_instructions: Call this IMMEDIATELY when patient shares any discharge text. Do not respond without calling it first.
- schedule_appointment: Call this when patient asks to book a specific appointment with a date and time.
- get_appointments: Call this when patient asks about upcoming visits.
- get_discharge_instructions: Call this when patient asks to review their care instructions.
- log_symptom_check: Call this when patient reports any symptom. Always include user_id, symptom, and severity.
- analyze_symptom_trends: Call this when patient wants to review how they have been feeling over time.
- create_medication_schedule: Call this when patient wants their daily medication plan.
- get_medication_info: Call this when patient asks about a specific medication.
- generate_visit_summary: Call this when patient is preparing for a doctor visit. Return the full tool output verbatim with no intro sentence — do not add any text before or after it.
- consult_discharge_instructions_pdf: Call this when patient asks a specific question about their discharge PDF file.
- lookup_medical_reference: Call this when patient asks about medication side effects or condition warning signs.
"""

# ── Agent ──────────────────────────────────────────────────────────────────────

tools = [
    parse_discharge_instructions,
    schedule_appointment,
    get_appointments,
    get_discharge_instructions,
    log_symptom_check,
    analyze_symptom_trends,
    create_medication_schedule,
    get_medication_info,
    generate_visit_summary,
    consult_discharge_instructions_pdf,
    lookup_medical_reference,
]

agent = create_react_agent(
    model=llm,
    tools=tools,
    prompt=system_prompt,
)
