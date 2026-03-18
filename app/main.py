import os
import json
import tempfile
from datetime import date, datetime, timedelta

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
from langchain_core.messages import HumanMessage
from dotenv import load_dotenv

from app.agent import (
    agent, init_db, get_db_connection,
    _log_symptom, _assess_symptom_severity, WARNING_SIGNS_DB, MEDICATIONS_DB,
    _genai_model, _get_symptom_logs, _get_medications, _get_appointments,
    parse_discharge_instructions,
)

load_dotenv()
init_db()

def _iso(dt) -> str | None:
    """Return ISO string with Z suffix so browsers parse as UTC."""
    if dt is None:
        return None
    return dt.isoformat() + "Z"

app = FastAPI(
    title="CareCompanion Agent API",
    description="AI-powered post-discharge healthcare assistant",
    version="2.0.0",
)

# ── Pydantic models ────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    user_email: Optional[str] = None
    user_name: Optional[str] = None

class ChatResponse(BaseModel):
    response: str

class OnboardRequest(BaseModel):
    user_id: int
    name: str
    phone: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    primary_condition: Optional[str] = None
    reminder_preference: Optional[str] = "email"
    preferred_time: Optional[str] = None
    terms_agreed: bool = False

class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    primary_condition: Optional[str] = None
    reminder_preference: Optional[str] = None
    preferred_time: Optional[str] = None
    location: Optional[str] = None
    patient_id_number: Optional[str] = None
    insurance_id: Optional[str] = None
    medical_history: Optional[str] = None

class LogSymptomRequest(BaseModel):
    symptom: str
    severity: int
    condition_type: Optional[str] = None

class AddMedicationRequest(BaseModel):
    user_id: int
    medication_name: str
    dosage: Optional[str] = None
    schedule: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None

class MarkTakenRequest(BaseModel):
    medication_id: int

class AddAppointmentRequest(BaseModel):
    user_id: int
    appointment_time: str
    reason: str
    location: Optional[str] = None
    appointment_type: Optional[str] = "follow-up"
    status: Optional[str] = "upcoming"
    source: Optional[str] = "manual"

class UpdateAppointmentRequest(BaseModel):
    appointment_time: Optional[str] = None
    reason: Optional[str] = None
    location: Optional[str] = None
    appointment_type: Optional[str] = None
    status: Optional[str] = None

class CreateSummaryRequest(BaseModel):
    user_id: int
    title: Optional[str] = "Visit Summary"
    visit_date: Optional[str] = None

class UpdateSummaryRequest(BaseModel):
    user_notes: Optional[str] = None
    title: Optional[str] = None

# ── Helpers ────────────────────────────────────────────────────────────────────

def get_or_create_user(email: str, name: str | None = None) -> dict:
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT user_id, name, onboarded FROM users WHERE email = %s", (email,))
    row = cur.fetchone()
    if row:
        result = {"user_id": row[0], "name": row[1], "email": email, "onboarded": bool(row[2])}
    else:
        cur.execute(
            "INSERT INTO users (name, email, onboarded) VALUES (%s, %s, FALSE) RETURNING user_id",
            (name or email, email),
        )
        user_id = cur.fetchone()[0]
        conn.commit()
        result = {"user_id": user_id, "name": name or email, "email": email, "onboarded": False}
    cur.close()
    conn.close()
    return result

def _generate_patient_id(user_id: int) -> str:
    return f"PT-{user_id:04d}"

# ── Auth / User endpoints ──────────────────────────────────────────────────────

@app.get("/user-by-email/{email:path}")
async def user_by_email(email: str):
    try:
        return get_or_create_user(email)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/onboard")
