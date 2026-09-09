from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.db.connection import init_db
from app.routers import students, colleges, shortlists, payments


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="College Platform API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(students.router,   prefix="/students",   tags=["students"])
app.include_router(colleges.router,   prefix="/colleges",   tags=["colleges"])
app.include_router(shortlists.router, prefix="/shortlists", tags=["shortlists"])
app.include_router(payments.router,   prefix="/payments",   tags=["payments"])


@app.get("/health")
async def health():
    return {"status": "ok"}