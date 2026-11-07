from abc import ABC, abstractmethod
from typing import ClassVar

from adintel.agents.llm import LlmGateway
from adintel.agents.state import RunState


class SubAgent(ABC):
    name: ClassVar[str]
    title: ClassVar[str]
    mandate: ClassVar[str]

    def __init__(self, llm: LlmGateway):
        self.llm = llm

    async def __call__(self, state: RunState) -> None:
        await state.emit("agent_start", self.name, title=self.title)
        await state.set_owner_status(self.name, "in_progress")
        await self.run(state)
        await state.set_owner_status(self.name, "done")
        await state.emit("agent_end", self.name, title=self.title)

    def session(self, state: RunState) -> str:
        return f"{state.run_id}:{self.name}"

    @abstractmethod
    async def run(self, state: RunState) -> None:
        ...
