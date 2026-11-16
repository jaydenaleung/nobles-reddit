"""A tiny server for the hand-built summariser.

    uvicorn serve.app:app --port 8000        (run from the ml/ folder)

One endpoint: POST /summarize. It takes a thread and returns a summary, in
exactly the shapes of `AiProvider.summarize` on the site
(functions/src/ai/provider.ts). When the site runs with AI_PROVIDER=local, its
LocalProvider calls this endpoint.

Until you change SUMMARISER below, it answers with the placeholder baseline.
"""

from __future__ import annotations

from typing import Callable, List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from commons_ml import baseline_extractive
from commons_ml.schema import validate_summary

# TODO(student): point this at your own function when it is ready, for example
#   from commons_ml import textrank
#   SUMMARISER = textrank.summarise
SUMMARISER: Callable[[dict], dict] = baseline_extractive.summarise  # type: ignore[assignment]


class Comment(BaseModel):
    n: int
    replyTo: Optional[int] = None
    text: str = Field(max_length=8000)


class Thread(BaseModel):
    """What the site sends. There are no author fields: a summariser is never told who wrote anything."""

    title: str = Field(max_length=400)
    body: str = Field(default="", max_length=20000)
    comments: List[Comment] = Field(default_factory=list, max_length=60)


class Summary(BaseModel):
    text: str
    bullets: List[str]
    agreements: str
    disagreements: str


app = FastAPI(title="Nobles Commons hand-built summariser", version="0.1.0")


@app.get("/healthz")
def healthz() -> dict:
    return {"ok": True, "summariser": f"{SUMMARISER.__module__}.{SUMMARISER.__name__}"}


@app.post("/summarize", response_model=Summary)
def summarize(thread: Thread) -> Summary:
    try:
        result = validate_summary(SUMMARISER(thread.model_dump()))
    except NotImplementedError as error:
        # A TODO(student) that has not been written yet.
        raise HTTPException(status_code=501, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=500, detail=f"The summariser returned something invalid: {error}") from error
    return Summary(**result)
