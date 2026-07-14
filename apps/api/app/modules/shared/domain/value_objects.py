from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class UserId:
    value: str

    def __post_init__(self) -> None:
        if not isinstance(self.value, str) or not self.value.strip():
            raise ValueError("invalid_user_id")
        object.__setattr__(self, "value", self.value.strip())
