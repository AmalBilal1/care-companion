from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from langchain_core.messages import HumanMessage
from dotenv import load_dotenv

from app.agent import agent, init_db

load_dotenv()

# Initialize database tables on startup
init_db()

app = FastAPI(
    title="CareCompanion Agent API",
    description="An AI-powered post-discharge healthcare assistant powered by LangGraph",
    version="1.0.0",
)


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    response: str


@app.get("/health")
async def health_check():
    return {"status": "ok"}


@app.get("/debug/patient/{user_id}")
async def debug_patient(user_id: int):
    from app.agent import get_db_connection
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("SELECT medication_name, dosage, schedule FROM medication_logs WHERE user_id=%s", (user_id,))
    medications = [{"name": r[0], "dosage": r[1], "schedule": r[2]} for r in cur.fetchall()]

    cur.execute("SELECT appointment_time, reason FROM appointments WHERE patient_id=%s", (user_id,))
    appointments = [{"time": str(r[0]), "reason": r[1]} for r in cur.fetchall()]

    cur.execute("SELECT instruction FROM discharge_instructions WHERE user_id=%s", (user_id,))
    instructions = [r[0] for r in cur.fetchall()]

    cur.execute("SELECT symptom, severity, logged_at FROM symptom_logs WHERE user_id=%s ORDER BY logged_at DESC", (user_id,))
    symptoms = [{"symptom": r[0], "severity": r[1], "logged_at": str(r[2])} for r in cur.fetchall()]

    cur.close()
    conn.close()
    return {
        "user_id": user_id,
        "medications": medications,
        "appointments": appointments,
        "discharge_instructions": instructions,
        "symptoms": symptoms,
    }


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        result = agent.invoke({
            "messages": [HumanMessage(content=request.message)]
        })
        response_text = result["messages"][-1].content
        return ChatResponse(response=response_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