async def onboard_user(req: OnboardRequest):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        patient_id = _generate_patient_id(req.user_id)
        cur.execute("""
            UPDATE users SET
              name = %s, phone = %s, date_of_birth = %s,
              gender = %s, primary_condition = %s,
              reminder_preference = %s, preferred_time = %s,
              patient_id_number = %s, onboarded = TRUE
            WHERE user_id = %s
        """, (req.name, req.phone, req.date_of_birth, req.gender,
              req.primary_condition, req.reminder_preference,
              req.preferred_time, patient_id, req.user_id))
        conn.commit()
        return {"success": True, "user_id": req.user_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.get("/profile/{user_id}")
async def get_profile(user_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT user_id, name, email, phone, date_of_birth, gender,
                   primary_condition, reminder_preference, preferred_time,
                   location, patient_id_number, insurance_id, medical_history,
                   onboarded, google_refresh_token, created_at
            FROM users WHERE user_id = %s
        """, (user_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        keys = ["user_id","name","email","phone","date_of_birth","gender",
                "primary_condition","reminder_preference","preferred_time",
                "location","patient_id_number","insurance_id","medical_history",
                "onboarded","google_refresh_token","created_at"]
        profile = dict(zip(keys, row))
        # Serialize non-JSON-serializable types
        for k, v in profile.items():
            if isinstance(v, (date, datetime)):
                profile[k] = _iso(v) if isinstance(v, datetime) else v.isoformat()
        profile["calendar_connected"] = bool(profile.get("google_refresh_token"))
        profile.pop("google_refresh_token", None)  # never send token to frontend
        return profile
    finally:
        cur.close()
        conn.close()

@app.put("/profile/{user_id}")
async def update_profile(user_id: int, req: ProfileUpdateRequest):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        fields = req.model_dump(exclude_none=True)
        if not fields:
            return {"success": True}
        set_clause = ", ".join(f"{k} = %s" for k in fields)
        values = list(fields.values()) + [user_id]
        cur.execute(f"UPDATE users SET {set_clause} WHERE user_id = %s", values)
        conn.commit()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

# ── Google Calendar OAuth ──────────────────────────────────────────────────────

@app.get("/auth/google/calendar")
async def google_calendar_auth(user_id: int):
    """Returns the Google OAuth URL for calendar access."""
    import urllib.parse
    client_id = os.environ["GOOGLE_CLIENT_ID"]
    redirect_uri = os.environ.get("CALENDAR_REDIRECT_URI", "http://localhost:8000/auth/google/calendar/callback")
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "https://www.googleapis.com/auth/calendar.events",
        "access_type": "offline",
        "prompt": "consent",
        "state": str(user_id),
    }
    auth_url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params)
    return {"auth_url": auth_url}

@app.get("/auth/google/calendar/callback")
async def google_calendar_callback(code: str, state: str):
    """Handles OAuth callback, stores refresh token, redirects to frontend."""
    import requests as http_requests
    import urllib.parse
    from fastapi.responses import RedirectResponse
    try:
        redirect_uri = os.environ.get("CALENDAR_REDIRECT_URI", "http://localhost:8000/auth/google/calendar/callback")
        token_resp = http_requests.post("https://oauth2.googleapis.com/token", data={
            "code": code,
            "client_id": os.environ["GOOGLE_CLIENT_ID"],
            "client_secret": os.environ["GOOGLE_CLIENT_SECRET"],
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        })
        token_data = token_resp.json()
        refresh_token = token_data.get("refresh_token")
        if not refresh_token:
            raise Exception(f"No refresh token returned: {token_data}")
        user_id = int(state)
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("UPDATE users SET google_refresh_token = %s WHERE user_id = %s", (refresh_token, user_id))
        conn.commit()
        cur.close()
        conn.close()
        return RedirectResponse(url="/dashboard?calendar=connected")
    except Exception as e:
        return RedirectResponse(url=f"/dashboard?calendar=error&msg={urllib.parse.quote(str(e))}")

# ── Health ─────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    return {"status": "ok"}

# ── Symptoms ───────────────────────────────────────────────────────────────────

@app.get("/symptoms/{user_id}")
async def get_symptoms(user_id: int, local_date: Optional[str] = None, utc_offset: Optional[int] = 0):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        try:
            today = date.fromisoformat(local_date) if local_date else date.today()
        except ValueError:
            today = date.today()
        # Use UTC window based on local date + offset
        utc_offset_hours = int(utc_offset or 0)
        utc_start = datetime.combine(today, datetime.min.time()) - timedelta(hours=utc_offset_hours)
        utc_end = utc_start + timedelta(hours=24)
        cur.execute("""
            SELECT symptom_id, symptom, severity, condition_type, logged_at
            FROM symptom_logs
            WHERE user_id = %s AND logged_at >= %s AND logged_at < %s
            ORDER BY logged_at DESC
        """, (user_id, utc_start, utc_end))
        today_rows = [
            {"symptom_id": r[0], "symptom": r[1], "severity": r[2],
             "condition_type": r[3], "logged_at": _iso(r[4])}
            for r in cur.fetchall()
        ]

        # 7-day trend
        trend = []
        for i in range(6, -1, -1):
            d = today - timedelta(days=i)
            d_start = datetime.combine(d, datetime.min.time()) - timedelta(hours=utc_offset_hours)
            d_end = d_start + timedelta(hours=24)
            cur.execute("""
                SELECT AVG(severity), COUNT(*)
                FROM symptom_logs
                WHERE user_id = %s AND logged_at >= %s AND logged_at < %s
            """, (user_id, d_start, d_end))
            row = cur.fetchone()
            trend.append({
                "date": d.isoformat(),
                "avg_severity": round(float(row[0]), 1) if row[0] else 0,
                "count": row[1] or 0,
            })

        # Last logged
        cur.execute("""
            SELECT symptom, logged_at FROM symptom_logs
            WHERE user_id = %s ORDER BY logged_at DESC LIMIT 1
        """, (user_id,))
        last = cur.fetchone()
        last_logged = {"symptom": last[0], "logged_at": _iso(last[1])} if last else None

        return {"today": today_rows, "trend": trend, "last_logged": last_logged}
    finally:
        cur.close()
        conn.close()

@app.post("/symptoms/{user_id}")
async def log_symptom(user_id: int, req: LogSymptomRequest):
    try:
        symptom_id = _log_symptom(user_id, req.symptom, req.severity)
        assessment = {"level": "normal", "reason": "Mild symptom."}
        if req.condition_type and req.condition_type in WARNING_SIGNS_DB:
            assessment = _assess_symptom_severity(
                req.symptom, req.severity, WARNING_SIGNS_DB[req.condition_type]
            )
        return {"symptom_id": symptom_id, "assessment_level": assessment["level"],
                "assessment_reason": assessment["reason"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Medications ────────────────────────────────────────────────────────────────

@app.get("/medications/{user_id}")
async def get_medications(user_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        today = date.today()
        cur.execute("""
            SELECT m.medication_id, m.medication_name, m.dosage, m.schedule,
                   m.start_date, m.end_date, m.created_at,
                   CASE WHEN t.taken_id IS NOT NULL THEN TRUE ELSE FALSE END as taken_today
            FROM medication_logs m
            LEFT JOIN medication_taken t
              ON t.medication_id = m.medication_id AND t.taken_date = %s
            WHERE m.user_id = %s
            ORDER BY m.created_at
        """, (today, user_id))
        rows = cur.fetchall()
        meds = []
        for r in rows:
            freq = (r[3] or "once daily").lower()
            if "twice" in freq:
                times = ["08:00", "20:00"]
            elif "three" in freq:
                times = ["08:00", "14:00", "20:00"]
            elif "four" in freq:
                times = ["08:00", "12:00", "16:00", "20:00"]
            elif "bedtime" in freq:
                times = ["22:00"]
            elif "as needed" in freq or "prn" in freq:
                times = []
            else:
                times = ["08:00"]
            now_str = datetime.now().strftime("%H:%M")
            next_dose = next((t for t in times if t > now_str), times[0] if times else None)
            meds.append({
                "medication_id": r[0],
                "medication_name": r[1],
                "dosage": r[2],
                "schedule": r[3],
                "start_date": r[4].isoformat() if r[4] else None,
                "end_date": r[5].isoformat() if r[5] else None,
                "created_at": _iso(r[6]),
                "taken_today": bool(r[7]),
                "next_dose_time": next_dose,
            })
        return {"medications": meds}
    finally:
        cur.close()
        conn.close()

@app.post("/medications/{user_id}/taken")
async def mark_medication_taken(user_id: int, req: MarkTakenRequest):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO medication_taken (user_id, medication_id, taken_date)
            VALUES (%s, %s, CURRENT_DATE)
            ON CONFLICT (medication_id, taken_date) DO NOTHING
        """, (user_id, req.medication_id))
        conn.commit()
        return {"success": True, "taken_at": _iso(datetime.now())}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.post("/medications")
async def add_medication(req: AddMedicationRequest):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO medication_logs (user_id, medication_name, dosage, schedule, start_date, end_date)
            VALUES (%s, %s, %s, %s, %s, %s) RETURNING medication_id
        """, (req.user_id, req.medication_name, req.dosage, req.schedule,
              req.start_date, req.end_date))
        med_id = cur.fetchone()[0]
        conn.commit()
        # Try to add recurring calendar reminders
        cur.execute("SELECT google_refresh_token FROM users WHERE user_id = %s", (req.user_id,))
        token_row = cur.fetchone()
        if token_row and token_row[0]:
            from app.agent import _create_recurring_medication_events
            event_ids = _create_recurring_medication_events(
                token_row[0],
                req.medication_name,
                req.dosage or "",
                req.schedule or "once daily",
                req.start_date,
                req.end_date,
            )
            if event_ids:
                cur.execute("UPDATE medication_logs SET calendar_event_id = %s WHERE medication_id = %s", (event_ids[0], med_id))
                conn.commit()
        return {"medication_id": med_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.get("/medication-info/{name}")
async def medication_info(name: str):
    info = MEDICATIONS_DB.get(name.lower().strip())
    if not info:
        return {"found": False, "name": name}
    return {"found": True, "name": name, **info}

# ── Appointments ───────────────────────────────────────────────────────────────

@app.get("/appointments/{user_id}")
async def get_appointments_api(user_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT id, appointment_time, reason, location, appointment_type, status, source, created_at
            FROM appointments WHERE patient_id = %s ORDER BY appointment_time
        """, (user_id,))
        rows = cur.fetchall()
        def row_to_dict(r):
            return {
                "id": r[0],
                "appointment_time": r[1].isoformat() if r[1] else None,
                "reason": r[2],
                "location": r[3],
                "appointment_type": r[4] or "follow-up",
                "status": r[5] or "upcoming",
                "source": r[6] or "manual",
                "created_at": _iso(r[7]),
            }
        upcoming = [row_to_dict(r) for r in rows if (r[5] or "upcoming") == "upcoming"]
        completed = [row_to_dict(r) for r in rows if (r[5] or "upcoming") == "completed"]
        next_appt = upcoming[0] if upcoming else None
        return {"upcoming": upcoming, "completed": completed, "next_appointment": next_appt}
    finally:
        cur.close()
        conn.close()

