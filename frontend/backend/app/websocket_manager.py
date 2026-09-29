import asyncio
import json
import logging
from typing import Dict

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Manages active WebSocket connections keyed by user_id.
    Supports broadcasting JSON messages to individual users.
    """

    def __init__(self):
        # user_id → list of active WebSocket connections (same user, multiple tabs)
        self._connections: Dict[int, list[WebSocket]] = {}

    async def connect(self, user_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.setdefault(user_id, []).append(websocket)
        logger.info("WS connected: user=%d, total_connections=%d", user_id, len(self._connections[user_id]))

    def disconnect(self, user_id: int, websocket: WebSocket) -> None:
        conns = self._connections.get(user_id, [])
        if websocket in conns:
            conns.remove(websocket)
        if not conns:
            self._connections.pop(user_id, None)
        logger.info("WS disconnected: user=%d", user_id)

    async def send_to_user(self, user_id: int, message: dict) -> None:
        """Send a JSON message to all connections for a given user."""
        conns = self._connections.get(user_id, [])
        dead: list[WebSocket] = []
        for ws in conns:
            try:
                await ws.send_text(json.dumps(message))
            except Exception as exc:
                logger.warning("WS send failed for user=%d: %s", user_id, exc)
                dead.append(ws)
        for ws in dead:
            self.disconnect(user_id, ws)

    @property
    def active_users(self) -> list[int]:
        return list(self._connections.keys())


# Singleton instance shared across routers
manager = ConnectionManager()
