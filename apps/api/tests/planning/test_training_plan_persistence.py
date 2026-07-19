from contextlib import contextmanager
from datetime import date
from types import SimpleNamespace

import pytest

from app.modules.auth.context import UserContext
from app.modules.planning import generation_use_case
from app.modules.planning.generation_use_case import (
    GeneratedTrainingBundle,
    generate_and_activate_training_plan,
)
from app.modules.planning.use_cases import (
    TrainingPlanPersistenceUnavailable,
    read_active_training_plan,
)
from tests.planning.test_generate_training_block import candidate


class Repository:
    def __init__(self) -> None:
        self.calls = []
        self.rows = []

    def insert_candidate(self, owner_id, plan):
        self.calls.append(("candidate", owner_id.value, plan))
        return "candidate-id"

    def insert_session(self, plan_id, session):
        self.calls.append(("session", plan_id, session))

    def archive_active(self, owner_id):
        self.calls.append(("archive", owner_id.value))

    def activate_candidate(self, plan_id):
        self.calls.append(("activate", plan_id))

    def read_active_plan(self, owner_id):
        self.calls.append(("read", owner_id.value))
        return self.rows


class Transactions:
    def __init__(self, repository, failure=None) -> None:
        self.repository = repository
        self.failure = failure
        self.rollbacks = 0

    @contextmanager
    def __call__(self, user):
        try:
            yield self.repository
            if self.failure:
                raise self.failure
        except Exception:
            self.rollbacks += 1
            raise


def trusted_context():
    return SimpleNamespace(
        authorized_approach="kaio_path",
        generation_window_start=date(2026, 7, 6),
        goal_date=date(2026, 12, 1),
        provider_context=SimpleNamespace(
            weeks=(SimpleNamespace(window_end=date(2026, 7, 8)),)
        ),
    )


def test_validated_bundle_preserves_the_exact_assembled_context(monkeypatch):
    context = trusted_context()
    block = candidate()
    monkeypatch.setattr(
        generation_use_case,
        "assemble_training_generation_context",
        lambda *args, **kwargs: context,
    )
    monkeypatch.setattr(generation_use_case, "_validation_violations", lambda *a: ())

    provider = SimpleNamespace(generate=lambda _: block)
    bundle = generation_use_case._generate_validated_training_bundle(
        UserContext("verified-owner"),
        object(),
        provider,
        current_instant=lambda: None,
    )

    assert bundle.context is context
    assert bundle.block is block


def test_generation_persists_exact_trusted_mapping_and_verified_owner(monkeypatch):
    repository = Repository()
    transactions = Transactions(repository)
    bundle = GeneratedTrainingBundle(trusted_context(), candidate())
    monkeypatch.setattr(
        "app.modules.planning.generation_use_case._generate_validated_training_bundle",
        lambda *args, **kwargs: bundle,
    )

    plan_id = generate_and_activate_training_plan(
        UserContext("verified-owner"),
        transactions,
        object(),
        current_instant=lambda: None,
    )

    assert plan_id == "candidate-id"
    assert repository.calls[0][0:2] == ("candidate", "verified-owner")
    plan = repository.calls[0][2]
    assert (plan.plan_approach, plan.start_date, plan.end_date, plan.block_focus) == (
        "kaio_path",
        date(2026, 7, 6),
        date(2026, 7, 8),
        "Aerobic consistency",
    )
    sessions = [call[2] for call in repository.calls if call[0] == "session"]
    assert [(item.week_number, item.session_order) for item in sessions] == [
        (1, 1),
        (1, 2),
    ]
    assert [call[0] for call in repository.calls] == [
        "candidate",
        "session",
        "session",
        "archive",
        "activate",
    ]


def test_persistence_failure_is_safely_normalized(monkeypatch):
    repository = Repository()
    transactions = Transactions(repository, RuntimeError("database details"))
    monkeypatch.setattr(
        "app.modules.planning.generation_use_case._generate_validated_training_bundle",
        lambda *args, **kwargs: GeneratedTrainingBundle(trusted_context(), candidate()),
    )

    with pytest.raises(TrainingPlanPersistenceUnavailable) as caught:
        generate_and_activate_training_plan(
            UserContext("verified-owner"),
            transactions,
            object(),
            current_instant=lambda: None,
        )

    assert str(caught.value) == "service_unavailable"
    assert caught.value.__cause__ is None
    assert caught.value.__suppress_context__ is True
    assert "database details" not in str(caught.value)
    assert transactions.rollbacks == 1


def test_active_read_failure_suppresses_raw_database_details():
    repository = Repository()
    repository.read_active_plan = lambda owner_id: (_ for _ in ()).throw(
        RuntimeError("raw active-read database details")
    )

    with pytest.raises(TrainingPlanPersistenceUnavailable) as caught:
        read_active_training_plan(
            UserContext("verified-owner"), Transactions(repository)
        )

    assert str(caught.value) == "service_unavailable"
    assert caught.value.__cause__ is None
    assert caught.value.__suppress_context__ is True
    assert "raw active-read database details" not in str(caught.value)


def active_row(week_number, session_order, scheduled_date, session_type):
    return {
        "plan_id": "plan-id",
        "plan_approach": "mode_z",
        "start_date": date(2026, 7, 6),
        "end_date": date(2026, 7, 19),
        "block_focus": "Durability",
        "week_number": week_number,
        "session_order": session_order,
        "scheduled_date": scheduled_date,
        "session_type": session_type,
        "session_category": "run",
        "planned_duration_minutes": 30,
        "planned_distance_kilometers": 5,
        "planned_elevation_meters": 0,
        "intensity_description": "Easy",
        "target_rpe_min": 2,
        "target_rpe_max": 3,
        "instructions": "Keep easy",
        "purpose": "Consistency",
    }


def test_active_plan_read_is_owner_bound_and_groups_stably():
    repository = Repository()
    repository.rows = [
        active_row(1, 1, date(2026, 7, 6), "Easy run"),
        active_row(2, 1, date(2026, 7, 13), "Long run"),
    ]
    transactions = Transactions(repository)

    plan = read_active_training_plan(UserContext("verified-owner"), transactions)

    assert repository.calls == [("read", "verified-owner")]
    assert plan is not None
    grouped = [
        (week.week_number, [session.session_order for session in week.sessions])
        for week in plan.weeks
    ]
    assert grouped == [(1, [1]), (2, [1])]
    with pytest.raises(AttributeError):
        plan.block_focus = "changed"
