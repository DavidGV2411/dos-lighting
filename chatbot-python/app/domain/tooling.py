from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class ToolContextUpdate:
    known_values: dict[str, Any] = field(default_factory=dict)
    last_missing_fields: list[str] = field(default_factory=list)
    last_recommendation: dict[str, Any] | None = None
    catalogs_loaded: bool = False


@dataclass
class ToolResult:
    output_text: str
    context: ToolContextUpdate = field(default_factory=ToolContextUpdate)


ToolExecutionResult = ToolResult
