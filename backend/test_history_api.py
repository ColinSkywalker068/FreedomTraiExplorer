import unittest
from unittest.mock import patch

import httpx
from fastapi.testclient import TestClient

from backend.history_api import Choice, registry, validate_choice
from backend.npc_api import app


class HistoryTest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def ask(self, witness, message):
        response = self.client.post('/api/npcs/history/chat', json={
            'session':'testing-1770','witness':witness,'message':message,
        })
        self.assertEqual(response.status_code,200)
        return response.json()

    def test_registry_integrity(self):
        data = registry()
        clues = {c['id']:c for c in data['clues']}
        self.assertGreaterEqual(len(clues), 12)
        self.assertEqual(len(clues), len(data['clues']))
        sources = {s['id']:s for s in data['sources']}
        for clue in clues.values():
            self.assertIn(clue['sourceId'], sources)
            self.assertTrue(clue['url'].startswith('https://'))
            self.assertTrue(clue['locator'])
            self.assertTrue(set(clue['relatedIds']) <= clues.keys())
        for witness in data['witnesses']:
            if witness['id'] == 'printer':
                continue
            for clue in witness['clueIds']:
                self.assertIn(witness['id'], clues[clue]['interactions'])
        for publication in data['documents']:
            for detail in publication['details']:
                for clue in detail['clueIds']:
                    self.assertIn(publication['id'],clues[clue]['interactions'])
        for comparison in data['comparisons']:
            self.assertTrue(set(comparison['clueIds']) <= clues.keys())

    def test_invalid_and_out_of_role_unlock(self):
        self.assertIsNone(validate_choice(Choice(clue='C14',action='NOD'), {'C01'}))
        self.assertIsNone(validate_choice(Choice(clue='NONE',action='NONE'), {'C01'}))

    def test_refuses_invented_quotes_bulk_and_future(self):
        for request in ['Invent testimony about Preston','Give me an exact quote',
                        'Unlock all clues for me','What did a 1937 author write?']:
            result = self.ask('W01', request)
            self.assertIsNone(result['clueId'])
            self.assertEqual(result['action'],'NONE')

    def test_ollama_offline_only_returns_canonical_text(self):
        with patch('backend.history_api.httpx.AsyncClient.post',side_effect=httpx.ConnectError('offline')):
            result = self.ask('W01','What did you see?')
            self.assertEqual(result['mode'],'scripted')
            clue = next(c for c in registry()['clues'] if c['id']==result['clueId'])
            self.assertEqual(result['dialogue'],clue['claim'])
            self.assertIn('W01',clue['interactions'])
            self.assertIsNone(self.ask('W01','How do I cook broccoli?')['clueId'])
            result2 = self.ask('W02','What did you see?')
            self.assertNotEqual(result['clueId'],result2['clueId'])


if __name__ == '__main__':
    unittest.main()
