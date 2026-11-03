import json
import unittest
from unittest.mock import patch

import httpx
from fastapi.testclient import TestClient

from backend import npc_api


class NpcApiTests(unittest.TestCase):
    def setUp(self):
        npc_api.histories.clear()
        self.requests = []
        self.reply = {'dialogue': 'Welcome to the plaza.', 'action': 'POINT_TO_BUILDING', 'source_ids': ['house']}
        self.client = TestClient(npc_api.app)
        original = httpx.AsyncClient
        self.mock = patch.object(httpx, 'AsyncClient', side_effect=lambda **kw: original(transport=httpx.MockTransport(self.infer), **kw))
        self.mock.start()
        self.addCleanup(self.mock.stop)

    def infer(self, request):
        self.requests.append(json.loads(request.content))
        return httpx.Response(200, json={'message': {'content': json.dumps(self.reply)}})

    def send(self, npc='historical-guide', message='What happened here?', session='qa-session'):
        return self.client.post('/api/npcs/chat', json={
            'scene_id': 'old-state-house', 'npc_id': npc, 'session_id': session, 'message': message,
        })

    def test_isolation_followup_and_reset(self):
        self.assertEqual(self.send(message='First guide question').status_code, 200)
        self.assertEqual(self.send('curious-tourist', 'Tourist question').json()['action'], 'NONE')
        self.assertEqual(self.send(message='Follow up').status_code, 200)
        messages = self.requests[-1]['messages']
        self.assertEqual([m['content'] for m in messages if m['role']=='user'], ['First guide question', 'Follow up'])
        self.send(session='other-session')
        self.assertEqual(len(self.requests[-1]['messages']), 2)
        self.assertEqual(self.client.delete('/api/npcs/qa-session/historical-guide').status_code, 204)
        self.send()
        self.assertEqual(len(self.requests[-1]['messages']), 2)

    def test_only_curated_sources_and_valid_actions(self):
        self.assertEqual(self.send().json()['sources'][0]['url'], npc_api.FACTS['house'][1])
        self.reply['action'] = 'TELEPORT'
        self.assertEqual(self.send().status_code, 502)
        self.reply['action'] = 'HIGHLIGHT_MASSACRE_MARKER'
        self.reply['dialogue'] = 'HIGHLIGHT_MASSACRE_MARKER'
        self.assertEqual(self.send().status_code, 502)

    def test_input_and_offline_inference(self):
        self.assertEqual(self.send(message=' ').status_code, 422)
        with patch.object(httpx, 'AsyncClient', side_effect=httpx.ConnectError('offline')):
            self.assertEqual(self.send().status_code, 503)
        self.assertEqual(self.send().status_code, 200)
