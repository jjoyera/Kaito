"""Opt-in private local diagnostics for training-plan generation."""

import json
import os
import stat
from collections.abc import Iterator
from contextlib import contextmanager
from contextvars import ContextVar, Token
from dataclasses import asdict, dataclass, fields, is_dataclass
from datetime import UTC, date, datetime
from decimal import Decimal
from enum import Enum
from pathlib import Path
from uuid import uuid4

DIAGNOSTIC_DIRECTORY_ENV = "KAITO_TRAINING_GENERATION_DIAGNOSTIC_DIR"


@dataclass(slots=True)
class _AttemptState:
    diagnostic_id: str
    attempt: int
    directory: Path
    payload: dict[str, object] | None = None
    written: bool = False


_current_attempt: ContextVar[_AttemptState | None] = ContextVar(
    "training_generation_diagnostic_attempt", default=None
)


def diagnostic_capture_active() -> bool:
    """Return whether a safe absolute diagnostic directory is configured."""
    return _configured_directory() is not None


@contextmanager
def training_generation_attempt(attempt: int) -> Iterator[None]:
    """Correlate provider and validation capture for one synchronous attempt."""
    directory = _configured_directory()
    if directory is None:
        yield
        return
    state = _AttemptState(uuid4().hex, attempt, directory)
    token: Token[_AttemptState | None] = _current_attempt.set(state)
    try:
        yield
    finally:
        _current_attempt.reset(token)


def capture_provider_attempt(
    *,
    prompt_version: str,
    model: str,
    prompt: str,
    structured_schema: object,
    raw_response: object,
    parsed: object,
    elapsed_ms: int,
) -> None:
    """Persist the provider exchange using SDK/Pydantic safe dump APIs only."""
    state = _current_attempt.get()
    if state is None:
        return
    state.payload = _base_payload(
        state,
        prompt_version=prompt_version,
        model=model,
        prompt=prompt,
        structured_schema=structured_schema,
        elapsed_ms=elapsed_ms,
    )
    state.payload.update(
        {
            "raw_response": _safe_model_dump(raw_response),
            "parsed_training_block": _safe_model_dump(parsed),
            "outcome": "provider_completed",
            "failure": None,
            "violations": [],
            "accepted": None,
        }
    )
    _persist(state)


def capture_provider_failure(
    *,
    prompt_version: str,
    model: str,
    prompt: str,
    structured_schema: object,
    elapsed_ms: int,
    category: str,
    status: int | None = None,
    code: str | None = None,
) -> None:
    """Persist only allowlisted failure metadata, never provider error content."""
    state = _current_attempt.get()
    if state is None:
        return
    failure: dict[str, object] = {"category": category}
    if isinstance(status, int) and 100 <= status <= 599:
        failure["status"] = status
    if isinstance(code, str):
        failure["code"] = code
    state.payload = _base_payload(
        state,
        prompt_version=prompt_version,
        model=model,
        prompt=prompt,
        structured_schema=structured_schema,
        elapsed_ms=elapsed_ms,
    )
    state.payload.update(
        {
            "raw_response": None,
            "parsed_training_block": None,
            "outcome": "provider_failed",
            "failure": failure,
            "violations": [],
            "accepted": False,
        }
    )
    _persist(state)


def record_provider_response_outcome(outcome: str) -> None:
    """Mark a safely dumped response as refused or structurally invalid."""
    state = _current_attempt.get()
    if state is None or state.payload is None:
        return
    state.payload["outcome"] = outcome
    state.payload["accepted"] = False
    _persist(state)


def record_validation(violations: tuple[object, ...], *, accepted: bool) -> None:
    """Append deterministic semantic validation without provider-specific imports."""
    state = _current_attempt.get()
    if state is None or state.payload is None:
        return
    state.payload["violations"] = [_violation_payload(item) for item in violations]
    state.payload["accepted"] = accepted
    state.payload["outcome"] = "accepted" if accepted else "rejected"
    _persist(state)


