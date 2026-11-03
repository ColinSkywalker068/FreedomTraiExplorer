import asyncio
import os
from collections import deque
from time import monotonic

import httpx

PROVIDER = os.getenv('NPC_PROVIDER', 'ollama')
GROQ_MODEL = 'qwen/qwen3.8-27b'
GROQ_KEY = os.getenv('GROQ_API_KEY')
GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
attempts = deque()
cooldown_until = 0.0


class HostedUnavailable(Exception):
    pass


def reserve_turn(visitor):
    now = monotonic()
    while attempts and attempts[0][0] <= now - 86400:
        attempts.popleft()
    if not GROQ_KEY or now < cooldown_until or len(attempts) >= 100:
        raise HostedUnavailable
    if sum(t > now - 60 for t, _ in attempts) >= 3:
        raise HostedUnavailable
    if sum(t > now - 3600 and ip == visitor for t, ip in attempts) >= 12:
        raise HostedUnavailable
    attempts.append((now, visitor))


async def complete(model, ollama, schema, messages, max_tokens, temperature, visitor):
    global cooldown_until
    if PROVIDER == 'ollama':
        async with httpx.AsyncClient(timeout=httpx.Timeout(75, connect=2), trust_env=False) as client:
            response = await client.post(f'{ollama}/api/chat', json={
                'model': model, 'stream': False, 'think': False, 'keep_alive': '2m',
                'format': schema.model_json_schema(), 'messages': messages,
                'options': {'num_ctx': 4096, 'num_predict': max_tokens, 'temperature': temperature},
            })
            response.raise_for_status()
            return schema.model_validate_json(response.json()['message']['content'])
    if PROVIDER != 'groq':
        raise HostedUnavailable
    reserve_turn(visitor)
    try:
        async with asyncio.timeout(12), httpx.AsyncClient(timeout=10, trust_env=False) as client:
            response = await client.post(GROQ_URL, headers={'Authorization': f'Bearer {GROQ_KEY}'}, json={
                'model': GROQ_MODEL, 'messages': [messages[0], *messages[1:][-3:]],
                'reasoning_effort': 'none', 'reasoning_format': 'hidden',
                'temperature': temperature, 'max_completion_tokens': max_tokens,
                'response_format': {'type': 'json_schema', 'json_schema': {
                    'name': schema.__name__, 'strict': True, 'schema': schema.model_json_schema(),
                }},
            })
            if response.status_code == 429:
                delay = response.headers.get('retry-after', '')
                cooldown_until = monotonic() + (max(60, int(delay)) if delay.isdecimal() and len(delay) < 8 else 60)
            response.raise_for_status()
            return schema.model_validate_json(response.json()['choices'][0]['message']['content'])
    except (httpx.HTTPError, TimeoutError, ValueError, KeyError, TypeError, IndexError):
        raise HostedUnavailable from None


def visitor_id(request):
    # Render terminates public traffic at Cloudflare, which sets this header.
    if os.getenv('RENDER') == 'true':
        return request.headers.get('cf-connecting-ip', 'render-unknown')
    return request.client.host if request.client else 'unknown'
