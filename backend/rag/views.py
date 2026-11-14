import json
import threading

from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST

from .engine import INDEX_PATH, RagUnavailable, answer

_generation = threading.BoundedSemaphore(1)


@require_GET
def status(request):
    return JsonResponse({"index_present": INDEX_PATH.exists(), "provider": "local_ollama"})


@require_POST
def chat(request):
    if len(request.body) > 24000:
        return JsonResponse({"error": "Chat request is too large"}, status=413)
    try:
        body = json.loads(request.body)
        question = body["message"]
        if "history" in body or not isinstance(question, str) or not question.strip() or len(question) > 2000:
            raise ValueError
    except (ValueError, KeyError, TypeError, UnicodeDecodeError):
        return JsonResponse({"error": "Provide a standalone message (1–2000 characters), without history"}, status=400)
    if not _generation.acquire(blocking=False):
        return JsonResponse({"error": "The local model is answering another question. Please try again shortly."}, status=429)
    try:
        return JsonResponse(answer(question.strip()))
    except RagUnavailable as exc:
        return JsonResponse({"error": str(exc)}, status=503)
    finally:
        _generation.release()