def _configured_directory() -> Path | None:
    raw = os.environ.get(DIAGNOSTIC_DIRECTORY_ENV)
    if not raw:
        return None
    path = Path(raw)
    if not path.is_absolute() or ".." in path.parts:
        return None
    return path


def _base_payload(
    state: _AttemptState,
    *,
    prompt_version: str,
    model: str,
    prompt: str,
    structured_schema: object,
    elapsed_ms: int,
) -> dict[str, object]:
    return {
        "diagnostic_id": state.diagnostic_id,
        "timestamp": datetime.now(UTC).isoformat(),
        "correlation": {
            "diagnostic_id": state.diagnostic_id,
            "attempt": state.attempt,
            "prompt_version": prompt_version,
            "model": model,
        },
        "prompt": prompt,
        "structured_schema": _json_safe(structured_schema),
        "elapsed_ms": max(0, int(elapsed_ms)),
    }


def _safe_model_dump(value: object) -> object:
    dump = getattr(value, "model_dump", None)
    if not callable(dump):
        return None
    try:
        return _json_safe(dump(mode="json"))
    except Exception:
        return None


def _violation_payload(value: object) -> dict[str, object]:
    if not is_dataclass(value):
        return {"code": "unserializable_violation"}
    return {
        field.name: _json_safe(getattr(value, field.name)) for field in fields(value)
    }


def _json_safe(value: object) -> object:
    if value is None or isinstance(value, str | int | float | bool):
        return value
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, date | datetime):
        return value.isoformat()
    if isinstance(value, Enum):
        return _json_safe(value.value)
    if is_dataclass(value):
        return _json_safe(asdict(value))
    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}
    if isinstance(value, list | tuple):
        return [_json_safe(item) for item in value]
    return None


def _persist(state: _AttemptState) -> None:
    if state.payload is None:
        return
    directory_fd: int | None = None
    try:
        directory_fd = _open_private_directory(state.directory)
        target = f"{state.diagnostic_id}.json"
        if not state.written:
            try:
                os.stat(target, dir_fd=directory_fd, follow_symlinks=False)
            except FileNotFoundError:
                pass
            else:
                return
        temporary = f".{state.diagnostic_id}.{uuid4().hex}.tmp"
        flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
        if hasattr(os, "O_NOFOLLOW"):
            flags |= os.O_NOFOLLOW
        file_fd = os.open(temporary, flags, 0o600, dir_fd=directory_fd)
        try:
            content = json.dumps(
                state.payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")
            ).encode("utf-8")
            with os.fdopen(file_fd, "wb", closefd=False) as stream:
                stream.write(content)
                stream.flush()
                os.fsync(stream.fileno())
            os.chmod(file_fd, 0o600)
        finally:
            os.close(file_fd)
        os.replace(
            temporary,
            target,
            src_dir_fd=directory_fd,
            dst_dir_fd=directory_fd,
        )
        state.written = True
    except Exception:
        return
    finally:
        if directory_fd is not None:
            os.close(directory_fd)


def _open_private_directory(path: Path) -> int:
    if os.name != "posix":  # pragma: no cover - exercised on supported POSIX targets
        path.mkdir(mode=0o700, parents=True, exist_ok=True)
        if path.is_symlink():
            raise OSError("diagnostic_directory_symlink")
        return os.open(path, os.O_RDONLY)

    flags = os.O_RDONLY | os.O_DIRECTORY
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    current_fd = os.open(path.anchor, flags)
    try:
        for component in path.parts[1:]:
            try:
                next_fd = os.open(component, flags, dir_fd=current_fd)
            except FileNotFoundError:
                os.mkdir(component, 0o700, dir_fd=current_fd)
                next_fd = os.open(component, flags, dir_fd=current_fd)
            os.close(current_fd)
            current_fd = next_fd
        os.fchmod(current_fd, stat.S_IRWXU)
        return current_fd
    except BaseException:
        os.close(current_fd)
        raise