@app.post("/appointments")
async def add_appointment(req: AddAppointmentRequest):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO appointments (patient_id, appointment_time, reason, location,
                                      appointment_type, status, source)
            VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id
        """, (req.user_id, req.appointment_time, req.reason, req.location,
              req.appointment_type, req.status, req.source))
        appt_id = cur.fetchone()[0]
        conn.commit()
        # Try to add to Google Calendar
        cur.execute("SELECT google_refresh_token FROM users WHERE user_id = %s", (req.user_id,))
        token_row = cur.fetchone()
        if token_row and token_row[0]:
            from app.agent import _create_calendar_event
            from datetime import datetime as dt
            appt_dt = dt.fromisoformat(req.appointment_time) if isinstance(req.appointment_time, str) else req.appointment_time
            event_id = _create_calendar_event(
                token_row[0],
                f"🏥 {req.reason}",
                f"Appointment type: {req.appointment_type or 'follow-up'}\nLocation: {req.location or 'TBD'}",
                appt_dt,
                60,
            )
            if event_id:
                cur.execute("UPDATE appointments SET calendar_event_id = %s WHERE id = %s", (event_id, appt_id))
                conn.commit()
        return {"id": appt_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.put("/appointments/{appt_id}")
async def update_appointment(appt_id: int, req: UpdateAppointmentRequest):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        fields = req.model_dump(exclude_none=True)
        if not fields:
            return {"success": True}
        set_clause = ", ".join(f"{k} = %s" for k in fields)
        values = list(fields.values()) + [appt_id]
        cur.execute(f"UPDATE appointments SET {set_clause} WHERE id = %s", values)
        conn.commit()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

# ── Summaries ──────────────────────────────────────────────────────────────────

@app.get("/summaries/{user_id}")
async def get_summaries(user_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT summary_id, title, ai_summary, user_notes, visit_date, created_at
            FROM visit_summaries WHERE user_id = %s ORDER BY created_at DESC
        """, (user_id,))
        rows = cur.fetchall()
        summaries = [{
            "summary_id": r[0], "title": r[1], "ai_summary": r[2],
            "user_notes": r[3],
            "visit_date": r[4].isoformat() if r[4] else None,
            "created_at": _iso(r[5]),
        } for r in rows]
        last_date = summaries[0]["created_at"] if summaries else None
        return {"summaries": summaries, "last_summary_date": last_date}
    finally:
        cur.close()
        conn.close()

