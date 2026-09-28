"""Check which API keys in training/.env are set and working. Never prints a key.

Each check makes one read-only call. Errors show only the HTTP status, because an
exception message can contain the request URL, and some services put the key in it.
"""
import os
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).with_name('.env'))


def key(name):
    return (os.getenv(name) or '').strip()


def roboflow(k):
    r = requests.get('https://api.roboflow.com/', params={'api_key': k}, timeout=20)
    r.raise_for_status()
    return f"workspace '{r.json().get('workspace')}'"


def huggingface(k):
    r = requests.get('https://huggingface.co/api/whoami-v2', headers={'Authorization': f'Bearer {k}'}, timeout=20)
    r.raise_for_status()
    j = r.json()
    role = j.get('auth', {}).get('accessToken', {}).get('role', '?')
    return f"user '{j.get('name')}', token type '{role}'"


def kaggle(k):
    os.environ['KAGGLE_API_TOKEN'] = k
    from kaggle.api.kaggle_api_extended import KaggleApi
    api = KaggleApi()
    api.authenticate()
    found = api.dataset_list(search='sea animals')
    return f"search works ({len(found)} results for 'sea animals')"


def freesound(k):
    r = requests.get('https://freesound.org/apiv2/search/text/', params={'query': 'bubbles', 'page_size': 1, 'token': k}, timeout=20)
    r.raise_for_status()
    return f"search works ({r.json().get('count')} sounds for 'bubbles')"


def data_gov(k):
    # Any api.data.gov key works across the agencies behind it; College Scorecard is a simple one to test.
    r = requests.get('https://api.data.gov/ed/collegescorecard/v1/schools', params={'api_key': k, 'fields': 'id', 'per_page': 1}, timeout=20)
    if not r.ok:  # api.data.gov explains key problems with an error code, e.g. API_KEY_INVALID
        return f"HTTP {r.status_code} {r.json().get('error', {}).get('code', '')}".strip()
    return 'key accepted'


checks = [
    ('ROBOFLOW_API_KEY', roboflow),
    ('HF_TOKEN', huggingface),
    ('KAGGLE_API_TOKEN', kaggle),
    ('FREESOUND_API_KEY', freesound),
    ('DATA_GOV_API_KEY', data_gov),
]

for name, check in checks:
    k = key(name)
    if not k:
        print(f'{name:18} not set')
        continue
    try:
        print(f'{name:18} OK    {check(k)}')
    except requests.HTTPError as e:
        print(f'{name:18} FAIL  HTTP {e.response.status_code}')
    except Exception as e:  # never echo the message: it may contain the key
        print(f'{name:18} FAIL  {type(e).__name__}')
