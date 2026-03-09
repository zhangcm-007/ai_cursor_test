import json
import random
from typing import Iterator

import requests
from sseclient import SSEClient

from core.config import config


class APIClient:

    def __init__(self):
        self.session = requests.Session()
        self.base_url = config.app.base_url
        self.user_id = config.app.user_id

    def _generate_sleuth_trace_id(self):
        # 128 位 hex traceId
        return f"{random.getrandbits(128):032x}"

    def _generate_sleuth_span_id(self):
        # 64 位 hex spanId
        return f"{random.getrandbits(64):016x}"

    def get(self, endpoint: str, **kwargs) -> tuple[requests.Response, str]:
        trace_id = self._generate_sleuth_trace_id()
        span_id = self._generate_sleuth_span_id()
        url = f"{self.base_url}{endpoint}"
        headers = kwargs.pop("headers", {})
        headers.update({
            "X-B3-TraceId": trace_id,
            "X-B3-SpanId": span_id,
            "X-B3-Sampled": "1",
            "uid": self.user_id
        })
        response = self.session.get(url, headers=headers, **kwargs)
        return response.json(), trace_id

    def post(self, endpoint: str, **kwargs) -> tuple[requests.Response, str]:
        trace_id = self._generate_sleuth_trace_id()
        span_id = self._generate_sleuth_span_id()
        url = f"{self.base_url}{endpoint}"
        headers = kwargs.pop("headers", {})
        headers.update({
            "Content-Type": "application/json",
            "X-B3-TraceId": trace_id,
            "X-B3-SpanId": span_id,
            "X-B3-Sampled": "1",
            "uid": self.user_id
        })
        return self.session.post(url, headers=headers, **kwargs), trace_id

    def post_sse(self, endpoint: str, **kwargs) -> Iterator[dict]:
        trace_id = self._generate_sleuth_trace_id()
        span_id = self._generate_sleuth_span_id()
        url = f"{self.base_url}{endpoint}"
        headers = kwargs.pop("headers", {})
        headers.update({
            "Accept": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-B3-TraceId": trace_id,
            "X-B3-SpanId": span_id,
            "X-B3-Sampled": "1",
            "uid": self.user_id
        })
        kwargs['stream'] = True
        resp = self.session.post(url,
                                 headers=headers,
                                 timeout=(30, 600),  # (连接超时, 读取超时)
                                 **kwargs)
        resp.raise_for_status()
        client = SSEClient(resp)
        for event in client.events():
            if event.data:
                yield json.loads(event.data), trace_id
