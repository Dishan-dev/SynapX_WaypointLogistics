"""Quick integration test for POST /api/v1/driver/upload/photo"""
import urllib.request
import urllib.error
import json
import os

BASE = "http://localhost:8000/api/v1"

# --- Step 1: login ---
import urllib.parse
login_payload = urllib.parse.urlencode({"username": "driver@waypoint.com", "password": "driver123"}).encode()
req = urllib.request.Request(
    f"{BASE}/auth/login",
    data=login_payload,
    headers={"Content-Type": "application/x-www-form-urlencoded"},
)
try:
    resp = urllib.request.urlopen(req, timeout=5)
    token = json.loads(resp.read())["access_token"]
    print(f"[OK] Login  token={token[:30]}...")
except Exception as e:
    print(f"[FAIL] Login: {e}")
    raise SystemExit(1)

# --- Step 2: upload tiny JPEG ---
BOUNDARY = "TestBoundary12345"
IMG_PATH = os.path.join(os.path.dirname(__file__), "test_upload.jpg")

with open(IMG_PATH, "rb") as f:
    img_bytes = f.read()

lines = [
    f"--{BOUNDARY}".encode(),
    b'Content-Disposition: form-data; name="file"; filename="test.jpg"',
    b"Content-Type: image/jpeg",
    b"",
    img_bytes,
    f"--{BOUNDARY}--".encode(),
]
body = b"\r\n".join(lines)

req2 = urllib.request.Request(
    f"{BASE}/driver/upload/photo",
    data=body,
    headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": f"multipart/form-data; boundary={BOUNDARY}",
    },
    method="POST",
)
try:
    resp2 = urllib.request.urlopen(req2, timeout=10)
    result = json.loads(resp2.read())
    print(f"[OK] Upload: {result}")

    # Step 3: verify file is reachable via static URL
    photo_url = result.get("photo_url", "")
    static_req = urllib.request.Request(f"http://localhost:8000{photo_url}")
    static_resp = urllib.request.urlopen(static_req, timeout=5)
    print(f"[OK] Static file served — status {static_resp.status}, size {len(static_resp.read())} bytes")
except urllib.error.HTTPError as e:
    print(f"[FAIL] Upload HTTP {e.code}: {e.read().decode()}")
except Exception as e:
    print(f"[FAIL] Upload: {e}")
