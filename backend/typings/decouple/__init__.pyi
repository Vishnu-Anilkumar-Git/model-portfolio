from typing import Any, Callable, Optional, Sequence, TypeVar

_T = TypeVar("_T")

class Csv:
    def __call__(self, value: str) -> list[str]: ...

def config(
    search_path: Optional[Sequence[str]] = ...,
    cast: Optional[Callable[[str], _T] | type[_T] | Csv] = ...,
    default: Optional[_T] = ...,
    **kwargs: Any,
) -> Any: ...
