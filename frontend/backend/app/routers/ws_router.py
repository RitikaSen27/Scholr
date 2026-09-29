import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, HTTPException

from app.auth import decode_token
from app.database import SessionLocal
from app import models
from app.websocket_manager import manager

logger = logging.getLogger(__name__)
router = APIRouter(tags=["websocket"])


@router.websocket("/ws/{user_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    user_id: int,
    token: str = Query(...),
):
    """
    Authenticated WebSocket endpoint.
    Clients connect with: ws://host/ws/{user_id}?token=<access_token>
    """
    # Validate token
    try:
        payload = decode_token(token)
        token_user_id = int(payload.get("sub", 0))
        if token_user_id != user_id or payload.get("type") != "access":
            await websocket.close(code=4001)
            return
    except HTTPException:
        await websocket.close(code=4001)
        return

    # Verify user exists in DB
    db = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if not user:
            await websocket.close(code=4001)
            return
    finally:
        db.close()

    await manager.connect(user_id, websocket)
    logger.info("WebSocket connected: user_id=%d", user_id)

    try:
        while True:
            # Keep the connection alive; client can send pings
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
        logger.info("WebSocket disconnected: user_id=%d", user_id)