@app.post("/summaries")
async def create_summary(req: CreateSummaryRequest):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        symptoms = _get_symptom_logs(req.user_id)
        medications = _get_medications(req.user_id)
        appointments = _get_appointments(req.user_id)

        symptom_str = "\n".join(
            f"- {s[0]} (Severity: {s[1]}/10) on {s[2].strftime('%b %d') if hasattr(s[2],'strftime') else s[2]}"
            for s in symptoms[:10]
        ) or "No symptoms logged."
        med_str = "\n".join(f"- {m[0]} {m[1] or ''}: {m[2] or ''}" for m in medications) or "No medications."
        appt_str = "\n".join(
            f"- {a[2] or 'Follow-up'} on {a[1].strftime('%b %d, %Y') if hasattr(a[1],'strftime') else a[1]}"
            for a in appointments
        ) or "No upcoming appointments."

        prompt = f"""You are a medical assistant helping a patient prepare for a doctor's visit.

SYMPTOMS (Recent):
{symptom_str}

CURRENT MEDICATIONS:
{med_str}

UPCOMING APPOINTMENTS:
{appt_str}

Generate a concise, professional visit summary with:
- Overall health trend (improving/worsening/stable)
- Key concerns to discuss with the doctor (2-3 bullet points)
- Suggested questions for the doctor (2-3)
- What to bring to the appointment
"""
        response = _genai_model.generate_content(prompt)
        ai_text = response.text

        cur.execute("""
            INSERT INTO visit_summaries (user_id, title, ai_summary, visit_date)
            VALUES (%s, %s, %s, %s) RETURNING summary_id
        """, (req.user_id, req.title, ai_text, req.visit_date or date.today().isoformat()))
        summary_id = cur.fetchone()[0]
        conn.commit()
        return {"summary_id": summary_id, "title": req.title, "ai_summary": ai_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.put("/summaries/{summary_id}")
async def update_summary(summary_id: int, req: UpdateSummaryRequest):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        fields = req.model_dump(exclude_none=True)
        if not fields:
            return {"success": True}
        set_clause = ", ".join(f"{k} = %s" for k in fields)
        values = list(fields.values()) + [summary_id]
        cur.execute(f"UPDATE visit_summaries SET {set_clause} WHERE summary_id = %s", values)
        conn.commit()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

# ── Discharge PDF upload ───────────────────────────────────────────────────────

@app.post("/upload-discharge")
async def upload_discharge(user_id: int = Form(...), file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    contents = await file.read()
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(contents)
            tmp_path = tmp.name
        from pypdf import PdfReader
        reader = PdfReader(tmp_path)
        text = "".join(page.extract_text() or "" for page in reader.pages)
        if not text.strip():
            raise HTTPException(status_code=422, detail="Could not extract text from PDF.")
        result = parse_discharge_instructions.invoke({"user_id": user_id, "discharge_text": text})
        # Parse counts from result string
        import re
        meds = int(m.group(1)) if (m := re.search(r"Medications added: (\d+)", result)) else 0
        appts = int(m.group(1)) if (m := re.search(r"Appointments scheduled: (\d+)", result)) else 0
        instrs = int(m.group(1)) if (m := re.search(r"Care instructions saved: (\d+)", result)) else 0
        return {"medications_added": meds, "appointments_scheduled": appts,
                "instructions_saved": instrs, "raw_result": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)

# ── Chat ───────────────────────────────────────────────────────────────────────

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        if request.user_email:
            user_data = get_or_create_user(request.user_email, request.user_name)
            user_id = user_data["user_id"]
        else:
            user_id = 1
        message_with_id = f"[user_id={user_id}] {request.message}"
        result = agent.invoke({"messages": [HumanMessage(content=message_with_id)]})
        response_text = result["messages"][-1].content
        return ChatResponse(response=response_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Static / SPA ───────────────────────────────────────────────────────────────

_static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(_static_dir):
    _assets_dir = os.path.join(_static_dir, "assets")
    if os.path.exists(_assets_dir):
        app.mount("/assets", StaticFiles(directory=_assets_dir), name="assets")

@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    index = os.path.join(_static_dir, "index.html")
    if os.path.exists(index):
        return FileResponse(index)
    return {"message": "CareCompanion API running. Frontend not built yet."}
