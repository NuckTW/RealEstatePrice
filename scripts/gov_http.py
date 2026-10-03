"""
政府網站 HTTP 共用工具

部分政府網站（fia.gov.tw、plvr.land.moi.gov.tw 等）的憑證鏈缺 Subject Key Identifier，
Python 3.13 起 ssl 預設開啟 VERIFY_X509_STRICT，會以 "Missing Subject Key Identifier" 拒絕連線。
GovCertAdapter 仍完整驗證憑證鏈與主機名，只移除 strict 旗標；Python 3.12 以下行為不變。
"""

from __future__ import annotations

import os
import ssl

import requests


def _context() -> ssl.SSLContext:
    ctx = ssl.create_default_context(cafile=os.environ.get('REQUESTS_CA_BUNDLE') or None)
    ctx.verify_flags &= ~getattr(ssl, 'VERIFY_X509_STRICT', 0)
    return ctx


class GovCertAdapter(requests.adapters.HTTPAdapter):
    def init_poolmanager(self, *args, **kwargs):
        kwargs['ssl_context'] = _context()
        return super().init_poolmanager(*args, **kwargs)

    def proxy_manager_for(self, proxy, **kwargs):
        kwargs['ssl_context'] = _context()
        return super().proxy_manager_for(proxy, **kwargs)


def gov_session(user_agent: str = 'Mozilla/5.0 (tainan-realestate-ai data fetcher)',
                **headers) -> requests.Session:
    s = requests.Session()
    s.headers.update({'User-Agent': user_agent, **headers})
    s.mount('https://', GovCertAdapter())
    return s
