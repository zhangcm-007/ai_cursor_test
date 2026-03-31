"""Update register endpoint debugDraft to use {{password}} placeholder"""
import json, sqlite3

db = sqlite3.connect(r"d:\ai_code\testing-framework\backend_python\data\python.db")
db.row_factory = sqlite3.Row

eps = db.execute("SELECT id, method, path, debugDraft FROM ApiEndpoint WHERE path LIKE '%register%'").fetchall()
for ep in eps:
    draft_raw = ep["debugDraft"] or "{}"
    try:
        draft = json.loads(draft_raw)
    except:
        continue
    body_str = draft.get("body", "")
    if not body_str:
        continue
    try:
        body = json.loads(body_str)
    except:
        continue
    if isinstance(body, dict) and "password" in body:
        old_val = body["password"]
        if old_val != "{{password}}":
            body["password"] = "{{password}}"
            draft["body"] = json.dumps(body, ensure_ascii=False, indent=2)
            new_draft = json.dumps(draft, ensure_ascii=False)
            db.execute("UPDATE ApiEndpoint SET debugDraft=? WHERE id=?", (new_draft, ep["id"]))
            print(f"{ep['method']} {ep['path']}: password {old_val} -> {{{{password}}}}")

db.commit()
db.close()
print("Done!")
