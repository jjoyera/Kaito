"""
Provider isolation guard for the auth boundary.

Scans app/modules/auth/* using AST-based import analysis to assert no provider
leakage:
- No 'supabase' in any import module names or identifiers (AST-level, not docstrings).
- No 'import jwt' (PyJWT is infrastructure-only).
- No Supabase claim tokens 'sub'/'aud' as string literals in code expressions.
- No app.core.auth.* imports except the single allowed composition-seam import
  of 'app.core.auth.provider.get_auth_verifier' in dependencies.py.
- Direct concrete adapter imports (app.core.auth.supabase) are always forbidden.

Also validates that get_current_user works against a fake in-memory AuthVerifier
via app.dependency_overrides (proving the dependency is decoupled from Supabase).
"""

import ast
import importlib
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.modules.auth.context import UserContext
from app.modules.auth.dependencies import get_current_user  # noqa: F401

# ---------------------------------------------------------------------------
# Source paths
# ---------------------------------------------------------------------------

_MODULES_AUTH = Path(__file__).parent.parent.parent / "app" / "modules" / "auth"


def _read_sources() -> dict[str, str]:
    """Return {filename: source} for all .py files in app/modules/auth/."""
    return {f.name: f.read_text() for f in _MODULES_AUTH.glob("*.py")}


def _get_imports(src: str) -> list[tuple[str, str]]:
    """Return (module, alias_or_name) for all import nodes in the AST."""
    tree = ast.parse(src)
    imports: list[tuple[str, str]] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imports.append((alias.name, alias.asname or alias.name))
        elif isinstance(node, ast.ImportFrom):
            module = node.module or ""
            for alias in node.names:
                imports.append((module, alias.name))
    return imports


def _get_code_string_literals(src: str) -> list[str]:
    """Return string literals from non-docstring positions in the AST.

    Excludes module, class, and function docstrings so we only check
    operational string constants.
    """
    tree = ast.parse(src)

    # Collect docstring node ids to exclude.
    docstring_nodes: set[int] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Module):
            body = node.body
        elif isinstance(node, ast.ClassDef | ast.FunctionDef | ast.AsyncFunctionDef):
            body = node.body
        else:
            continue

        if (
            body
            and isinstance(body[0], ast.Expr)
            and isinstance(body[0].value, ast.Constant)
            and isinstance(body[0].value.value, str)
        ):
            docstring_nodes.add(id(body[0].value))

    literals: list[str] = []
    for node in ast.walk(tree):
        if (
            isinstance(node, ast.Constant)
            and isinstance(node.value, str)
            and id(node) not in docstring_nodes
        ):
            literals.append(node.value)
    return literals


# ---------------------------------------------------------------------------
# Source scan: forbidden provider references (AST-based)
# ---------------------------------------------------------------------------


def test_no_supabase_import_in_modules_auth() -> None:
    """No file in app/modules/auth/ may import a module containing 'supabase'."""
    violations = []
    for fname, src in _read_sources().items():
        imports = _get_imports(src)
        for module, name in imports:
            if "supabase" in module.lower() or "supabase" in name.lower():
                violations.append(f"{fname}: import of '{module}.{name}'")
    assert (
        not violations
    ), f"Provider leakage: 'supabase' import found in modules/auth/: {violations}"


def test_no_jwt_import_in_modules_auth() -> None:
    """No file in app/modules/auth/ may import 'jwt' (PyJWT is infrastructure-only)."""
    violations = []
    for fname, src in _read_sources().items():
        imports = _get_imports(src)
        for module, name in imports:
            if module == "jwt" or (module == "" and name == "jwt"):
                violations.append(fname)
    assert (
        not violations
    ), f"Provider leakage: 'import jwt' found in modules/auth/: {violations}"


def test_no_claim_string_literals_in_modules_auth() -> None:
    """Supabase claim names 'sub' and 'aud' must not appear as code string literals.

    Checked via AST excluding docstrings — these names in operational code
    indicate claim extraction that belongs only in the adapter layer.
    """
    violations = []
    for fname, src in _read_sources().items():
        for literal in _get_code_string_literals(src):
            if literal in ("sub", "aud"):
                violations.append(f"{fname}: string literal {literal!r}")
    assert not violations, (
        f"Provider claim names ('sub'/'aud') in code string literals in "
        f"modules/auth/: {violations}"
    )


def test_no_core_auth_imports_except_allowed_seam() -> None:
    """No app/modules/auth/* may import app.core.auth.* except the allowed seam.

    Allowed: exactly 'from app.core.auth.provider import get_auth_verifier'
    in dependencies.py only.
    All other app.core.auth.* imports (including app.core.auth.supabase) are
    always forbidden.
    """
    allowed = ("app.core.auth.provider", "get_auth_verifier")
    violations = []
    for fname, src in _read_sources().items():
        imports = _get_imports(src)
        for module, name in imports:
            if not module.startswith("app.core.auth"):
                continue
            if (module, name) == allowed and fname == "dependencies.py":
                continue  # single allowed composition-seam import
            violations.append(f"{fname}: from {module} import {name}")
    assert (
        not violations
    ), f"Forbidden app.core.auth.* import in modules/auth/: {violations}"


# ---------------------------------------------------------------------------
# Dependency override: get_current_user works with a fake verifier
# ---------------------------------------------------------------------------

_FAKE_USER_ID = "fake-user-99"
_FAKE_EMAIL = "fake@example.com"


class _FakeVerifier:
    """In-memory AuthVerifier that always returns a fixed UserContext."""

    def verify(self, token: str) -> UserContext:  # noqa: ARG002
        return UserContext(user_id=_FAKE_USER_ID, email=_FAKE_EMAIL)


def test_get_current_user_works_with_fake_verifier(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """get_current_user must work with any AuthVerifier via dependency_overrides.

    Proves the dependency is decoupled from the concrete adapter: swapping
    the verifier via app.dependency_overrides suffices.
    """
    # SUPABASE_URL not needed: dependency_overrides bypasses get_auth_verifier.
    import app.main as main_module

    importlib.reload(main_module)
    test_app = main_module.app

    from app.core.auth.provider import get_auth_verifier

    fake = _FakeVerifier()
    test_app.dependency_overrides[get_auth_verifier] = lambda: fake

    try:
        client = TestClient(test_app, raise_server_exceptions=True)
        # Any non-empty bearer string works; the fake verifier ignores the content.
        response = client.get("/auth/me", headers={"Authorization": "Bearer any-token"})
        assert response.status_code == 200
        body = response.json()
        assert body["user_id"] == _FAKE_USER_ID
        assert body["email"] == _FAKE_EMAIL
    finally:
        test_app.dependency_overrides.pop(get_auth_verifier, None)
